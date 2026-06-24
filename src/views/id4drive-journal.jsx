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

function EventDetailSheet({ ev, meta, onClose, theme }) {
  const [closing, setClosing] = useState(false);
  const shade = a => `rgba(${theme.SHADE},${a})`;
  const glow  = a => `rgba(${theme.GLOW},${a})`;
  const byLabel = BY_LABEL[ev.by] || ev.by;
  const _close = () => setClosing(true);

  return (
    <>
      <style>{`
        @keyframes _jd-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes _jd-down{from{transform:translateY(0);opacity:1}to{transform:translateY(100%);opacity:0}}
        @keyframes _jd-bg-in{from{opacity:0}to{opacity:1}}
        @keyframes _jd-bg-out{from{opacity:1}to{opacity:0}}
      `}</style>
      <div
        onClick={closing ? undefined : _close}
        style={{
          position:"fixed",inset:0,zIndex:200,
          background:shade(0.55),
          backdropFilter:"blur(8px)",
          display:"flex",alignItems:"flex-end",justifyContent:"center",
          animation: closing ? `_jd-bg-out 0.26s ease-in forwards` : `_jd-bg-in 0.2s ease-out`,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          onAnimationEnd={closing ? () => { setClosing(false); onClose(); } : undefined}
          style={{
            width:"100%",maxWidth:480,
            background:theme.BG_DEEP,
            borderRadius:"24px 24px 0 0",
            boxShadow:`0 -2px 0 ${glow(0.08)},0 -16px 60px ${shade(0.8)}`,
            overflow:"hidden",
            pointerEvents: closing ? "none" : undefined,
            animation: closing ? `_jd-down 0.26s ease-in forwards` : `_jd-up 0.38s cubic-bezier(0.34,1.56,0.64,1)`,
          }}
        >
          <div style={{width:36,height:4,borderRadius:2,background:glow(0.15),margin:"10px auto 0"}} />

          <div style={{
            padding:"16px 20px 14px",
            display:"flex",alignItems:"center",gap:12,
            borderBottom:`1px solid ${theme.BORDER}`,
          }}>
            <div style={{
              width:42,height:42,borderRadius:13,flexShrink:0,
              background:`${meta.color}22`,
              border:`1.5px solid ${meta.color}55`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:20,
            }}>{meta.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:theme.FAINT,marginBottom:2}}>{formatDT(ev.ts)}</div>
              <div style={{fontSize:15,fontWeight:700,color:meta.color}}>{meta.label}</div>
            </div>
            <div
              onClick={_close}
              style={{
                width:28,height:28,borderRadius:8,
                background:glow(0.07),
                display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",color:theme.FAINT,fontSize:14,userSelect:"none",flexShrink:0,
              }}
            >✕</div>
          </div>

          <div style={{padding:"14px 20px 28px",display:"flex",flexDirection:"column",gap:8}}>
            <InfoRow label="УЧЕНЬ" value={ev.name} valueStyle={{fontSize:16,fontWeight:800,color:theme.TEXT}} theme={theme} />
            {ev.slot && <InfoRow label="ЗАНЯТТЯ" value={ev.slot} theme={theme} />}
            {byLabel && <InfoRow label="ДІЯ ВІД" value={byLabel} theme={theme} />}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, theme, valueStyle = {} }) {
  const glow = a => `rgba(${theme.GLOW},${a})`;
  return (
    <div style={{
      background:glow(0.04),
      borderRadius:10,
      border:`1px solid ${theme.BORDER}`,
      padding:"10px 14px",
    }}>
      <div style={{fontSize:10,color:theme.FAINT,letterSpacing:1,marginBottom:4}}>{label}</div>
      <div style={{fontSize:14,fontWeight:600,color:theme.DIM,...valueStyle}}>{value}</div>
    </div>
  );
}

export default function JournalView() {
  const theme = useContext(ThemeContext);

  const EVENT_TYPES = {
    new:        { label: "Новий запис", color: theme.GREEN, icon: "📅" },
    cancel:     { label: "Скасовано",   color: theme.RED,   icon: "✗"  },
    reschedule: { label: "Перенос",     color: theme.GOLD,  icon: "↔"  },
  };

  const [events,     setEvents]    = useState([]);
  const [section,    setSection]   = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [detail,     setDetail]    = useState(null);
  const [prevReadAt] = useState(getJournalReadAt);

  useEffect(() => {
    setJournalReadAt();
    const unsub = onValue(ref(db, "bookings"), snap => {
      setEvents(buildEvents(snap.val()));
    });
    return unsub;
  }, []);

  const unreadCount = events.filter(e => e.ts > prevReadAt).length;
  const bySection   = section === "admin" ? events.filter(e => e.by === "admin") : events;
  const filtered    = typeFilter === "all" ? bySection : bySection.filter(e => e.type === typeFilter);

  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes _jc-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .jcard{animation:_jc-in .15s ease both;cursor:pointer}
        .jcard:active{opacity:.85}
      `}</style>

      {/* Section tabs */}
      <div style={{
        display:"flex",gap:4,marginBottom:12,
        background:theme.BG_DEEP,borderRadius:12,padding:4,
        border:`1px solid ${theme.BORDER}`,
      }}>
        {[
          ["all",   unreadCount > 0 ? `Всі записи · ${unreadCount}` : "Всі записи"],
          ["admin", "Дії адміна"],
        ].map(([id, lbl]) => (
          <button key={id} onClick={() => setSection(id)} style={{
            flex:1,padding:"7px 10px",borderRadius:9,border:"none",
            cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",
            background: section === id ? theme.ACCENT : "transparent",
            color: section === id ? "#fff" : theme.DIM,
            transition:"all .15s",
          }}>{lbl}</button>
        ))}
      </div>

      {/* Type filter chips */}
      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
        {[
          ["all",        "Всі типи",    theme.DIM  ],
          ["cancel",     "Скасовано",   theme.RED  ],
          ["new",        "Новий запис", theme.GREEN],
          ["reschedule", "Перенос",     theme.GOLD ],
        ].map(([id, lbl, color]) => {
          const active = typeFilter === id;
          return (
            <button key={id} onClick={() => setTypeFilter(id)} style={{
              padding:"5px 12px",borderRadius:12,
              border:`1.5px solid ${active ? color : "transparent"}`,
              cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",
              background: active ? `${color}22` : theme.SURF_LO,
              color: active ? color : theme.DIM,
              transition:"all .15s",
            }}>{lbl}</button>
          );
        })}
        <div style={{flex:1}} />
        <span style={{fontSize:10,color:theme.DIM}}>{filtered.length} подій</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", color:theme.DIM, fontSize:13, paddingTop:40 }}>
          {section === "admin" ? "Немає дій адміна" : "Журнал порожній"}
        </div>
      )}

      {filtered.map((ev, i) => {
        const meta    = EVENT_TYPES[ev.type] || { label: ev.type, color: theme.ACCENT, icon: "•" };
        const isNew   = ev.ts > prevReadAt;
        const byLabel = BY_LABEL[ev.by] || ev.by;

        return (
          <div
            key={ev.id}
            className="jcard"
            onClick={() => setDetail(ev)}
            style={{
              background:theme.BG_DEEP,
              borderRadius:12,
              boxShadow:theme.SI,
              border:`1px solid ${theme.BORDER}`,
              marginBottom: i < filtered.length - 1 ? 8 : 0,
              display:"flex",
              overflow:"hidden",
            }}
          >
            <div style={{width:4,background:meta.color,flexShrink:0}} />

            <div style={{flex:1,padding:"10px 10px 10px 12px",display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <div style={{
                width:38,height:38,borderRadius:11,flexShrink:0,
                background:`${meta.color}18`,
                border:`1.5px solid ${meta.color}44`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:18,
              }}>{meta.icon}</div>

              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:2}}>
                  <span style={{fontSize:11,fontWeight:700,color:meta.color}}>{meta.label}</span>
                  <span style={{
                    fontSize:10,flexShrink:0,
                    color:isNew ? meta.color : theme.FAINT,
                    fontWeight:isNew ? 700 : 400,
                  }}>{formatDT(ev.ts)}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}>
                  <span style={{
                    fontSize:13,fontWeight:isNew ? 800 : 600,
                    color:theme.TEXT,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  }}>{ev.name}</span>
                  {isNew && (
                    <div style={{
                      width:6,height:6,borderRadius:"50%",flexShrink:0,
                      background:meta.color,
                      boxShadow:`0 0 5px ${meta.color}88`,
                    }} />
                  )}
                </div>
                {(ev.slot || byLabel) && (
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    {ev.slot && <span style={{fontSize:10,color:theme.DIM}}>{ev.slot}</span>}
                    {ev.slot && byLabel && <span style={{fontSize:10,color:theme.FAINT}}>·</span>}
                    {byLabel && <span style={{fontSize:10,color:theme.DIM}}>від: {byLabel}</span>}
                  </div>
                )}
              </div>

              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.FAINT} strokeWidth="2.5" strokeLinecap="round" style={{flexShrink:0}}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        );
      })}

      {detail && (
        <EventDetailSheet
          ev={detail}
          meta={EVENT_TYPES[detail.type] || { label: detail.type, color: theme.ACCENT, icon: "•" }}
          onClose={() => setDetail(null)}
          theme={theme}
        />
      )}
    </div>
  );
}
