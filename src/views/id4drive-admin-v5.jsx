import { useState, useRef, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS (v3 skin)
// ═══════════════════════════════════════════════════════════════
const BG = "#1c1d21";
const BG_DEEP = "#161719";
const SURFACE = "#26282c";
const SURFACE_HI = "#2e3034";
const SURFACE_LO = "#1f2125";
const BORDER = "rgba(255,255,255,0.05)";
const TEXT = "#e8e8ea";
const TEXT_DIM = "#8b8d93";
const TEXT_FAINT = "#5a5c62";
const ACCENT = "#ff5a3c";
const ACCENT_HI = "#ff7a5c";
const GREEN = "#7ed957";
const BLUE = "#5b9bff";
const PURPLE = "#c084fc";
const GOLD = "#f7c948";
const RED = "#ef4444";

const SHADOW_OUT = "6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(255,255,255,0.025)";
const SHADOW_IN = "inset 3px 3px 8px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.025)";

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
const initialBookings = [
  { id:"b1", day:0, startMin:8*60,  durMin:120, name:"Марія Коваль",   phone:"+380671234567", type:"school",  tsc:"ТСЦ Оболонь",   hoursDone:12, status:"confirmed", serviceId:"sv1" },
  { id:"b2", day:0, startMin:11*60, durMin:60,  name:"Іван Петренко",  phone:"+380509876543", type:"private", tsc:"",              hoursDone:5,  status:"pending",   serviceId:"sv3", categoryId:"cat-std" },
  { id:"b3", day:0, startMin:14*60, durMin:120, name:"Олена Мороз",    phone:"+380631112233", type:"school",  tsc:"ТСЦ Дарниця",  hoursDone:38, status:"confirmed", serviceId:"sv1" },
  { id:"b4", day:1, startMin:9*60,  durMin:60,  name:"Дмитро Сало",    phone:"+380961234567", type:"private", tsc:"",              hoursDone:9,  status:"confirmed", serviceId:"sv3", categoryId:"cat-vip" },
  { id:"b5", day:1, startMin:13*60, durMin:60,  name:"Тетяна Кравець", phone:"+380731234567", type:"school",  tsc:"ТСЦ Оболонь",   hoursDone:40, status:"confirmed", serviceId:"sv1" },
  { id:"b6", day:2, startMin:10*60, durMin:120, name:"Антон Білий",    phone:"+380501112233", type:"school",  tsc:"ТСЦ Лівобережна", hoursDone:22, status:"confirmed", serviceId:"sv1" },
  { id:"b7", day:2, startMin:15*60, durMin:120, name:"Юлія Денисюк",   phone:"+380935023739", type:"private", tsc:"",              hoursDone:3,  status:"pending",   serviceId:"sv4", categoryId:"cat-new" },
  { id:"b8", day:3, startMin:8*60,  durMin:60,  name:"Сергій Гук",     phone:"+380961234500", type:"private", tsc:"",              hoursDone:14, status:"confirmed", serviceId:"sv3", categoryId:"cat-std" },
  { id:"b9", day:3, startMin:11*60, durMin:120, name:"Наталія Бондар", phone:"+380671112244", type:"school",  tsc:"ТСЦ Дарниця",  hoursDone:18, status:"confirmed", serviceId:"sv1" },
  { id:"b10",day:4, startMin:9*60,  durMin:120, name:"Андрій Чорний",  phone:"+380501234500", type:"school",  tsc:"ТСЦ Оболонь",   hoursDone:30, status:"confirmed", serviceId:"sv1" },
  { id:"b11",day:4, startMin:14*60, durMin:60,  name:"Ірина Лесник",   phone:"+380967240853", type:"private", tsc:"",              hoursDone:1,  status:"pending",   serviceId:"sv3", categoryId:"cat-new" },
  { id:"b12",day:5, startMin:10*60, durMin:120, name:"Ангеліна Коник", phone:"+380681746071", type:"private", tsc:"",              hoursDone:6,  status:"confirmed", serviceId:"sv4", categoryId:"cat-vip" },
];

const _DLABELS = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];
const _MLABELS = ["січ","лют","бер","кві","тра","чер","лип","сер","вер","жов","лис","гру"];
const getDayInfo = (offsetFromToday) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  return { num: d.getDate(), month: _MLABELS[d.getMonth()], label: _DLABELS[dow], wk: dow >= 5 };
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
function ScheduleView({ settings, setSettings, onSlotClick, onEmptySlotClick, bookings, setBookings }) {
  const [dragId, setDragId] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [windowW, setWindowW] = useState(window.innerWidth);
  const [dayOffset, setDayOffset] = useState(0);
  const dragRef = useRef(null);
  const calcRef = useRef({});
  const gridRef = useRef(null);
  const holdTimerRef = useRef(null);
  const pendingDragRef = useRef(null);
  const dragEndedRef = useRef(false);
  const swipeRef = useRef(null);
  const gridWrapRef = useRef(null);
  const [pinch, setPinch] = useState(null);
  const [bubbleData, setBubbleData] = useState(null);
  const [formData, setFormData] = useState(null);
  const [localSelectedBooking, setLocalSelectedBooking] = useState(null);

  const PX_PER_MIN = settings.hourHeightPx / 60;
  const TIME_COL_W = 42;
  const COL_W = Math.max(44, Math.floor((windowW - 28 - TIME_COL_W - Math.max(0, settings.daysShown - 1) * 4) / settings.daysShown));
  const totalMin = (settings.workEnd - settings.workStart) * 60;
  const gridHeight = totalMin * PX_PER_MIN;
  const days = Array.from({length: settings.daysShown}, (_, i) => getDayInfo(dayOffset + i));

  // Keep calc values fresh for always-on window listeners (avoids stale closure)
  calcRef.current = { PX_PER_MIN, snapMin: settings.snapMin, workStart: settings.workStart, workEnd: settings.workEnd, COL_W, dayOffset, daysShown: settings.daysShown };

  const minToPx = (m) => (m - settings.workStart*60) * PX_PER_MIN;

  const onPointerDown = (e, b, mode) => {
    e.preventDefault(); e.stopPropagation();
    pendingDragRef.current = {
      id:b.id, mode,
      startClientY:e.clientY, startClientX:e.clientX,
      startMinutes:b.startMin, startDur:b.durMin, startDay:b.day,
    };
    setHoldId(b.id);
    holdTimerRef.current = setTimeout(() => {
      if (!pendingDragRef.current) return;
      dragRef.current = {...pendingDragRef.current};
      pendingDragRef.current = null;
      setHoldId(null);
      setDragId(b.id);
      navigator.vibrate?.(35);
    }, 1000);
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
            gridWrapRef.current.style.transform = `translateX(${dx * 0.88}px)`;
          }
        }
      }
      if (pendingDragRef.current) {
        const pd = pendingDragRef.current;
        const moved = Math.hypot(e.clientY - pd.startClientY, e.clientX - pd.startClientX);
        if (moved > 15) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          pendingDragRef.current = null;
          setHoldId(null);
        }
        return;
      }
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const { PX_PER_MIN, snapMin, workStart, workEnd, COL_W, dayOffset, daysShown } = calcRef.current;
      const snap = (m) => Math.round(m / snapMin) * snapMin;
      const dy = e.clientY - drag.startClientY;
      const dxRaw = e.clientX - drag.startClientX;
      const deltaMin = dy / PX_PER_MIN;
      setBookings(bs => bs.map(b => {
        if (b.id !== drag.id) return b;
        if (drag.mode === "move") {
          const newDay = Math.max(dayOffset, Math.min(dayOffset + daysShown - 1, drag.startDay + Math.round(dxRaw/(COL_W+4))));
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
      dragRef.current = null;
      setDragId(null);
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      pendingDragRef.current = null;
      setHoldId(null);
      if (wasDragging) {
        dragEndedRef.current = true;
        requestAnimationFrame(() => { dragEndedRef.current = false; });
      }
      // Swipe navigation with slide animation
      const sw = swipeRef.current;
      swipeRef.current = null;
      const el = gridWrapRef.current;
      if (sw && !wasDragging && el) {
        const dx = sw.endX - sw.startX;
        const dy = sw.endY - sw.startY;
        const isHSwipe = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2;
        if (isHSwipe) {
          const { COL_W } = calcRef.current;
          const daysToShift = Math.max(1, Math.min(3, Math.round(Math.abs(dx) / COL_W)));
          const dir = dx < 0 ? 1 : -1; // +1=forward(left swipe) -1=back(right swipe)
          const slideOut = dir > 0 ? `-${COL_W * daysToShift * 1.1}px` : `${COL_W * daysToShift * 1.1}px`;
          const slideIn  = dir > 0 ? `${COL_W * daysToShift * 1.1}px` : `-${COL_W * daysToShift * 1.1}px`;
          // Phase 1: slide current content out
          el.style.transition = "transform 0.18s ease-in";
          el.style.transform = `translateX(${slideOut})`;
          const phase2 = () => {
            el.removeEventListener("transitionend", phase2);
            // Update content + position off-screen on opposite side
            el.style.transition = "none";
            el.style.transform = `translateX(${slideIn})`;
            setDayOffset(o => Math.max(0, o + dir * daysToShift));
            // Phase 3: slide new content in
            requestAnimationFrame(() => requestAnimationFrame(() => {
              el.style.transition = "transform 0.22s ease-out";
              el.style.transform = "translateX(0)";
              const phase3 = () => { el.removeEventListener("transitionend", phase3); el.style.transition = ""; };
              el.addEventListener("transitionend", phase3);
            }));
          };
          el.addEventListener("transitionend", phase2);
        } else {
          // Snap back if threshold not met
          el.style.transition = "transform 0.2s ease-out";
          el.style.transform = "translateX(0)";
          const snap = () => { el.removeEventListener("transitionend", snap); el.style.transition = ""; };
          el.addEventListener("transitionend", snap);
        }
      } else if (el && el.style.transform) {
        el.style.transition = "";
        el.style.transform = "";
      }
    };
    const onResize = () => setWindowW(window.innerWidth);
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
  }, [setBookings, setDayOffset]);

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
    onEmptySlotClick?.(bData);
  };
  const handleAction = (action, b) => {
    if (action === "confirm") setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"confirmed"}:x));
    if (action === "cancel")  setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"cancelled"}:x));
    if (action === "noshow")  setBookings(bs=>bs.map(x=>x.id===b.id?{...x,status:"noshow"}:x));
    if (action === "call")    window.location.href=`tel:${b.phone}`;
    if (action === "sms")     window.location.href=`sms:${b.phone}`;
    setLocalSelectedBooking(null);
  };
  const handleBlock = ({ day, startMin }) => {
    setBookings(bs=>[...bs,{
      id:`block-${Date.now()}`, day, startMin, durMin:60,
      name:"ЗАБЛОКОВАНО", phone:"", type:"block", tsc:"",
      hoursDone:0, status:"cancelled", serviceId:""
    }]);
  };

  return (
    <>
    <style>{GLOBAL_CSS}</style>
    <Card style={{padding:"8px 8px 12px"}}>
      {/* Day header */}
      <div style={{display:"flex",marginBottom:4,paddingLeft:TIME_COL_W+4}}>
        {days.map((day,i)=>(
          <div key={i} style={{
            width:COL_W,marginRight:i<days.length-1?4:0,flexShrink:0,
            textAlign:"center",fontSize:10,fontWeight:800,
            color:day.wk?ACCENT:TEXT_DIM
          }}>{day.label} {day.num}</div>
        ))}
      </div>
      <div
        ref={gridRef}
        onPointerDownCapture={e=>{
          swipeRef.current={startX:e.clientX,startY:e.clientY,endX:e.clientX,endY:e.clientY};
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        style={{display:"flex", overflowX:"hidden", overflowY:"auto", maxHeight:"calc(100vh - 200px)", touchAction:"pan-y"}}
      >
        <div ref={gridWrapRef} style={{display:"flex", flexShrink:0}}>
        {/* Time column */}
        <div style={{width:TIME_COL_W, flexShrink:0, position:"relative", height:gridHeight}}>
          {Array.from({length:(settings.workEnd-settings.workStart)*2+1},(_,i)=>{
            const totalMins = i*30;
            const h = settings.workStart + Math.floor(totalMins/60);
            const m = totalMins % 60;
            if (h > settings.workEnd) return null;
            const isHour = m===0;
            return (
              <div key={i} style={{
                position:"absolute", top:totalMins*PX_PER_MIN-6,
                right:2, fontSize:isHour?10:8,
                color:isHour?TEXT_FAINT:"rgba(90,92,98,0.45)",
                fontWeight:700, lineHeight:1
              }}>{h}:{String(m).padStart(2,'0')}</div>
            );
          })}
        </div>

        {/* Day columns */}
        {days.map((day,colIdx)=>{
          const absDay = dayOffset + colIdx;
          return (
          <div key={absDay}
            onClick={e=>handleColumnClick(e, absDay)}
            style={{
              width:COL_W, flexShrink:0, height:gridHeight,
              position:"relative", marginRight:colIdx<days.length-1?4:0, padding:"0 4px",
              background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
              borderRadius:14, boxShadow:SHADOW_IN, cursor:"cell"
            }}>

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
            {settings.lunchEnabled && !day.wk && (
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

            {/* Bookings */}
            {bookings.filter(b=>b.day===absDay).map(b=>{
              const top = minToPx(b.startMin);
              const height = b.durMin * PX_PER_MIN;
              const c = slotColor(b);
              const isPending = b.status==="pending" && settings.pendingEnabled;
              const svc = settings.services.find(s=>s.id===b.serviceId);
              const price = svc ? Math.round((svc.price / svc.duration) * b.durMin) : 0;
              return (
                <div key={b.id}
                  className={`slot-base slot-colored ${isPending?"slot-pending-ring":""}`}
                  onPointerDown={e=>onPointerDown(e,b,"move")}
                  onContextMenu={e=>e.preventDefault()}
                  onClick={e=>{ e.stopPropagation(); if(!dragRef.current){ setLocalSelectedBooking(b); onSlotClick?.(b); }}}
                  style={{
                    "--c": c,
                    position:"absolute", top:top+2, left:4, right:4,
                    height:height-4, padding:"2px 6px",
                    display:"flex", flexDirection:"column", justifyContent:"center", gap:0,
                    zIndex: dragId===b.id?10:2,
                    transition:"transform 0.12s",
                    transform: holdId===b.id ? "scale(0.95)" : "none",
                    outline: holdId===b.id ? `2px solid ${c}` : "none",
                  }}>
                  <div className="slot-handle top" onPointerDown={e=>onPointerDown(e,b,"top")}/>
                  {height >= 16 && (() => {
                    const nSz = Math.max(8, Math.min(12, Math.floor(Math.min(COL_W/5.5, height/4.8))));
                    const sSz = Math.max(7, Math.min(10, Math.floor(Math.min(COL_W/7.5, height/7))));
                    const [fName, ...lParts] = b.name.split(' ');
                    const lName = lParts.join(' ');
                    return <>
                      <div style={{
                        fontSize:nSz, fontWeight:800, color:"#fff",
                        lineHeight:1.1, textShadow:"0 1px 2px rgba(0,0,0,0.5)",
                        zIndex:2, position:"relative",
                        overflow:"hidden",
                      }}>{fName}{lName&&<><br/><span style={{fontWeight:700}}>{lName}</span></>}</div>
                      {height >= 36 && b.type==="school" && b.tsc && (
                        <div style={{
                          fontSize:sSz, color:"rgba(255,255,255,0.85)", lineHeight:1.1,
                          zIndex:2, position:"relative", textShadow:"0 1px 2px rgba(0,0,0,0.5)",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                        }}>{b.tsc}</div>
                      )}
                      {height >= 28 && (
                        <div style={{
                          fontSize:sSz, color:"rgba(255,255,255,0.7)",
                          zIndex:2, position:"relative", fontWeight:700,
                          textShadow:"0 1px 2px rgba(0,0,0,0.5)"
                        }}>{fmtDur(b.durMin)}</div>
                      )}
                      {height >= 42 && price > 0 && (
                        <div style={{
                          fontSize:sSz, color:"rgba(255,255,255,0.9)",
                          zIndex:2, position:"relative", fontWeight:800,
                          textShadow:"0 1px 3px rgba(0,0,0,0.6)"
                        }}>{price} ₴</div>
                      )}
                    </>;
                  })()}
                  <div className="slot-handle bottom" onPointerDown={e=>onPointerDown(e,b,"bottom")}/>
                </div>
              );
            })}
          </div>
          );
        })}
        </div>{/* /gridWrapRef */}
      </div>
    </Card>

    <BookingModal booking={localSelectedBooking} onClose={()=>setLocalSelectedBooking(null)}
      onAction={handleAction} settings={settings}/>

    {bubbleData && (
      <div onClick={()=>setBubbleData(null)} style={{position:"fixed",inset:0,zIndex:100}}>
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",
          top: Math.max(60, Math.min(bubbleData.clientY - 80, window.innerHeight - 170)),
          left: Math.max(10, Math.min(bubbleData.clientX - 10, window.innerWidth - 210)),
          width:196,
          background:`linear-gradient(135deg,${SURFACE},${BG_DEEP})`,
          borderRadius:16, padding:"14px",
          boxShadow:"0 8px 32px rgba(0,0,0,0.65),inset 1px 1px 0 rgba(255,255,255,0.08)",
          border:`1px solid ${BORDER}`
        }}>
          <div style={{fontSize:11,fontWeight:700,color:TEXT_DIM,marginBottom:10}}>
            {getDayInfo(bubbleData.day).label} {getDayInfo(bubbleData.day).num} · {fmtTime(bubbleData.startMin)}
          </div>
          <button onClick={()=>{setFormData(bubbleData);setBubbleData(null);}} style={{
            width:"100%",padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:6,
            background:`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`,
            color:"#fff",fontSize:12,fontWeight:800,
            boxShadow:`0 4px 12px ${ACCENT}44`
          }}>+ Записати учня</button>
          <button onClick={()=>{handleBlock(bubbleData);setBubbleData(null);}} style={{
            width:"100%",padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
            color:TEXT_DIM,fontSize:12,fontWeight:700,
            boxShadow:SHADOW_OUT
          }}>Заблокувати</button>
        </div>
      </div>
    )}

    <NewBookingModal data={formData} onClose={()=>setFormData(null)}
      onConfirm={b=>{setBookings(bs=>[...bs,b]);setFormData(null);}} settings={settings}/>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOOKING DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function BookingModal({ booking, onClose, onAction, settings }) {
  if (!booking) return null;
  const svc = settings.services.find(s=>s.id===booking.serviceId);
  const cat = booking.categoryId ? settings.categories.find(c=>c.id===booking.categoryId) : null;

  const Btn = ({ icon, label, onClick, color }) => (
    <button onClick={onClick} style={{
      flex:"1 1 100px", padding:"12px 8px", borderRadius:12, border:"none", cursor:"pointer",
      background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
      color: color||TEXT, fontSize:11, fontWeight:700,
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      boxShadow:SHADOW_OUT
    }}>
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      backdropFilter:"blur(8px)"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:520,background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0", padding:"22px 20px 30px",
        boxShadow:"0 -10px 40px rgba(0,0,0,0.6)",
        maxHeight:"90vh", overflowY:"auto"
      }}>
        {/* drag handle */}
        <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"0 auto 16px"}}/>

        {/* header */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          {ICONS.user(54)}
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{booking.name}</div>
            <div style={{fontSize:12,color:TEXT_DIM,marginTop:2}}>{booking.phone}</div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {statusPill(booking.status)}
              {cat && <Pill label={cat.name} color={colorOf(cat.colorId)} bg={`${colorOf(cat.colorId)}22`}/>}
              {booking.type==="school" && (
                <Pill label={`${booking.hoursDone}/40 год`} color={booking.hoursDone>=40?ACCENT:GREEN} bg="rgba(255,255,255,0.05)"/>
              )}
            </div>
          </div>
        </div>

        {/* info grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`}}>
            <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1}}>ДАТА</div>
            <div style={{fontSize:14,fontWeight:700,marginTop:3}}>25 трав 2026</div>
          </div>
          <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`}}>
            <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1}}>ЧАС</div>
            <div style={{fontSize:14,fontWeight:700,marginTop:3,color:BLUE}} className="tabular">
              {fmtTime(booking.startMin)}–{fmtTime(booking.startMin+booking.durMin)}
            </div>
          </div>
          <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`}}>
            <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1}}>ПОСЛУГА</div>
            <div style={{fontSize:13,fontWeight:700,marginTop:3,color:svc?colorOf(svc.colorId):TEXT}}>{svc?.name || "—"}</div>
          </div>
          <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`}}>
            <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1}}>ЦІНА</div>
            <div style={{fontSize:14,fontWeight:700,marginTop:3,color:GOLD}}>{svc?.price || 0} ₴</div>
          </div>
          {booking.tsc && (
            <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,gridColumn:"span 2"}}>
              <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1}}>ТСЦ</div>
              <div style={{fontSize:13,fontWeight:700,marginTop:3}}>{booking.tsc}</div>
            </div>
          )}
        </div>

        {/* notes (instructor private) */}
        <div style={{padding:"10px 12px",borderRadius:12,boxShadow:SHADOW_IN,background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,marginBottom:16}}>
          <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1,marginBottom:6}}>НОТАТКИ ІНСТРУКТОРА (ПРИВАТНІ)</div>
          <textarea placeholder="Додай нотатку про учня..." rows={2} style={{
            width:"100%",background:"transparent",border:"none",outline:"none",
            color:TEXT,fontSize:13,resize:"none",fontFamily:"inherit"
          }}/>
        </div>

        {/* actions grid */}
        <div style={{fontSize:10,color:TEXT_FAINT,letterSpacing:1,marginBottom:8}}>ДІЇ</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
          {booking.status==="pending" && <Btn icon={ICONS.check(34)} label="Підтвердити" color={GREEN} onClick={()=>onAction("confirm",booking)}/>}
          <Btn icon={ICONS.clock(34)} label="Перенести" onClick={()=>onAction("reschedule",booking)}/>
          <Btn icon={
            <Icon3D size={34} gradient="linear-gradient(165deg,#34d399,#047857)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </Icon3D>
          } label="Дзвонити" onClick={()=>onAction("call",booking)}/>
          <Btn icon={ICONS.chat(34)} label="Чат" onClick={()=>onAction("chat",booking)}/>
          <Btn icon={ICONS.bell(34)} label="SMS" onClick={()=>onAction("sms",booking)}/>
          <Btn icon={ICONS.calendar(34)} label="Повторити" onClick={()=>onAction("repeat",booking)}/>
          <Btn icon={ICONS.cross(34)} label="Не прийшов" color={RED} onClick={()=>onAction("noshow",booking)}/>
          <Btn icon={
            <Icon3D size={34} gradient="linear-gradient(165deg,#ef4444,#b91c1c)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </Icon3D>
          } label="Скасувати" color={RED} onClick={()=>onAction("cancel",booking)}/>
        </div>

        {/* close */}
        <button onClick={onClose} style={{
          width:"100%",padding:"14px",borderRadius:14,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
          color:TEXT_DIM,fontSize:13,fontWeight:700,
          boxShadow:SHADOW_OUT,marginTop:8
        }}>Закрити</button>
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
// NEW BOOKING MODAL (drum roll pickers)
// ═══════════════════════════════════════════════════════════════
function NewBookingModal({ data, onClose, onConfirm, settings }) {
  const dateItems = useMemo(()=>{
    return Array.from({length:42},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()+i);
      const dow=(d.getDay()+6)%7;
      return {label:`${_DLABELS[dow]} ${d.getDate()} ${_MLABELS[d.getMonth()]}`};
    });
  },[]);

  const timeItems = useMemo(()=>{
    const arr=[];
    for(let m=settings.workStart*60; m<settings.workEnd*60; m+=30)
      arr.push({label:`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`,value:m});
    return arr;
  },[settings.workStart,settings.workEnd]);

  const studentItems = useMemo(()=>STUDENTS.map(s=>({label:s.name,phone:s.phone})),[]);

  const serviceItems = useMemo(()=>
    settings.services.filter(s=>s.active).map(s=>({label:s.name,id:s.id,duration:s.duration,price:s.price,type:s.type||"private"})),
  [settings.services]);

  const [dateIdx, setDateIdx] = useState(0);
  const [timeIdx, setTimeIdx] = useState(0);
  const [studentIdx, setStudentIdx] = useState(0);
  const [svcIdx, setSvcIdx] = useState(0);

  useEffect(()=>{
    if(data){
      setDateIdx(Math.max(0, Math.min(dateItems.length-1, data.day??0)));
      const ti=timeItems.findIndex(t=>t.value>=(data.startMin??settings.workStart*60));
      setTimeIdx(Math.max(0, ti<0?0:ti));
      setStudentIdx(0);
      setSvcIdx(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[!!data]);

  if(!data) return null;

  const selStudent = studentItems[studentIdx] || studentItems[0];
  const selSvc = serviceItems[svcIdx] || serviceItems[0];
  const selTime = timeItems[timeIdx];

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      backdropFilter:"blur(10px)"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:520,
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"14px 14px 28px",
        boxShadow:"0 -12px 40px rgba(0,0,0,0.7)",
        maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:10
      }}>
        {/* handle */}
        <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 4px",flexShrink:0}}/>
        <div style={{fontSize:16,fontWeight:800,color:TEXT,textAlign:"center",letterSpacing:-0.3,flexShrink:0}}>Новий запис</div>

        {/* Date + Time side by side */}
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <DrumRoll items={dateItems} currentIdx={dateIdx} onChange={setDateIdx} label="ДАТА" itemH={42} visible={4}/>
          <DrumRoll items={timeItems} currentIdx={timeIdx} onChange={setTimeIdx} label="ЧАС" itemH={42} visible={4}/>
        </div>

        {/* Student */}
        <div style={{flexShrink:0}}>
          <DrumRoll items={studentItems} currentIdx={studentIdx} onChange={setStudentIdx} label="УЧЕНЬ" itemH={48} visible={3}/>
        </div>

        {/* Service */}
        <div style={{flexShrink:0}}>
          <DrumRoll items={serviceItems} currentIdx={svcIdx} onChange={setSvcIdx} label="ПОСЛУГА" itemH={42} visible={3}/>
        </div>

        {/* Summary */}
        {selSvc && selStudent && (
          <div style={{
            display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"9px 12px",borderRadius:12,flexShrink:0,
            background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,boxShadow:SHADOW_IN
          }}>
            <div style={{fontSize:11,color:TEXT_DIM,flex:1,marginRight:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {selStudent.label} · {selTime?.label}
            </div>
            <div style={{fontSize:15,fontWeight:800,color:GOLD,flexShrink:0}}>{selSvc.price} ₴</div>
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onClose} style={{
            flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${SURFACE_HI},${SURFACE})`,
            color:TEXT_DIM,fontSize:13,fontWeight:700,boxShadow:SHADOW_OUT
          }}>Скасувати</button>
          <button onClick={()=>{
            if(!selStudent||!selSvc||!selTime) return;
            onConfirm({
              id:`b-${Date.now()}`,
              day:dateIdx,
              startMin:selTime.value,
              durMin:selSvc.duration,
              name:selStudent.label,
              phone:selStudent.phone,
              serviceId:selSvc.id,
              type:selSvc.type,
              status:"confirmed",tsc:"",hoursDone:0
            });
            onClose();
          }} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",
            background:`linear-gradient(165deg,${ACCENT_HI},${ACCENT})`,
            color:"#fff",fontSize:13,fontWeight:800,
            boxShadow:`0 4px 16px ${ACCENT}44`
          }}>Записати</button>
        </div>
      </div>
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

  const NumInput = ({ value, onChange, min, max, suffix }) => (
    <div style={{
      display:"flex",alignItems:"center",gap:6,
      padding:"6px 12px",borderRadius:10,
      background:`linear-gradient(135deg,${BG_DEEP},${SURFACE_LO})`,
      boxShadow:SHADOW_IN
    }}>
      <input type="number" value={value} min={min} max={max}
        onChange={e=>onChange(Number(e.target.value))}
        style={{
          width:50,background:"transparent",border:"none",outline:"none",
          color:TEXT,fontSize:14,fontWeight:800,textAlign:"center"
        }}/>
      {suffix && <span style={{fontSize:11,color:TEXT_DIM,fontWeight:700}}>{suffix}</span>}
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
        paddingBottom:90
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
            position:"fixed",bottom:96,right:18,
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
          background:`linear-gradient(180deg,${SURFACE},${SURFACE_LO})`,
          borderTop:`1px solid ${BORDER}`,
          boxShadow:"0 -8px 24px rgba(0,0,0,0.35)",
          zIndex:30, display:"flex"
        }}>
          {TABS.filter(t=>settings.navTabs?.includes(t.id)??true).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:"1 1 0", minWidth:0,
              padding:"7px 2px",
              background:"transparent",border:"none",cursor:"pointer",
              color: tab===t.id?ACCENT:TEXT_FAINT,
              display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              position:"relative"
            }}>
              <div style={{
                transform: tab===t.id?"scale(1.05)":"scale(0.9)",
                transition:"transform .15s",
                opacity:tab===t.id?1:0.5
              }}>{t.icon(28)}</div>
              <span style={{fontSize:8,fontWeight:700}}>{t.label}</span>
              {tab===t.id && (
                <div style={{
                  position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",
                  width:30,height:3,borderRadius:"3px 3px 0 0",background:ACCENT,
                  boxShadow:`0 0 8px ${ACCENT}88`
                }}/>
              )}
            </button>
          ))}
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
