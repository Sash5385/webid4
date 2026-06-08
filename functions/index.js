const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueUpdated, onValueWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.database();

const OFFER_WINDOW_MS = 30 * 60 * 1000; // 30 хвилин

// Хелпер: зберегти сповіщення в RTDB для студента
async function saveNotification(uid, title, body, type = "system") {
  const ts = Date.now();
  const time = new Date(ts).toLocaleTimeString("uk", { hour: "2-digit", minute: "2-digit" });
  const date = new Date(ts).toLocaleDateString("uk", { day: "2-digit", month: "2-digit", year: "numeric" });
  await db.ref(`notifications/${uid}`).push({ title, body, type, ts, time, date }).catch(() => {});
}

// Хелпер: відправити push студенту
async function pushStudent(uid, title, body, data = {}) {
  const snap = await db.ref(`users/${uid}/fcmTokens/web/token`).get();
  const token = snap.val();
  if (!token) return;
  const link = data.url || "https://id4drive.pro/cabinet";
  await admin.messaging().send({
    token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries({ url: link, ...data }).map(([k,v]) => [k, String(v)])),
    webpush: {
      notification: { icon: "/favicon.svg" },
      fcmOptions: { link },
    },
  }).catch(() => {});
}

// Хелпер: запросити наступного в черзі для слота
async function inviteNextInQueue(slotKey, excludeUids = []) {
  const entriesSnap = await db.ref(`queue/${slotKey}/entries`).get();
  if (!entriesSnap.exists()) return;
  const entries = Object.entries(entriesSnap.val())
    .map(([uid, e]) => ({ uid, ...e }))
    .filter(e => e.status === "waiting" && !excludeUids.includes(e.uid))
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  if (!entries.length) return;
  const next = entries[0];
  await db.ref(`queue/${slotKey}/entries/${next.uid}`).update({ status: "offered" });
  // onQueueInvite спрацює автоматично
}

// Хелпер: відправити push адміну
async function pushAdmin(title, body) {
  const snap = await db.ref("admin/fcmToken").get();
  const token = snap.val();
  if (!token) { console.log("pushAdmin: no token at admin/fcmToken"); return; }
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      webpush: {
        notification: { icon: "/favicon.svg" },
        fcmOptions: { link: "https://admin.id4drive.pro" },
      },
    });
    console.log(`pushAdmin OK: ${title}`);
  } catch (e) {
    console.error("pushAdmin error:", e.code, e.message);
  }
}

// Всі зміни букінгу → push адміну або клієнту
exports.onBookingChanged = onValueWritten(
  { ref: "bookings/{uid}/{bookingId}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();
    const uid    = event.params.uid;
    const name   = (after || before)?.studentName || "Учень";
    const date   = (after || before)?.date || "—";
    const time   = (after || before)?.time || "—";

    // Новий запис (before = null)
    if (before === null && after && after.cancelledBy !== "admin") {
      console.log(`onBookingChanged: new booking uid=${uid}`);
      await pushAdmin("📋 Новий запис", `${name} · ${date} о ${time}`);
      return;
    }

    if (!before || !after) return;

    // Учень скасував
    if (after.cancelledBy === "student" && before.cancelledBy !== "student") {
      console.log(`onBookingChanged: student cancel uid=${uid}`);
      await pushAdmin("❌ Урок скасовано", `${name} · ${date} о ${time}`);
      return;
    }

    // Адмін підтвердив
    if (after.status === "confirmed" && before.status !== "confirmed") {
      console.log(`onBookingChanged: admin confirmed uid=${uid}`);
      await pushStudent(uid, "✅ Урок підтверджено", `${date} о ${time}`, {
        url: "https://id4drive.pro/cabinet/bookings",
      });
      await saveNotification(uid, "✅ Урок підтверджено", `${date} о ${time}`, "booking_confirmed");
      return;
    }

    // Адмін скасував
    if (after.status === "cancelled" && before.status !== "cancelled" && after.cancelledBy === "admin") {
      console.log(`onBookingChanged: admin cancelled uid=${uid}`);
      await pushStudent(uid, "❌ Урок скасовано", `${date} о ${time}`, {
        url: "https://id4drive.pro/cabinet/bookings",
      });
      await saveNotification(uid, "❌ Урок скасовано", `${date} о ${time}`, "booking_cancelled");
      return;
    }

    // Адмін переніс урок (змінилась дата або час, статус активний)
    const rescheduled = after.status !== "cancelled" &&
      (after.date !== before.date || after.time !== before.time);
    if (rescheduled) {
      const oldDate = before.date || "—";
      const oldTime = before.time || "—";
      const body = `Новий час: ${date} о ${time} (було ${oldDate} о ${oldTime})`;
      console.log(`onBookingChanged: rescheduled uid=${uid}`);
      await pushStudent(uid, "🔄 Урок перенесено", body, {
        url: "https://id4drive.pro/cabinet/bookings",
      });
      await saveNotification(uid, "🔄 Урок перенесено", body, "booking_rescheduled");
      return;
    }
  }
);

// Кнопка "Запросити": записує offeredTo/{uid} і пушить студента
exports.onQueueInvite = onValueUpdated(
  { ref: "queue/{slotKey}/entries/{uid}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();
    if (!after || after.status !== "offered" || before?.status === "offered") return;

    const uid     = event.params.uid;
    const slotKey = event.params.slotKey; // "2026-06-10_09:00"
    const sep = slotKey.lastIndexOf("_");
    const date = slotKey.slice(0, sep);
    const time = slotKey.slice(sep + 1);
    if (!date || !time) return;
    const slotId = `slot${time.replace(":", "")}`;

    // Додаємо uid до offeredTo зі строком дії (перший → теж залишається)
    const until = Date.now() + OFFER_WINDOW_MS;
    await db.ref(`timeslots/${date}/${slotId}/offeredTo/${uid}`).set({ until }).catch(() => {});

    // In-app сповіщення: клієнт підписаний на цей шлях
    await db.ref(`users/${uid}/queueOffers/${slotKey}`).set({ date, time, until, slotKey }).catch(() => {});

    const url = `https://id4drive.pro/cabinet?date=${date}&time=${encodeURIComponent(time)}`;
    const pushTitle = "🎉 Слот зарезервовано для вас!";
    const pushBody = `${date} о ${time} — у вас 30 хвилин щоб записатись`;
    await pushStudent(uid, pushTitle, pushBody, { url, date, time, slotKey });
    await saveNotification(uid, pushTitle, pushBody, "queue_offer");
  }
);


// Кожні 10 хв: для кожного спроченого offeredTo → запрошує наступного
// (першому резерв залишається — він може й надалі записатися)
exports.cascadeQueueInvites = onSchedule({ schedule: "every 10 minutes", region: "europe-west1" }, async () => {
  const now = Date.now();
  const slotsSnap = await db.ref("timeslots").get();
  const data = slotsSnap.val() || {};

  for (const [date, dateSlots] of Object.entries(data)) {
    if (!dateSlots || typeof dateSlots !== "object") continue;
    for (const [slotId, slot] of Object.entries(dateSlots)) {
      if (!slot.offeredTo) continue;
      if (slot.available === false) continue; // слот вже зайнятий

      const time = slot.time;
      if (!time) continue;
      const slotKey = `${date}_${time}`;

      const expiredUids = [];
      for (const [uid, offer] of Object.entries(slot.offeredTo)) {
        if (offer.until < now) expiredUids.push(uid);
      }

      if (!expiredUids.length) continue;

      // Всі хто вже отримав запрошення (offered/expired) — щоб не повторювати
      const alreadyOfferedSnap = await db.ref(`queue/${slotKey}/entries`).get();
      const alreadyOffered = alreadyOfferedSnap.exists()
        ? Object.entries(alreadyOfferedSnap.val())
            .filter(([, e]) => e.status === "offered" || e.status === "booked")
            .map(([uid]) => uid)
        : [];

      // Запрошуємо наступного (першому резерв НЕ видаляємо)
      await inviteNextInQueue(slotKey, alreadyOffered);
    }
  }
});

// Адмін відкрив заблокований слот → запрошуємо першого в черзі
exports.onAdminSlotOpened = onValueWritten(
  { ref: "timeslots/{date}/{slotId}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before?.val();
    const after  = event.data.after?.val();
    if (!before || !after) return;
    // Тригер тільки: adminBlocked true → false, available → true
    if (before.adminBlocked !== true) return;
    if (after.adminBlocked !== false || after.available !== true) return;

    const { date } = event.params;
    const time = after.time;
    if (!time) return;

    const slotKey = `${date}_${time}`;
    const qSnap = await db.ref(`queue/${slotKey}/entries`).get();
    if (!qSnap.exists()) return;

    const entries = Object.entries(qSnap.val())
      .map(([uid, e]) => ({ uid, ...e }))
      .filter(e => e.status === "waiting")
      .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    if (!entries.length) return;
    // Ставимо першого як "offered" → onQueueInvite відправить push і зарезервує слот
    await db.ref(`queue/${slotKey}/entries/${entries[0].uid}`).update({ status: "offered" });
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

  const usersSnap = await db.ref("users").get();
  const usersData = usersSnap.val() || {};
  const tokens = Object.values(usersData)
    .filter(u => u.fcmToken && !u.isVip)
    .map(u => u.fcmToken);
  if (!tokens.length) return;

  for (let i = 0; i < tokens.length; i += 500) {
    await admin.messaging().sendEachForMulticast({
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
