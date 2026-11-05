// Запуск: node --test functions/finddriveSync.test.js
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { sign, verify } = require("./syncAuth");
const core = require("./finddriveCore");

const DATE = "2026-11-10"; // вівторок
const NOW = core.kyivLocalToMs("2026-11-05", "12:00"); // 5 листопада, 12:00 Київ
const SECRET = "test-secret";
const weekAll = Array.from({ length: 7 }, () => ({ enabled: true, start: 9, end: 18, lunchEnabled: true, lunchStart: 12, lunchEnd: 13 }));
const settings = { weekSchedule: weekAll, lunchEnabled: true, lunchStart: 12, lunchEnd: 13 };
const free = (t, extra = {}) => ({ time: t, available: true, ...extra });
const hour = (h, extra) => [`slot${String(h).padStart(2, "0")}00`, free(`${String(h).padStart(2, "0")}:00`, extra)];
const mkDay = (hours, extraByHour = {}) => Object.fromEntries(hours.map((h) => hour(h, extraByHour[h])));
const open = (day, s = settings, nowMs = NOW) => core.computeOpenSlots({ day, date: DATE, settings: s, nowMs });

// ─── відкриті слоти ────────────────────────────────────────────────

test("вільні слоти повертаються, обід виключається", () => {
  const day = mkDay([9, 10, 11, 12, 13, 14]);
  assert.deepStrictEqual(open(day), ["09:00", "10:00", "11:00", "13:00", "14:00"]);
});

test("зайняті / phantom / vip / private / personal / adminBlocked відсікаються", () => {
  const day = mkDay([9, 10, 11, 14, 15, 16, 17], {
    9: { available: false },
    10: { vipOnly: true },
    11: { privateOnly: true },
    14: { personal: true },
    15: { adminBlocked: true },
    16: { phantom: true },
  });
  assert.deepStrictEqual(open(day), ["17:00"]);
});

test("активний резерв (reservedFor / offeredTo) відсікає слот, протермінований — ні", () => {
  const day = mkDay([9, 10, 14, 15], {
    9: { reservedFor: "u1", reservedUntil: NOW + 60000 },
    10: { reservedFor: "u1", reservedUntil: NOW - 60000 },
    14: { offeredTo: { u2: { until: NOW + 60000 } } },
    15: { offeredTo: { u2: { until: NOW - 1 } } },
  });
  assert.deepStrictEqual(open(day), ["10:00", "15:00"]);
});

test("минуле і bookCutoffHours відсікаються", () => {
  const day = mkDay([9, 10, 11]);
  const todayNow = core.kyivLocalToMs(DATE, "10:00");
  assert.deepStrictEqual(core.computeOpenSlots({ day, date: DATE, settings, nowMs: todayNow }), ["11:00"]);
  assert.deepStrictEqual(core.computeOpenSlots({ day, date: DATE, settings: { ...settings, bookCutoffHours: 2 }, nowMs: core.kyivLocalToMs(DATE, "08:30") }), ["11:00"]);
});

test("зайнята позиція всередині звичайного слота (30 хв) блокує його", () => {
  const day = { ...mkDay([9, 10]), slot0930: { time: "09:30", available: false, phantom: true } };
  assert.deepStrictEqual(open(day), ["10:00"]);
});

test("розтягнутий слот (durMin 90) лишається відкритим, lunchOverride пробиває обід", () => {
  const day = { slot0900: free("09:00", { durMin: 90 }), slot1200: free("12:00", { lunchOverride: true }), slot1230: free("12:30") };
  assert.deepStrictEqual(open(day), ["09:00", "12:00"]);
});

test("вихідний за шаблоном без слотів — порожньо; закритий день не показує зайняте", () => {
  const ws = weekAll.map((d, i) => (i === 1 ? { ...d, enabled: false } : d)); // вівторок вимкнено
  assert.deepStrictEqual(open({}, { ...settings, weekSchedule: ws }), []);
  assert.deepStrictEqual(open(mkDay([10, 11]), { ...settings, weekSchedule: ws }), ["10:00", "11:00"]); // відкрито вручну
  const closed = { ...settings, dateOverrides: [{ date: DATE, type: "closed" }] };
  assert.deepStrictEqual(open({ ...mkDay([10]), slot1100: { time: "11:00", available: false } }, closed), ["10:00"]);
});

test("sticky: лише слоти поруч із записом", () => {
  const day = { ...mkDay([9, 10, 11, 14, 15, 16]), slot1000: free("10:00", { available: false }) };
  const sticky = { ...settings, stickyTimeEnabled: true, stickyTime: "both" };
  assert.deepStrictEqual(open(day, sticky), ["09:00", "11:00"]); // 09:00 — початок дня, 11:00 — одразу після запису о 10:00
});

test("buildDatesPayload: порожній масив для дат без слотів; suspended -> усе порожнє", () => {
  const dates = [DATE, "2026-11-11"];
  const p = core.buildDatesPayload({ dates, daysByDate: { [DATE]: mkDay([9, 10]) }, settings, nowMs: NOW });
  assert.deepStrictEqual(p, { [DATE]: ["09:00", "10:00"], "2026-11-11": [] });
  const s = core.buildDatesPayload({ dates, daysByDate: { [DATE]: mkDay([9, 10]) }, settings, nowMs: NOW, suspended: true });
  assert.deepStrictEqual(s, { [DATE]: [], "2026-11-11": [] });
});

// ─── діапазон під бронь (claim) ────────────────────────────────────

const claim = (day, time, durMin, s = settings) => core.checkClaimRange({ day, date: DATE, time, durMin, settings: s, nowMs: NOW });

test("claim: одна година на вільному слоті ок", () => {
  assert.strictEqual(claim(mkDay([9, 10]), "09:00", 60).ok, true);
});

test("claim: 2 години — потрібні обидві години вільними", () => {
  assert.strictEqual(claim(mkDay([9, 10]), "09:00", 120).ok, true);
  assert.strictEqual(claim({ ...mkDay([9, 10]), slot1000: free("10:00", { available: false }) }, "09:00", 120).ok, false);
  assert.strictEqual(claim(mkDay([9]), "09:00", 120).ok, false); // немає наступної години в сітці
});

test("claim: зайнятий / відсутній / обід / минуле / некоректна тривалість", () => {
  const day = mkDay([9, 11, 12, 13], { 9: { available: false } });
  assert.strictEqual(claim(day, "09:00", 60).ok, false);
  assert.strictEqual(claim(day, "10:00", 60).reason, "no_slot");
  assert.strictEqual(claim(day, "12:00", 60).reason, "lunch");
  assert.strictEqual(claim(day, "11:00", 120).reason, "lunch"); // 11-13 заходить в обід
  assert.strictEqual(claim(day, "13:00", 45).reason, "bad_duration");
  const late = core.checkClaimRange({ day, date: DATE, time: "13:00", durMin: 60, settings, nowMs: core.kyivLocalToMs(DATE, "13:00") });
  assert.strictEqual(late.reason, "too_soon");
});

test("claim: vip / резерв / розтягнутий слот", () => {
  const day = { ...mkDay([9, 10], { 9: { vipOnly: true }, 10: { reservedFor: "u", reservedUntil: NOW + 1000 } }), slot1400: free("14:00", { durMin: 90 }) };
  assert.strictEqual(claim(day, "09:00", 60).ok, false);
  assert.strictEqual(claim(day, "10:00", 60).ok, false);
  assert.strictEqual(claim(day, "14:00", 90).ok, true);
  assert.strictEqual(claim(day, "14:00", 60).reason, "duration_mismatch");
});

test("claim: блокування діапазону = available:false + phantom для відсутніх позицій, оновлення чисте", () => {
  const day = mkDay([9, 10]);
  const upd = core.claimBlockUpdates(day, 9 * 60, 120);
  const next = core.applyFlatUpdates(day, upd);
  assert.strictEqual(next.slot0900.available, false);
  assert.strictEqual(next.slot0900.bookingStart, true);
  assert.strictEqual(next.slot0930.phantom, true);
  assert.strictEqual(next.slot1000.available, false);
  assert.strictEqual(day.slot0900.available, true); // вхідний об'єкт не мутовано
  assert.strictEqual(claim(next, "09:00", 60).ok, false); // повторний claim того ж слота — taken
});

// ─── підпис ────────────────────────────────────────────────────────

function mkReq({ body, secret = SECRET, method = "POST", headerOverride, rawOverride } = {}) {
  const raw = rawOverride ?? JSON.stringify(body);
  const sig = headerOverride ?? sign(secret, raw);
  return { method, rawBody: Buffer.from(raw), headers: { "x-sync-signature": sig }, get: (h) => (h.toLowerCase() === "x-sync-signature" ? sig : undefined) };
}

test("sign: hex HMAC-SHA256 від сирого тіла", () => {
  const expected = crypto.createHmac("sha256", SECRET).update("abc").digest("hex");
  assert.strictEqual(sign(SECRET, "abc"), expected);
});

test("verify: валідний підпис приймається", () => {
  const r = verify(mkReq({ body: { ts: Date.now(), a: 1 } }), SECRET);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.body.a, 1);
});

test("verify: невірний підпис / чужий секрет / змінене тіло -> 401", () => {
  const body = { ts: Date.now() };
  assert.deepStrictEqual(verify(mkReq({ body, secret: "other" }), SECRET), { ok: false, status: 401, reason: "bad_signature" });
  assert.strictEqual(verify(mkReq({ body, headerOverride: "deadbeef" }), SECRET).status, 401);
  const tampered = mkReq({ body });
  tampered.rawBody = Buffer.from(JSON.stringify({ ts: body.ts, extra: true }));
  assert.strictEqual(verify(tampered, SECRET).reason, "bad_signature");
});

test("verify: прострочений ts (>5 хв) -> 401 expired, 4 хв ще ок", () => {
  assert.deepStrictEqual(verify(mkReq({ body: { ts: Date.now() - 6 * 60 * 1000 } }), SECRET), { ok: false, status: 401, reason: "expired" });
  assert.deepStrictEqual(verify(mkReq({ body: { ts: Date.now() + 6 * 60 * 1000 } }), SECRET).reason, "expired");
  assert.strictEqual(verify(mkReq({ body: { ts: Date.now() - 4 * 60 * 1000 } }), SECRET).ok, true);
});

test("verify: не POST -> 405, без підпису -> 401, без ts -> 400", () => {
  assert.deepStrictEqual(verify(mkReq({ body: { ts: Date.now() }, method: "GET" }), SECRET), { ok: false, status: 405, reason: "method_not_allowed" });
  const noSig = mkReq({ body: { ts: Date.now() } });
  noSig.get = () => undefined; noSig.headers = {};
  assert.strictEqual(verify(noSig, SECRET).reason, "no_signature");
  assert.strictEqual(verify(mkReq({ body: { a: 1 } }), SECRET).reason, "bad_ts");
});
