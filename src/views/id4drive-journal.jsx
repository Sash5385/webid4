import React, { useState, useEffect, useContext } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { ThemeContext } from "../theme.js";

export const JOURNAL_READ_KEY = "journal_read_at";

export function getJournalReadAt() {
  return parseInt(localStorage.getItem(JOURNAL_READ_KEY) || "0", 10);
}

export function setJournalReadAt() {
  localStorage.setItem(JOURNAL_READ_KEY, Date.now().toString());
}

export function countJournalUnread(data) {
  const readAt = getJournalReadAt();
  if (!data || !readAt) return 0;
  let count = 0;
  Object.values(data).forEach(userBkgs => {
    if (!userBkgs) return;
    Object.values(userBkgs).forEach(b => {
      if (!b) return;
      if (b.createdAt    && b.createdAt    > readAt) count++;
      if (b.cancelledAt  && b.cancelledAt  > readAt) count++;
      if (b.rescheduledAt && b.rescheduledAt > readAt) count++;
    });
  });
  return count;
}

function formatDT(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildEvents(data) {
  const evs = [];
  if (!data) return evs;
  Object.values(data).forEach(userBkgs => {
    if (!userBkgs) return;
    Object.entries(userBkgs).forEach(([key, b]) => {
      if (!b) return;
      const name = b.studentName || b.name || "Без імені";
      const dateStr = b.date ? b.date.split("-").reverse().join(".") : "";
      const slot = [dateStr, b.time].filter(Boolean).join(" ");
      if (b.createdAt)     evs.push({ id: `${key}_new`,        type: "new",        ts: b.createdAt,     name, slot, by: b.createdBy   || "" });
      if (b.cancelledAt)   evs.push({ id: `${key}_cancel`,     type: "cancel",     ts: b.cancelledAt,   name, slot, by: b.cancelledBy  || "" });
      if (b.rescheduledAt) evs.push({ id: `${key}_reschedule`, type: "reschedule", ts: b.rescheduledAt, name, slot, by: "" });
    });
  });
  return evs.sort((a, b) => b.ts - a.ts);
}

const EVENT_TYPES = {
  new:        { label: "Новий запис", color: "#34d399", icon: "+" },
  cancel:     { label: "Скасовано",   color: "#f87171", icon: "✕" },
  reschedule: { label: "Перенос",     color: "#fbbf24", icon: "↩" },
};

const BY_LABEL = { admin: "адмін", client: "учень" };

export default function JournalView() {
  const theme = useContext(ThemeContext);
  const [events,   setEvents]  = useState([]);
  const [filter,   setFilter]  = useState("all");
  // capture previous readAt before marking as read so we can show "unread" correctly this session
  const [prevReadAt] = useState(getJournalReadAt);

  useEffect(() => {
    setJournalReadAt();
    const unsub = onValue(ref(db, "bookings"), snap => {
      setEvents(buildEvents(snap.val()));
    });
    return unsub;
  }, []);

  const unreadCount = events.filter(e => e.ts > prevReadAt).length;
  const filtered    = filter === "unread" ? events.filter(e => e.ts > prevReadAt) : events;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[
          ["all",    "Всі"],
          ["unread", `Непрочитані${unreadCount > 0 ? ` (${unreadCount})` : ""}`],
        ].map(([id, lbl]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: "5px 14px", borderRadius: 12, border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filter === id ? theme.ACCENT : theme.SURF_LO,
            color: filter === id ? "#fff" : theme.DIM,
            transition: "all .15s",
          }}>{lbl}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: theme.DIM }}>{events.length} подій</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: theme.DIM, fontSize: 13, paddingTop: 40 }}>
          {filter === "unread" ? "Немає нових подій" : "Журнал порожній"}
        </div>
      )}

      {filtered.map(ev => {
        const meta    = EVENT_TYPES[ev.type] || { label: ev.type, color: theme.ACCENT, icon: "•" };
        const isNew   = ev.ts > prevReadAt;
        const byLabel = BY_LABEL[ev.by] || ev.by;
        return (
          <div key={ev.id} style={{
            background: theme.SURFACE,
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            border: `1px solid ${isNew ? meta.color + "55" : theme.BORDER}`,
          }}>
            {/* icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${meta.color}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, fontWeight: 800, color: meta.color,
            }}>{meta.icon}</div>

            {/* content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                <span style={{ fontSize: 10, color: theme.DIM, flexShrink: 0 }}>{formatDT(ev.ts)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.TEXT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.name}</div>
              {ev.slot   && <div style={{ fontSize: 11, color: theme.DIM, marginTop: 1 }}>{ev.slot}</div>}
              {byLabel   && <div style={{ fontSize: 10, color: theme.DIM, marginTop: 1 }}>хто: {byLabel}</div>}
            </div>

            {/* unread dot */}
            {isNew && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0, marginTop: 4 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
