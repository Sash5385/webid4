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

function EventIcon({ color, icon, isKava, theme }) {
  return (
    <div style={{
      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
      background: isKava
        ? `linear-gradient(145deg,${theme.SURF_HI},${theme.SURF_LO})`
        : `${color}18`,
      border: `1.5px solid ${color}${isKava ? "99" : "44"}`,
      boxShadow: isKava
        ? theme.SI
        : `0 2px 8px ${color}28`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* specular highlight on kava */}
      {isKava && (
        <div style={{
          position: "absolute", top: 0, right: 0, width: "60%", height: "50%",
          background: `radial-gradient(ellipse at top right,rgba(255,250,243,0.45) 0%,transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}
      <span style={{
        position: "relative", zIndex: 1,
        fontSize: 20, fontWeight: 800, color,
      }}>{icon}</span>
    </div>
  );
}

export default function JournalView() {
  const theme   = useContext(ThemeContext);
  const isKava  = !!theme.BG_IMAGE;

  // event type colors come from theme — correct on both dark & kava
  const EVENT_TYPES = {
    new:        { label: "Новий запис", color: theme.GREEN, icon: "📅" },
    cancel:     { label: "Скасовано",   color: theme.RED,   icon: "✗" },
    reschedule: { label: "Перенос",     color: theme.GOLD,  icon: "↔" },
  };

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
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        {[
          ["all",    "Всі"],
          ["unread", `Непрочитані${unreadCount > 0 ? ` (${unreadCount})` : ""}`],
        ].map(([id, lbl]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: "5px 14px", borderRadius: 12, border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filter === id ? theme.ACCENT : theme.SURF_LO,
            color: filter === id ? (isKava ? "#fff8ef" : "#fff") : theme.DIM,
            boxShadow: filter === id ? theme.SO : "none",
            transition: "all .15s",
          }}>{lbl}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: theme.DIM }}>{filtered.length} подій</span>
      </div>

      {/* Type filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        {[
          ["all",        "Всі типи",    theme.DIM],
          ["cancel",     "Скасовано",   theme.RED],
          ["new",        "Новий запис", theme.GREEN],
          ["reschedule", "Перенос",     theme.GOLD],
        ].map(([id, lbl, color]) => {
          const active = typeFilter === id;
          return (
            <button key={id} onClick={() => setTypeFilter(id)} style={{
              padding: "5px 12px", borderRadius: 12, border: `1.5px solid ${active ? color : "transparent"}`,
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: active ? `${color}22` : theme.SURF_LO,
              color: active ? color : theme.DIM,
              transition: "all .15s",
            }}>{lbl}</button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: theme.DIM, fontSize: 13, paddingTop: 40 }}>
          {filter === "unread" ? "Немає нових подій" : "Журнал порожній"}
        </div>
      )}

      {filtered.map((ev, i) => {
        const meta    = EVENT_TYPES[ev.type] || { label: ev.type, color: theme.ACCENT, icon: "•" };
        const isNew   = ev.ts > prevReadAt;
        const byLabel = BY_LABEL[ev.by] || ev.by;

        return (
          <div key={ev.id} style={{
            background: `linear-gradient(155deg,${theme.SURF_HI},${theme.SURFACE})`,
            borderRadius: 13,
            boxShadow: theme.SO,
            border: `1px solid ${theme.BORDER}`,
            padding: "0 12px",
            marginBottom: i < filtered.length - 1 ? 8 : 0,
          }}>
            <div style={{
              height: ROW_H,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <EventIcon color={meta.color} icon={meta.icon} isKava={isKava} theme={theme} />

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
                    color: isNew ? meta.color : theme.DIM,
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
                    color: theme.TEXT,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1,
                  }}>{ev.name}</span>
                  {ev.slot && (
                    <span style={{ fontSize: 11, color: theme.DIM, flexShrink: 0, whiteSpace: "nowrap" }}>· {ev.slot}</span>
                  )}
                  {byLabel && (
                    <span style={{ fontSize: 11, color: theme.DIM, flexShrink: 0, whiteSpace: "nowrap" }}>· від: {byLabel}</span>
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
