const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueUpdated } = require("firebase-functions/v2/database");
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
