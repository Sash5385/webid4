// Запуск: node functions/pricing.test.js
const assert = require("node:assert");
const { computeExpectedBookingPrice: c, buildPricePatch: p } = require("./pricing");
const svcs = [{ id: "sv1", type: "school", duration: 60, price: 600, active: true }, { id: "sv3", type: "private", duration: 60, price: 700, active: true, nextPrice: 800, nextPriceFrom: "2026-12-01" }];
const day = { slot1000: { available: false, time: "10:00" }, slot1100: { available: false, surcharge: 100 }, slot1200: { fixedPrice: 450 } };
const mk = (o) => ({ id: "n", date: "2026-11-10", time: "10:00", serviceId: "sv1", serviceType: "school", durationHours: 1, ...o });
let r = c({ booking: mk({ price: 600 }), user: {}, services: svcs, day });
assert.equal(r.expected.price, 600); assert.deepEqual(p(mk({ price: 600 }), r), {});
assert.deepEqual(p(mk({ price: 1 }), r), { price: 600 });                       // підроблена ціна
assert.deepEqual(p(mk({ price: 600, manualPrice: 5 }), r), { manualPrice: null }); // manualPrice лише для fixedPrice
// знижка, 2 години, надбавка на другу годину
r = c({ booking: mk({ durationHours: 2, price: 1200 + 100 - 100, surcharge: 100, discountAmt: 50 }), user: { discount: 50 }, services: svcs, day });
assert.equal(r.expected.price, 1200 + 100 - 100); assert.equal(r.expected.surcharge, 100); assert.equal(r.expected.discountAmt, 50);
// індивідуальна ціна
r = c({ booking: mk({ price: 500 }), user: { customPrice: 500, discount: 50 }, services: svcs, day });
assert.equal(r.expected.price, 500); assert.equal(r.expected.discountAmt, null);
// фіксована ціна слота
r = c({ booking: mk({ time: "12:00", price: 450, manualPrice: 450 }), user: {}, services: svcs, day });
assert.equal(r.expected.price, 450); assert.deepEqual(p(mk({ time: "12:00", price: 450, manualPrice: 450 }), r), {});
// nextPrice, запис без ціни (claimQueueOffer: без serviceId) -> заповнюється
r = c({ booking: mk({ serviceId: undefined, serviceType: "private", date: "2026-12-05", time: "15:00" }), user: {}, services: svcs, day });
assert.equal(r.expected.price, 800); assert.deepEqual(p(mk({ serviceId: undefined, serviceType: "private", date: "2026-12-05", time: "15:00" }), r), { price: 800 });
// безкоштовно (знижка > ціни) -> ціни нема
r = c({ booking: mk({}), user: { discount: 900 }, services: svcs, day });
assert.equal(r.expected.price, null);
// невідома послуга / тип -> не перевіряємо, позначаємо
assert.equal(c({ booking: mk({ serviceId: "zz" }), user: {}, services: svcs, day }).ok, false);
assert.equal(c({ booking: mk({ serviceType: "private" }), user: {}, services: svcs, day }).ok, false);
// тривалість не відповідає слоту
assert.ok(c({ booking: mk({ durationHours: 5, price: 3000 }), user: {}, services: svcs, day }).flags.includes("duration-mismatch"));
// перенесення: стара ціна/формула клієнта допустимі, довільна — ні
const ub = { o1: { id: "o1", date: "2026-11-01", time: "09:00", status: "confirmed", serviceId: "sv1", price: 1200, durationHours: 2, createdAt: 1 } };
const rb = (price) => mk({ durationHours: 2, price, rescheduledFrom: "2026-11-01 09:00" });
r = c({ booking: rb(1200), user: {}, services: svcs, day: {}, userBookings: ub }); assert.deepEqual(p(rb(1200), r), {});
assert.deepEqual(p(rb(600), r), {});                    // формула клієнта (без множення на години) — допустима
assert.deepEqual(p(rb(1), r), { price: 1200 });
// rescheduledFrom без реального старого запису -> як новий запис
r = c({ booking: mk({ price: 1, rescheduledFrom: "x y" }), user: {}, services: svcs, day, userBookings: ub }); assert.deepEqual(p(mk({ price: 1, rescheduledFrom: "x y" }), r), { price: 600 });
console.log("pricing tests OK");
