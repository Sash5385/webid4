// Чиста логіка синхронізації ID4Drive <-> FindDrive: «що вважається відкритим слотом» і перевірка
// діапазону під бронь. Без firebase — тестується окремо (finddriveSync.test.js).
//
// Правила повторюють те, що бачить учень у вебклієнті (webID4client BookTab.jsx → slotsList):
//  - слот вільний (available !== false), не phantom / vipOnly / privateOnly / personal / adminBlocked;
//  - немає активного резерву: reservedFor + reservedUntil > now, або offeredTo[uid].until > now (черга);
//  - не в минулому (+ admin_settings.bookCutoffHours), не потрапляє в обід (крім lunchOverride);
//  - розтягнутий слот (durMin != 60) — цілісний блок; звичайний (60 хв) не перекриває зайняті позиції;
//  - «липкі» слоти (stickyTimeEnabled) — лише у списку відкритих (для claim не застосовуємо, щоб не
//    відхиляти бронь через дрібну гонку).

const { blockRangeUpdates, slotIdAt } = require("./slotRules");

const SLOT_KEY = /^slot\d{4}$/;
const pad2 = (n) => String(n).padStart(2, "0");

const timeToMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const minToTime = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

// "YYYY-MM-DDTHH:MM" за київським часом -> абсолютні мс (копія хелпера з index.js, з урахуванням DST)
function kyivLocalToMs(dateStr, timeStr) {
  const guessMs = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kiev", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offsetAt = (ms) => {
    const parts = fmt.formatToParts(ms).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === "24" ? 0 : parts.hour, parts.minute, parts.second) - ms;
  };
  const firstMs = guessMs - offsetAt(guessMs);
  return guessMs - offsetAt(firstMs);
}

// Сьогоднішня дата YYYY-MM-DD за Києвом
const kyivToday = (nowMs = Date.now()) => new Date(nowMs).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });

// Дата YYYY-MM-DD через d днів (рядкова арифметика, без залежності від TZ сервера)
function addDays(dateStr, d) {
  const t = new Date(`${dateStr}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}

// Mon=0..Sun=6
const dowOf = (dateStr) => (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7;

// Обід на дату: той самий порядок пріоритетів, що getLunchForDate у BookTab.jsx
function lunchFor(date, settings) {
  const s = settings || {};
  const ov = (s.dateOverrides || []).find((o) => o && o.date === date);
  if (ov && ov.type !== "closed") {
    return { lunchEnabled: ov.lunchEnabled ?? s.lunchEnabled, lunchStart: ov.lunchStart ?? s.lunchStart ?? 12, lunchEnd: ov.lunchEnd ?? s.lunchEnd ?? 13 };
  }
  const ws = (s.weekSchedule || [])[dowOf(date)];
  if (ws) return { lunchEnabled: ws.lunchEnabled ?? true, lunchStart: ws.lunchStart ?? 12, lunchEnd: ws.lunchEnd ?? 13 };
  return { lunchEnabled: s.lunchEnabled, lunchStart: s.lunchStart || 12, lunchEnd: s.lunchEnd || 13 };
}

// Активний резерв слота (запрошення з черги / reservedFor)
function isReserved(doc, nowMs) {
  if (doc.reservedFor && Number(doc.reservedUntil) > nowMs) return true;
  if (doc.offeredTo && typeof doc.offeredTo === "object") {
    return Object.values(doc.offeredTo).some((o) => o && Number(o.until) > nowMs);
  }
  return false;
}

// Слот публічно вільний сам по собі (без урахування сусідів / обіду / часу)
function isPubliclyFree(doc, nowMs) {
  return !!doc && typeof doc === "object" &&
    doc.available !== false && !doc.phantom && !doc.vipOnly && !doc.privateOnly &&
    !doc.personal && !doc.adminBlocked && !isReserved(doc, nowMs);
}

// Загальний контекст дня: документи слотів, обід, чи вихідний
function dayContext(day, date, settings) {
  const s = settings || {};
  const docs = Object.entries(day || {})
    .filter(([k, v]) => SLOT_KEY.test(k) && v && typeof v === "object" && v.time && !Number.isNaN(timeToMin(v.time)))
    .map(([, v]) => ({ doc: v, start: timeToMin(v.time) }))
    .sort((a, b) => a.start - b.start);

  let offDay = false;
  const ov = (s.dateOverrides || []).find((o) => o && o.date === date);
  if (ov?.type === "closed") offDay = true;
  let emptyOffDay = false;
  if (!ov) {
    const ws = (s.weekSchedule || [])[dowOf(date)];
    if (ws && ws.enabled === false) {
      if (docs.length === 0) emptyOffDay = true;
      offDay = true;
    }
  }
  return { docs, offDay, closedDay: ov?.type === "closed", emptyOffDay, lunch: lunchFor(date, s) };
}

// Ефективна тривалість слота: власний durMin, обрізаний до початку наступного документа дня
function effectiveDur(entry, docs) {
  const next = docs.map((d) => d.start).filter((t) => t > entry.start)[0];
  return (entry.doc.durMin && next != null) ? Math.min(entry.doc.durMin, next - entry.start) : (entry.doc.durMin || 60);
}

function overlapsLunch(ctx, entry, startMin, durMin) {
  const { lunchEnabled, lunchStart, lunchEnd } = ctx.lunch;
  if (!lunchEnabled || ctx.offDay || entry.doc.lunchOverride) return false;
  return startMin < lunchEnd * 60 && startMin + durMin > lunchStart * 60;
}

// Слот у минулому / ближче за bookCutoffHours
function tooSoon(date, startMin, settings, nowMs) {
  const hrs = Number(settings?.bookCutoffHours) || 0;
  return kyivLocalToMs(date, minToTime(startMin)) <= nowMs + hrs * 3600 * 1000;
}

// Список відкритих стартів дня: ["HH:MM", ...] (відсортований, унікальний).
// day — знімок timeslots/{date}; settings — admin_settings; nowMs — поточний момент.
function computeOpenSlots({ day, date, settings, nowMs = Date.now() }) {
  const s = settings || {};
  const ctx = dayContext(day, date, s);
  if (ctx.emptyOffDay) return [];
  const { docs } = ctx;

  const stickyEnabled = !!s.stickyTimeEnabled;
  const stickyMode = s.stickyTime || "both";
  const taken = docs.filter((e) => e.doc.available === false).map((e) => ({ start: e.start, end: e.start + (e.doc.durMin || 60) }));
  const dayStart = docs.length ? docs[0].start : null;
  const lunchEndMin = ctx.lunch.lunchEnabled ? ctx.lunch.lunchEnd * 60 : null;
  const lunchStartMin = ctx.lunch.lunchEnabled ? ctx.lunch.lunchStart * 60 : null;

  const out = new Set();
  for (const entry of docs) {
    if (!isPubliclyFree(entry.doc, nowMs)) continue;
    const dur = effectiveDur(entry, docs);
    const isCustom = dur !== 60;

    if (overlapsLunch(ctx, entry, entry.start, dur)) continue;
    if (tooSoon(date, entry.start, s, nowMs)) continue;

    // Звичайний 60-хв слот не має перекривати зайняті позиції всередині себе
    if (!isCustom) {
      const blocked = docs.some((o) => o.start > entry.start && o.start < entry.start + dur && o.doc.available === false);
      if (blocked) continue;
    }

    // «Липкі» слоти: лише поруч із наявним записом / краєм дня / обідом
    if (stickyEnabled && taken.length > 0 && entry.start !== dayStart) {
      const nearLunch = (stickyMode !== "before" && entry.start === lunchEndMin) ||
        (stickyMode !== "after" && entry.start + dur === lunchStartMin);
      const nearTaken = taken.some((iv) =>
        (stickyMode !== "after" && entry.start + dur === iv.start) ||
        (stickyMode !== "before" && entry.start === iv.end));
      if (!nearLunch && !nearTaken) continue;
    }
    out.add(minToTime(entry.start));
  }
  return [...out].sort();
}

// Чи можна зайняти [time, time+durMin) на дату. Повертає { ok:true, startMin } або { ok:false, reason }.
function checkClaimRange({ day, date, time, durMin, settings, nowMs = Date.now() }) {
  const startMin = timeToMin(time);
  if (Number.isNaN(startMin)) return { ok: false, reason: "bad_time" };
  if (!Number.isInteger(durMin) || durMin <= 0 || durMin % 30 !== 0 || durMin > 480) return { ok: false, reason: "bad_duration" };

  const ctx = dayContext(day, date, settings);
  const entry = ctx.docs.find((e) => e.start === startMin && e.doc === day[slotIdAt(startMin)]);
  if (!entry) return { ok: false, reason: "no_slot" };
  if (!isPubliclyFree(entry.doc, nowMs)) return { ok: false, reason: "not_free" };
  if (tooSoon(date, startMin, settings, nowMs)) return { ok: false, reason: "too_soon" };
  if (overlapsLunch(ctx, entry, startMin, durMin)) return { ok: false, reason: "lunch" };

  const dur = effectiveDur(entry, ctx.docs);
  if (dur !== 60) {
    // Розтягнутий слот — цілісний блок: бронь лише рівно під його тривалість
    if (durMin !== dur) return { ok: false, reason: "duration_mismatch" };
    return { ok: true, startMin };
  }
  // Звичайний слот: довші записи — кратні годині, кожна наступна година має бути вільною
  if (durMin % 60 !== 0) return { ok: false, reason: "duration_mismatch" };
  for (let i = 60; i < durMin; i += 60) {
    const next = day[slotIdAt(startMin + i)];
    if (!next || !isPubliclyFree(next, nowMs)) return { ok: false, reason: "not_free" };
  }
  // Усі документи всередині діапазону мають бути вільними (напр. вільний :30 буде заблоковано разом)
  const endMin = startMin + durMin;
  const inner = ctx.docs.filter((e) => e.start > startMin && e.start < endMin);
  if (inner.some((e) => !isPubliclyFree(e.doc, nowMs))) return { ok: false, reason: "not_free" };
  return { ok: true, startMin };
}

// Плоскі оновлення (шляхи відносно дня, напр. "slot1000/available") -> новий об'єкт дня (без мутації вхідного)
function applyFlatUpdates(day, upd) {
  const out = JSON.parse(JSON.stringify(day || {}));
  for (const [path, value] of Object.entries(upd)) {
    const parts = path.split("/").filter(Boolean);
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] == null || typeof node[parts[i]] !== "object") node[parts[i]] = {};
      node = node[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete node[last]; else node[last] = value;
  }
  return out;
}

// Оновлення слотів під бронь FindDrive (шляхи відносно timeslots/{date}/); bookingStart — як у адмінці
function claimBlockUpdates(day, startMin, durMin) {
  return blockRangeUpdates(day, "", startMin, durMin, { bookingStart: true });
}

// Відкриті слоти на кожну дату з переліку: { "YYYY-MM-DD": ["HH:MM", ...] }
function buildDatesPayload({ dates, daysByDate, settings, nowMs = Date.now(), suspended = false }) {
  const out = {};
  for (const date of dates) {
    out[date] = suspended ? [] : computeOpenSlots({ day: daysByDate[date] || {}, date, settings, nowMs });
  }
  return out;
}

module.exports = {
  timeToMin, minToTime, kyivLocalToMs, kyivToday, addDays,
  isPubliclyFree, computeOpenSlots, checkClaimRange, applyFlatUpdates, claimBlockUpdates, buildDatesPayload,
};
