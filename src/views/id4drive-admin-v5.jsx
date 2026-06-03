import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { ref, update, get, onValue, remove } from "firebase/database";
import { db } from "../firebase";

import { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, SO, SI } from "../theme.js";
// local aliases for legacy names used in this file
const SURFACE_HI = SURF_HI;
const SURFACE_LO = SURF_LO;
const TEXT_DIM   = DIM;
const TEXT_FAINT = FAINT;
const ACCENT_HI  = ACC_HI;
const SHADOW_OUT = SO;
const SHADOW_IN  = SI;

// Palette for service colors
const PALETTE = [
  { id:"green",  name:"Зелений",   color:GREEN },
  { id:"yellow", name:"Жовтий",    color:GOLD },
  { id:"blue",   name:"Синій",     color:BLUE },
  { id:"purple", name:"Фіолетовий",color:PURPLE },
  { id:"red",    name:"Червоний",  color:ACCENT },
  { id:"teal",   name:"Бірюзовий", color:"#2dd4bf" },
  { id:"pink",   name:"Рожевий",   color:"#f472b6" },
  { id:"orange", name:"Оранжевий", color:"#fb923c" },
];

// ═══════════════════════════════════════════════════════════════
// GLOBAL CSS (slots from v4, rest v3)
// ═══════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body, html, #root { margin:0; padding:0; }

/* ─── 3D PILLOW SLOTS (from v4, color via CSS var) ─── */
.slot-base {
  position: relative; overflow: hidden;
  border-radius: 8px;
  transition: box-shadow .2s, transform .15s;
  cursor: grab; user-select: none;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}
.slot-base::before {
  content:''; position:absolute; pointer-events:none;
  top: 2px; right: 8%;
  width: 50%; height: 35%;
  background: radial-gradient(ellipse at top right, rgba(255,255,255,0.22) 0%, transparent 65%);
  border-radius: 50%;
  filter: blur(1px);
}
.slot-base::after {
  content:''; position:absolute; pointer-events:none;
  bottom: 0; left: 0; right: 0; height: 35%;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.18));
  border-radius: 0 0 8px 8px;
}
.slot-base:active { cursor: grabbing; }
.slot-colored {
  background: linear-gradient(155deg, color-mix(in srgb, var(--c) 50%, transparent) 0%, color-mix(in srgb, var(--c) 18%, transparent) 100%);
  border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
  box-shadow:
    -2px 5px 14px rgba(0,0,0,0.5),
    inset 1px 1px 0 rgba(255,255,255,0.18),
    inset -1px -1px 0 rgba(0,0,0,0.25);
}
.slot-pending-ring {
  animation: pulse-ring 2s infinite;
}
@keyframes pulse-ring {
  0%,100% { box-shadow: -2px 5px 14px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.25), 0 0 0 0 rgba(255,90,60,0.6); }
  50%     { box-shadow: -2px 5px 14px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.25), 0 0 0 6px rgba(255,90,60,0); }
}

/* resize handles — invisible hit area, no visual bar */
.slot-handle {
  position: absolute; left: 0; right: 0; height: 20px;
  cursor: ns-resize; z-index: 5;
  touch-action: none;
}
.slot-handle.top { top: 0; }
.slot-handle.bottom { bottom: 0; }

/* corner glint — top-right specular highlight, like light on a rounded button */
@keyframes shine-corner {
  0%   { opacity: 0; transform: scale(0.7); }
  35%  { opacity: 1; transform: scale(1); }
  65%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8); }
}
.shine-layer {
  position:absolute; inset:0;
  pointer-events:none; overflow:hidden;
  border-radius:inherit; z-index:6;
}
.shine-layer::after {
  content:'';
  position:absolute;
  top:-25%; right:-15%;
  width:65%; height:65%;
  background: radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.22) 45%, transparent 70%);
  border-radius: 50%;
  filter: blur(3px);
  opacity: 0;
}
.shine-active .shine-layer::after {
  animation: shine-corner 0.9s ease-in-out forwards;
}

/* hold-to-drag: ripple expands exactly over 1s, synced with timer */
@keyframes hold-charge {
  0%   { box-shadow: -2px 5px 14px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.25), 0 0 0 0px rgba(255,255,255,0.55); transform: scale(1); }
  60%  { transform: scale(0.96); }
  100% { box-shadow: -2px 5px 14px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.25), 0 0 0 10px rgba(255,255,255,0); transform: scale(0.96); }
}
.slot-holding {
  animation: hold-charge 1s ease-out forwards;
}

/* 3D icons (from v4) */
.icon3d {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 14px;
  position: relative; overflow: hidden;
  flex-shrink: 0;
  box-shadow:
    -2px 4px 10px rgba(0,0,0,0.5),
    inset 1px 1px 0 rgba(255,255,255,0.25),
    inset -1px -1px 0 rgba(0,0,0,0.3);
}
.icon3d::before {
  content:''; position:absolute; top:0; right:0;
  width:60%; height:50%;
  background: radial-gradient(ellipse at top right, rgba(255,255,255,0.4) 0%, transparent 70%);
  pointer-events: none;
}
.icon3d > svg { position: relative; z-index: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }

/* Toggle switch */
.toggle {
  width: 46px; height: 26px; border-radius: 13px; cursor: pointer;
  position: relative; transition: background .2s;
  background: ${SURFACE_LO};
  box-shadow: inset 2px 2px 5px rgba(0,0,0,0.4);
}
.toggle.on {
  background: linear-gradient(165deg, ${GREEN}, #5fb83d);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.2);
}
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 10px;
  background: linear-gradient(135deg, #fff, #ccc);
  transition: left .2s;
  box-shadow: -1px 2px 4px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.6);
}
.toggle.on .toggle-thumb { left: 23px; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }
input[type="range"] { accent-color: ${ACCENT}; }
.tabular { font-variant-numeric: tabular-nums; }
.drum-scroll::-webkit-scrollbar { display: none; }
`;

// ═══════════════════════════════════════════════════════════════
// 3D ICONS
// ═══════════════════════════════════════════════════════════════
function Icon3D({ children, gradient, size=40, radius }) {
  return (
    <div className="icon3d" style={{
      width: size, height: size,
      background: gradient,
      borderRadius: radius ?? 14,
    }}>{children}</div>
  );
}
const ICONS = {
  calendar: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#5b9bff,#3b73d9)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
      </svg>
    </Icon3D>
  ),
  check: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#9ee07a,#5fb83d)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 12 10 17 19 8"/>
      </svg>
    </Icon3D>
  ),
  cross: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#7a7e85,#3f4248)">
      <svg width={s*0.45} height={s*0.45} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </Icon3D>
  ),
  car: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#c084fc,#8b5cf6)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17h14M3 17V9l3-5h12l3 5v8M5 17a2 2 0 1 0 4 0 2 2 0 1 0 -4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0 -4 0M3 9h18"/>
      </svg>
    </Icon3D>
  ),
  school: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#9ee07a,#5fb83d)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10l9-5 9 5-9 5-9-5z"/><path d="M7 12v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5"/>
      </svg>
    </Icon3D>
  ),
  money: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#fcd34d,#d97706)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 2v20M16 6h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8"/>
      </svg>
    </Icon3D>
  ),
  user: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#94a3b8,#475569)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
      </svg>
    </Icon3D>
  ),
  users: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#c084fc,#7c3aed)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 18c0-2 2-4 4-4s3 1 3 3"/>
      </svg>
    </Icon3D>
  ),
  clock: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#fb923c,#ea580c)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>
      </svg>
    </Icon3D>
  ),
  chat: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#34d399,#059669)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12c0 5-4 8-9 8-1.5 0-3-.3-4-.7L3 21l1-4c-1-1.5-1.5-3.2-1.5-5 0-5 4-8 9-8s9.5 3 9.5 8z"/>
      </svg>
    </Icon3D>
  ),
  bell: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#fcd34d,#f59e0b)">
      <svg width={s*0.55} height={s*0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>
      </svg>
    </Icon3D>
  ),
  settings: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#94a3b8,#334155)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </Icon3D>
  ),
  list: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#34d399,#047857)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
      </svg>
    </Icon3D>
  ),
  chart: (s=40) => (
    <Icon3D size={s} gradient="linear-gradient(165deg,#a78bfa,#6d28d9)">
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/>
      </svg>
    </Icon3D>
  ),
  plus: (s=40) => (
    <Icon3D size={s} gradient={`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`}>
      <svg width={s*0.5} height={s*0.5} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </Icon3D>
  ),
  menu: (s=40) => (
    <Icon3D size={s} gradient={`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`}>
      <svg width={s*0.5} height={s*0.5} viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth="2.4" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
      </svg>
    </Icon3D>
  ),
  refresh: (s=40) => (
    <Icon3D size={s} gradient={`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`}>
      <svg width={s*0.5} height={s*0.5} viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10"/>
      </svg>
    </Icon3D>
  ),
};

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════
const initialBookings = [];

const _DLABELS = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];
const _DLABELS_FULL = ["Понеділок","Вівторок","Середа","Четвер","П'ятниця","Субота","Неділя"];
const _MLABELS = ["січ","лют","бер","кві","тра","чер","лип","сер","вер","жов","лис","гру"];
const getDayInfo = (offsetFromToday) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  return { num: d.getDate(), month: _MLABELS[d.getMonth()], label: _DLABELS[dow], fullLabel: _DLABELS_FULL[dow], wk: dow >= 5 };
};

const STUDENTS = [
  { id:"s1",  name:"Марія Коваль",   phone:"+380671234567" },
  { id:"s2",  name:"Іван Петренко",  phone:"+380509876543" },
  { id:"s3",  name:"Олена Мороз",    phone:"+380631112233" },
  { id:"s4",  name:"Дмитро Сало",    phone:"+380961234567" },
  { id:"s5",  name:"Тетяна Кравець", phone:"+380731234567" },
  { id:"s6",  name:"Антон Білий",    phone:"+380501112233" },
  { id:"s7",  name:"Юлія Денисюк",  phone:"+380935023739" },
  { id:"s8",  name:"Сергій Гук",     phone:"+380961234500" },
  { id:"s9",  name:"Наталія Бондар", phone:"+380671112244" },
  { id:"s10", name:"Андрій Чорний",  phone:"+380501234500" },
  { id:"s11", name:"Ірина Лесник",   phone:"+380967240853" },
  { id:"s12", name:"Ангеліна Коник", phone:"+380681746071" },
];

// ═══════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SETTINGS = {
  // profile
  profile: {
    name: "Олександр",
    phone: "+380989225442",
    address: "Київ, Верховинна 44",
    experience: 8,
    photo: null,
  },
  // schedule
  workStart: 7,
  workEnd: 20,
  weekends: [6], // 0=Mon..6=Sun
  daysShown: 5,  // 1..30
  snapMin: 30,
  hourHeightPx: 60, // resizable via pinch
  // breaks
  lunchEnabled: true,
  lunchStart: 12,
  lunchEnd: 13,
  customBlocks: [],
  // per-day schedule (Option C)
  weekSchedule: [
    { enabled:true,  start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Пн
    { enabled:true,  start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Вт
    { enabled:true,  start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Ср
    { enabled:true,  start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Чт
    { enabled:true,  start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Пт
    { enabled:true,  start:10, end:15, lunchEnabled:false, lunchStart:12, lunchEnd:13 }, // Сб
    { enabled:false, start:9,  end:18, lunchEnabled:true,  lunchStart:12, lunchEnd:13 }, // Нд
  ],
  // date overrides (Option B+C)
  dateOverrides: [], // [{ date:"2024-06-20", type:"closed"|"custom", start?:9, end?:18, lunchEnabled?:false, reason?:"" }]
  // pending
  pendingEnabled: false, // toggle: requires confirmation
  // visual
  theme: "dark",     // dark | light
  language: "uk",    // uk | en
  // queue (waiting list)
  queueAutoFifo: true,
  queueBroadcast: false,
  queueManual: false,
  // restrictions
  studentCanReschedule: true,
  studentCanCancel: true,
  bookCutoffHours: 2,       // min hours before slot for booking
  calendarOpenDays: 30,     // how many days ahead visible to students
  // sticky time
  stickyTime: "both",       // before | after | both
  // notifications display
  notifLocation: "topbar",  // topbar | tab | profile
  // bottom nav visibility
  navTabs: ["schedule","bookings","students","services","chats","templates","stats","settings"],
  // auto messages
  autoReminder: { enabled:true, hoursBefore:24 },
  autoWelcome: { enabled:true },
  autoConfirm: { enabled:true },
  autoCancel: { enabled:true },
  autoQueueOffer: { enabled:true },
  // services
  services: [
    { id:"sv1", name:"Автошкола 1 год", type:"school",  duration:60,  price:600,  colorId:"green",  active:true,  description:"Урок з автошколи" },
    { id:"sv2", name:"Автошкола 2 год", type:"school",  duration:120, price:1100, colorId:"green",  active:true,  description:"" },
    { id:"sv3", name:"Приватний 1 год", type:"private", duration:60,  price:700,  colorId:"yellow", active:true,  description:"" },
    { id:"sv4", name:"Приватний 2 год", type:"private", duration:120, price:1300, colorId:"yellow", active:true,  description:"" },
  ],
  // categories
  categories: [
    { id:"cat-vip", name:"VIP",       colorId:"purple" },
    { id:"cat-std", name:"Стандарт",  colorId:"blue" },
    { id:"cat-new", name:"Новачок",   colorId:"teal" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SHARED UI HELPERS
// ═══════════════════════════════════════════════════════════════
function Card({ children, style={}, inset=false }) {
  return (
    <div style={{
      background: SURFACE, borderRadius:20,
      boxShadow: inset ? SHADOW_IN : SHADOW_OUT,
      border:`1px solid ${BORDER}`,
      ...style
    }}>{children}</div>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:11,color:TEXT_FAINT,fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>{children}</div>
      {right}
    </div>
  );
}
function Toggle({ on, onChange }) {
  return (
    <div className={`toggle ${on?"on":""}`} onClick={()=>onChange(!on)}>
      <div className="toggle-thumb"/>
    </div>
  );
}
function Pill({ label, color, bg }) {
  return <span style={{
    background:bg, color, padding:"3px 10px",
    borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:0.4
  }}>{label}</span>;
}
function statusPill(s) {
  const M = {
    pending:["Очікує",ACCENT,"rgba(255,90,60,0.15)"],
    confirmed:["Підтверджено",GREEN,"rgba(126,217,87,0.15)"],
    cancelled:["Скасовано","#888","rgba(255,255,255,0.07)"],
    noshow:["Не прийшов",RED,"rgba(239,68,68,0.18)"],
  };
  const [l,c,b] = M[s] || M.confirmed;
  return <Pill label={l} color={c} bg={b}/>;
}
const fmtTime = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const fmtDur = (m) => { const h=Math.floor(m/60),min=m%60; return h===0?`${min}хв`:min===0?`${h}год`:`${h}год ${min}хв`; };
const colorOf = (id) => PALETTE.find(p=>p.id===id)?.color || GREEN;

// ═══════════════════════════════════════════════════════════════
// SCHEDULE VIEW with drag/resize + pinch-to-zoom + day-count
// ═══════════════════════════════════════════════════════════════
function ScheduleView({ settings, setSettings, onSlotClick, onEmptySlotClick, bookings, setBookings, activeDragIds, navTo }) {
  const [dragId, setDragId] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [quickCancelId, setQuickCancelId] = useState(null);
  const quickCancelRef = useRef(null);
  const [cancellingSet, setCancellingSet] = useState(new Set());
  const cancelTimers = useRef({});
  const [windowW, setWindowW] = useState(window.innerWidth);
  const [windowH, setWindowH] = useState(window.innerHeight);
  const PAST_DAYS = 7;
  const [dayOffset, setDayOffset] = useState(-7);
  const dragRef = useRef(null);
  const calcRef = useRef({});
  const setBookingsRef = useRef(null);
  const gridRef = useRef(null);
  const headerScrollRef = useRef(null);
  const headersInnerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const pendingDragRef = useRef(null);
  const dragEndedRef = useRef(false);
  const swipeRef = useRef(null);
  const gridWrapRef = useRef(null);
  const xVisibleRef = useRef(false);
  const xJustShownRef = useRef(false);
  const snapTimerRef = useRef(null);
  const timeColRef = useRef(null);
  const [pinch, setPinch] = useState(null);
  const [shineId, setShineId] = useState(null);
  const slotHoldTimerRef = useRef(null);
  const slotHoldFiredRef = useRef(false);
  const [openSlots, setOpenSlots] = useState({}); // { "2025-06-01": ["07:00","08:00",...] }
  const [viewingSlots, setViewingSlots] = useState({});
  const [genLoadingDays, setGenLoadingDays] = useState(new Set());
  const [queueMap, setQueueMap] = useState({}); // { "YYYY-MM-DD_HH:MM": count }

  useEffect(() => {
    const r = ref(db, "queue");
    const unsub = onValue(r, snap => {
      const val = snap.val() || {};
      const map = {};
      Object.entries(val).forEach(([slotKey, slotData]) => {
        if (!slotData?.entries) return;
        const count = Object.values(slotData.entries).filter(e => e.status === 'waiting').length;
        if (count > 0) map[slotKey] = count;
      });
      setQueueMap(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const r = ref(db, "timeslots");
    const unsub = onValue(r, snap => {
      const val = snap.val() || {};
      const slots = {};
      const viewing = {};
      Object.entries(val).forEach(([date, dateSlots]) => {
        const slotMap = {};
        const viewTimes = [];
        Object.values(dateSlots).forEach(slot => {
          if (slot.time && (slot.available !== false || slot.adminBlocked || slot.vipOnly)) {
            slotMap[slot.time] = { available: slot.available !== false, adminBlocked: !!slot.adminBlocked, vipOnly: !!slot.vipOnly, surcharge: slot.surcharge || null };
          }
          if (slot.viewing && Object.keys(slot.viewing).length > 0) viewTimes.push(slot.time);
        });
        if (Object.keys(slotMap).length) slots[date] = slotMap;
        if (viewTimes.length) viewing[date] = viewTimes;
      });
      setOpenSlots(slots);
      setViewingSlots(viewing);
    });
    return () => unsub();
  }, []);

  const absDayToDateStr = (absDay) => {
    const d = new Date(); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + absDay);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const generateDaySlots = async (absDay) => {
    const dateStr = absDayToDateStr(absDay);
    const d = new Date(dateStr);
    const dow = (d.getDay() + 6) % 7;
    const ov = (settings.dateOverrides || []).find(o => o.date === dateStr);
    if (ov?.type === "closed") return;
    const ws = (settings.weekSchedule || [])[dow] || {};
    const start        = ov?.start        ?? ws.start        ?? settings.workStart  ?? 9;
    const end          = ov?.end          ?? ws.end          ?? settings.workEnd    ?? 18;
    const lunchEnabled = ov?.lunchEnabled ?? ws.lunchEnabled ?? settings.lunchEnabled ?? true;
    const lunchStart   = ov?.lunchStart   ?? ws.lunchStart   ?? settings.lunchStart  ?? 12;
    const lunchEnd     = ov?.lunchEnd     ?? ws.lunchEnd     ?? settings.lunchEnd    ?? 13;
    const step = settings.slotCreateStep || settings.snapMin || 30;
    setGenLoadingDays(s => new Set([...s, absDay]));
    const snap = await get(ref(db, `timeslots/${dateStr}`));
    const existing = snap.val() || {};
    const updates = {};
    for (let min = start * 60; min < end * 60; min += step) {
      if (lunchEnabled && min >= lunchStart * 60 && min < lunchEnd * 60) continue;
      const h = String(Math.floor(min / 60)).padStart(2, "0");
      const m = String(min % 60).padStart(2, "0");
      const id = `slot${h}${m}`;
      if (!existing[id]) {
        updates[`timeslots/${dateStr}/${id}/time`] = `${h}:${m}`;
        updates[`timeslots/${dateStr}/${id}/available`] = true;
      }
    }
    if (Object.keys(updates).length) await update(ref(db, "/"), updates);
    setGenLoadingDays(s => { const ns = new Set(s); ns.delete(absDay); return ns; });
  };

  const clearDaySlots = async (absDay) => {
    const dateStr = absDayToDateStr(absDay);
    await remove(ref(db, `timeslots/${dateStr}`));
  };

  // Клік: вільний ↔ зайнятий (2 стани)
  const toggleSlotFree = (dateStr, time, slot) => {
    const slotId = `slot${time.replace(":", "")}`;
    if (slot.adminBlocked) {
      update(ref(db, `timeslots/${dateStr}/${slotId}`), { available: true, adminBlocked: false }).catch(() => {});
    } else {
      update(ref(db, `timeslots/${dateStr}/${slotId}`), { available: false, adminBlocked: true, vipOnly: false, surcharge: null }).catch(() => {});
    }
  };

  // Довгий тап: VIP, надбавка або скидання
  const applySlotOption = (dateStr, time, option) => {
    const slotId = `slot${time.replace(":", "")}`;
    const [hh, mm] = time.split(":").map(Number);
    const startMin = hh * 60 + mm;
    const today = new Date(); today.setHours(0,0,0,0);
    const day = Math.round((new Date(dateStr + "T12:00:00") - today) / 86400000);
    if (option === "vip") {
      update(ref(db, `timeslots/${dateStr}/${slotId}`), { available: true, adminBlocked: false, vipOnly: true, surcharge: null }).catch(() => {});
    } else if (option === "reset") {
      update(ref(db, `timeslots/${dateStr}/${slotId}`), { available: true, adminBlocked: false, vipOnly: false, surcharge: null }).catch(() => {});
    } else {
      update(ref(db, `timeslots/${dateStr}/${slotId}`), { available: true, adminBlocked: false, vipOnly: false, surcharge: option }).catch(() => {});
    }
    setSlotOptions(null);
  };

  // Скидаємо transform після зміни dayOffset (контент оновився — повертаємо в 0)
  useLayoutEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "";
  }, [dayOffset]);

  // При маунті скролимо до сьогодні (PAST_DAYS колонок від початку)
  useEffect(() => {
    if (gridRef.current) {
      const colW = calcRef.current.COL_W || 70;
      const left = PAST_DAYS * (colW + 4);
      gridRef.current.scrollLeft = left;
      if (headersInnerRef.current) headersInnerRef.current.style.transform = `translateX(-${left}px)`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bubbleData, setBubbleData] = useState(null);
  const [formData, setFormData] = useState(null);
  const [createSlotData, setCreateSlotData] = useState(null); // {day, startMin}
  const [localSelectedBooking, setLocalSelectedBooking] = useState(null);
  const emptyHoldTimerRef = useRef(null);
  const emptyHoldPosRef   = useRef(null);

  // Shine glint animation — one booking at a time, random, every 3s
  const bookingsRef = useRef(bookings);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);
  useEffect(() => { setBookingsRef.current = setBookings; }, [setBookings]);
  // quickCancelRef тепер оновлюється напряму в holdTimer/onMove (без затримки ре-рендеру)
  useEffect(() => {
    const timer = setInterval(() => {
      const bks = bookingsRef.current;
      if (!bks.length) return;
      const b = bks[Math.floor(Math.random() * bks.length)];
      setShineId(b.id);
      setTimeout(() => setShineId(id => id === b.id ? null : id), 950);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const TIME_COL_W = 34;
  const HEADER_H = 50;
  const N_DAYS = PAST_DAYS + 28; // 7 минулих + 28 майбутніх
  const COL_W = Math.max(48, Math.floor((windowW - 14 - TIME_COL_W - (settings.daysShown - 1) * 4) / Math.max(1, settings.daysShown)));
  const totalMin = Math.max(60, (settings.workEnd - settings.workStart) * 60);
  // Авто-підлаштування: вся висота розкладу = доступна висота viewport
  // hourHeightPx / 60 використовується як zoom-множник (pinch)
  const availGridH = Math.max(120, windowH - 156 - HEADER_H - 4);
  const autoPxPerMin = availGridH / totalMin;
  const PX_PER_MIN = autoPxPerMin * (settings.hourHeightPx / 60);
  const gridHeight = totalMin * PX_PER_MIN;
  const days = Array.from({length: N_DAYS}, (_, i) => getDayInfo(dayOffset + i));

  // Keep calc values fresh for always-on window listeners (avoids stale closure)
  calcRef.current = { PX_PER_MIN, snapMin: settings.snapMin, workStart: settings.workStart, workEnd: settings.workEnd, COL_W, dayOffset, daysShown: settings.daysShown, N_DAYS };

  const minToPx = (m) => (m - settings.workStart*60) * PX_PER_MIN;

  const onPointerDown = (e, b, mode) => {
    e.preventDefault(); e.stopPropagation();
    const isBlock = b.type === "block";
    const dragData = { id:b.id, mode, isBlock, startClientY:e.clientY, startClientX:e.clientX, startMinutes:b.startMin, startDur:b.durMin, startDay:b.day };
    activeDragIds?.current?.add(b.id);

    if (mode === "top" || mode === "bottom") {
      navigator.vibrate?.(6);
      pendingDragRef.current = dragData;
      return;
    }

    navigator.vibrate?.(6);
    pendingDragRef.current = dragData;
    if (!isBlock) {
      // Звичайні слоти: 700мс утримання → значок скасування + розблокування drag
      setHoldId(b.id);
      holdTimerRef.current = setTimeout(() => {
        if (!pendingDragRef.current) return;
        setHoldId(null);
        quickCancelRef.current = b.id;   // встановлюємо ref одразу (не чекаємо ре-рендер)
        setQuickCancelId(b.id);          // оновлюємо стан для відображення іконки
        xVisibleRef.current = true;
        xJustShownRef.current = true;
        setTimeout(() => { xJustShownRef.current = false; }, 400);
        navigator.vibrate?.([30, 40, 60]);
      }, 700);
    }
    // Блоки: жодного hold-таймера — drag активується одразу при русі >4px в onMove
  };

  // Listeners always attached — dragRef gives instant access without useEffect re-fire
  useEffect(() => {
    const onMove = (e) => {
      if (swipeRef.current) {
        swipeRef.current.endX = e.clientX;
        swipeRef.current.endY = e.clientY;
        // Real-time visual tracking (only when not dragging a slot)
        if (!dragRef.current && !pendingDragRef.current && gridWrapRef.current) {
          const dx = e.clientX - swipeRef.current.startX;
          const dy = e.clientY - swipeRef.current.startY;
          if (Math.abs(dx) > Math.abs(dy) * 0.7 && Math.abs(dx) > 6) {
            gridWrapRef.current.style.transform = `translateX(${dx}px)`;
          }
        }
      }
      if (pendingDragRef.current) {
        const pd = pendingDragRef.current;
        const moved = Math.hypot(e.clientY - pd.startClientY, e.clientX - pd.startClientX);
        if (pd.mode === "top" || pd.mode === "bottom" || pd.isBlock) {
          // Resize або блок: активуємо drag відразу при русі >4px
          if (moved > 4) {
            clearTimeout(holdTimerRef.current);
            dragRef.current = {...pd};
            pendingDragRef.current = null;
            setDragId(pd.id);
            navigator.vibrate?.(18);
          }
          return;
        }
        // Звичайний move: drag тільки якщо hold вже спрацював (quickCancelRef встановлено)
        if (moved > 8) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          if (quickCancelRef.current !== null) {
            // Hold був — дозволяємо drag
            dragRef.current = {...pd};
            pendingDragRef.current = null;
            quickCancelRef.current = null;
            xVisibleRef.current = false;
            setQuickCancelId(null);
            setHoldId(null);
            setDragId(pd.id);
            navigator.vibrate?.(55);
          } else {
            // Hold не відбувся — скасовуємо (scroll wins)
            pendingDragRef.current = null;
            setHoldId(null);
          }
        }
        return;
      }
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const { PX_PER_MIN, snapMin, workStart, workEnd, COL_W, dayOffset, N_DAYS } = calcRef.current;
      const snap = (m) => Math.round(m / snapMin) * snapMin;
      const dy = e.clientY - drag.startClientY;
      const dxRaw = e.clientX - drag.startClientX;
      const deltaMin = dy / PX_PER_MIN;
      const setBookingsFn = setBookingsRef.current || setBookings;
      setBookingsFn(bs => bs.map(b => {
        if (b.id !== drag.id) return b;
        if (drag.mode === "move") {
          const newDay = Math.max(dayOffset, Math.min(dayOffset + N_DAYS - 1, drag.startDay + Math.round(dxRaw/(COL_W+4))));
          let s = snap(drag.startMinutes + deltaMin);
          s = Math.max(workStart*60, Math.min(workEnd*60 - b.durMin, s));
          const wouldOverlap = bs.some(x => x.id!==b.id && x.day===newDay && s<x.startMin+x.durMin && s+b.durMin>x.startMin);
          if (wouldOverlap) return b;
          return {...b, startMin:s, day:newDay};
        } else if (drag.mode === "bottom") {
          let d = snap(drag.startDur + deltaMin);
          const nextStart = bs.filter(x=>x.id!==b.id&&x.day===b.day&&x.startMin>b.startMin)
            .reduce((mn,x)=>Math.min(mn,x.startMin), workEnd*60);
          d = Math.max(60, Math.min(d, nextStart - b.startMin));
          return {...b, durMin:d};
        } else if (drag.mode === "top") {
          let s = snap(drag.startMinutes + deltaMin);
          const maxS = drag.startMinutes + drag.startDur - 60;
          const floorStart = bs.filter(x=>x.id!==b.id&&x.day===b.day&&x.startMin+x.durMin<=drag.startMinutes)
            .reduce((mx,x)=>Math.max(mx,x.startMin+x.durMin), workStart*60);
          s = Math.max(floorStart, Math.min(maxS, s));
          const diff = s - drag.startMinutes;
          return {...b, startMin:s, durMin: drag.startDur - diff};
        }
        return b;
      }));
    };
    const onUp = () => {
      const wasDragging = !!dragRef.current;
      const endedId = dragRef.current?.id ?? pendingDragRef.current?.id;
      dragRef.current = null;
      setDragId(null);
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      pendingDragRef.current = null;
      setHoldId(null);
      quickCancelRef.current = null;
      if (!xVisibleRef.current) setQuickCancelId(null);
      if (wasDragging) {
        dragEndedRef.current = true;
        setTimeout(() => { dragEndedRef.current = false; }, 400);
      }
      // Remove from activeDragIds after save debounce window (700ms > 600ms save timer)
      if (endedId) setTimeout(() => { activeDragIds?.current?.delete(endedId); }, 700);
      swipeRef.current = null;
    };
    const onResize = () => { setWindowW(window.innerWidth); setWindowH(window.innerHeight); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      clearTimeout(holdTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const touchesRef = useRef([]);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      touchesRef.current = [e.touches[0].clientY, e.touches[1].clientY];
      setPinch({ startDist: Math.abs(e.touches[0].clientY - e.touches[1].clientY), startH: settings.hourHeightPx });
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch) {
      const dist = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
      const ratio = dist / pinch.startDist;
      setSettings(s => ({...s, hourHeightPx: Math.max(30, Math.min(160, Math.round(pinch.startH * ratio)))}));
    }
  };
  const onTouchEnd = () => setPinch(null);

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSettings(s => ({...s, hourHeightPx: Math.max(30, Math.min(160, s.hourHeightPx - Math.sign(e.deltaY) * 6))}));
    }
  };

  const hours = [];
  for (let h = settings.workStart; h <= settings.workEnd; h++) hours.push(h);

  const slotColor = (b) => {
    const svc = settings.services.find(s=>s.id===b.serviceId);
    return colorOf(svc?.colorId);
  };

  const handleColumnClick = (e, absDay) => {
    if (dragRef.current || dragEndedRef.current || pendingDragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const yRel = e.clientY - rect.top;
    const { snapMin, workStart, PX_PER_MIN } = calcRef.current;
    const rawMin = workStart * 60 + yRel / PX_PER_MIN;
    const minute = Math.round(rawMin / snapMin) * snapMin;
    const bData = { day: absDay, startMin: minute, clientX: e.clientX, clientY: e.clientY };
    setBubbleData(bData);
  };

  const handleAction = (action, b) => {
    if (action === "confirm") setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"confirmed"}:x));
    if (action === "cancel") {
      // Відновити вільні слоти
      if (b.startMin !== undefined && b.durMin) {
        const dateStr = b.date || absDayToDateStr(b.day);
        const updates = {};
        for (let i = 0; i < b.durMin; i += 30) {
          const slotMin = b.startMin + i;
          const hh = String(Math.floor(slotMin / 60)).padStart(2, '0');
          const mm = String(slotMin % 60).padStart(2, '0');
          const path = `timeslots/${dateStr}/slot${hh}${mm}`;
          if (i % 60 === 0) {
            updates[`${path}/available`] = true;
            updates[`${path}/time`] = `${hh}:${mm}`;
          } else {
            updates[path] = null;
          }
        }
        update(ref(db, '/'), updates).catch(() => {});
      }
      // Затемнення 2с → видалення (так само як значок ×)
      setCancellingSet(s=>new Set([...s, b.id]));
      cancelTimers.current[b.id] = setTimeout(()=>{
        setCancellingSet(s=>{ const ns=new Set(s); ns.delete(b.id); return ns; });
        setBookings(bs=>bs.filter(x=>x.id!==b.id));
        delete cancelTimers.current[b.id];
      }, 2000);
    }
    if (action === "noshow")  setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"noshow"}:x));
    if (action === "delete")  setBookings(bs=>bs.filter(x=>x.id!==b.id));
    if (action === "repeat")  setBookings(bs=>[...bs,{...b, id:`b-${Date.now()}`, day:b.day+7, status:"confirmed"}]);
    if (action === "chat")     { navTo?.("chats"); return; }
    if (action === "call")     window.location.href=`tel:${b.phone}`;
    if (action === "sms")      window.location.href=`sms:${b.phone}`;
    if (action === "viber")    window.location.href=`viber://chat?number=%2B${b.phone.replace(/\D/g,"")}`;
    if (action === "telegram") window.location.href=`https://t.me/${b.phone.replace(/\D/g,"")}`;
    if (action === "toggleVip") {
      const next = !b.isVipOnly;
      setBookings(bs=>bs.map(x=>x.id===b.id?{...x,isVipOnly:next,categoryId:next?"cat-vip":null}:x));
      setLocalSelectedBooking(prev=>prev?{...prev,isVipOnly:next,categoryId:next?"cat-vip":null}:null);
      return;
    }
    setLocalSelectedBooking(null);
  };
  const [blockModal, setBlockModal] = useState(null); // {id, day, startMin, durMin}

  const handleBlock = ({ day, startMin }) => {
    setBookings(bs=>[...bs,{
      id:`block-${Date.now()}`, day, startMin, durMin:60,
      name:"ЗАБЛОКОВАНО", phone:"", type:"block", tsc:"",
      hoursDone:0, status:"blocked", serviceId:""
    }]);
  };

  const handleVipSlot = ({ day, startMin }) => {
    const dateStr = absDayToDateStr(day);
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    update(ref(db, `timeslots/${dateStr}/slot${hh}${mm}`), {
      time: `${hh}:${mm}`, available: true, vipOnly: true,
    }).catch(() => {});
  };

  const [vipSlotModal, setVipSlotModal] = useState(null);
  const [slotOptions, setSlotOptions] = useState(null); // { dateStr, time, slot }

  return (
    <>
    <style>{GLOBAL_CSS}</style>
    <Card style={{padding:"6px 3px 10px", overflow:"hidden"}}>
      <div style={{display:"flex", maxHeight:"calc(100vh - 156px)", overflow:"hidden"}}>

        {/* TIME COLUMN — fixed left, never scrolls */}
        <div style={{
          width:TIME_COL_W, flexShrink:0, zIndex:10,
          display:"flex", flexDirection:"column",
          borderRight:`1px solid rgba(255,255,255,0.07)`,
        }}>
          {/* Spacer aligns with sticky day headers */}
          <div style={{height:HEADER_H + 4, flexShrink:0}}/>
          <div style={{overflow:"hidden", flex:1, position:"relative"}}>
            <div ref={timeColRef} style={{position:"absolute", top:0, left:0, right:0, height:gridHeight}}>
              {Array.from({length:(settings.workEnd-settings.workStart)*2+1},(_,i)=>{
                const totalMins = i*30;
                const h = settings.workStart + Math.floor(totalMins/60);
                const m = totalMins % 60;
                if (h > settings.workEnd) return null;
                return m === 0 ? (
                  <div key={i} style={{
                    position:"absolute", top:Math.max(2, totalMins*PX_PER_MIN - 5),
                    left:0, right:0, textAlign:"center",
                    fontSize:10, fontWeight:700, lineHeight:1, color:TEXT_DIM,
                  }}>{h}:00</div>
                ) : (
                  <div key={i} style={{
                    position:"absolute", top:totalMins*PX_PER_MIN - 3,
                    left:0, right:0, textAlign:"center",
                    fontSize:7, fontWeight:600, lineHeight:1,
                    color:"rgba(139,141,147,0.5)",
                  }}>{h}:30</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SCROLLABLE GRID — horizontal + vertical */}
        <div
          ref={gridRef}
          onPointerDownCapture={e=>{
            swipeRef.current={startX:e.clientX,startY:e.clientY,endX:e.clientX,endY:e.clientY,startTime:Date.now()};
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          onScroll={e=>{
            if (timeColRef.current)
              timeColRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
          }}
          style={{flex:1, overflowX:"auto", overflowY:"auto", touchAction:"pan-x pan-y", WebkitOverflowScrolling:"touch"}}
        >
          <div ref={gridWrapRef} style={{display:"flex", paddingTop:2}}>
          {days.map((day,colIdx)=>{
            const absDay = dayOffset + colIdx;
            const dateStrCol = absDayToDateStr(absDay);
            const isOpenCol = Object.values(openSlots[dateStrCol] || {}).some(s => s.available);
            const isToday = absDay === 0;
            const isLoadingCol = genLoadingDays.has(absDay);
            const hasAnySlotsCol = !!(openSlots[dateStrCol] && Object.keys(openSlots[dateStrCol]).length);
            return (
            <div key={absDay} style={{
              display:"flex", flexDirection:"column", flexShrink:0,
              width:COL_W, marginRight:colIdx<days.length-1?4:0,
            }}>
              {/* DATE HEADER — sticky top, moves with column horizontally */}
              <div
                onClick={e=>{ e.stopPropagation(); if(isLoadingCol) return; hasAnySlotsCol ? clearDaySlots(absDay) : generateDaySlots(absDay); }}
                style={{
                  position:"sticky", top:0, zIndex:4,
                  height:HEADER_H, flexShrink:0, marginBottom:4,
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"space-between",
                  padding:"3px 2px 3px", borderRadius:10, cursor:"pointer",
                  background: isToday ? `rgba(247,201,72,0.18)` : isOpenCol ? `rgba(99,211,120,0.13)` : `rgba(0,0,0,0.18)`,
                  boxShadow: isToday ? `inset 0 0 0 1.5px rgba(247,201,72,0.55)` : isOpenCol ? `inset 0 0 0 1px rgba(99,211,120,0.35)` : "none",
                }}>
                <div style={{fontSize:9, fontWeight:700, lineHeight:1.2,
                  color: isToday ? GOLD : isOpenCol ? GREEN : TEXT_FAINT,
                  letterSpacing:0.3, overflow:"hidden", whiteSpace:"nowrap",
                  maxWidth:"100%", textOverflow:"ellipsis",
                }}>{day.fullLabel}</div>
                <div style={{fontSize:14, fontWeight:800, lineHeight:1.2,
                  color: isToday ? GOLD : isOpenCol ? GREEN : DIM,
                }}>{day.num}</div>
                <div style={{fontSize:9, lineHeight:1, opacity:0.7,
                  color: isLoadingCol ? FAINT : isOpenCol ? GREEN : FAINT,
                }}>{isLoadingCol ? "…" : isOpenCol ? "✓" : "＋"}</div>
              </div>

              {/* SLOT CONTENT */}
              <div
                onClick={e=>{ if(xJustShownRef.current){ xJustShownRef.current=false; return; } if(quickCancelId){ xVisibleRef.current=false; setQuickCancelId(null); } }}
                onPointerDown={e=>{
                  if (e.button > 0) return;
                  if (dragRef.current || pendingDragRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const rawMin = calcRef.current.workStart * 60 + (e.clientY - rect.top) / calcRef.current.PX_PER_MIN;
                  const minute = Math.round(rawMin / 5) * 5;
                  emptyHoldPosRef.current = { startY: e.clientY, day: absDay, startMin: minute, freeSnap: true };
                  emptyHoldTimerRef.current = setTimeout(() => {
                    if (!emptyHoldPosRef.current) return;
                    setBubbleData({ day: absDay, startMin: minute, clientX: e.clientX, clientY: e.clientY, freeSnap: true });
                    emptyHoldPosRef.current = null;
                  }, 480);
                }}
                onPointerMove={()=>{ clearTimeout(emptyHoldTimerRef.current); emptyHoldPosRef.current = null; }}
                onPointerUp={()=>{ clearTimeout(emptyHoldTimerRef.current); emptyHoldPosRef.current = null; }}
                onPointerCancel={()=>{ clearTimeout(emptyHoldTimerRef.current); emptyHoldPosRef.current = null; }}
                onPointerLeave={()=>{ clearTimeout(emptyHoldTimerRef.current); emptyHoldPosRef.current = null; }}
                style={{
                  width:COL_W, height:gridHeight,
                  position:"relative", padding:"0 4px",
                  background:`linear-gradient(135deg,${BG_DEEP},rgba(0,0,0,0.55))`,
                  borderRadius:14, boxShadow:SHADOW_IN, cursor:"cell",
                }}>

              {/* Open/blocked/surcharge/VIP slot indicators */}
              {Object.entries(openSlots[dateStrCol] || {}).map(([time, slot]) => {
                const [h, m] = time.split(":").map(Number);
                const startMin = h * 60 + m;
                const isVip = slot.vipOnly;
                const isBlocked = slot.adminBlocked;
                const hasSurcharge = !!slot.surcharge;
                const bg = isVip ? "rgba(168,85,247,0.15)" : isBlocked ? "rgba(239,68,68,0.15)" : hasSurcharge ? "rgba(247,201,72,0.15)" : "rgba(99,211,120,0.15)";
                const borderColor = isVip ? "rgba(168,85,247,0.55)" : isBlocked ? "rgba(239,68,68,0.5)" : hasSurcharge ? "rgba(247,201,72,0.6)" : "rgba(99,211,120,0.45)";
                const color = isVip ? "rgba(168,85,247,0.9)" : isBlocked ? "rgba(239,68,68,0.85)" : hasSurcharge ? "rgba(247,201,72,0.95)" : "rgba(99,211,120,0.9)";
                return (
                  <div key={`os-${time}`}
                    onPointerDown={e=>{
                      e.stopPropagation();
                      slotHoldFiredRef.current = false;
                      slotHoldTimerRef.current = setTimeout(()=>{
                        slotHoldFiredRef.current = true;
                        navigator.vibrate?.(40);
                        setSlotOptions({ dateStr: dateStrCol, time, slot });
                      }, 600);
                    }}
                    onPointerUp={()=>clearTimeout(slotHoldTimerRef.current)}
                    onPointerCancel={()=>clearTimeout(slotHoldTimerRef.current)}
                    onClick={e=>{
                      e.stopPropagation();
                      if (slotHoldFiredRef.current) return;
                      toggleSlotFree(dateStrCol, time, slot);
                    }}
                    style={{
                      position:"absolute", left:0, right:0,
                      top: minToPx(startMin) + 1,
                      height: (settings.slotCreateStep || settings.snapMin || 30) * PX_PER_MIN - 2,
                      opacity: 0.5,
                      background: bg,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius:8, cursor:"pointer", zIndex:1,
                      display:"flex", flexDirection:"column",
                      alignItems:"flex-start", justifyContent:"center",
                      padding:"0 7px", position:"absolute",
                    }}>
                    {hasSurcharge && <span style={{position:"absolute", top:3, left:4, fontSize:9, fontWeight:800, color:"rgba(247,201,72,0.95)", lineHeight:1}}>+{slot.surcharge}₴</span>}
                    {isVip && <span style={{position:"absolute", top:3, right:4, fontSize:10, lineHeight:1}}>👑</span>}
                    {isBlocked && <span style={{position:"absolute", top:3, left:4, fontSize:8, fontWeight:600, color:"rgba(239,68,68,0.65)", lineHeight:1}}>закрито</span>}
                    <span style={{fontSize:10, fontWeight:800, lineHeight:1, color}}>{time}</span>
                  </div>
                );
              })}

              {/* 30-min grid lines */}
              {Array.from({length:(settings.workEnd-settings.workStart)*2-1},(_,i)=>{
                const isHour=(i+1)%2===0;
                return <div key={i} style={{
                  position:"absolute",left:0,right:0,
                  top:(i+1)*30*PX_PER_MIN,
                  height:1,
                  background:isHour?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.025)"
                }}/>;
              })}

              {/* Lunch block */}
              {settings.lunchEnabled && (
                <div style={{
                  position:"absolute",
                  top:minToPx(settings.lunchStart*60), left:4, right:4,
                  height:(settings.lunchEnd - settings.lunchStart)*60*PX_PER_MIN,
                  background:`repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 12px)`,
                  borderRadius:8, pointerEvents:"none",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:9,color:TEXT_FAINT,fontWeight:700,letterSpacing:1
                }}>ОБІД</div>
              )}

              {/* Viewing indicators — student selected this time but hasn't booked yet */}
              {(viewingSlots[dateStrCol] || []).map(time => {
                const [h, m] = time.split(":").map(Number);
                const topPx = minToPx(h * 60 + m);
                return (
                  <div key={`v-${time}`} style={{
                    position:"absolute", left:2, right:2,
                    top:topPx, height:60*PX_PER_MIN,
                    background:"rgba(247,201,72,0.10)",
                    borderLeft:"2px solid rgba(247,201,72,0.5)",
                    borderRadius:6, pointerEvents:"none",
                    display:"flex", alignItems:"center", paddingLeft:5,
                    gap:3,
                  }}>
                    <span style={{fontSize:8, color:"rgba(247,201,72,0.7)", fontWeight:700, letterSpacing:0.5}}>👁 {time}</span>
                  </div>
                );
              })}

              {/* Bookings — consecutive same-student adjacent bookings merged into one card */}
              {(()=>{
                const sorted = bookings.filter(b=>b.day===absDay).sort((a,b)=>a.startMin-b.startMin);
                const merged = [];
                let i = 0;
                while (i < sorted.length) {
                  const b = sorted[i];
                  if (b.type==="block" || b.type==="vip-slot") { merged.push(b); i++; continue; }
                  let totalDur = b.durMin;
                  let j = i + 1;
                  while (j < sorted.length) {
                    const nx = sorted[j];
                    if (nx.userId && nx.userId===b.userId && nx.startMin===b.startMin+totalDur && nx.type!=="block" && nx.type!=="vip-slot") {
                      totalDur += nx.durMin; j++;
                    } else break;
                  }
                  merged.push(j > i+1 ? {...b, durMin:totalDur} : b);
                  i = j;
                }
                return merged;
              })().map(b=>{
                const top = minToPx(b.startMin);
                const height = b.durMin * PX_PER_MIN;
                const c = slotColor(b);
                const isPending = b.status==="pending" && settings.pendingEnabled;
                const isCancelling = cancellingSet.has(b.id);
                const isBlock = b.type === "block";
                const isVipSlot = b.type === "vip-slot";
                const slotTimeStr = String(Math.floor(b.startMin/60)).padStart(2,'0')+':'+String(b.startMin%60).padStart(2,'0');
                const queueCount = b.date ? (queueMap[`${b.date}_${slotTimeStr}`] || 0) : 0;
                const isDimmed = !isBlock && !isVipSlot && (b.status==="cancelled" || b.status==="noshow" || isCancelling);
                const svc = settings.services.find(s=>s.id===b.serviceId)
                         || settings.services.find(s=>s.active && s.type===(b.serviceType||b.type) && Number(s.duration)===b.durMin);
                const basePrice = svc
                  ? Math.round((svc.price / svc.duration) * b.durMin)
                  : b.price && b.durationHours
                    ? Math.round((b.price / (b.durationHours * 60)) * b.durMin)
                    : (b.price || 0);
                const price = basePrice + (b.surcharge || 0);
                return (
                  /* Обгортка — overflow:visible щоб значок не обрізався */
                  <div key={b.id} style={{
                    position:"absolute", top:top+1, left:0, right:0,
                    height:height-2, overflow:"visible",
                    zIndex: dragId===b.id?10:2,
                    background: BG_DEEP,
                    borderRadius: 8,
                  }}>
                    {/* Сам слот */}
                    <div
                      className={`slot-base ${isBlock?"":"slot-colored"} ${!isBlock&&isPending?"slot-pending-ring":""} ${!isBlock&&holdId===b.id?"slot-holding":""} ${!isBlock&&shineId===b.id&&!isDimmed?"shine-active":""}`}
                      onPointerDown={e=>onPointerDown(e,b,"move")}
                      onContextMenu={e=>e.preventDefault()}
                      onClick={e=>{
                        e.stopPropagation();
                        if(xJustShownRef.current){ xJustShownRef.current=false; return; }
                        if(quickCancelId){ xVisibleRef.current=false; setQuickCancelId(null); return; }
                        if(dragEndedRef.current) return;
                        if(isVipSlot){ setVipSlotModal(b); return; }
                        if(isBlock){ setBlockModal(b); return; }
                        if(isCancelling){
                          clearTimeout(cancelTimers.current[b.id]);
                          delete cancelTimers.current[b.id];
                          setCancellingSet(s=>{ const ns=new Set(s); ns.delete(b.id); return ns; });
                          return;
                        }
                        if(!dragRef.current){ setLocalSelectedBooking(b); onSlotClick?.(b); }
                      }}
                      style={isVipSlot ? {
                        position:"relative", width:"100%", height:"100%",
                        borderRadius:8,
                        background:"rgba(168,85,247,0.13)",
                        border:"1.5px solid rgba(168,85,247,0.5)",
                        display:"flex", flexDirection:"column",
                        alignItems:"flex-start", justifyContent:"center",
                        padding:"0 7px", overflow:"hidden",
                      } : isBlock ? {
                        position:"relative", width:"100%", height:"100%",
                        borderRadius:8,
                        background:"repeating-linear-gradient(45deg,#1a1b1f,#1a1b1f 6px,#222428 6px,#222428 12px)",
                        border:"1px solid rgba(255,255,255,0.08)",
                        boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        overflow:"hidden",
                      } : {
                        "--c": c,
                        position:"relative", width:"100%", height:"100%",
                        padding:"2px 6px",
                        display:"flex", flexDirection:"column",
                        opacity: isDimmed ? 0.38 : 1,
                        filter: isDimmed ? "grayscale(0.6)" : "none",
                        transition:"opacity 0.4s, filter 0.4s",
                      }}>
                      <div className="slot-handle top" onPointerDown={e=>onPointerDown(e,b,"top")}/>
                      {!isBlock && !isVipSlot && <div className="shine-layer"/>}
                      {isVipSlot && height >= 14 && (
                        <>
                          <span style={{fontSize:10, fontWeight:800, color:"rgba(168,85,247,0.9)", lineHeight:1}}>{fmtTime(b.startMin)}</span>
                          <span style={{fontSize:11, lineHeight:1, marginTop:1}}>👑</span>
                        </>
                      )}
                      {isBlock && height >= 18 && (() => {
                        const sz = Math.min(height * 0.62, 36);
                        return (
                          <svg width={sz} height={sz} viewBox="0 0 100 100" style={{opacity:0.55,flexShrink:0}}>
                            <polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30"
                              fill="#ef4444" stroke="#ff6b6b" strokeWidth="3"/>
                            <rect x="20" y="43" width="60" height="14" rx="7" fill="white"/>
                          </svg>
                        );
                      })()}
                      {!isBlock && !isVipSlot && height >= 12 && (() => {
                        const [fName, ...lParts] = b.name.split(' ');
                        const lName = lParts.join(' ');
                        const priceColor = b.surcharge ? GOLD : "rgba(255,255,255,0.9)";
                        const lines = [
                          { text: fName, w: 800, c: "#fff" },
                          ...(lName ? [{ text: lName, w: 700, c: "rgba(255,255,255,0.85)" }] : []),
                          { text: b.type==="school" ? "Автошкола" : "Приватний", w: 600, c: "rgba(255,255,255,0.6)" },
                          ...(price > 0 ? [{ text: `${price}₴`, w: 900, c: priceColor }] : []),
                        ];
                        const maxFs = Math.min(11, Math.floor(COL_W / 5.5));
                        const fs = Math.max(6, Math.min(maxFs, Math.floor((height - 6) / (lines.length * 1.25))));
                        return (
                          <div style={{
                            position:"absolute", top:2, left:2, right:2, bottom:2,
                            display:"flex", flexDirection:"column", justifyContent:"space-evenly",
                            overflow:"hidden", zIndex:2,
                          }}>
                            {lines.map((ln, i) => (
                              <div key={i} style={{
                                fontSize: fs, fontWeight: ln.w, color: ln.c,
                                lineHeight: 1.2, textAlign:"center",
                                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                                textShadow:"0 1px 2px rgba(0,0,0,0.55)",
                              }}>{ln.text}</div>
                            ))}
                          </div>
                        );
                      })()}
                      {/* VIP crown badge for regular bookings marked as VIP */}
                      {b.isVipOnly && !isVipSlot && height >= 14 && (
                        <div style={{
                          position:"absolute", top:2, right:2, zIndex:4,
                          fontSize:Math.min(11, Math.max(7, height/7)),
                          lineHeight:1, pointerEvents:"none",
                          filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.7))",
                        }}>👑</div>
                      )}
                      {/* Queue badge */}
                      {queueCount > 0 && !isBlock && !isVipSlot && height >= 14 && (
                        <div style={{
                          position:"absolute", bottom:3, left:3, zIndex:4,
                          background:"rgba(0,0,0,0.55)", borderRadius:5,
                          padding:"1px 4px", display:"flex", alignItems:"center", gap:2,
                          pointerEvents:"none",
                        }}>
                          <svg width="7" height="7" viewBox="0 0 24 24" fill={GOLD}><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                          <span style={{fontSize:7, fontWeight:800, color:GOLD, lineHeight:1}}>{queueCount}</span>
                        </div>
                      )}
                      <div className="slot-handle bottom" onPointerDown={e=>onPointerDown(e,b,"bottom")}/>

                    </div>

                    {/* ── Значок скасування (довге натискання) — поза slot-base щоб не обрізатись ── */}
                    {quickCancelId===b.id && (
                      <div
                        onPointerDown={e=>e.stopPropagation()}
                        onClick={e=>{
                          e.stopPropagation();
                          xVisibleRef.current = false;
                          setQuickCancelId(null);
                          // Починаємо 2с відлік — затемнення → видалення
                          setCancellingSet(s=>new Set([...s, b.id]));
                          cancelTimers.current[b.id] = setTimeout(()=>{
                            setCancellingSet(s=>{ const ns=new Set(s); ns.delete(b.id); return ns; });
                            setBookings(bs=>bs.filter(x=>x.id!==b.id));
                            delete cancelTimers.current[b.id];
                          }, 2000);
                        }}
                        style={{
                          position:"absolute", top:-11, right:-11, zIndex:30,
                          width:30, height:30, borderRadius:"50%",
                          background:"linear-gradient(145deg,#f87171,#b91c1c)",
                          boxShadow:"0 0 0 3px rgba(30,30,40,0.85), 0 4px 12px #b91c1c99",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          cursor:"pointer",
                        }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="#fff" strokeWidth="3.2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
            );
          })}
          </div>
        </div>

      </div>{/* /outer flex */}
    </Card>

    <BookingModal booking={localSelectedBooking} onClose={()=>setLocalSelectedBooking(null)}
      onAction={handleAction} settings={settings}/>

    {/* ── Модалка блокування ── */}
    {blockModal && (
      <div onClick={()=>setBlockModal(null)} style={{
        position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.78)",
        display:"flex",alignItems:"flex-end",justifyContent:"center",
        backdropFilter:"blur(12px)"
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:"100%",maxWidth:480,background:BG_DEEP,
          borderRadius:"28px 28px 0 0",
          boxShadow:"0 -2px 0 rgba(255,255,255,0.08), 0 -16px 60px rgba(0,0,0,0.8)",
          display:"flex",flexDirection:"column",overflow:"hidden",
        }}>
          {/* Hero */}
          <div style={{
            padding:"14px 16px 18px",
            background:"repeating-linear-gradient(45deg,#1e1f23,#1e1f23 8px,#232428 8px,#232428 16px)",
            position:"relative",
          }}>
            <div style={{width:38,height:4,borderRadius:2,background:"rgba(255,255,255,0.1)",margin:"0 auto 14px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{
                width:50,height:50,borderRadius:25,flexShrink:0,
                background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:18,fontWeight:900,color:"rgba(255,255,255,0.5)",letterSpacing:-0.4}}>Заблоковано</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",marginTop:3}}>
                  {getDayInfo(blockModal.day).fullLabel} · {fmtTime(blockModal.startMin)} · {fmtDur(blockModal.durMin)}
                </div>
              </div>
            </div>
          </div>
          {/* Buttons */}
          <div style={{padding:"14px 16px 28px",display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>{
              setBookings(bs=>bs.filter(x=>x.id!==blockModal.id));
              setBlockModal(null);
            }} style={{
              width:"100%",padding:"14px",borderRadius:18,border:"none",cursor:"pointer",
              background:`linear-gradient(160deg,${GREEN},#4ade80)`,
              color:"#fff",fontSize:14,fontWeight:800,
              boxShadow:`0 6px 20px ${GREEN}55`,
            }}>
              🔓 Розблокувати
            </button>
            <button onClick={()=>setBlockModal(null)} style={{
              width:"100%",padding:"13px",borderRadius:18,border:"none",cursor:"pointer",
              background:"linear-gradient(145deg,#f87171,#b91c1c)",
              color:"#fff",fontSize:13,fontWeight:700,
              boxShadow:"0 4px 14px #b91c1c66",
            }}>Закрити</button>
          </div>
        </div>
      </div>
    )}

    {bubbleData && (
      <div onClick={()=>setBubbleData(null)} style={{position:"fixed",inset:"0 0 80px 0",zIndex:100}}>
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",
          top: Math.max(60, Math.min(bubbleData.clientY - 50, window.innerHeight - 130)),
          left: Math.max(10, Math.min(bubbleData.clientX - 10, window.innerWidth - 180)),
          width:168,
          background:`linear-gradient(135deg,${SURFACE},${BG_DEEP})`,
          borderRadius:14, padding:"10px 12px",
          boxShadow:"0 8px 32px rgba(0,0,0,0.65),inset 1px 1px 0 rgba(255,255,255,0.08)",
          border:`1px solid ${BORDER}`
        }}>
          <div style={{fontSize:18,fontWeight:900,color:TEXT,marginBottom:8,letterSpacing:0.5}}>
            {fmtTime(bubbleData.startMin)}
            <span style={{fontSize:10,fontWeight:600,color:TEXT_DIM,marginLeft:6}}>
              {getDayInfo(bubbleData.day).label} {getDayInfo(bubbleData.day).num}
            </span>
          </div>
          <button onClick={()=>{setCreateSlotData(bubbleData);setBubbleData(null);}} style={{
            width:"100%",padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",
            background:`linear-gradient(165deg,${GREEN},#16a34a)`,
            color:"#fff",fontSize:12,fontWeight:800,
            boxShadow:`0 4px 12px rgba(99,211,120,0.4)`
          }}>+ Створити слот</button>
        </div>
      </div>
    )}

    {/* ── Меню опцій слота (довгий тап) — компактне вікно ── */}
    {slotOptions && (
      <div onClick={()=>setSlotOptions(null)} style={{
        position:"fixed",inset:0,zIndex:200,
        background:"rgba(0,0,0,0.45)",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:220,
          background:BG_DEEP,
          borderRadius:18,
          boxShadow:"0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
          overflow:"hidden",
        }}>
          {/* Заголовок */}
          <div style={{
            padding:"10px 14px 8px",
            borderBottom:`1px solid rgba(255,255,255,0.06)`,
            fontSize:11,fontWeight:700,color:TEXT_FAINT,textAlign:"center",
          }}>{slotOptions.time}</div>

          {/* VIP */}
          <button onClick={()=>applySlotOption(slotOptions.dateStr, slotOptions.time, "vip")} style={{
            width:"100%",padding:"11px 14px",border:"none",cursor:"pointer",
            background:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,
            color:"#c084fc",fontSize:13,fontWeight:700,
            display:"flex",alignItems:"center",gap:9,
          }}>
            <span>👑</span> VIP слот
          </button>

          {/* Надбавки */}
          {[100,200,300].map((amt,i)=>(
            <button key={amt} onClick={()=>applySlotOption(slotOptions.dateStr, slotOptions.time, amt)} style={{
              width:"100%",padding:"11px 14px",border:"none",cursor:"pointer",
              background:"none",
              borderBottom: i<2 ? `1px solid rgba(255,255,255,0.05)` : "none",
              color:GOLD,fontSize:13,fontWeight:700,
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <span style={{color:TEXT_DIM,fontWeight:500}}>Надбавка</span>
              <span>+{amt}₴</span>
            </button>
          ))}

          {/* Скинути — тільки якщо є що скидати */}
          {(slotOptions.slot?.vipOnly || slotOptions.slot?.surcharge) && (
            <button onClick={()=>applySlotOption(slotOptions.dateStr, slotOptions.time, "reset")} style={{
              width:"100%",padding:"10px 14px",border:"none",cursor:"pointer",
              background:"none",borderTop:`1px solid rgba(255,255,255,0.06)`,
              color:TEXT_FAINT,fontSize:12,fontWeight:600,
            }}>Скинути</button>
          )}
        </div>
      </div>
    )}

    {/* ── VIP слот модалка ── */}
    {vipSlotModal && (
      <div onClick={()=>setVipSlotModal(null)} style={{
        position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.78)",
        display:"flex",alignItems:"flex-end",justifyContent:"center",
        backdropFilter:"blur(12px)"
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:"100%",maxWidth:480,background:BG_DEEP,
          borderRadius:"28px 28px 0 0",
          boxShadow:"0 -2px 0 rgba(168,85,247,0.4), 0 -16px 60px rgba(0,0,0,0.8)",
          display:"flex",flexDirection:"column",overflow:"hidden",
        }}>
          <div style={{
            padding:"16px 16px 18px",
            background:"linear-gradient(145deg,rgba(168,85,247,0.18),rgba(124,58,237,0.08))",
            borderBottom:"1px solid rgba(168,85,247,0.2)",
          }}>
            <div style={{width:38,height:4,borderRadius:2,background:"rgba(255,255,255,0.1)",margin:"0 auto 14px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{
                width:52,height:52,borderRadius:26,flexShrink:0,
                background:"linear-gradient(145deg,#a855f7,#7c3aed)",
                boxShadow:"0 0 0 3px rgba(168,85,247,0.3), 0 6px 20px rgba(168,85,247,0.4)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
              }}>👑</div>
              <div>
                <div style={{fontSize:18,fontWeight:900,color:PURPLE}}>VIP Слот</div>
                <div style={{fontSize:12,color:TEXT_DIM,marginTop:3}}>
                  {getDayInfo(vipSlotModal.day).fullLabel} · {fmtTime(vipSlotModal.startMin)} · {fmtDur(vipSlotModal.durMin)}
                </div>
                <div style={{fontSize:11,color:TEXT_FAINT,marginTop:4}}>
                  Тільки для учнів категорії VIP
                </div>
              </div>
            </div>
          </div>
          <div style={{padding:"14px 16px 32px",display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>{
              const v = vipSlotModal;
              const dateStr = v._dateStr || absDayToDateStr(v.day);
              const hh = String(Math.floor(v.startMin / 60)).padStart(2, "0");
              const mm = String(v.startMin % 60).padStart(2, "0");
              update(ref(db, `timeslots/${dateStr}/slot${hh}${mm}`), { vipOnly: false }).catch(() => {});
              setVipSlotModal(null);
            }} style={{
              width:"100%",padding:"14px",borderRadius:18,border:"none",cursor:"pointer",
              background:`linear-gradient(160deg,${GREEN},#4ade80)`,
              color:"#fff",fontSize:14,fontWeight:800,
              boxShadow:`0 6px 20px ${GREEN}55`,
            }}>🗑 Видалити VIP слот</button>
            <button onClick={()=>setVipSlotModal(null)} style={{
              width:"100%",padding:"13px",borderRadius:18,border:"none",cursor:"pointer",
              background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
              color:TEXT_DIM,fontSize:13,fontWeight:700,boxShadow:SHADOW_OUT,
            }}>Закрити</button>
          </div>
        </div>
      </div>
    )}

    <NewBookingModal data={formData} onClose={()=>setFormData(null)}
      onConfirm={b=>{setBookings(bs=>[...bs,b]);setFormData(null);}} settings={settings}/>

    {createSlotData && <CreateSlotSheet data={createSlotData} settings={settings} onClose={()=>setCreateSlotData(null)}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE SLOT SHEET — вільний слот з вибором часу і тривалості
// ═══════════════════════════════════════════════════════════════
function CreateSlotSheet({ data, settings, onClose }) {
  const slotStep = settings.slotCreateStep || 30;
  const timeItems = useMemo(() => {
    const arr = [];
    for (let m = settings.workStart * 60; m < settings.workEnd * 60; m += slotStep)
      arr.push({ label: fmtTime(m), value: m });
    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.workStart, settings.workEnd, slotStep]);

  const durItems = [
    { label:"1 год",  value:60  },
    { label:"2 год",  value:120 },
    { label:"3 год",  value:180 },
    { label:"4 год",  value:240 },
  ];

  const initTimeIdx = Math.max(0, timeItems.findIndex(t => t.value >= (data.startMin || 0)));
  const [timeIdx, setTimeIdx] = useState(initTimeIdx);
  const [durIdx,  setDurIdx]  = useState(1);
  const [saving,  setSaving]  = useState(false);

  const day = getDayInfo(data.day);

  const handleCreate = async () => {
    setSaving(true);
    const startMin = timeItems[timeIdx]?.value ?? data.startMin;
    const dur = durItems[durIdx].value;
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + data.day);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const updates = {};
    for (let m = startMin; m < startMin + dur; m += 60) {
      const h = String(Math.floor(m / 60)).padStart(2, '0');
      const mn = String(m % 60).padStart(2, '0');
      const id = `slot${h}${mn}`;
      updates[`timeslots/${dateStr}/${id}/time`] = `${h}:${mn}`;
      updates[`timeslots/${dateStr}/${id}/available`] = true;
    }
    await update(ref(db, '/'), updates).catch(() => {});
    setSaving(false);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"flex-end"}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",background:SURFACE,borderRadius:"22px 22px 0 0",
        padding:"16px 20px 40px",
        boxShadow:"0 -10px 40px rgba(0,0,0,0.5)"
      }}>
        <div style={{width:36,height:4,background:BORDER,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:13,fontWeight:700,color:TEXT_DIM,marginBottom:16,textAlign:"center",letterSpacing:0.5,textTransform:"uppercase"}}>
          Вільний слот · {day.fullLabel} {day.num}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:TEXT_DIM,letterSpacing:1,marginBottom:6,textAlign:"center"}}>ПОЧАТОК</div>
            <DrumRoll items={timeItems} currentIdx={timeIdx} onChange={setTimeIdx} itemH={40} visible={3}/>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:TEXT_DIM,letterSpacing:1,marginBottom:6,textAlign:"center"}}>ТРИВАЛІСТЬ</div>
            <DrumRoll items={durItems} currentIdx={durIdx} onChange={setDurIdx} itemH={40} visible={3}/>
          </div>
        </div>
        <div style={{textAlign:"center",fontSize:12,color:TEXT_DIM,marginBottom:14}}>
          {fmtTime(timeItems[timeIdx]?.value ?? 0)} — {fmtTime((timeItems[timeIdx]?.value ?? 0) + durItems[durIdx].value)}
        </div>
        <button onClick={handleCreate} disabled={saving} style={{
          width:"100%",padding:14,borderRadius:14,border:"none",cursor:"pointer",
          background:`linear-gradient(165deg,${GREEN},#16a34a)`,
          color:"#fff",fontSize:14,fontWeight:800,
          boxShadow:"0 4px 16px rgba(99,211,120,0.4),inset 1px 1px 0 rgba(255,255,255,0.25)"
        }}>{saving ? "Створюємо..." : "✓ Створити слот"}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOOKING DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function BookingModal({ booking, onClose, onAction, settings }) {
  const [queueEntries, setQueueEntries] = useState([]);
  useEffect(() => {
    if (!booking) return;
    const dateStr = booking.date || (() => {
      const d = new Date(); d.setHours(0,0,0,0);
      d.setDate(d.getDate() + booking.day);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();
    const hh = String(Math.floor(booking.startMin/60)).padStart(2,'0');
    const mm = String(booking.startMin%60).padStart(2,'0');
    const slotKey = `${dateStr}_${hh}:${mm}`;
    const r = ref(db, `queue/${slotKey}/entries`);
    const unsub = onValue(r, snap => {
      if (!snap.exists()) { setQueueEntries([]); return; }
      const entries = Object.values(snap.val())
        .filter(e => e.status === 'waiting')
        .sort((a,b) => (a.addedAt||0) - (b.addedAt||0));
      setQueueEntries(entries);
    });
    return () => unsub();
  }, [booking]);

  if (!booking) return null;

  const svc   = settings.services.find(s => s.id === booking.serviceId)
             || settings.services.find(s => s.active && s.type===(booking.serviceType||booking.type) && Number(s.duration)===booking.durMin);
  const c     = colorOf(svc?.colorId);
  const day   = getDayInfo(booking.day);
  const basePrice = svc
    ? Math.round((svc.price / svc.duration) * booking.durMin)
    : booking.price && booking.durationHours
      ? Math.round((booking.price / (booking.durationHours * 60)) * booking.durMin)
      : (booking.price || 0);
  const price = basePrice + (booking.surcharge || 0);
  const ini   = booking.name.trim().split(" ").slice(0, 2).map(w => w[0]).join("");
  const typeLabel = booking.type === "school" ? "🎓 Автошкола" : "🚗 Приватний";

  const IcoPhone = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 4.14 6.18 2 2 0 0 1 6.12 4h3a2 2 0 0 1 2 1.72c.13 1 .37 1.98.72 2.91a2 2 0 0 1-.45 2.11L10 12a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.93.35 1.91.59 2.91.72A2 2 0 0 1 22 16.92z"/></svg>;
  const IcoChat  = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(0,0,0,0.55)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:300,
        background:BG_DEEP,
        borderRadius:20,
        boxShadow:`0 2px 0 ${c}55, 0 20px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)`,
        overflow:"hidden",
      }}>

        {/* Student row */}
        <div style={{
          display:"flex", alignItems:"center", gap:11,
          padding:"14px 14px 12px",
          borderBottom:`1px solid rgba(255,255,255,0.06)`,
          background:`linear-gradient(135deg,${c}18,${c}08)`,
        }}>
          <div style={{
            width:40, height:40, borderRadius:12, flexShrink:0,
            background:`linear-gradient(145deg,${c},color-mix(in srgb,${c} 55%,#000))`,
            boxShadow:`0 0 0 2px ${c}33`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:900, color:"#fff",
          }}>{ini}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14, fontWeight:800, color:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{booking.name}</div>
            <div style={{fontSize:10, color:c, fontWeight:700, marginTop:2}}>{typeLabel}</div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:"rgba(255,255,255,0.04)"}}>
          {[
            { label:"Дата",  val:`${day.num} ${day.month}`, sub:day.label },
            { label:"Час",   val:`${fmtTime(booking.startMin)}`, sub:`–${fmtTime(booking.startMin+booking.durMin)}` },
            { label:"Ціна",  val:`${price}₴`, sub: booking.surcharge ? `+${booking.surcharge}₴` : (svc ? `${svc.duration}хв` : "—"), gold: !!booking.surcharge },
          ].map(({ label, val, sub, gold }, i) => (
            <div key={i} style={{
              padding:"11px 6px",
              background:BG_DEEP,
              display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <div style={{fontSize:8, fontWeight:700, letterSpacing:1, color:TEXT_FAINT, textTransform:"uppercase", marginBottom:5}}>{label}</div>
              <div style={{fontSize:14, fontWeight:900, color: gold ? GOLD : TEXT, lineHeight:1}}>{val}</div>
              <div style={{fontSize:9, color: gold ? `${GOLD}99` : TEXT_FAINT, marginTop:3, fontWeight:600}}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Queue */}
        {queueEntries.length > 0 && (
          <div style={{padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:9, fontWeight:700, letterSpacing:1, color:GOLD, textTransform:"uppercase", marginBottom:6}}>
              ⏳ Черга ({queueEntries.length})
            </div>
            {queueEntries.map((e, i) => (
              <div key={e.uid||i} style={{display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderBottom: i < queueEntries.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none"}}>
                <div style={{width:16, height:16, borderRadius:5, background:"rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:GOLD, flexShrink:0}}>{i+1}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, fontWeight:700, color:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.name || "—"}</div>
                  {e.phone && <div style={{fontSize:10, color:DIM}}>{e.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"12px 12px 14px"}}>
          <button onClick={() => onAction("call", booking)} style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
            padding:"11px", borderRadius:14, border:"none", cursor:"pointer",
            background:"linear-gradient(145deg,#34d399,#059669)",
            boxShadow:"0 4px 14px rgba(52,211,153,0.35)",
            color:"#fff", fontSize:13, fontWeight:800,
          }}>{IcoPhone} Дзвонити</button>
          <button onClick={() => onAction("chat", booking)} style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
            padding:"11px", borderRadius:14, border:"none", cursor:"pointer",
            background:`linear-gradient(145deg,${SURFACE_HI},${SURFACE})`,
            boxShadow:SHADOW_OUT,
            color:BLUE, fontSize:13, fontWeight:800,
          }}>{IcoChat} Чат</button>
        </div>

        {/* Cancel link */}
        <button onClick={() => { onAction("cancel", booking); onClose(); }} style={{
          width:"100%", padding:"9px", border:"none", cursor:"pointer",
          background:"none", borderTop:"1px solid rgba(255,255,255,0.05)",
          color:"rgba(248,113,113,0.7)", fontSize:11, fontWeight:600,
        }}>Скасувати запис</button>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DRUM ROLL PICKER (iOS-style scroll wheel)
// ═══════════════════════════════════════════════════════════════
function DrumRoll({ items, currentIdx, onChange, label, itemH=42, visible=4 }) {
  const ref = useRef(null);
  const timerRef = useRef(null);
  const containerH = itemH * visible;
  const padV = Math.floor(visible / 2) * itemH;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = currentIdx * itemH;
  }, [currentIdx, itemH]);

  const handleScroll = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(ref.current.scrollTop / itemH)));
      onChange(idx);
    }, 80);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"stretch"}}>
      {label && <div style={{fontSize:9,color:TEXT_FAINT,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,textAlign:"center",marginBottom:5}}>{label}</div>}
      <div style={{position:"relative",height:containerH,borderRadius:14,overflow:"hidden",
        background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,boxShadow:SHADOW_IN}}>
        {/* Center green highlight */}
        <div style={{
          position:"absolute",zIndex:2,pointerEvents:"none",
          top:Math.floor(visible/2)*itemH, left:4, right:4, height:itemH,
          borderRadius:10,
          background:"rgba(126,217,87,0.13)",
          border:"1.5px solid rgba(126,217,87,0.4)"
        }}/>
        {/* Top/bottom fade */}
        <div style={{
          position:"absolute",zIndex:3,inset:0,pointerEvents:"none",
          background:`linear-gradient(to bottom,${BG_DEEP}EE 0%,transparent 36%,transparent 64%,${BG_DEEP}EE 100%)`
        }}/>
        {/* Scrollable list */}
        <div ref={ref} className="drum-scroll" onScroll={handleScroll} style={{
          position:"absolute",inset:0,
          overflowY:"scroll",overflowX:"hidden",
          scrollSnapType:"y mandatory",
          WebkitOverflowScrolling:"touch",
          scrollbarWidth:"none",
          paddingTop:padV, paddingBottom:padV,
        }}>
          {items.map((item,i)=>{
            const dist = Math.abs(i - currentIdx);
            return (
              <div key={i} onClick={()=>{
                ref.current?.scrollTo({top:i*itemH,behavior:"smooth"});
                onChange(i);
              }} style={{
                height:itemH, flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                scrollSnapAlign:"center",
                fontSize:dist===0?14:11,
                fontWeight:dist===0?800:500,
                color:dist===0?GREEN:TEXT_DIM,
                opacity:dist===0?1:Math.max(0.2,1-dist*0.3),
                userSelect:"none",cursor:"pointer",
                textAlign:"center",padding:"0 4px",lineHeight:1.3,
              }}>{item.label}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW BOOKING MODAL v3 — drum rolls for student + service
// ═══════════════════════════════════════════════════════════════
function NewBookingModal({ data, onClose, onConfirm, settings }) {
  const timeStep = data?.freeSnap ? 5 : (settings.snapMin || 30);
  const timeItems = useMemo(()=>{
    const arr=[];
    for(let m=settings.workStart*60; m<settings.workEnd*60; m+=timeStep)
      arr.push({label:fmtTime(m), value:m});
    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings.workStart, settings.workEnd, timeStep]);

  const activeServices = useMemo(()=>
    settings.services.filter(s=>s.active)
  ,[settings.services]);

  const serviceItems = useMemo(()=>
    activeServices.map(s=>({ label:s.name, id:s.id, duration:s.duration, price:s.price, type:s.type||"private" }))
  ,[activeServices]);

  const [search,      setSearch]      = useState("");
  const [selStudent,  setSelStudent]  = useState(null);
  const [phone,       setPhone]       = useState("");
  const [newName,     setNewName]     = useState("");
  const [newPhone,    setNewPhone]    = useState("");
  const [dateOffset,  setDateOffset]  = useState(0);
  const [timeIdx,     setTimeIdx]     = useState(0);
  const [svcIdx,      setSvcIdx]      = useState(0);
  const [isVip,       setIsVip]       = useState(false);

  useEffect(()=>{
    if(data){
      const ti=timeItems.findIndex(t=>t.value>=(data.startMin??settings.workStart*60));
      setTimeIdx(Math.max(0, ti<0?0:ti));
      setDateOffset(Math.max(0, data.day??0));
      setSearch(""); setSelStudent(null); setPhone("");
      setNewName(""); setNewPhone("");
      setSvcIdx(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[!!data]);

  if(!data) return null;

  const isNewStudent = selStudent?.id === "new";
  const selSvc     = serviceItems[svcIdx];
  const selTime    = timeItems[timeIdx];
  const q          = search.toLowerCase().trim();
  const filtered   = q ? STUDENTS.filter(s=>s.name.toLowerCase().includes(q)||s.phone.includes(q)) : STUDENTS;
  const finalName  = isNewStudent ? newName.trim() : selStudent ? selStudent.name : search.trim();
  const finalPhone = isNewStudent ? newPhone.trim() : phone || (selStudent ? selStudent.phone : "");
  const canConfirm = finalName.length > 1 && !!selSvc && !!selTime;

  const dayChips = Array.from({length:14},(_,i)=>{
    const info = getDayInfo(i);
    return { lbl: i===0?"Сьогодні":i===1?"Завтра":`${info.label} ${info.num}`, info, i };
  });

  const SL = ({children})=>(
    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.4,color:TEXT_FAINT,
      textTransform:"uppercase",marginBottom:6}}>{children}</div>
  );

  const inputRow = (icon, value, onChange, placeholder, type="text") => (
    <div style={{
      display:"flex",alignItems:"center",gap:8,
      padding:"10px 13px",borderRadius:13,
      background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,boxShadow:SHADOW_IN
    }}>
      {icon}
      <input type={type} placeholder={placeholder} value={value}
        onChange={e=>onChange(e.target.value)}
        style={{flex:1,background:"none",border:"none",outline:"none",
          color:TEXT,fontSize:14,fontWeight:600}}/>
    </div>
  );

  const IcoUser = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
  const IcoPhone= <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 4.14 6.18 2 2 0 0 1 6.12 4h3a2 2 0 0 1 2 1.72c.13 1 .37 1.98.72 2.91a2 2 0 0 1-.45 2.11L10 12a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.93.35 1.91.59 2.91.72A2 2 0 0 1 22 16.92z"/></svg>;

  // Колір героя — береться з вибраної послуги
  const heroC = selSvc ? colorOf(selSvc.type==="school" ? "green" : "yellow") : ACCENT;

  // Ініціали для аватара
  const avatarInitials = (() => {
    const nm = finalName.trim();
    if (!nm) return null;
    const parts = nm.split(" ").filter(Boolean);
    return parts.length >= 2 ? parts[0][0]+parts[1][0] : parts[0].slice(0,2);
  })();

  const Tile = ({label, value, color}) => (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,
      padding:"10px 6px 8px",borderRadius:14,
      background:`linear-gradient(145deg,${SURFACE_HI},${SURFACE_LO})`,boxShadow:SHADOW_OUT}}>
      <div style={{fontSize:13,fontWeight:800,color:color||TEXT,letterSpacing:-0.2}}>{value}</div>
      <div style={{fontSize:9,fontWeight:700,color:TEXT_FAINT,letterSpacing:0.8,textTransform:"uppercase"}}>{label}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:200,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      backdropFilter:"blur(12px)"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:480,background:BG_DEEP,
        borderRadius:"28px 28px 0 0",
        boxShadow:`0 -2px 0 ${heroC}44, 0 -16px 60px rgba(0,0,0,0.8)`,
        maxHeight:"93vh",overflowY:"auto",
        display:"flex",flexDirection:"column",
      }}>

        {/* ══ HERO ══ */}
        <div style={{
          position:"relative",overflow:"hidden",
          padding:"14px 16px 18px",
          background:`linear-gradient(160deg,${heroC}32 0%,${heroC}12 60%,transparent 100%)`,
          borderRadius:"28px 28px 0 0",
          flexShrink:0,
        }}>
          {/* glow blob */}
          <div style={{position:"absolute",top:-40,right:-30,width:160,height:160,borderRadius:"50%",
            background:`radial-gradient(circle,${heroC}44 0%,transparent 68%)`,pointerEvents:"none"}}/>

          {/* handle */}
          <div style={{width:38,height:4,borderRadius:2,background:"rgba(255,255,255,0.1)",margin:"0 auto 14px"}}/>

          {/* avatar row */}
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {/* avatar */}
            <div style={{
              width:54,height:54,borderRadius:27,flexShrink:0,
              background:avatarInitials
                ? `linear-gradient(145deg,${heroC}cc,${heroC}88)`
                : `linear-gradient(145deg,${SURFACE_HI},${SURFACE_LO})`,
              boxShadow:`0 4px 16px ${heroC}55`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:avatarInitials?20:22,fontWeight:800,color:"#fff",
              border:`2px solid ${heroC}66`,
            }}>
              {avatarInitials || "＋"}
            </div>

            {/* name + status */}
            <div style={{flex:1,minWidth:0}}>
              {finalName ? (
                <>
                  <div style={{fontSize:18,fontWeight:900,color:TEXT,letterSpacing:-0.4,
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{finalName}</div>
                  {finalPhone&&<div style={{fontSize:12,color:TEXT_DIM,marginTop:2}}>{finalPhone}</div>}
                </>
              ) : (
                <div style={{fontSize:15,fontWeight:700,color:TEXT_FAINT}}>Новий запис</div>
              )}
              {selSvc && (
                <div style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:5,
                  padding:"3px 10px",borderRadius:20,
                  background:`${heroC}22`,border:`1px solid ${heroC}44`}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:heroC,flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:heroC}}>{selSvc.label}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div style={{padding:"12px 14px 24px",display:"flex",flexDirection:"column",gap:12,flexShrink:0}}>

          {/* ── Тайли дата/час/ціна якщо все вибрано ── */}
          {canConfirm && (
            <div style={{display:"flex",gap:8}}>
              <Tile label="Дата"  value={dayChips[dateOffset]?.lbl} color={GOLD}/>
              <Tile label="Час"   value={selTime?.label}            color={BLUE}/>
              <Tile label="Ціна"  value={`${selSvc.price}₴`}        color={GOLD}/>
            </div>
          )}

          {/* ── УЧЕНЬ ── */}
          <div>
            <SL>Учень</SL>
            {isNewStudent ? (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"8px 14px",borderRadius:12,
                  background:`${GREEN}18`,border:`1.5px solid ${GREEN}44`}}>
                  <div style={{fontSize:12,fontWeight:700,color:GREEN}}>Новий учень</div>
                  <button onClick={()=>{setSelStudent(null);setNewName("");setNewPhone("");}}
                    style={{background:"none",border:"none",cursor:"pointer",color:TEXT_FAINT,fontSize:20,padding:"0 2px",lineHeight:1}}>×</button>
                </div>
                {inputRow(IcoUser,  newName,  setNewName,  "Ім'я та прізвище")}
                {inputRow(IcoPhone, newPhone, setNewPhone, "+380...", "tel")}
              </div>
            ) : selStudent ? (
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",borderRadius:14,
                  background:`${GREEN}20`,border:`1.5px solid ${GREEN}50`}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:TEXT}}>{selStudent.name}</div>
                    <div style={{fontSize:11,color:TEXT_DIM,marginTop:1}}>{selStudent.phone}</div>
                  </div>
                  <button onClick={()=>{setSelStudent(null);setPhone("");setSearch("");}}
                    style={{background:"none",border:"none",cursor:"pointer",color:TEXT_FAINT,fontSize:20,padding:"0 4px",lineHeight:1}}>×</button>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,
                  padding:"10px 13px",borderRadius:13,
                  background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,boxShadow:SHADOW_IN}}>
                  {IcoPhone}
                  <input type="tel" placeholder="+380..." value={finalPhone}
                    onChange={e=>setPhone(e.target.value)}
                    style={{flex:1,background:"none",border:"none",outline:"none",color:TEXT_DIM,fontSize:13,fontWeight:600}}/>
                </div>
              </>
            ) : (
              <>
                <div style={{display:"flex",alignItems:"center",gap:8,
                  padding:"10px 13px",borderRadius:14,marginBottom:6,
                  background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,boxShadow:SHADOW_IN}}>
                  {IcoUser}
                  <input type="text" placeholder="Пошук за ім'ям..."
                    value={search} onChange={e=>setSearch(e.target.value)}
                    style={{flex:1,background:"none",border:"none",outline:"none",color:TEXT,fontSize:14,fontWeight:600}}/>
                  {search&&<button onClick={()=>setSearch("")}
                    style={{background:"none",border:"none",cursor:"pointer",color:TEXT_FAINT,fontSize:18,padding:0,lineHeight:1}}>×</button>}
                </div>
                <div style={{borderRadius:14,overflow:"hidden",
                  background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
                  boxShadow:SHADOW_IN,maxHeight:148,overflowY:"auto"}}>
                  {!q&&(
                    <div onClick={()=>{setSelStudent({id:"new",name:"",phone:""});setNewName("");setNewPhone("");}}
                      style={{display:"flex",alignItems:"center",gap:10,
                        padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${BORDER}`}}>
                      <div style={{width:22,height:22,borderRadius:11,flexShrink:0,
                        background:`${GREEN}33`,border:`1.5px solid ${GREEN}55`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:15,color:GREEN,fontWeight:800}}>+</div>
                      <div style={{fontSize:13,fontWeight:700,color:GREEN}}>Новий учень</div>
                    </div>
                  )}
                  {filtered.slice(0,7).map(s=>(
                    <div key={s.id}
                      onClick={()=>{setSelStudent(s);setPhone(s.phone);setSearch("");}}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${BORDER}`}}>
                      <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{s.name}</div>
                      <div style={{fontSize:11,color:TEXT_FAINT}}>{s.phone.slice(-7)}</div>
                    </div>
                  ))}
                  {q&&!filtered.length&&(
                    <div style={{padding:"12px 14px",fontSize:12,color:TEXT_FAINT,textAlign:"center"}}>Не знайдено</div>
                  )}
                  {q.length>1&&!filtered.find(s=>s.name.toLowerCase()===q)&&(
                    <div onClick={()=>{setSelStudent({id:"new",name:"",phone:""});setNewName(search.trim());setNewPhone("");setSearch("");}}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer"}}>
                      <div style={{width:22,height:22,borderRadius:11,flexShrink:0,
                        background:`${GREEN}33`,border:`1.5px solid ${GREEN}55`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:15,color:GREEN,fontWeight:800}}>+</div>
                      <div style={{fontSize:13,fontWeight:700,color:GREEN}}>Додати «{search.trim()}»</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── ДАТА ── */}
          <div>
            <SL>Дата</SL>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
              {dayChips.map(({lbl,info,i})=>{
                const active=i===dateOffset;
                return (
                  <button key={i} onClick={()=>setDateOffset(i)} style={{
                    flexShrink:0,padding:"7px 12px",borderRadius:12,border:"none",cursor:"pointer",
                    background:active?`linear-gradient(165deg,${GOLD},#e6a800)`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE_LO})`,
                    color:active?"#1a1200":info.wk?ACCENT:TEXT_DIM,
                    fontSize:12,fontWeight:active?800:600,
                    boxShadow:active?`0 4px 12px ${GOLD}55`:SHADOW_OUT,
                    transition:"all .15s"
                  }}>
                    <div>{lbl}</div>
                    {i>1&&<div style={{fontSize:9,opacity:0.7,marginTop:1}}>{info.month}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ЧАС + ПОСЛУГА ── */}
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <SL>Час початку</SL>
              <DrumRoll items={timeItems} currentIdx={timeIdx} onChange={setTimeIdx} itemH={40} visible={3}/>
            </div>
            <div style={{flex:1}}>
              <SL>Послуга</SL>
              <DrumRoll items={serviceItems} currentIdx={svcIdx} onChange={setSvcIdx} itemH={40} visible={3}/>
            </div>
          </div>

          {/* ── VIP SLOT TOGGLE ── */}
          <div onClick={()=>setIsVip(v=>!v)} style={{
            display:"flex",alignItems:"center",gap:12,cursor:"pointer",
            padding:"11px 14px",borderRadius:13,
            background:isVip?`linear-gradient(145deg,rgba(192,132,252,0.18),rgba(124,58,237,0.1))`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE_LO})`,
            border:isVip?`1px solid rgba(192,132,252,0.35)`:`1px solid transparent`,
            boxShadow:SHADOW_OUT,
          }}>
            <span style={{fontSize:20}}>👑</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:isVip?"#c084fc":TEXT}}>VIP-слот</div>
              <div style={{fontSize:10,color:TEXT_FAINT}}>Тільки для учнів категорії VIP</div>
            </div>
            <div style={{
              width:44,height:24,borderRadius:12,position:"relative",
              background:isVip?"linear-gradient(145deg,#c084fc,#7c3aed)":"linear-gradient(145deg,#1f2125,#161719)",
              boxShadow:isVip?"0 0 8px rgba(192,132,252,0.4)":SHADOW_IN,
              transition:"background .2s",
            }}>
              <div style={{position:"absolute",top:3,left:isVip?21:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s"}}/>
            </div>
          </div>

          {/* ── КНОПКИ ── */}
          <button disabled={!canConfirm} onClick={()=>{
            if(!canConfirm) return;
            onConfirm({
              id:`b-${Date.now()}`,
              day:dateOffset, startMin:selTime.value, durMin:selSvc.duration,
              name:finalName, phone:finalPhone, serviceId:selSvc.id,
              type:selSvc.type||"private", status:"confirmed", tsc:"", hoursDone:0,
              categoryId: isVip ? "cat-vip" : null,
              isVipOnly:  isVip,
            });
            onClose();
          }} style={{
            width:"100%",padding:"14px",borderRadius:18,border:"none",cursor:"pointer",
            background:canConfirm?`linear-gradient(160deg,${GREEN},#4ade80)`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE_LO})`,
            color:canConfirm?"#fff":TEXT_FAINT,
            fontSize:14,fontWeight:800,letterSpacing:0.2,
            boxShadow:canConfirm?`0 6px 20px ${GREEN}55`:SHADOW_OUT,
            transition:"all .2s"
          }}>✓ Записати</button>

          <button onClick={onClose} style={{
            width:"100%",padding:"13px",borderRadius:18,border:"none",cursor:"pointer",
            background:"linear-gradient(145deg,#f87171,#b91c1c)",
            color:"#fff",fontSize:13,fontWeight:700,
            boxShadow:"0 4px 14px #b91c1c66",letterSpacing:0.2,
          }}>Скасувати</button>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NUM INPUT — локальний стан, не скаче при наборі
// ═══════════════════════════════════════════════════════════════
function NumInput({ value, onChange, min, max, suffix }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (raw) => {
    const n = parseInt(raw ?? draft, 10);
    if (!isNaN(n) && n >= (min ?? -Infinity) && n <= (max ?? Infinity)) onChange(n);
    else setDraft(String(value));
  };
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:6,
      padding:"6px 12px", borderRadius:10,
      background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
      boxShadow:SHADOW_IN
    }}>
      <input
        type="number" inputMode="numeric"
        value={draft} min={min} max={max}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={e => { if (e.key === "Enter") { commit(); e.target.blur(); } }}
        style={{
          width:50, background:"transparent", border:"none", outline:"none",
          color:TEXT, fontSize:14, fontWeight:800, textAlign:"center"
        }}
      />
      {suffix && <span style={{fontSize:11, color:TEXT_DIM, fontWeight:700}}>{suffix}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS — все настройки
// ═══════════════════════════════════════════════════════════════
function SettingsView({ settings, setSettings }) {
  const upd = (k, v) => setSettings(s => ({...s, [k]:v}));
  const updNested = (k1, k2, v) => setSettings(s => ({...s, [k1]:{...s[k1], [k2]:v}}));

  // ── row helper
  const Row = ({ label, hint, children }) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,padding:"12px 0",borderBottom:`1px solid ${BORDER}`}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{label}</div>
        {hint && <div style={{fontSize:11,color:TEXT_DIM,marginTop:3}}>{hint}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );


  return (
    <>
    <style>{GLOBAL_CSS}</style>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── PROFILE ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Профіль інструктора</SectionTitle>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <div className="icon3d" style={{
            width:80,height:80,borderRadius:40,
            background:`linear-gradient(165deg,${PURPLE},#6d28d9)`
          }}>
            <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{position:"relative",zIndex:1}}>
              <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <input value={settings.profile.name} onChange={e=>updNested("profile","name",e.target.value)}
              style={{background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:17,fontWeight:800,width:"100%",marginBottom:4}}/>
            <input value={settings.profile.phone} onChange={e=>updNested("profile","phone",e.target.value)}
              style={{background:"transparent",border:"none",outline:"none",color:TEXT_DIM,fontSize:12,width:"100%"}}/>
          </div>
        </div>
        <Row label="Адреса">
          <input value={settings.profile.address} onChange={e=>updNested("profile","address",e.target.value)}
            style={{
              background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
              border:"none",outline:"none",color:TEXT,fontSize:13,
              padding:"8px 12px",borderRadius:10,boxShadow:SHADOW_IN,width:180,textAlign:"right"
            }}/>
        </Row>
        <Row label="Досвід (років)">
          <NumInput value={settings.profile.experience} onChange={v=>updNested("profile","experience",v)} min={0} max={50}/>
        </Row>
      </Card>

      {/* ── SCHEDULE ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Робочий графік</SectionTitle>
        <Row label="Початок дня" hint="Перший доступний слот">
          <NumInput value={settings.workStart} onChange={v=>upd("workStart",v)} min={0} max={23} suffix=":00"/>
        </Row>
        <Row label="Кінець дня" hint="Останній доступний слот">
          <NumInput value={settings.workEnd} onChange={v=>upd("workEnd",v)} min={1} max={24} suffix=":00"/>
        </Row>
        <Row label="Вихідні дні">
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:200}}>
            {["Пн","Вт","Ср","Чт","Пт","Сб","Нд"].map((d,i)=>{
              const on = settings.weekends.includes(i);
              return (
                <button key={d} onClick={()=>upd("weekends", on?settings.weekends.filter(x=>x!==i):[...settings.weekends,i])}
                  style={{
                    width:34,height:34,borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                    background: on?`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
                    color: on?"#fff":TEXT_DIM,
                    boxShadow: on?`inset 1px 1px 0 rgba(255,255,255,0.25)`:SHADOW_OUT
                  }}>{d}</button>
              );
            })}
          </div>
        </Row>
        <Row label="Днів відображати в розкладі" hint="Від 1 до 30">
          <NumInput value={settings.daysShown} onChange={v=>upd("daysShown",v)} min={1} max={30} suffix="дн"/>
        </Row>
      </Card>

      {/* ── BREAKS ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Обідня перерва</SectionTitle>
        <Row label="Робити паузу на обід">
          <Toggle on={settings.lunchEnabled} onChange={v=>upd("lunchEnabled",v)}/>
        </Row>
        {settings.lunchEnabled && (
          <>
            <Row label="З">
              <NumInput value={settings.lunchStart} onChange={v=>upd("lunchStart",v)} min={0} max={23} suffix=":00"/>
            </Row>
            <Row label="До">
              <NumInput value={settings.lunchEnd} onChange={v=>upd("lunchEnd",v)} min={1} max={24} suffix=":00"/>
            </Row>
          </>
        )}
      </Card>

      {/* ── SNAP & DISPLAY ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Сітка часу</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:10}}>
          Крок при перетягуванні: <b style={{color:ACCENT}}>{settings.snapMin} хв</b>
        </div>
        <input type="range" min={1} max={60} value={settings.snapMin}
          onChange={e=>upd("snapMin",+e.target.value)}
          style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4,marginBottom:10}}>
          <span style={{fontSize:10,color:TEXT_FAINT}}>1 хв</span>
          <span style={{fontSize:10,color:TEXT_FAINT}}>60 хв</span>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[1,5,15,30,60].map(v=>(
            <button key={v} onClick={()=>upd("snapMin",v)} style={{
              padding:"6px 12px",borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background: settings.snapMin===v?`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
              color: settings.snapMin===v?"#fff":TEXT_DIM,
              boxShadow: settings.snapMin===v?`inset 1px 1px 0 rgba(255,255,255,0.25)`:SHADOW_OUT
            }}>{v} хв</button>
          ))}
        </div>
      </Card>

      {/* ── PENDING ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Підтвердження букінгів</SectionTitle>
        <Row label="Вимагати підтвердження" hint="Нові букінги отримують статус 'Очікує' до твого підтвердження">
          <Toggle on={settings.pendingEnabled} onChange={v=>upd("pendingEnabled",v)}/>
        </Row>
      </Card>

      {/* ── STICKY TIME ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Прилипання вільних слотів</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:14}}>
          Якщо є запис на 12:00–14:00, які слоти показувати учневі для 1-годинного уроку?
        </div>
        {[
          {k:"before",l:"Тільки попередні (11:00)"},
          {k:"after", l:"Тільки наступні (14:00)"},
          {k:"both",  l:"Обидва (11:00 і 14:00) — вибір учня"},
        ].map(o=>(
          <Row key={o.k} label={o.l}>
            <div onClick={()=>upd("stickyTime",o.k)} style={{
              width:22,height:22,borderRadius:11,cursor:"pointer",
              border:`2px solid ${settings.stickyTime===o.k?ACCENT:TEXT_FAINT}`,
              background: settings.stickyTime===o.k?ACCENT:"transparent",
              boxShadow: settings.stickyTime===o.k?`0 0 8px ${ACCENT}77, inset 1px 1px 0 rgba(255,255,255,0.3)`:"none"
            }}/>
          </Row>
        ))}
      </Card>

      {/* ── RESTRICTIONS ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Обмеження для учнів</SectionTitle>
        <Row label="Учень може переносити свої букінги">
          <Toggle on={settings.studentCanReschedule} onChange={v=>upd("studentCanReschedule",v)}/>
        </Row>
        <Row label="Учень може скасовувати букінги">
          <Toggle on={settings.studentCanCancel} onChange={v=>upd("studentCanCancel",v)}/>
        </Row>
        <Row label="Заборона запису" hint="За скільки годин до слоту учень не може записатись">
          <NumInput value={settings.bookCutoffHours} onChange={v=>upd("bookCutoffHours",v)} min={0} max={48} suffix="год"/>
        </Row>
        <Row label="Календар наперед" hint="На скільки днів учень бачить вільні слоти">
          <NumInput value={settings.calendarOpenDays} onChange={v=>upd("calendarOpenDays",v)} min={1} max={365} suffix="дн"/>
        </Row>
      </Card>

      {/* ── SERVICES ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Послуги та ціни</SectionTitle>
        {settings.services.map(s=>(
          <div key={s.id} style={{
            padding:"14px",marginBottom:10,borderRadius:14,
            background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,boxShadow:SHADOW_OUT,
            opacity:s.active?1:0.5
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              {/* color preview */}
              <div className="slot-base slot-colored" style={{"--c":colorOf(s.colorId),width:30,height:30,borderRadius:8}}/>
              <input value={s.name}
                onChange={e=>upd("services", settings.services.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:14,fontWeight:800}}/>
              <Toggle on={s.active} onChange={v=>upd("services", settings.services.map(x=>x.id===s.id?{...x,active:v}:x))}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1,marginBottom:4}}>ХВИЛИН</div>
                <NumInput value={s.duration}
                  onChange={v=>upd("services", settings.services.map(x=>x.id===s.id?{...x,duration:v}:x))}
                  min={5} max={480} suffix="хв"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1,marginBottom:4}}>ЦІНА</div>
                <NumInput value={s.price}
                  onChange={v=>upd("services", settings.services.map(x=>x.id===s.id?{...x,price:v}:x))}
                  min={0} max={100000} suffix="₴"/>
              </div>
            </div>
            <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1,marginBottom:6}}>КОЛІР</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {PALETTE.map(p=>(
                <button key={p.id} title={p.name}
                  onClick={()=>upd("services", settings.services.map(x=>x.id===s.id?{...x,colorId:p.id}:x))}
                  style={{
                    width:28,height:28,borderRadius:8,border:s.colorId===p.id?`2px solid ${TEXT}`:"none",
                    cursor:"pointer",background:`linear-gradient(155deg, ${p.color}aa, ${p.color}44)`,
                    boxShadow:`inset 1px 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.3)`
                  }}/>
              ))}
            </div>
          </div>
        ))}
        <button onClick={()=>upd("services",[...settings.services,{
          id:`sv-${Date.now()}`,name:"Нова послуга",type:"private",duration:60,price:0,colorId:"blue",active:true,description:""
        }])} style={{
          width:"100%",padding:"12px",borderRadius:14,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
          color:TEXT,fontSize:13,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          boxShadow:SHADOW_OUT
        }}>{ICONS.plus(28)} Додати послугу</button>
      </Card>

      {/* ── CATEGORIES ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Категорії учнів</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:12}}>
          Категорії для приватних учнів. Допомагає відкривати спецслоти для VIP, давати знижки тощо.
        </div>
        {settings.categories.map(c=>(
          <div key={c.id} style={{
            display:"flex",alignItems:"center",gap:10,padding:"12px",marginBottom:8,borderRadius:12,
            background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,boxShadow:SHADOW_OUT
          }}>
            <div style={{
              width:14,height:14,borderRadius:4,
              background:colorOf(c.colorId),boxShadow:`0 0 8px ${colorOf(c.colorId)}88`
            }}/>
            <input value={c.name}
              onChange={e=>upd("categories", settings.categories.map(x=>x.id===c.id?{...x,name:e.target.value}:x))}
              style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,fontWeight:700}}/>
            <select value={c.colorId}
              onChange={e=>upd("categories", settings.categories.map(x=>x.id===c.id?{...x,colorId:e.target.value}:x))}
              style={{
                background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
                color:TEXT,border:"none",outline:"none",padding:"6px 10px",borderRadius:8,fontSize:12
              }}>
              {PALETTE.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={()=>upd("categories", settings.categories.filter(x=>x.id!==c.id))}
              style={{background:"none",border:"none",cursor:"pointer",color:RED,fontSize:18}}>×</button>
          </div>
        ))}
        <button onClick={()=>upd("categories",[...settings.categories,{
          id:`cat-${Date.now()}`,name:"Нова категорія",colorId:"blue"
        }])} style={{
          width:"100%",padding:"12px",borderRadius:14,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
          color:TEXT,fontSize:13,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          boxShadow:SHADOW_OUT
        }}>{ICONS.plus(28)} Додати категорію</button>
      </Card>

      {/* ── NAVIGATION ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Нижня навігація</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:12}}>
          Оберіть вкладки, які відображаються в нижньому меню. «Налашт.» завжди активні.
        </div>
        {TABS.map(t=>(
          <Row key={t.id} label={t.label}>
            <Toggle
              on={settings.navTabs?.includes(t.id) ?? true}
              onChange={v=>{
                if(t.id==="settings") return;
                upd("navTabs", v
                  ? [...(settings.navTabs||[]), t.id]
                  : (settings.navTabs||[]).filter(x=>x!==t.id));
              }}/>
          </Row>
        ))}
      </Card>

      {/* ── AUTO MESSAGES ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Автоматичні повідомлення</SectionTitle>
        <Row label="Нагадування за N годин до уроку">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {settings.autoReminder.enabled && (
              <NumInput value={settings.autoReminder.hoursBefore}
                onChange={v=>updNested("autoReminder","hoursBefore",v)}
                min={1} max={168} suffix="год"/>
            )}
            <Toggle on={settings.autoReminder.enabled} onChange={v=>updNested("autoReminder","enabled",v)}/>
          </div>
        </Row>
        <Row label="Вітання при реєстрації нового учня">
          <Toggle on={settings.autoWelcome.enabled} onChange={v=>updNested("autoWelcome","enabled",v)}/>
        </Row>
        <Row label="Повідомлення про підтвердження букінгу">
          <Toggle on={settings.autoConfirm.enabled} onChange={v=>updNested("autoConfirm","enabled",v)}/>
        </Row>
        <Row label="Повідомлення після скасування">
          <Toggle on={settings.autoCancel.enabled} onChange={v=>updNested("autoCancel","enabled",v)}/>
        </Row>
        <Row label="Пропозиція вільного слоту (черга)">
          <Toggle on={settings.autoQueueOffer.enabled} onChange={v=>updNested("autoQueueOffer","enabled",v)}/>
        </Row>
      </Card>

      {/* ── QUEUE ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Черга очікування — режим роботи</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:14}}>
          Коли учень скасовує запис, як пропонувати слот тим, хто в черзі?
        </div>
        <Row label="FIFO" hint="Автоматично запросити першого в черзі">
          <Toggle on={settings.queueAutoFifo} onChange={v=>upd("queueAutoFifo",v)}/>
        </Row>
        <Row label="Broadcast" hint="Розіслати всім, хто перший підтвердив — той записаний">
          <Toggle on={settings.queueBroadcast} onChange={v=>upd("queueBroadcast",v)}/>
        </Row>
        <Row label="Ручний" hint="Інструктор сам обирає кого запросити">
          <Toggle on={settings.queueManual} onChange={v=>upd("queueManual",v)}/>
        </Row>
      </Card>

      {/* ── APPEARANCE ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Зовнішній вигляд</SectionTitle>
        <Row label="Тема">
          <div style={{display:"flex",gap:6}}>
            {[{k:"dark",l:"Темна"},{k:"light",l:"Світла"}].map(t=>(
              <button key={t.k} onClick={()=>upd("theme",t.k)} style={{
                padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background: settings.theme===t.k?`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
                color: settings.theme===t.k?"#fff":TEXT_DIM,
                boxShadow: settings.theme===t.k?`inset 1px 1px 0 rgba(255,255,255,0.25)`:SHADOW_OUT
              }}>{t.l}</button>
            ))}
          </div>
        </Row>
        <Row label="Мова">
          <div style={{display:"flex",gap:6}}>
            {[{k:"uk",l:"УКР"},{k:"en",l:"ENG"}].map(t=>(
              <button key={t.k} onClick={()=>upd("language",t.k)} style={{
                padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background: settings.language===t.k?`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
                color: settings.language===t.k?"#fff":TEXT_DIM,
                boxShadow: settings.language===t.k?`inset 1px 1px 0 rgba(255,255,255,0.25)`:SHADOW_OUT
              }}>{t.l}</button>
            ))}
          </div>
        </Row>
      </Card>

      {/* ── NOTIFICATIONS ── */}
      <Card style={{padding:"20px"}}>
        <SectionTitle>Нотифікації</SectionTitle>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:14}}>Де показувати нові букінги та повідомлення:</div>
        {[
          {k:"topbar",l:"У верхньому барі (іконка дзвіночка)"},
          {k:"tab",l:"Окрема вкладка в меню"},
          {k:"profile",l:"У профілі інструктора"},
        ].map(o=>(
          <Row key={o.k} label={o.l}>
            <div onClick={()=>upd("notifLocation",o.k)} style={{
              width:22,height:22,borderRadius:11,cursor:"pointer",
              border:`2px solid ${settings.notifLocation===o.k?ACCENT:TEXT_FAINT}`,
              background: settings.notifLocation===o.k?ACCENT:"transparent",
              boxShadow: settings.notifLocation===o.k?`0 0 8px ${ACCENT}77, inset 1px 1px 0 rgba(255,255,255,0.3)`:"none"
            }}/>
          </Row>
        ))}
      </Card>

      <div style={{height:30}}/>
    </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUB for other tabs
// ═══════════════════════════════════════════════════════════════
function StubView({ title }) {
  return (
    <Card style={{padding:30,textAlign:"center"}}>
      <div style={{fontSize:14,color:TEXT_DIM,marginBottom:10}}>{title}</div>
      <div style={{fontSize:12,color:TEXT_FAINT}}>Допишемо після твого фідбеку на Розклад + Налаштування</div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const TABS = [
  {id:"schedule",  label:"Записи",     icon:ICONS.calendar},
  {id:"bookings",  label:"Букінги",    icon:ICONS.list},
  {id:"students",  label:"Учні",       icon:ICONS.users},
  {id:"services",  label:"Послуги",    icon:ICONS.car},
  {id:"chats",     label:"Чати",       icon:ICONS.chat},
  {id:"templates", label:"Шаблони",    icon:ICONS.bell},
  {id:"stats",     label:"Статистика", icon:ICONS.chart},
  {id:"settings",  label:"Налашт.",    icon:ICONS.settings},
];
const TITLES = {
  schedule:"Розклад", bookings:"Букінги", students:"Учні",
  services:"Послуги", chats:"Чати", templates:"Шаблони",
  stats:"Статистика", settings:"Налаштування"
};

export default function App() {
  const [tab, setTab] = useState("schedule");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [bookings, setBookings] = useState(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newBookingData, setNewBookingData] = useState(null);

  const handleAction = (action, b) => {
    if (action === "confirm")  setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"confirmed"}:x));
    if (action === "cancel")   setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"cancelled"}:x));
    if (action === "noshow")   setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"noshow"}:x));
    if (action === "call")     window.location.href = `tel:${b.phone}`;
    if (action === "sms")      window.location.href = `sms:${b.phone}`;
    setSelectedBooking(null);
  };

  const handleNewBooking = (b) => setBookings(bs=>[...bs, b]);

  const renderView = () => {
    switch(tab) {
      case "schedule":  return <ScheduleView settings={settings} setSettings={setSettings}
                                onSlotClick={setSelectedBooking}
                                onEmptySlotClick={setNewBookingData}
                                bookings={bookings} setBookings={setBookings}/>;
      case "settings":  return <SettingsView settings={settings} setSettings={setSettings}/>;
      default: return <StubView title={TITLES[tab]}/>;
    }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight:"100vh", background:BG, color:TEXT,
        fontFamily:"ui-sans-serif,-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        paddingBottom:100
      }}>
        {/* TOP BAR */}
        <div style={{
          padding:"14px 18px",
          display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,
          background:`linear-gradient(180deg,${BG} 60%,rgba(28,29,33,0.92))`,
          backdropFilter:"blur(20px)", zIndex:20,
          borderBottom:`1px solid ${BORDER}`
        }}>
          <button style={{padding:0,background:"transparent",border:"none",cursor:"pointer"}}>{ICONS.menu(42)}</button>
          <div style={{fontSize:17,fontWeight:800,letterSpacing:-0.3}}>{TITLES[tab]}</div>
          {settings.notifLocation==="topbar"
            ? <button style={{padding:0,background:"transparent",border:"none",cursor:"pointer",position:"relative"}}>
                {ICONS.bell(42)}
                <span style={{
                  position:"absolute",top:-2,right:-2,
                  background:ACCENT,color:"#fff",borderRadius:10,
                  padding:"1px 6px",fontSize:9,fontWeight:800,
                  boxShadow:`0 0 8px ${ACCENT}88`
                }}>3</span>
              </button>
            : <button style={{padding:0,background:"transparent",border:"none",cursor:"pointer"}}>{ICONS.refresh(42)}</button>
          }
        </div>

        {/* CONTENT */}
        <div style={{padding:"16px 14px 0"}}>{renderView()}</div>

        {/* FAB on schedule */}
        {tab==="schedule" && (
          <button style={{
            position:"fixed",bottom:118,right:18,
            width:60,height:60,borderRadius:30,
            background:`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`,
            color:"#fff",border:"none",fontSize:30,cursor:"pointer",
            boxShadow:`0 8px 24px rgba(255,90,60,0.5),0 4px 8px rgba(0,0,0,0.3),inset 1px 1px 0 rgba(255,255,255,0.3)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            zIndex:25
          }}>+</button>
        )}

        {/* BOTTOM NAV */}
        <div style={{
          position:"fixed",bottom:0,left:0,right:0,
          padding:"0 16px 14px",
          background:"transparent",
          zIndex:30,
          pointerEvents:"none",
        }}>
          <div style={{
            background:`linear-gradient(180deg,${SURFACE},${SURFACE_LO})`,
            borderRadius:26,
            border:`1px solid rgba(255,255,255,0.08)`,
            boxShadow:"0 -1px 0 rgba(255,255,255,0.05), 0 12px 40px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.4)",
            display:"flex", overflow:"hidden",
            pointerEvents:"auto",
            justifyContent:"center", gap:0,
          }}>
          {TABS.filter(t=>settings.navTabs?.includes(t.id)??true).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:"1 1 0", minWidth:0, maxWidth:90,
              padding:"12px 6px 10px",
              background:"transparent",border:"none",cursor:"pointer",
              color: tab===t.id?ACCENT:TEXT_FAINT,
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              position:"relative",
            }}>
              <div style={{
                transform: tab===t.id?"scale(1.1)":"scale(0.95)",
                transition:"transform .15s",
                opacity:tab===t.id?1:0.52,
              }}>{t.icon(33)}</div>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:0.2}}>{t.label}</span>
              {tab===t.id && (
                <div style={{
                  position:"absolute",bottom:5,left:"50%",transform:"translateX(-50%)",
                  width:28,height:3,borderRadius:2,background:ACCENT,
                  boxShadow:`0 0 10px ${ACCENT}99`
                }}/>
              )}
            </button>
          ))}
          </div>
        </div>

        {/* MODALS */}
        <BookingModal booking={selectedBooking} onClose={()=>setSelectedBooking(null)}
          onAction={handleAction} settings={settings}/>
        <NewBookingModal data={newBookingData} onClose={()=>setNewBookingData(null)}
          onConfirm={handleNewBooking} settings={settings}/>
      </div>
    </>
  );
}

export { ScheduleView, SettingsView };
