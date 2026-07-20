const { google } = require("googleapis");
const { defineSecret } = require("firebase-functions/params");

const CALENDAR_TIMEZONE = "Europe/Kyiv";

const googleClientId = defineSecret("GOOGLE_CALENDAR_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_CALENDAR_CLIENT_SECRET");
const googleRefreshToken = defineSecret("GOOGLE_CALENDAR_REFRESH_TOKEN");

const CALENDAR_SECRETS = [googleClientId, googleClientSecret, googleRefreshToken];

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    googleClientId.value(),
    googleClientSecret.value()
  );
  oauth2Client.setCredentials({ refresh_token: googleRefreshToken.value() });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// Той самий розрахунок дати/тривалості, що й buildSlotUpdates в index.js
function computeRange(booking) {
  const { date, time, durationHours, durMin, startMin } = booking || {};
  if (!date || (!time && startMin == null)) return null;

  let start;
  if (startMin != null) {
    start = startMin;
  } else {
    const [h, m] = (time || "0:0").split(":").map(Number);
    start = h * 60 + m;
  }
  const dur = durMin ?? ((durationHours || 1) * 60);
  const end = start + dur;

  const toDateTime = (totalMin) => {
    const dayOffset = Math.floor(totalMin / 1440);
    const mins = ((totalMin % 1440) + 1440) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + dayOffset);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${MM}-${DD}T${hh}:${mm}:00`;
  };

  return { startDateTime: toDateTime(start), endDateTime: toDateTime(end) };
}

function buildEvent(booking, bookingId, uid) {
  const range = computeRange(booking);
  if (!range) return null;
  return {
    summary: `Урок водіння — ${booking.studentName || "Учень"}`,
    start: { dateTime: range.startDateTime, timeZone: CALENDAR_TIMEZONE },
    end: { dateTime: range.endDateTime, timeZone: CALENDAR_TIMEZONE },
    extendedProperties: {
      private: { appSource: "id4drive", bookingId, uid },
    },
  };
}

function isIgnorableCalendarError(err) {
  const status = err?.code ?? err?.response?.status;
  return status === 404 || status === 410;
}

module.exports = {
  CALENDAR_SECRETS,
  getCalendarClient,
  buildEvent,
  isIgnorableCalendarError,
};
