// Серверний перерахунок ціни запису учня (Cloud Function enforceBookingPrice).
//
// Правила БД не можуть перевірити ціну (учень сам пише price у bookings/{uid}/{id}), тому
// після створення запису ціну перераховує сервер за тією ж формулою, що й клієнт:
//  - новий запис — BookTab.jsx handleBook;
//  - перенесення (rescheduledFrom) — BookingsTab.jsx RescheduleModal.handleConfirm;
//  - запис без ціни (claimQueueOffer, відкладений запис після входу) — ціна береться як для нового.
// Файл чисто функціональний (без firebase), копія лежить у обох адмін-репозиторіях
// (webid4/functions, webOlhaDrive/functions) — тримати синхронно з клієнтами.
//
// Усі "відсутні" значення позначаємо null (у БД поле відсутнє).

const pad2 = (n) => String(n).padStart(2, "0");
const slotKeyAt = (min) => `slot${pad2(Math.floor(min / 60))}${pad2(min % 60)}`;
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Ціна послуги на дату (nextPrice/nextPriceFrom) — як effectivePrice у клієнтах.
function effectivePrice(svc, dateStr) {
  if (!svc) return 0;
  if (svc.nextPrice != null && svc.nextPriceFrom && dateStr && dateStr >= svc.nextPriceFrom) return svc.nextPrice;
  return svc.price || 0;
}

const servicesList = (val) => (Array.isArray(val) ? val : Object.values(val || {})).filter((s) => s && typeof s === "object");

// Базова погодинна послуга цього типу (60 хв) — як baseService у BookTab.jsx.
function findBaseService(services, type) {
  return services.find((s) => s.active !== false && !s.archived && s.type === type && Number(s.duration) === 60)
    || services.find((s) => s.type === type && Number(s.duration) === 60) || null;
}

// Надбавка за слоти: клієнт іде кроком 60 хв від старту (BookTab: `slotMin += 60`).
function sumSurcharge(day, startMin, hours, stepHours) {
  let sum = 0;
  if (stepHours) {
    for (let i = 0; i < hours; i++) sum += num(day?.[slotKeyAt(startMin + i * 60)]?.surcharge) || 0;
  } else {
    for (let m = startMin; m < startMin + hours * 60; m += 60) sum += num(day?.[slotKeyAt(m)]?.surcharge) || 0;
  }
  return sum;
}

// Обчислення очікуваних полів. Повертає:
//  { ok:true, expected:{price,manualPrice,surcharge,discountAmt}, acceptedPrices:[...], flags:[...] }
//  { ok:false, reason }  — коли ціну надійно перевірити неможливо (позначаємо для адміна, не чіпаємо).
function computeExpectedBookingPrice({ booking, user, services: servicesVal, day, userBookings }) {
  const services = servicesList(servicesVal);
  const b = booking || {};
  const hours = num(b.durationHours);
  if (!b.date || !b.time || hours == null || hours <= 0) return { ok: false, reason: "bad-booking-fields" };
  const startMin = toMin(b.time);
  const flags = [];
  const discount = num(user?.discount) || 0;
  const customPrice = num(user?.customPrice) > 0 ? Number(user.customPrice) : null;

  // ── Перенесення: знаходимо старий запис за "YYYY-MM-DD HH:MM"
  let old = null;
  if (b.rescheduledFrom && userBookings) {
    const [od, ot] = String(b.rescheduledFrom).split(" ");
    const cand = Object.entries(userBookings)
      .filter(([id, x]) => x && id !== b.id && x.date === od && x.time === ot)
      .map(([id, x]) => ({ id, ...x }));
    // активний запис — пріоритет; інакше найновіший (старий уже міг бути скасований перенесенням)
    old = cand.find((x) => x.status !== "cancelled") || cand.sort((a, c) => (c.createdAt || 0) - (a.createdAt || 0))[0] || null;
  }

  if (old) {
    const svcAny = services.find((s) => s.id === old.serviceId) || null;
    if (b.serviceId && old.serviceId && b.serviceId !== old.serviceId) flags.push("service-changed");
    const discTot = (num(old.discountAmt) || 0) * hours;
    const newSurcharge = sumSurcharge(day, startMin, hours, true);
    const oldPrice = num(old.price);
    // Коректна ціна для тривалості (тариф × години + надбавка − знижка). Приймаємо ЛИШЕ її:
    // стара формула клієнта (тариф без множення на години) більше не допустима — сервер виправить.
    const proper = svcAny ? Math.max(0, Math.round(effectivePrice(svcAny, b.date) * hours) + newSurcharge - discTot) : null;
    // Послуги вже немає — стара ціна + різниця надбавки (як у клієнта)
    const delta = oldPrice != null ? Math.max(0, oldPrice + (newSurcharge - (num(old.surcharge) || 0))) : null;
    const expectedPrice = proper != null ? proper : delta;
    if (expectedPrice == null) return { ok: false, reason: "reschedule-no-price-basis" };
    const price = expectedPrice;
    const accepted = [price];
    return {
      ok: true,
      expected: { price, manualPrice: null, surcharge: newSurcharge || null, discountAmt: num(old.discountAmt) || null },
      acceptedPrices: accepted,
      flags,
    };
  }

  // ── Новий запис (BookTab.jsx handleBook)
  const svc = b.serviceId ? services.find((s) => s.id === b.serviceId) : findBaseService(services, b.serviceType);
  if (!svc) return { ok: false, reason: "unknown-service" };
  if (b.serviceType && svc.type !== b.serviceType) return { ok: false, reason: "service-type-mismatch" };

  const startSlot = day?.[slotKeyAt(startMin)];
  const slotDurH = (num(startSlot?.durMin) || 60) / 60;
  // дозволена тривалість: власна тривалість слота, або 2 год при злитті двох сусідніх годинних слотів
  if (!(Math.abs(hours - slotDurH) < 1e-9 || (slotDurH === 1 && hours === 2))) flags.push("duration-mismatch");

  const surcharge = sumSurcharge(day, startMin, hours, false);
  const fixedPrice = num(startSlot?.fixedPrice) || null;
  let total;
  let manualPrice = null;
  let surchargeField = surcharge || null;
  let discountField = null;
  if (fixedPrice != null) {
    total = fixedPrice; manualPrice = fixedPrice; surchargeField = null;
  } else if (customPrice != null) {
    total = Math.round(customPrice * hours) + surcharge;
  } else {
    total = Math.round(effectivePrice(svc, b.date) * hours) + surcharge;
    if (discount > 0) { total = Math.max(0, total - discount * hours); discountField = discount; }
  }
  const price = total || null; // клієнт: `totalPrice || undefined`
  return { ok: true, expected: { price, manualPrice, surcharge: surchargeField, discountAmt: discountField }, acceptedPrices: [price], flags };
}

const samePrice = (a, b) => (a == null || b == null ? a == null && b == null : Math.abs(a - b) < 0.01);

// Що саме треба записати в запис (null = прибрати поле). Порожній об'єкт — все гаразд.
function buildPricePatch(booking, result) {
  if (!result.ok) return null;
  const e = result.expected;
  const clientPrice = num(booking.price);
  const patch = {};
  if (!result.acceptedPrices.some((p) => samePrice(p, clientPrice))) patch.price = e.price;
  for (const k of ["manualPrice", "surcharge", "discountAmt"]) {
    if (!samePrice(e[k], num(booking[k]))) patch[k] = e[k];
  }
  return patch;
}

module.exports = { computeExpectedBookingPrice, buildPricePatch, effectivePrice, findBaseService, samePrice };
