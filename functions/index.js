const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueUpdated, onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.database();

// Push адміну коли учень відміняє урок
exports.onStudentCancel = onValueUpdated(
  { ref: "bookings/{uid}/{bookingId}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();
    if (!after || after.cancelledBy !== "student" || before.cancelledBy === "student") return;

    const adminTokenSnap = await db.ref("admin/fcmToken").get();
    const token = adminTokenSnap.val();
    if (!token) return;

    const name = after.studentName || after.name || "Учень";
    const date = after.date || "—";
    const time = after.time || "—";

    await admin.messaging().send({
      token,
      notification: {
        title: "❌ Урок скасовано",
        body: `${name} · ${date} о ${time}`,
      },
      webpush: {
        notification: { icon: "/favicon.svg" },
        fcmOptions: { link: "https://admin.id4drive.pro" },
      },
    }).catch(() => {});
  }
);

// Запросити з черги — резервує слот і пушить студента
exports.onQueueInvite = onValueUpdated(
  { ref: "queue/{slotKey}/entries/{uid}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();
    if (!after || after.status !== "offered" || before?.status === "offered") return;

    const uid     = event.params.uid;
    const slotKey = event.params.slotKey; // "2026-06-10_09:00"
    const [date, time] = slotKey.split("_");
    if (!date || !time) return;
    const slotId = `slot${time.replace(":", "")}`;

    // Резервуємо слот на 30 хв
    const reservedUntil = Date.now() + 30 * 60 * 1000;
    await db.ref(`timeslots/${date}/${slotId}`).update({ reservedFor: uid, reservedUntil }).catch(() => {});

    // FCM токен студента
    const tokenSnap = await db.ref(`users/${uid}/fcmTokens/web/token`).get();
    const token = tokenSnap.val();
    if (!token) return;

    await admin.messaging().send({
      token,
      notification: {
        title: "🎉 Слот зарезервовано для вас!",
        body: `${date} о ${time} — у вас 30 хвилин щоб записатись`,
      },
      webpush: {
        notification: { icon: "/favicon.svg" },
        fcmOptions: { link: "https://id4drive.pro" },
      },
    }).catch(() => {});
  }
);

// Кожні 15 хв — знімає прострочені резервації (30-хв вікно)
exports.clearExpiredReservations = onSchedule({ schedule: "every 15 minutes", region: "europe-west1" }, async () => {
  const now = Date.now();
  const slotsSnap = await db.ref("timeslots").get();
  const data = slotsSnap.val() || {};
  const updates = {};
  for (const [date, dateSlots] of Object.entries(data)) {
    if (!dateSlots || typeof dateSlots !== "object") continue;
    for (const [slotId, slot] of Object.entries(dateSlots)) {
      if (slot.reservedFor && slot.reservedUntil && slot.reservedUntil < now) {
        updates[`timeslots/${date}/${slotId}/reservedFor`]  = null;
        updates[`timeslots/${date}/${slotId}/reservedUntil`] = null;
      }
    }
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
});

// Runs every hour — unlocks VIP slots within 48h and sends push to all non-VIP students
exports.unlockVipSlots = onSchedule("every 1 hours", async () => {
  const now = Date.now();
  const threshold = now + 48 * 60 * 60 * 1000;

  const slotsSnap = await db.ref("timeslots").get();
  const slotsData = slotsSnap.val() || {};

  const updates = {};
  let unlocked = false;

  for (const [date, dateSlots] of Object.entries(slotsData)) {
    if (!dateSlots || typeof dateSlots !== "object") continue;
    for (const [slotId, slot] of Object.entries(dateSlots)) {
      if (!slot.vipOnly || slot.available === false) continue;
      const time = slot.time;
      if (!time) continue;
      const slotMs = new Date(`${date}T${time}:00`).getTime();
      if (slotMs > now && slotMs <= threshold) {
        updates[`timeslots/${date}/${slotId}/vipOnly`] = false;
        unlocked = true;
      }
    }
  }

  if (!unlocked) return;
  await db.ref().update(updates);

  // Collect FCM tokens of non-VIP students
  const usersSnap = await db.ref("users").get();
  const usersData = usersSnap.val() || {};
  const tokens = Object.values(usersData)
    .filter(u => u.fcmToken && !u.isVip)
    .map(u => u.fcmToken);

  if (!tokens.length) return;

  const messaging = admin.messaging();
  for (let i = 0; i < tokens.length; i += 500) {
    await messaging.sendEachForMulticast({
      tokens: tokens.slice(i, i + 500),
      notification: {
        title: "🚗 З'явились нові слоти!",
        body: "Відкрились нові години для запису. Поспішай!",
      },
      webpush: {
        notification: { icon: "/favicon.svg" },
        fcmOptions: { link: "https://id4drive.pro/book" },
      },
    }).catch(() => {});
  }
});
