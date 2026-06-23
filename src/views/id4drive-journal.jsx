import React, { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

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
      if (b.createdAt     && b.createdAt     > readAt) count++;
      if (b.cancelledAt   && b.cancelledAt   > readAt) count++;
      if (b.rescheduledAt && b.rescheduledAt > readAt) count++;
    });
  });
  return count;
}

function formatDT(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  if (isToday)     return time;
  if (isYesterday) return `вчора ${time}`;
  return `${p(d.getDate())}.${p(d.getMonth()+1)} ${time}`;
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

const BY_LABEL = { admin: "адмін", client: "учень" };
const ROW_H = 72;

// Mint/sage palette — light green skin inspired by clean insurance app design
const M = {
  TEXT:    "#0f3d2a",
  DIM:     "#4d8a6e",
  CARD:    "#ffffff",
  CBORDER: "rgba(15,100,70,0.09)",
  CSHADOW: "0 2px 14px rgba(15,100,70,0.09)",
  PILL_A:  "#0f3d2a",
  PILL_AT: "#ffffff",
  PILL_I:  "rgba(15,61,42,0.09)",
  PILL_IT: "#4d8a6e",
  WRAP:    "linear-gradient(160deg,#c4e8d4 0%,#d9eef6 55%,#dce6f5 100%)",
  GREEN:   "#059669",
  RED:     "#dc2626",
  GOLD:    "#d97706",
};

const EVENT_META = {
  new:        { label: "Новий запис", color: M.GREEN, bg: "#d1fae5", border: "rgba(5,150,105,0.25)",  icon: "📅" },
  cancel:     { label: "Скасовано",   color: M.RED,   bg: "#fee2e2", border: "rgba(220,38,38,0.25)",  icon: "✗"  },
  reschedule: { label: "Перенос",     color: M.GOLD,  bg: "#fef3c7", border: "rgba(217,119,6,0.25)",  icon: "↔"  },
};

function EventIcon({ type }) {
  const meta = EVENT_META[type] || { color: M.GREEN, bg: "#d1fae5", border: "rgba(5,150,105,0.25)", icon: "•" };
  return (
    <div style={{
      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
      background: meta.bg,
      border: `1.5px solid ${meta.border}`,
      boxShadow: `0 2px 8px ${meta.color}20`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: meta.color }}>{meta.icon}</span>
    </div>
  );
}

export default function JournalView() {
  const [events,     setEvents]    = useState([]);
  const [filter,     setFilter]    = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [prevReadAt] = useState(getJournalReadAt);

  useEffect(() => {
    setJournalReadAt();
    const unsub = onValue(ref(db, "bookings"), snap => {
      setEvents(buildEvents(snap.val()));
    });
    return unsub;
  }, []);

  const unreadCount = events.filter(e => e.ts > prevReadAt).length;
  const byRead      = filter === "unread" ? events.filter(e => e.ts > prevReadAt) : events;
  const filtered    = typeFilter === "all" ? byRead : byRead.filter(e => e.type === typeFilter);

  return (
    <div style={{
      borderRadius: 20,
      background: M.WRAP,
      padding: "14px 12px 12px",
      margin: "-4px -4px 0",
    }}>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        {[
          ["all",    "Всі"],
          ["unread", `Непрочитані${unreadCount > 0 ? ` (${unreadCount})` : ""}`],
        ].map(([id, lbl]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: "6px 16px", borderRadius: 20, border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filter === id ? M.PILL_A : M.PILL_I,
            color: filter === id ? M.PILL_AT : M.PILL_IT,
            boxShadow: filter === id ? "0 2px 8px rgba(15,61,42,0.25)" : "none",
            transition: "all .15s",
          }}>{lbl}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: M.DIM }}>{filtered.length} подій</span>
      </div>

      {/* Type filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {[
          ["all",        "Всі типи",    M.DIM],
          ["cancel",     "Скасовано",   M.RED],
          ["new",        "Новий запис", M.GREEN],
          ["reschedule", "Перенос",     M.GOLD],
        ].map(([id, lbl, color]) => {
          const active = typeFilter === id;
          return (
            <button key={id} onClick={() => setTypeFilter(id)} style={{
              padding: "5px 13px", borderRadius: 20,
              border: `1.5px solid ${active ? color : "rgba(15,61,42,0.15)"}`,
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: active ? `${color}18` : "rgba(255,255,255,0.55)",
              color: active ? color : M.DIM,
              transition: "all .15s",
            }}>{lbl}</button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: M.DIM, fontSize: 13, paddingTop: 40 }}>
          {filter === "unread" ? "Немає нових подій" : "Журнал порожній"}
        </div>
      )}

      {filtered.map((ev, i) => {
        const meta    = EVENT_META[ev.type] || { label: ev.type, color: M.GREEN, bg: "#d1fae5", border: "rgba(5,150,105,0.25)", icon: "•" };
        const isNew   = ev.ts > prevReadAt;
        const byLabel = BY_LABEL[ev.by] || ev.by;

        return (
          <div key={ev.id} style={{
            background: M.CARD,
            borderRadius: 16,
            boxShadow: M.CSHADOW,
            border: `1px solid ${M.CBORDER}`,
            padding: "0 12px",
            marginBottom: i < filtered.length - 1 ? 8 : 0,
          }}>
            <div style={{
              height: ROW_H,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <EventIcon type={ev.type} />

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Row 1: event type + time */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: meta.color,
                  }}>{meta.label}</span>
                  <span style={{
                    fontSize: 11, flexShrink: 0,
                    color: isNew ? meta.color : M.DIM,
                    fontWeight: isNew ? 700 : 400,
                  }}>{formatDT(ev.ts)}</span>
                </div>

                {/* Row 2: name · slot · by */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginTop: 3, overflow: "hidden",
                }}>
                  <span style={{
                    fontSize: 14, fontWeight: isNew ? 800 : 600,
                    color: M.TEXT,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1,
                  }}>{ev.name}</span>
                  {ev.slot && (
                    <span style={{ fontSize: 11, color: M.DIM, flexShrink: 0, whiteSpace: "nowrap" }}>· {ev.slot}</span>
                  )}
                  {byLabel && (
                    <span style={{ fontSize: 11, color: M.DIM, flexShrink: 0, whiteSpace: "nowrap" }}>· від: {byLabel}</span>
                  )}
                </div>
              </div>

              {/* Unread dot */}
              {isNew && (
                <div style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: meta.color, flexShrink: 0,
                  boxShadow: `0 0 6px ${meta.color}88`,
                }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
