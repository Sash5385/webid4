// Тест правил root-RTDB. Запуск з кореня репо: npx firebase-tools emulators:exec --only database --project demo-rt "node tests/rules/rules.test.mjs" (потрібні Java і npm i у tests/rules)
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, get, set, update, remove, push, runTransaction } from "firebase/database";
import { readFileSync } from "node:fs";
import process from "node:process";
const [H, P] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000").split(":");
const rules = readFileSync(process.env.RULES || "database.rules.json", "utf8");
const ADMIN = rules.match(/auth\.uid === '([A-Za-z0-9]+)'/)[1];
const env = await initializeTestEnvironment({ projectId: "demo-rt", database: { host: H, port: Number(P), rules } });
const NOW = Date.now(), DAY = 86400000, D = "2026-10-10";
await env.withSecurityRulesDisabled(async (ctx) => {
  await set(ref(ctx.database(), "/"), {
    users: { stu1: { profile: { name: "S1", phone: "+380501234567" }, isVip: false, discount: 0, hoursOffset: 0, blocked: false, firstLoginAt: 1 },
             stuB: { profile: { name: "B" }, blocked: true }, stu2: { profile: { name: "S2", phone: "+380679999999" } } },
    timeslots: { [D]: {
      slot1000: { time: "10:00", available: true },
      slot0830: { time: "08:30", available: true },
      slot1100: { time: "11:00", available: false, adminBlocked: true },
      slot1200: { time: "12:00", available: false, phantom: true, bookedBy: "stu1" },
      slot1400: { time: "14:00", available: false, bookingStart: true, bookedBy: "stu1" },
      slot1500: { time: "15:00", available: false, bookingStart: true, bookedBy: "stu2" },
      slot1530: { time: "15:30", available: false, phantom: true, bookedBy: "stu2" },
      slot1600: { time: "16:00", available: false, bookingStart: true },
      slot1300: { time: "13:00", available: true, vipOnly: true, surcharge: 100, durMin: 120, viewing: { stu2: 1 }, offeredTo: { stu1: { until: NOW + DAY }, stu2: { until: 1 } } },
      slot1700: { time: "17:00", available: true, reservedFor: "stu2", reservedUntil: NOW + DAY },
      slot1900: { time: "19:00", available: true, reservedFor: "stu1", reservedUntil: NOW + DAY, offeredTo: { stu1: { until: 1 } } },
      slot2000: { time: "20:00", available: true, someAdminObj: { a: 1, b: 2 }, personal: true },
    } },
    bookings: { stu1: { b1: { id: "b1", date: D, time: "14:00", status: "confirmed", price: 600, durationHours: 1, serviceType: "school", studentName: "S1", phone: "+380501234567", createdAt: 1, debtAmount: 100 },
                        b0: { id: "b0", date: D, time: "09:00", status: "completed", price: 600, durationHours: 1 } } },
    queue: { [`${D}_14:00`]: { entries: { stu2: { uid: "stu2", status: "waiting", name: "S2", phone: "+38", addedAt: 1, durationHours: 1, studentType: "school" } } } },
    queue_counts: { [D]: { "14:00": { n: 1, at: [1] } } },
    reviews: {}, chats: { general: {}, stu1: {} }, chatMeta: { stu1: {} }, dayNotes: { [D]: { text: "x" } }, bookings_by_phone: { "380501234567": { p1: { status: "confirmed" } } },
    admin_data: { services: [] }, license: { status: "trial" },
  });
});
const as = (uid) => env.authenticatedContext(uid).database();
const ADM = as(ADMIN), S1 = as("stu1"), S2 = as("stu2"), SB = as("stuB"), ANON = env.unauthenticatedContext().database();
let fails = 0;
async function t(name, expect, fn) {
  let ok; try { await fn(); ok = true } catch (e) { ok = false; if (process.env.V) console.log("   ", String(e.message).slice(0, 120)) }
  const pass = (expect === "ALLOW") === ok; if (!pass) fails++;
  console.log(`${pass ? "ok  " : "FAIL"} ${expect === "ALLOW" ? "ALLOW" : "DENY "} ${name}${pass ? "" : "   <-- got " + (ok ? "ALLOW" : "DENY")}`);
}
const A = "ALLOW", X = "DENY", R = (db, p) => ref(db, p);
const slotPath = (id) => `timeslots/${D}/${id}`;

// ---- Потоки учня: запис (db.js: claimSlot -> createBooking -> markSlotsUnavailable)
await t("claimSlot (transaction) on free real slot", A, () => runTransaction(R(S1, slotPath("slot1000")), c => ({ ...(c || {}), available: false, time: "10:00", bookingStart: true, bookedBy: "stu1" })));
await t("claimSlot on slot with admin fields + viewing/offeredTo objects (full-node rewrite)", A, () => runTransaction(R(S1, slotPath("slot1300")), c => ({ ...c, available: false, time: "13:00", bookingStart: true, bookedBy: "stu1" })));
await t("claimSlot on slot with unknown admin object field (full rewrite)", A, () => runTransaction(R(S1, slotPath("slot2000")), c => ({ ...c, available: false, time: "20:00", bookingStart: true, bookedBy: "stu1" })));
await t("claimSlot on NEW slot -> phantom", A, () => runTransaction(R(S1, slotPath("slot0900")), c => ({ ...(c || {}), phantom: true, available: false, time: "09:00", bookingStart: true, bookedBy: "stu1" })));
await t("claimSlot on slot reserved for other student", X, () => runTransaction(R(S1, slotPath("slot1700")), c => ({ ...c, available: false, bookingStart: true, bookedBy: "stu1" })));
await t("unclaimSlot (available:true, bookingStart:null, bookedBy:null)", A, () => update(R(S1, slotPath("slot1000")), { available: true, bookingStart: null, bookedBy: null }));
await t("markSlotsUnavailable multipath incl. new phantom", A, () => update(R(S1, "/"), {
  [`${slotPath("slot1030")}/phantom`]: true, [`${slotPath("slot1030")}/available`]: false, [`${slotPath("slot1030")}/time`]: "10:30", [`${slotPath("slot1030")}/bookingStart`]: false, [`${slotPath("slot1030")}/bookedBy`]: "stu1",
  [`${slotPath("slot1000")}/available`]: false, [`${slotPath("slot1000")}/time`]: "10:00", [`${slotPath("slot1000")}/bookingStart`]: true, [`${slotPath("slot1000")}/bookedBy`]: "stu1" }));
await t("createBooking (pending, client payload)", A, () => set(R(S1, "bookings/stu1/n1"), { date: D, time: "10:00", serviceType: "school", serviceId: "sv1", serviceName: "Автошкола 1 год", price: 600, manualPrice: 500, surcharge: 50, discountAmt: 10, durationHours: 1, studentName: "S1", phone: "+380501234567", studentNote: "hi", id: "n1", status: "pending", createdAt: NOW }));
await t("createBooking reschedule (rescheduledFrom)", A, () => set(R(S1, "bookings/stu1/n2"), { date: D, time: "15:00", price: 600, durationHours: 2, studentName: "S1", id: "n2", status: "pending", createdAt: NOW, rescheduledFrom: `${D} 14:00` }));
await t("createBooking with status confirmed", X, () => set(R(S1, "bookings/stu1/bad1"), { date: D, time: "16:00", durationHours: 1, id: "bad1", status: "confirmed", createdAt: NOW }));
await t("createBooking with createdBy:admin", X, () => set(R(S1, "bookings/stu1/bad2"), { date: D, time: "16:00", durationHours: 1, id: "bad2", status: "pending", createdBy: "admin", createdAt: NOW }));
await t("createBooking with extra field paid:true", X, () => set(R(S1, "bookings/stu1/bad3"), { date: D, time: "16:00", durationHours: 1, id: "bad3", status: "pending", paid: true, createdAt: NOW }));
await t("createBooking with date garbage", X, () => set(R(S1, "bookings/stu1/bad7"), { date: "xx", time: "10:00", durationHours: 1, id: "bad7", status: "pending", createdAt: NOW }));
await t("change booking date/time/duration", X, () => update(R(S1, "bookings/stu1/n2"), { date: "2026-12-01" }));
await t("createBooking with price -5", X, () => set(R(S1, "bookings/stu1/bad4"), { date: D, time: "16:00", durationHours: 1, id: "bad4", status: "pending", price: -5, createdAt: NOW }));
await t("createBooking for ANOTHER uid", X, () => set(R(S1, "bookings/stu2/bad5"), { date: D, time: "16:00", durationHours: 1, id: "bad5", status: "pending", createdAt: NOW }));
await t("createBooking by blocked student", X, () => set(R(SB, "bookings/stuB/bad6"), { date: D, time: "16:00", durationHours: 1, id: "bad6", status: "pending", createdAt: NOW }));
// скасування
await t("cancelBooking multipath: status/cancelledAt/cancelledBy + restore slot", A, () => update(R(S1, "/"), {
  "bookings/stu1/b1/status": "cancelled", "bookings/stu1/b1/cancelledAt": NOW, "bookings/stu1/b1/cancelledBy": "student",
  [`${slotPath("slot1400")}/available`]: true, [`${slotPath("slot1400")}/time`]: "14:00", [`${slotPath("slot1400")}/phantom`]: null, [`${slotPath("slot1400")}/bookingStart`]: null, [`${slotPath("slot1400")}/bookedBy`]: null,
  [slotPath("slot1200")]: null }));
await t("cancel reschedule (cancelledBy reschedule)", A, () => update(R(S1, "/"), { "bookings/stu1/n1/status": "cancelled", "bookings/stu1/n1/cancelledAt": NOW, "bookings/stu1/n1/cancelledBy": "reschedule" }));
await t("cancel completed booking", X, () => update(R(S1, "bookings/stu1/b0"), { status: "cancelled", cancelledAt: NOW, cancelledBy: "student" }));
await t("studentNote update", A, () => update(R(S1, "bookings/stu1/n2"), { studentNote: "x" }));
await t("studentConfirmed update", A, () => update(R(S1, "bookings/stu1/n2"), { studentConfirmed: true }));
await t("price change on own booking", X, () => update(R(S1, "bookings/stu1/n2"), { price: 1 }));
await t("remove price of own booking", X, () => update(R(S1, "bookings/stu1/b1"), { price: null }));
await t("clear debtAmount", X, () => update(R(S1, "bookings/stu1/b1"), { debtAmount: null }));
await t("status confirmed->completed by student", X, () => update(R(S1, "bookings/stu1/n2"), { status: "completed" }));
await t("delete own booking", X, () => remove(R(S1, "bookings/stu1/n2")));
await t("delete all own bookings", X, () => remove(R(S1, "bookings/stu1")));
await t("read other's bookings", X, () => get(R(S1, "bookings/stu2")));
// відгук
await t("submitReview multipath (review + booking.reviewed)", A, () => update(R(S1, "/"), { "reviews/stu1/r1": { studentName: "S1", bookingId: "b0", rating: 5, text: "ok", createdAt: NOW, status: "approved" }, "bookings/stu1/b0/reviewed": true }));
await t("review for nonexistent booking", X, () => set(R(S1, "reviews/stu1/r2"), { studentName: "S1", bookingId: "nope", rating: 5, text: "", createdAt: NOW, status: "approved" }));
await t("review rating 9", X, () => set(R(S1, "reviews/stu1/r3"), { studentName: "S1", bookingId: "n2", rating: 9, text: "", createdAt: NOW }));
await t("review for other uid", X, () => set(R(S1, "reviews/stu2/r4"), { studentName: "S1", bookingId: "b0", rating: 5, text: "", createdAt: NOW }));
await t("review status hidden by student", X, () => set(R(S1, "reviews/stu1/r5"), { studentName: "S1", bookingId: "n2", rating: 5, text: "", createdAt: NOW, status: "hidden" }));
await t("edit existing review", X, () => update(R(S1, "reviews/stu1/r1"), { rating: 1 }));
await t("anon reads reviews", A, () => get(R(ANON, "reviews")));
// профіль
await t("saveUserProfile (users/uid/profile set)", A, () => set(R(S1, "users/stu1/profile"), { name: "S1", phone: "+380501234567", studentType: "school", updatedAt: NOW }));
await t("markFirstLoginIfNew (new uid, transaction)", A, () => runTransaction(R(as("stuNew"), "users/stuNew/firstLoginAt"), c => c === null ? NOW : c));
await t("rewrite firstLoginAt", X, () => set(R(S1, "users/stu1/firstLoginAt"), 5));
await t("fcmTokens + studentTokens", A, () => set(R(S1, "users/stu1/fcmTokens/dev1"), "tok"));
await t("clearQueueOffer (remove)", A, () => remove(R(S1, "users/stu1/queueOffers/k")));
await t("write isVip", X, () => set(R(S1, "users/stu1/isVip"), true));
await t("write discount", X, () => set(R(S1, "users/stu1/discount"), 50));
await t("write hoursOffset", X, () => set(R(S1, "users/stu1/hoursOffset"), 50));
await t("write blocked:false (self-unblock)", X, () => set(R(SB, "users/stuB/blocked"), false));
await t("write customPrice", X, () => set(R(S1, "users/stu1/customPrice"), 1));
await t("write badges", X, () => set(R(S1, "users/stu1/badges/x"), true));
await t("update users/stu1 {isVip:true} at node level", X, () => update(R(S1, "users/stu1"), { isVip: true }));
await t("overwrite whole users/stu1", X, () => set(R(S1, "users/stu1"), { profile: { name: "x" }, isVip: true }));
await t("write other's profile", X, () => set(R(S1, "users/stu2/profile/name"), "hack"));
await t("read own users node", A, () => get(R(S1, "users/stu1")));
await t("read other users node", X, () => get(R(S1, "users/stu2")));
// timeslots заборони
await t("student sets adminBlocked on slot", X, () => update(R(S1, slotPath("slot1000")), { adminBlocked: true }));
await t("student changes surcharge", X, () => update(R(S1, slotPath("slot1300")), { surcharge: 0 }));
await t("student deletes real slot", X, () => remove(R(S1, slotPath("slot1100"))));
await t("student deletes whole day", X, () => remove(R(S1, `timeslots/${D}`)));
await t("student deletes all timeslots", X, () => remove(R(S1, "timeslots")));
await t("student creates free slot", X, () => set(R(S1, slotPath("slot0800")), { time: "08:00", available: true }));
await t("student writes timeslots/date/slot ={}", X, () => set(R(S1, `timeslots/2026-11-11/slot1000`), { time: "10:00", available: true }));
await t("student sets available:'yes'", X, () => update(R(S1, slotPath("slot1000")), { available: "yes" }));
await t("student takes reserved slot (reserved for stu2)", X, () => update(R(S1, slotPath("slot1700")), { available: false }));
await t("student sets reservedFor on a free slot", X, () => update(R(S1, slotPath("slot1000")), { reservedFor: "stu1", reservedUntil: NOW + DAY }));
await t("student changes reservedFor of other", X, () => update(R(S1, slotPath("slot1700")), { reservedFor: null }));
await t("viewing set own", A, () => set(R(S1, `${slotPath("slot1000")}/viewing/stu1`), NOW));
await t("viewing set on slot reserved for other", A, () => set(R(S1, `${slotPath("slot1700")}/viewing/stu1`), NOW));
await t("[residual] viewing set for other uid", A, () => set(R(S1, `${slotPath("slot1000")}/viewing/stu2`), NOW));
await t("viewing remove", A, () => remove(R(S1, `${slotPath("slot1300")}/viewing/stu2`)) .catch(e => { throw e }) ).catch(()=>{});
await t("claimReservedSlot multipath (own reservation + offeredTo)", A, () => update(R(S1, "/"), {
  [`queue/${D}_19:00/entries/stu1/status`]: "booked", [`${slotPath("slot1900")}/offeredTo/stu1`]: null, [`${slotPath("slot1900")}/reservedFor`]: null, [`${slotPath("slot1900")}/reservedUntil`]: null,
  [`${slotPath("slot1900")}/available`]: false, [`${slotPath("slot1900")}/bookedBy`]: "stu1" }));
await t("declineQueueOffer: remove own offeredTo", A, () => update(R(S1, "/"), { [`queue/${D}_13:00/entries/stu1`]: null, "userQueue/stu1/k": null, [`${slotPath("slot1300")}/offeredTo/stu1`]: null, "users/stu1/queueOffers/k": null }));
await t("[residual] student adds own offeredTo", A, () => set(R(S1, `${slotPath("slot1000")}/offeredTo/stu1`), { until: NOW }));
await t("[residual] student removes other's offeredTo", A, () => remove(R(S1, `${slotPath("slot1300")}/offeredTo/stu2`)));
// ---- Власність слотів (bookedBy)
await t("claim without bookedBy", X, () => update(R(S2, slotPath("slot1030")), { available: false, bookingStart: true }));
await t("claim with bookedBy of someone else", X, () => runTransaction(R(S2, slotPath("slot0830")), c => ({ ...(c || {}), available: false, time: "08:30", bookingStart: true, bookedBy: "stu1" })));
await t("claim own (bookedBy self) on free slot", A, () => runTransaction(R(S2, slotPath("slot0830")), c => ({ ...(c || {}), available: false, time: "08:30", bookingStart: true, bookedBy: "stu2" })));
await t("claim of already taken slot by other student (overwrite)", X, () => update(R(S1, slotPath("slot0830")), { available: false, bookedBy: "stu1" }));
await t("FREE other student's booked slot (available:true)", X, () => update(R(S1, slotPath("slot1500")), { available: true, bookingStart: null, bookedBy: null }));
await t("free other's slot keeping bookedBy", X, () => update(R(S1, slotPath("slot1500")), { available: true }));
await t("steal other's booked slot (bookedBy -> me)", X, () => update(R(S1, slotPath("slot1500")), { bookedBy: "stu1" }));
await t("clear bookedBy on other's slot", X, () => update(R(S1, slotPath("slot1500")), { bookedBy: null }));
await t("DELETE other student's phantom", X, () => remove(R(S1, slotPath("slot1530"))));
await t("free LEGACY booked slot (no bookedBy)", X, () => update(R(S1, slotPath("slot1600")), { available: true, bookingStart: null }));
await t("delete own phantom", A, () => remove(R(S2, slotPath("slot1530"))));
await t("free admin-blocked slot", X, () => update(R(S1, slotPath("slot1100")), { available: true }));
await t("free own slot (clears bookedBy)", A, () => update(R(S2, slotPath("slot1500")), { available: true, bookingStart: null, bookedBy: null }));
await t("free slot but leave bookedBy behind", X, () => update(R(S1, slotPath("slot1000")), { bookedBy: "stu1", available: true }));
await t("free slot sets bookedBy while available:true", X, () => update(R(S1, slotPath("slot2000")), { available: true, bookedBy: "stu1" }));
await t("admin frees legacy slot", A, () => update(R(ADM, slotPath("slot1600")), { available: true, bookingStart: null }));
await t("admin sets bookedBy for a student", A, () => update(R(ADM, slotPath("slot1000")), { available: false, bookedBy: "stu2" }));
await t("anon reads timeslots", A, () => get(R(ANON, "timeslots")));
await t("admin writes admin fields on slot", A, () => update(R(ADM, slotPath("slot1000")), { adminBlocked: true, vipOnly: true, surcharge: 5, fixedPrice: 1, durMin: 90, personal: true }));
await t("admin deletes day", A, () => remove(R(ADM, `timeslots/${D}`)));
// черга
await t("joinQueue multipath (entry + userQueue)", A, () => update(R(S1, "/"), { [`queue/${D}_10:00/entries/stu1`]: { uid: "stu1", studentType: "school", durationHours: 1, name: "S1", phone: "+380501234567", addedAt: NOW, status: "waiting" }, "userQueue/stu1/k": true }));
await t("joinQueue by blocked student", X, () => update(R(SB, "/"), { [`queue/${D}_10:00/entries/stuB`]: { uid: "stuB", studentType: "school", durationHours: 1, name: "B", phone: "", addedAt: NOW, status: "waiting" }, "userQueue/stuB/k": true }));
await t("queue entry with status offered", X, () => set(R(S1, `queue/${D}_10:00/entries/stu1/status`), "offered"));
await t("queue entry for other uid", X, () => set(R(S1, `queue/${D}_10:00/entries/stu2`), { uid: "stu2", status: "waiting" }));
await t("leaveQueue", A, () => update(R(S1, "/"), { [`queue/${D}_10:00/entries/stu1`]: null, "userQueue/stu1/k": null }));
await t("read queue entries list (authed student) -> hidden", X, () => get(R(S1, `queue/${D}_14:00/entries`)));
await t("read OTHER student's queue entry", X, () => get(R(S1, `queue/${D}_14:00/entries/stu2`)));
await t("read OWN queue entry", A, () => get(R(S2, `queue/${D}_14:00/entries/stu2`)));
await t("admin reads whole queue", A, () => get(R(ADM, "queue")));
await t("admin reads queue entries", A, () => get(R(ADM, `queue/${D}_14:00/entries`)));
await t("read queue_counts (authed)", A, () => get(R(S1, `queue_counts/${D}`)));
await t("anon read queue_counts", X, () => get(R(ANON, `queue_counts/${D}`)));
await t("student writes queue_counts", X, () => set(R(S1, `queue_counts/${D}/14:00`, ), { n: 0, at: [] }));
await t("student deletes queue_counts", X, () => remove(R(S1, "queue_counts")));
await t("admin writes queue_counts", A, () => set(R(ADM, `queue_counts/${D}/15:00`), { n: 2, at: [1, 2] }));
await t("anon read queue entries", X, () => get(R(ANON, `queue/${D}_14:00/entries`)));
await t("read whole queue", X, () => get(R(S1, "queue")));
// чати
await t("send direct message (push + chatMeta update)", A, async () => { await push(R(S1, "chats/stu1"), { from: "student", text: "hi", time: "10:00", ts: NOW }); await update(R(S1, "chatMeta/stu1"), { unreadForAdmin: 1, lastMsg: "hi", lastTs: NOW }); });
await t("markDirectChatRead", A, () => set(R(S1, "chatMeta/stu1/unreadForStudent"), 0));
await t("general chat message (client payload)", A, () => push(R(S1, "chats/general"), { uid: "stu1", name: "S1", from: "student", text: "hello", time: "10:00", ts: NOW }));
await t("general chat as other uid", X, () => push(R(S1, "chats/general"), { uid: "stu2", name: "S2", from: "student", text: "hello", time: "10:00", ts: NOW }));
await t("general chat from:admin by student", X, () => push(R(S1, "chats/general"), { uid: "stu1", name: "S1", from: "admin", text: "hello", time: "10:00", ts: NOW }));
await t("general chat 5000 chars", X, () => push(R(S1, "chats/general"), { uid: "stu1", text: "x".repeat(5000), ts: NOW }));
await t("general chat wipe", X, () => remove(R(S1, "chats/general")));
await t("general chat overwrite msg", X, async () => { const r = await push(R(ADM, "chats/general"), { uid: "__admin__", from: "admin", text: "a", ts: NOW }); await set(R(S1, `chats/general/${r.key}/text`), "hacked"); });
await t("admin posts general", A, () => push(R(ADM, "chats/general"), { from: "admin", uid: "__admin__", name: "Інструктор", text: "yo", time: "1", ts: NOW }));
await t("student reads general chat", A, () => get(R(S1, "chats/general")));
await t("student reads chatMeta/general", X, () => get(R(S1, "chatMeta/general")));
// різне
await t("student reads dayNotes", X, () => get(R(S1, "dayNotes")));
await t("admin reads dayNotes", A, () => get(R(ADM, "dayNotes")));
await t("student writes recentStudents", X, () => set(R(S1, "recentStudents/stu1"), NOW));
await t("student reads bookings_by_phone of OWN profile phone", A, () => get(R(S1, "bookings_by_phone/380501234567")));
await t("student reads bookings_by_phone of ANOTHER phone", X, () => get(R(S2, "bookings_by_phone/380501234567")));
await t("student reads bookings_by_phone of unknown phone", X, () => get(R(S1, "bookings_by_phone/380000000000")));
await t("student without profile phone reads bookings_by_phone", X, () => get(R(as("stuNew"), "bookings_by_phone/380501234567")));
await t("student reads whole bookings_by_phone", X, () => get(R(S1, "bookings_by_phone")));
await t("admin reads bookings_by_phone", A, () => get(R(ADM, "bookings_by_phone/380501234567")));
await t("student writes bookings_by_phone", X, () => set(R(S1, "bookings_by_phone/380501234567/x"), { a: 1 }));
await t("student reads admin_data/services", A, () => get(R(S1, "admin_data/services")));
await t("anon reads admin_settings", A, () => get(R(ANON, "admin_settings")));
await t("student writes admin_settings", X, () => set(R(S1, "admin_settings/x"), 1));
await t("notifications clear own", A, () => remove(R(S1, "notifications/stu1/n")));
await t("studentTokens own", A, () => set(R(S1, "studentTokens/stu1/dev1"), "t"));
await t("admin writes booking confirmed + price", A, () => update(R(ADM, "bookings/stu1/n2"), { status: "confirmed", price: 700, debtAmount: 5, paid: true }));
await t("admin creates booking createdBy admin", A, () => set(R(ADM, "bookings/guest_380/x"), { status: "confirmed", createdBy: "admin" }));
await t("admin sets users isVip", A, () => update(R(ADM, "users/stu1"), { isVip: true, discount: 5 }));
await t("admin reads users root", A, () => get(R(ADM, "users")));
console.log(fails ? `\n${fails} FAILED` : "\nALL OK");
await env.cleanup();
process.exit(fails ? 1 : 0);
