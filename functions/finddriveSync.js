// Синхронізація слотів і бронювань ID4Drive <-> FindDrive (див. контракт).
// ID4 — джерело правди по слотах; FindDrive — вітрина + приймач бронювань.
//
// Вхідні (FindDrive -> ID4), HTTPS onRequest з HMAC-підписом (syncAuth.js):
//   fdClaimSlot     — атомарно зайняти діапазон і створити бронь guest_<телефон>/fd_<fdBookingId>
//   fdUpdateBooking — підтвердити / скасувати бронь (скасування звільняє слоти)
// Вихідні (ID4 -> FindDrive):
//   syncFdSlots     — зміна timeslots/{date}  -> POST id4SlotsSync
//   syncFdSlotsFull — кожні 10 хв, сьогодні..+60 днів -> POST id4SlotsSync (повна звірка)
//   onFdBookingChanged — зміна броні source:"finddrive" в ID4 -> POST id4BookingEvent

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { restoreRangeUpdates } = require("./slotRules");
const { verify, postSigned } = require("./syncAuth");
const core = require("./finddriveCore");

const FD_ID4_SECRET = defineSecret("FD_ID4_SECRET");
const FD_BASE = "https://europe-west1-finddrive-b009d.cloudfunctions.net";
const REGION = "europe-west1";
const WINDOW_DAYS = 60; // вікно синхронізації слотів: сьогодні..сьогодні+60

const db = () => admin.database();

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const readVal = async (path) => (await db().ref(path).get()).val();

// ─── Вхідні ендпоінти ──────────────────────────────────────────────

// Обгортка: перевірка підпису -> обробник -> JSON-відповідь
function signedEndpoint(handler) {
  return onRequest({ region: REGION, secrets: [FD_ID4_SECRET], timeoutSeconds: 60 }, async (req, res) => {
    const v = verify(req, FD_ID4_SECRET.value());
    if (!v.ok) { res.status(v.status).json({ ok: false, reason: v.reason }); return; }
    try {
      const out = await handler(v.body);
      res.status(out.httpStatus || 200).json(out.body);
    } catch (e) {
      console.error(`${handler.name} failed`, e);
      res.status(500).json({ ok: false, reason: "internal" });
    }
  });
}

const badRequest = (reason) => ({ httpStatus: 400, body: { ok: false, reason } });
const reply = (body) => ({ body });

// Шлях існуючої (не скасованої) броні за fdBookingId: index -> перевірка запису
async function findBooking(fdBookingId) {
  const path = await readVal(`fdBookingsIndex/${fdBookingId}`);
  if (typeof path !== "string" || !path) return null;
  const booking = await readVal(`bookings/${path}`);
  return booking ? { path, booking } : null;
}

function normalizeUaPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return "38" + d;
  if (d.length === 9) return "380" + d;
  return d;
}

async function handleClaim(body) {
  const { fdBookingId, date, time, status } = body;
  const durMin = Number(body.durMin);
  const clientName = String(body.clientName || "").trim().slice(0, 100);
  // Нормалізуємо до 380XXXXXXXXX, щоб 067… і +38067… давали один guest_-uid
  const phoneDigits = normalizeUaPhone(body.clientPhone);
  if (!ID_RE.test(String(fdBookingId || ""))) return badRequest("bad_fdBookingId");
  if (!DATE_RE.test(String(date || "")) || !TIME_RE.test(String(time || ""))) return badRequest("bad_datetime");
  if (!Number.isInteger(durMin) || durMin <= 0 || durMin % 30 !== 0 || durMin > 480) return badRequest("bad_duration");
  if (!clientName) return badRequest("bad_clientName");
  if (phoneDigits.length < 9 || phoneDigits.length > 15) return badRequest("bad_clientPhone");
  if (status !== "confirmed" && status !== "pending") return badRequest("bad_status");
  const price = body.price != null && Number.isFinite(Number(body.price)) ? Number(body.price) : null;

  // Ідемпотентність: бронь уже є і не скасована
  const existing = await findBooking(fdBookingId);
  if (existing && existing.booking.status !== "cancelled") {
    return reply({ ok: true, already: true, id4Path: `bookings/${existing.path}` });
  }

  const settings = (await readVal("admin_settings")) || {};
  const nowMs = Date.now();
  const dayRef = db().ref(`timeslots/${date}`);

  // Атомарно: перевіряємо і блокуємо діапазон в одній транзакції по дню.
  // Перший прохід транзакції може отримати null (немає локального кешу) — тоді повертаємо null:
  // сервер відхилить невідповідність і перезапустить колбек з реальними даними.
  let decision = null;
  const tx = await dayRef.transaction((cur) => {
    if (cur === null) { decision = { ok: false, reason: "empty_guess" }; return null; }
    const r = core.checkClaimRange({ day: cur, date, time, durMin, settings, nowMs });
    if (!r.ok) { decision = r; return undefined; }
    const upd = core.claimBlockUpdates(cur, r.startMin, durMin);
    decision = { ok: true };
    return core.applyFlatUpdates(cur, upd);
  }, undefined, false);

  if (!tx.committed || !decision || !decision.ok) {
    // Паралельний дубль того самого запиту міг встигнути раніше — тоді це «already», а не «taken»
    const dup = await findBooking(fdBookingId);
    if (dup && dup.booking.status !== "cancelled") {
      return reply({ ok: true, already: true, id4Path: `bookings/${dup.path}` });
    }
    console.log(`fdClaimSlot: taken ${date} ${time} ${durMin}хв fd=${fdBookingId} reason=${decision?.reason}`);
    return reply({ ok: false, reason: "taken" });
  }

  const startMin = core.timeToMin(time);
  const path = `guest_${phoneDigits}/fd_${fdBookingId}`;
  const booking = {
    id: `fd_${fdBookingId}`,
    date, time, startMin, durMin, durationHours: durMin / 60,
    studentName: clientName, name: clientName, phone: String(body.clientPhone).trim(),
    ...(body.clientEmail ? { email: String(body.clientEmail).trim().slice(0, 200) } : {}),
    status,
    createdBy: "finddrive", source: "finddrive", fdBookingId,
    ...(price != null ? { price } : {}),
    createdAt: Date.now(),
    lastSyncFrom: "fd", fdSyncTs: Date.now(), // створено з FindDrive — відлуння назад не потрібне
  };

  try {
    await db().ref().update({
      [`bookings/${path}`]: booking,
      [`fdBookingsIndex/${fdBookingId}`]: path,
    });
  } catch (e) {
    // Бронь не записалась — повертаємо слоти, щоб вони не лишились заблокованими без броні
    console.error(`fdClaimSlot: booking write failed fd=${fdBookingId}, rollback slots`, e);
    const day = (await readVal(`timeslots/${date}`)) || {};
    const rollback = restoreRangeUpdates(day, `timeslots/${date}/`, startMin, durMin);
    if (Object.keys(rollback).length) await db().ref().update(rollback).catch(() => {});
    throw e;
  }

  // Гість з'являється у списку «Учні» (як для гостей, яких записує адмін) — лише якщо ще немає
  const studentRef = db().ref(`users/guest_${phoneDigits}`);
  const hasStudent = (await studentRef.get().catch(() => null))?.exists();
  if (!hasStudent) {
    await studentRef.update({
      name: clientName, phone: String(body.clientPhone).trim(), type: "private",
      discount: 0, notes: "", blocked: false, isVip: false, hours: 0, createdAt: Date.now(),
    }).catch(() => {});
  }

  return reply({ ok: true, id4Path: `bookings/${path}` });
}

async function handleUpdate(body) {
  const { fdBookingId, action } = body;
  const by = ["client", "instructor", "system"].includes(body.by) ? body.by : "system";
  if (!ID_RE.test(String(fdBookingId || ""))) return badRequest("bad_fdBookingId");
  if (action !== "confirm" && action !== "cancel") return badRequest("bad_action");

  const found = await findBooking(fdBookingId);
  if (!found) return reply({ ok: false, reason: "not_found" });
  const { path, booking } = found;
  const marker = { lastSyncFrom: "fd", fdSyncTs: Date.now() }; // маркер для придушення відлуння

  if (action === "confirm") {
    if (booking.status === "cancelled") return reply({ ok: false, reason: "cancelled" });
    if (booking.status === "confirmed") return reply({ ok: true, already: true });
    await db().ref(`bookings/${path}`).update({ status: "confirmed", confirmedBy: `finddrive_${by}`, ...marker });
    return reply({ ok: true });
  }

  // cancel
  if (booking.status === "cancelled") return reply({ ok: true, already: true });
  const upd = {
    [`bookings/${path}/status`]: "cancelled",
    [`bookings/${path}/cancelledBy`]: `finddrive_${by}`,
    [`bookings/${path}/cancelledAt`]: Date.now(),
    [`bookings/${path}/lastSyncFrom`]: marker.lastSyncFrom,
    [`bookings/${path}/fdSyncTs`]: marker.fdSyncTs,
  };
  const range = booking.date && booking.time ? {
    start: booking.startMin ?? core.timeToMin(booking.time),
    dur: booking.durMin ?? Math.round((booking.durationHours || 1) * 60),
  } : null;
  if (range && Number.isFinite(range.start)) {
    // Звільняємо слоти тим самим update, що й статус (атомарно); phantom видаляються, справжні слоти повертаються
    const day = (await readVal(`timeslots/${booking.date}`)) || {};
    Object.assign(upd, restoreRangeUpdates(day, `timeslots/${booking.date}/`, range.start, range.dur));
  }
  await db().ref().update(upd);
  // Черга очікування і push адміну — в onBookingChanged (гілка cancelledBy "finddrive_*")
  return reply({ ok: true });
}

exports.fdClaimSlot = signedEndpoint(handleClaim);
exports.fdUpdateBooking = signedEndpoint(handleUpdate);

// ─── Вихідні: слоти -> FindDrive ───────────────────────────────────

async function readSyncContext() {
  const [settings, license] = await Promise.all([readVal("admin_settings"), readVal("license/status")]);
  return { settings: settings || {}, suspended: license === "suspended" };
}

async function postSlots(dates) {
  try {
    const res = await postSigned(`${FD_BASE}/id4SlotsSync`, { dates }, FD_ID4_SECRET.value());
    if (!res || res.ok !== true) console.warn(`id4SlotsSync відхилено: ${JSON.stringify(res)}`);
    return !!(res && res.ok);
  } catch (e) {
    console.error(`id4SlotsSync помилка мережі: ${e.message}`);
    return false;
  }
}

// Дешевий тригер: на рівні дати (один виклик на запис дня). Рахуємо відкриті слоти ДО і ПІСЛЯ —
// шлемо у FD лише якщо перелік реально змінився (viewing, bookedBy тощо ігноруються).
exports.syncFdSlots = onValueWritten(
  { ref: "timeslots/{date}", region: REGION, secrets: [FD_ID4_SECRET] },
  async (event) => {
    const { date } = event.params;
    const nowMs = Date.now();
    const today = core.kyivToday(nowMs);
    if (!DATE_RE.test(date) || date < today || date > core.addDays(today, WINDOW_DAYS)) return;
    const { settings, suspended } = await readSyncContext();
    const after = suspended ? [] : core.computeOpenSlots({ day: event.data.after.val() || {}, date, settings, nowMs });
    const before = suspended ? [] : core.computeOpenSlots({ day: event.data.before.val() || {}, date, settings, nowMs });
    if (JSON.stringify(after) === JSON.stringify(before)) return;
    await postSlots({ [date]: after });
  }
);

// Повна звірка кожні 10 хв (сьогодні..+60 днів) + повтор вихідних подій броней, що не дійшли
exports.syncFdSlotsFull = onSchedule(
  { schedule: "every 10 minutes", region: REGION, secrets: [FD_ID4_SECRET], timeoutSeconds: 120 },
  async () => {
    const nowMs = Date.now();
    const today = core.kyivToday(nowMs);
    const dates = Array.from({ length: WINDOW_DAYS + 1 }, (_, i) => core.addDays(today, i));
    const [ctx, daysByDate] = await Promise.all([
      readSyncContext(),
      db().ref("timeslots").orderByKey().startAt(dates[0]).endAt(dates[dates.length - 1]).get().then((s) => s.val() || {}),
    ]);
    const payload = core.buildDatesPayload({ dates, daysByDate, settings: ctx.settings, nowMs, suspended: ctx.suspended });
    await postSlots(payload);
    await flushBookingEventQueue();
  }
);

// ─── Вихідні: зміни броней FindDrive -> FindDrive ──────────────────

// Відправка події; якщо не вдалось — кладемо в чергу fdEventQueue (повтор у syncFdSlotsFull)
async function sendBookingEvent(fdBookingId, payload) {
  // FindDrive знає лише pending/confirmed/cancelled; інші статуси (напр. noshow) не шлемо
  if (!payload || !payload.status) {
    await db().ref(`fdEventQueue/${fdBookingId}`).remove().catch(() => {});
    return true;
  }
  let ok = false;
  let delivered = false;
  try {
    const res = await postSigned(`${FD_BASE}/id4BookingEvent`, { fdBookingId, ...payload }, FD_ID4_SECRET.value());
    delivered = true;
    ok = !!(res && res.ok);
    if (!ok) console.warn(`id4BookingEvent відхилено fd=${fdBookingId}: ${JSON.stringify(res)}`);
  } catch (e) {
    console.error(`id4BookingEvent помилка мережі fd=${fdBookingId}: ${e.message}`);
  }
  // not_found / no_linked_instructor повторювати марно, але і не губимо: лишаємо в черзі лише мережеві збої
  if (delivered) await db().ref(`fdEventQueue/${fdBookingId}`).remove().catch(() => {});
  else await db().ref(`fdEventQueue/${fdBookingId}`).set({ ...payload, at: Date.now() }).catch(() => {});
  return ok;
}

async function flushBookingEventQueue() {
  const queue = (await readVal("fdEventQueue")) || {};
  for (const [fdBookingId, saved] of Object.entries(queue)) {
    // Беремо СВІЖИЙ стан броні; якщо її вже видалено з ID4 — відправляємо збережений у черзі
    const found = await findBooking(fdBookingId);
    const payload = found ? eventPayload(found.booking) : { status: saved?.status, date: saved?.date, time: saved?.time, durMin: saved?.durMin };
    await sendBookingEvent(fdBookingId, payload);
  }
}

function eventPayload(b) {
  const map = { pending: "pending", confirmed: "confirmed", noshow: "confirmed", cancelled: "cancelled" };
  return {
    status: map[b.status] || null,
    date: b.date,
    time: b.time,
    durMin: b.durMin ?? Math.round((b.durationHours || 1) * 60),
  };
}

exports.onFdBookingChanged = onValueWritten(
  { ref: "bookings/{uid}/{bookingId}", region: REGION, secrets: [FD_ID4_SECRET] },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();
    const ref = after || before;
    if (!ref || ref.source !== "finddrive" || !ref.fdBookingId) return;
    if (!before) return; // створення — це наш власний fdClaimSlot

    // Бронь видалено повністю з ID4 — для FindDrive це скасування
    if (!after) {
      if (before.status === "cancelled") return;
      await sendBookingEvent(before.fdBookingId, { ...eventPayload(before), status: "cancelled" });
      return;
    }

    const changed = before.status !== after.status || before.date !== after.date || before.time !== after.time ||
      (before.durMin ?? before.durationHours) !== (after.durMin ?? after.durationHours);
    if (!changed) return; // напр. googleEventId / lastSyncedByApp

    // Придушення відлуння: зміну щойно зробив FindDrive через fdUpdateBooking (fdSyncTs змінився)
    if (after.lastSyncFrom === "fd" && after.fdSyncTs !== before.fdSyncTs) return;

    await sendBookingEvent(after.fdBookingId, eventPayload(after));
  }
);
