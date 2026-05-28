import React, { useState, useEffect, lazy, Suspense, createContext, useContext } from "react";
import { ref, onValue, update, push, remove } from "firebase/database";
import { db } from "./firebase";
import { useAdminAuth, LoginScreen } from "./AdminAuth";
import { setGlobalLang, createT } from "./lang";

export const LangContext = createContext('uk');

// ─── LAZY VIEWS
const ScheduleView  = lazy(()=>import("./views/id4drive-admin-v5").then(m=>({default:m.ScheduleView})))
const SettingsView  = lazy(()=>import("./views/id4drive-settings"))
const BookingsView  = lazy(()=>import("./views/id4drive-bookings"))
const StudentsView  = lazy(()=>import("./views/id4drive-students"))
const ServicesView  = lazy(()=>import("./views/id4drive-services"))
const ChatsView     = lazy(()=>import("./views/id4drive-chats"))
const TemplatesView = lazy(()=>import("./views/id4drive-templates"))
const StatsView     = lazy(()=>import("./views/id4drive-stats"))

const Loader = () => <div style={{color: "white", padding: "20px"}}>Завантаження...</div>;

import { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, GOLD, SO } from "./theme.js";

// ─── CSS ────────────────────────────────────────────────────────
const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body,html{margin:0;padding:0;background:${BG}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,0.06);border-top-color:${ACCENT};border-radius:50%;animation:spin .8s linear infinite}
@keyframes fade-tab{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.tab-anim{animation:fade-tab .22s ease both}
`;

// ─── INLINE VIEWS (schedule + settings already in v5 — rebuilt here compactly) ──
// Кожна вкладка — окремий компонент нижче або lazy-loaded

// ─── LAZY VIEWS ─────────────────────────────────────────────────
// У реальному проекті це були б:
// const BookingsView  = lazy(()=>import("./id4drive-bookings"));
// Тут — inline заглушки з повідомленням, бо всі компоненти в окремих файлах

// ─── ICONS (3D pillow) ───────────────────────────────────────────
const I3 = ({children,gr,s=36,r=12})=>(
  <div style={{
    width:s,height:s,borderRadius:r,background:gr,
    display:"inline-flex",alignItems:"center",justifyContent:"center",
    position:"relative",overflow:"hidden",flexShrink:0,
    boxShadow:"-2px 3px 8px rgba(0,0,0,0.45),inset 1px 1px 0 rgba(255,255,255,0.22),inset -1px -1px 0 rgba(0,0,0,0.3)"
  }}>
    <div style={{position:"absolute",top:0,right:0,width:"60%",height:"50%",background:"radial-gradient(ellipse at top right,rgba(255,255,255,0.38) 0%,transparent 70%)",pointerEvents:"none"}}/>
    <div style={{position:"relative",zIndex:1}}>{children}</div>
  </div>
);

const TabIcons = {
  schedule: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#5b9bff,#2563eb)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
  </I3>,
  bookings: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#34d399,#059669)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
  </I3>,
  students: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#c084fc,#7c3aed)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 18c0-2 2-4 4-4s3 1 3 3"/></svg>
  </I3>,
  services: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#fb923c,#ea580c)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M3 17V9l3-5h12l3 5v8M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 9h18"/></svg>
  </I3>,
  chats: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#34d399,#047857)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c0 5-4 8-9 8-1.5 0-3-.3-4-.7L3 21l1-4C2.5 15.5 2 13.8 2 12c0-5 4-8 9-8s10 3 10 8z"/></svg>
  </I3>,
  templates: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#fcd34d,#d97706)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  </I3>,
  stats: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#a78bfa,#6d28d9)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/></svg>
  </I3>,
  settings: (s,active) => <I3 s={s} r={s*0.3} gr={active?"linear-gradient(165deg,#94a3b8,#334155)":"linear-gradient(135deg,#2e3034,#26282c)"}>
    <svg width={s*.55} height={s*.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </I3>,
};

// ─── TABS CONFIG ─────────────────────────────────────────────────
const TAB_IDS = [
  { id:"schedule",  lk:"nav.schedule",  badge:null },
  { id:"bookings",  lk:"nav.bookings",  badge:3    },
  { id:"students",  lk:"nav.students",  badge:null },
  { id:"services",  lk:"nav.services",  badge:null },
  { id:"chats",     lk:"nav.chats",     badge:8    },
  { id:"templates", lk:"nav.templates", badge:null },
  { id:"stats",     lk:"nav.stats",     badge:null },
  { id:"settings",  lk:"nav.settings",  badge:null },
];

const TAB_TITLES = {
  schedule:"Розклад", bookings:"Букінги", students:"Учні",
  services:"Послуги", chats:"Чати", templates:"Шаблони",
  stats:"Статистика", settings:"Налаштування"
};


// ─── PLACEHOLDER (поки не підключено) ────────────────────────────
function Placeholder({ tab, file }) {
  return (
    <div style={{
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      gap:16,padding:"40px 20px",
      background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
      borderRadius:20,margin:"0 0 12px",
      boxShadow:SO,border:`1px solid ${BORDER}`
    }}>
      {TabIcons[tab]?.(64,true)}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:6}}>{TAB_TITLES[tab]}</div>
        <div style={{fontSize:12,color:DIM,marginBottom:12}}>Компонент підключається з файлу:</div>
        <div style={{
          fontSize:12,color:ACCENT,fontWeight:700,
          background:"rgba(255,90,60,0.1)",padding:"6px 14px",borderRadius:10,
          border:"1px solid rgba(255,90,60,0.2)",fontFamily:"monospace"
        }}>{file}</div>
      </div>
      <div style={{fontSize:11,color:FAINT,textAlign:"center",maxWidth:280}}>
        У production-версії тут рендериться повний компонент через lazy import
      </div>
    </div>
  );
}

// ─── SCHEDULE MINI (вбудована заглушка з інфо) ───────────────────
function ScheduleInfo() {
  const files = [
    { file:"id4drive-admin-v5.jsx",    comp:"ScheduleView + SettingsView", lines:1304 },
    { file:"id4drive-bookings.jsx",    comp:"BookingsView",                lines:703  },
    { file:"id4drive-students.jsx",    comp:"StudentsView",                lines:683  },
    { file:"id4drive-services.jsx",    comp:"ServicesView",                lines:612  },
    { file:"id4drive-chats.jsx",       comp:"ChatsView",                   lines:647  },
    { file:"id4drive-templates.jsx",   comp:"TemplatesView",               lines:597  },
    { file:"id4drive-stats.jsx",       comp:"StatsView",                   lines:462  },
  ];
  const totalLines = files.reduce((s,f)=>s+f.lines,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* header card */}
      <div style={{
        background:`linear-gradient(135deg,rgba(255,90,60,0.15),rgba(255,90,60,0.05))`,
        borderRadius:20,padding:"20px",
        border:`1px solid rgba(255,90,60,0.25)`,
        boxShadow:SO
      }}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <I3 s={52} r={16} gr="linear-gradient(165deg,#ff7a5c,#ff5a3c)">
            <span style={{fontSize:26,position:"relative",zIndex:1}}>🚗</span>
          </I3>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:TEXT,letterSpacing:-0.5}}>ID4Drive Admin</div>
            <div style={{fontSize:12,color:DIM,marginTop:2}}>Панель управління інструктора</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {label:"Файлів",    val:files.length,        c:BLUE},
            {label:"Рядків",    val:totalLines,          c:GOLD},
            {label:"Вкладок",   val:8,                   c:ACCENT},
          ].map(s=>(
            <div key={s.label} style={{
              background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,
              borderRadius:12,padding:"10px",textAlign:"center",
              boxShadow:"inset 3px 3px 8px rgba(0,0,0,0.4)"
            }}>
              <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.val}</div>
              <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* files list */}
      <div style={{
        background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
        borderRadius:20,padding:"16px",boxShadow:SO,
        border:`1px solid ${BORDER}`
      }}>
        <div style={{fontSize:10,color:FAINT,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Структура проекту</div>
        {files.map((f,i)=>(
          <div key={i} style={{
            display:"flex",alignItems:"center",gap:10,
            padding:"10px 12px",marginBottom:6,borderRadius:12,
            background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,
            boxShadow:"inset 2px 2px 6px rgba(0,0,0,0.35)"
          }}>
            {TabIcons[TAB_IDS[i]?.id]?.(32,false)}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:ACCENT,fontWeight:700,fontFamily:"monospace",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.file}</div>
              <div style={{fontSize:10,color:DIM}}>{f.comp}</div>
            </div>
            <div style={{
              fontSize:10,color:FAINT,fontWeight:700,
              background:`${SURF_HI}`,padding:"2px 8px",borderRadius:8,flexShrink:0
            }}>{f.lines} рядк.</div>
          </div>
        ))}
      </div>

      {/* integration guide */}
      <div style={{
        background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
        borderRadius:20,padding:"16px",boxShadow:SO,
        border:`1px solid ${BORDER}`
      }}>
        <div style={{fontSize:10,color:FAINT,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Як підключити</div>
        {[
          "1. Завантаж всі .jsx файли в папку /src/views/",
          "2. В App.jsx зроби lazy import кожного компонента",
          "3. Передай спільні settings та setSettings через props або Context",
          "4. Підключи Firebase — замість mock data використай реальні запити",
          "5. Задеплой на Vercel або Firebase Hosting",
        ].map((s,i)=>(
          <div key={i} style={{
            fontSize:12,color:DIM,padding:"8px 12px",marginBottom:4,
            borderRadius:10,background:`rgba(255,255,255,0.02)`,
            borderLeft:`3px solid ${ACCENT}44`
          }}>{s}</div>
        ))}
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────
function BottomNav({ active, onChange, settings }) {
  const lang = useContext(LangContext);
  const tl = createT(lang);
  const visible = TAB_IDS.filter(t => settings?.navTabs?.includes(t.id) ?? true);
  return (
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,
      padding:"0 3px 10px",
      background:"transparent",
      zIndex:50,
      pointerEvents:"none",
    }}>
      <div style={{
        background:`linear-gradient(180deg,${SURFACE},${SURF_LO})`,
        borderRadius:26,
        border:`1px solid rgba(255,255,255,0.08)`,
        boxShadow:"0 12px 40px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.05)",
        display:"flex", overflow:"hidden",
        pointerEvents:"auto",
      }}>
        {visible.map(t=>(
          <button key={t.id} onClick={()=>onChange(t.id)} style={{
            flex:"1 1 0",minWidth:0,padding:"13px 4px 11px",
            background:"transparent",border:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:5,
            position:"relative"
          }}>
            <div style={{
              transform:active===t.id?"scale(1.1)":"scale(0.94)",
              transition:"transform .15s",
              opacity:active===t.id?1:0.52,
              position:"relative"
            }}>
              {TabIcons[t.id]?.(34,active===t.id)}
              {t.badge && (
                <div style={{
                  position:"absolute",top:-4,right:-4,
                  background:ACCENT,color:"#fff",borderRadius:10,
                  padding:"1px 5px",fontSize:9,fontWeight:800,
                  boxShadow:`0 0 8px ${ACCENT}88`,lineHeight:1.4
                }}>{t.badge}</div>
              )}
            </div>
            <span style={{fontSize:9,fontWeight:700,color:active===t.id?ACCENT:FAINT,whiteSpace:"nowrap"}}>{tl(t.lk)}</span>
            {active===t.id && (
              <div style={{
                position:"absolute",bottom:5,left:"50%",transform:"translateX(-50%)",
                width:28,height:3,borderRadius:2,
                background:ACCENT,boxShadow:`0 0 10px ${ACCENT}99`
              }}/>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TOP BAR ─────────────────────────────────────────────────────
function TopBar({ tab, onChange }) {
  const lang = useContext(LangContext);
  const tl = createT(lang);
  const tabLabel = tl(TAB_IDS.find(x=>x.id===tab)?.lk || tab);
  return (
    <div style={{
      padding:"6px 12px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      position:"sticky",top:0,
      background:`linear-gradient(180deg,${BG} 60%,rgba(28,29,33,0.9))`,
      backdropFilter:"blur(20px)",zIndex:20,
      borderBottom:`1px solid ${BORDER}`
    }}>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <I3 s={22} r={7} gr="linear-gradient(165deg,#ff7a5c,#ff5a3c)">
          <span style={{fontSize:12,position:"relative",zIndex:1}}>🚗</span>
        </I3>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:-0.3,color:TEXT}}>{tabLabel}</div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <button onClick={()=>onChange?.("bookings")} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:0}}>
          <I3 s={24} r={7} gr={tab==="bookings"?"linear-gradient(165deg,#ff7a5c,#ff5a3c)":"linear-gradient(135deg,#2e3034,#26282c)"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </I3>
          <div style={{
            position:"absolute",top:-2,right:-2,
            background:ACCENT,color:"#fff",borderRadius:10,
            padding:"0 4px",fontSize:8,fontWeight:800,lineHeight:"14px",
            boxShadow:`0 0 6px ${ACCENT}88`
          }}>3</div>
        </button>
        <button onClick={()=>onChange?.("settings")} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
          <div style={{
            width:24,height:24,borderRadius:12,
            background: tab==="settings"
              ? "linear-gradient(165deg,#ff7a5c,#ff5a3c)"
              : "linear-gradient(165deg,#9ee07a,#5fb83d)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:9,fontWeight:800,color:"#fff",
            boxShadow:"-2px 3px 8px rgba(0,0,0,0.4),inset 1px 1px 0 rgba(255,255,255,0.2)"
          }}>ОЛ</div>
        </button>
      </div>
    </div>
  );
}

const INITIAL_BOOKINGS = [
  { id:"b1", day:0, startMin:8*60,  durMin:120, name:"Марія Коваль",   phone:"+380671234567", type:"school",  tsc:"ТСЦ 8041",     hoursDone:12, status:"confirmed", serviceId:"sv1" },
  { id:"b2", day:0, startMin:11*60, durMin:60,  name:"Іван Петренко",  phone:"+380509876543", type:"private", tsc:"",                hoursDone:5,  status:"pending",   serviceId:"sv3", categoryId:"cat-std" },
  { id:"b3", day:0, startMin:14*60, durMin:120, name:"Олена Мороз",    phone:"+380631112233", type:"school",  tsc:"ТСЦ 8042",    hoursDone:38, status:"confirmed", serviceId:"sv1" },
  { id:"b4", day:1, startMin:9*60,  durMin:60,  name:"Дмитро Сало",    phone:"+380961234567", type:"private", tsc:"",                hoursDone:9,  status:"confirmed", serviceId:"sv3", categoryId:"cat-vip" },
  { id:"b5", day:1, startMin:13*60, durMin:60,  name:"Тетяна Кравець", phone:"+380731234567", type:"school",  tsc:"ТСЦ 8041",     hoursDone:40, status:"confirmed", serviceId:"sv1" },
  { id:"b6", day:2, startMin:10*60, durMin:120, name:"Антон Білий",    phone:"+380501112233", type:"school",  tsc:"ТСЦ 8041", hoursDone:22, status:"confirmed", serviceId:"sv1" },
  { id:"b7", day:2, startMin:15*60, durMin:120, name:"Юлія Денисюк",   phone:"+380935023739", type:"private", tsc:"",                hoursDone:3,  status:"pending",   serviceId:"sv4", categoryId:"cat-new" },
  { id:"b8", day:3, startMin:8*60,  durMin:60,  name:"Сергій Гук",     phone:"+380961234500", type:"private", tsc:"",                hoursDone:14, status:"confirmed", serviceId:"sv3", categoryId:"cat-std" },
  { id:"b9", day:3, startMin:11*60, durMin:120, name:"Наталія Бондар", phone:"+380671112244", type:"school",  tsc:"ТСЦ 8042",    hoursDone:18, status:"confirmed", serviceId:"sv1" },
  { id:"b10",day:4, startMin:9*60,  durMin:120, name:"Андрій Чорний",  phone:"+380501234500", type:"school",  tsc:"ТСЦ 8041",     hoursDone:30, status:"confirmed", serviceId:"sv1" },
  { id:"b11",day:4, startMin:14*60, durMin:60,  name:"Ірина Лесник",   phone:"+380967240853", type:"private", tsc:"",                hoursDone:1,  status:"pending",   serviceId:"sv3", categoryId:"cat-new" },
  { id:"b12",day:5, startMin:10*60, durMin:120, name:"Ангеліна Коник", phone:"+380681746071", type:"private", tsc:"",                hoursDone:6,  status:"confirmed", serviceId:"sv4", categoryId:"cat-vip" },
];

const DEFAULT_SETTINGS = {
  profile: { name:"Олександр", phone:"+380989225442", address:"Київ", experience:8, photo:null },
  workStart:7, workEnd:20, weekends:[6], daysShown:6, snapMin:30, hourHeightPx:60,
  lunchEnabled:true, lunchStart:12, lunchEnd:13, customBlocks:[], pendingEnabled:false,
  theme:"dark", language:"uk", queueAutoFifo:true, queueBroadcast:false, queueManual:false,
  studentCanReschedule:true, studentCanCancel:true, bookCutoffHours:2, calendarOpenDays:30,
  stickyTime:"both", notifLocation:"topbar",
  navTabs:["schedule","bookings","students","services","chats","templates","stats","settings"],
  autoReminders:[
    {enabled:true,  hoursBefore:24},
    {enabled:false, hoursBefore:2},
    {enabled:false, hoursBefore:1},
  ],
  autoWelcome:{enabled:true}, autoConfirm:{enabled:true},
  autoCancel:{enabled:true}, autoQueueOffer:{enabled:true},
  services: [
    { id:"sv1", name:"Автошкола 1 год", type:"school",  duration:60,  price:600,  colorId:"green",  active:true,  description:"Урок з автошколи" },
    { id:"sv2", name:"Автошкола 2 год", type:"school",  duration:120, price:1100, colorId:"green",  active:true,  description:"" },
    { id:"sv3", name:"Приватний 1 год", type:"private", duration:60,  price:700,  colorId:"yellow", active:true,  description:"" },
    { id:"sv4", name:"Приватний 2 год", type:"private", duration:120, price:1300, colorId:"yellow", active:true,  description:"" },
  ],
  categories: [
    { id:"cat-vip", name:"VIP",      colorId:"purple" },
    { id:"cat-std", name:"Стандарт", colorId:"blue" },
  ],
};

// ─── VIEW RENDERER ───────────────────────────────────────────────
function ViewRenderer({ tab, settings, setSettings, bookings, setBookings, onSlotClick, onEmptySlotClick, showInfos, dismissInfo }) {
  if (tab === "schedule")  return <ScheduleView settings={settings} setSettings={setSettings} bookings={bookings} setBookings={setBookings} onSlotClick={onSlotClick} onEmptySlotClick={onEmptySlotClick}/>;
  if (tab === "settings")  return <SettingsView settings={settings} setSettings={setSettings}/>;
  if (tab === "bookings")  return <BookingsView showInfo={showInfos.bookings !== false} onDismissInfo={()=>dismissInfo('bookings')}/>;
  if (tab === "students")  return <StudentsView showInfo={showInfos.students !== false} onDismissInfo={()=>dismissInfo('students')}/>;
  if (tab === "services")  return <ServicesView showInfo={showInfos.services !== false} onDismissInfo={()=>dismissInfo('services')}/>;
  if (tab === "chats")     return <ChatsView/>;
  if (tab === "templates") return <TemplatesView/>;
  if (tab === "stats")     return <StatsView/>;
  return null;
}

// ─── DATE HELPERS ────────────────────────────────────────────────
// Convert Firebase date string ("2026-05-27") → day index relative to today's week start
function dateToDayIdx(dateStr) {
  if (!dateStr) return -1;
  const today = new Date(); today.setHours(0,0,0,0);
  const dow = today.getDay(); // 0=Sun
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.round((d - weekStart) / 86400000);
  return diff; // 0=Mon, 1=Tue … can be negative (past) or >6 (future)
}

// ─── MAIN APP ────────────────────────────────────────────────────
export default function App() {
  const adminUser = useAdminAuth();
  const [tab,        setTab]      = useState("schedule");
  const [tabVisits,  setTabVisits]= useState({});
  const [showInfos,  setShowInfos]= useState({});
  const [settings,   setSettings] = useState(DEFAULT_SETTINGS);
  const [bookings,   setBookings] = useState(INITIAL_BOOKINGS);
  const [selectedBooking,  setSelectedBooking]  = useState(null);
  const [newBookingData,   setNewBookingData]    = useState(null);

  const switchTab = t => {
    setTab(t);
    setTabVisits(v => ({...v, [t]: (v[t]||0) + 1}));
    setShowInfos({});
  };
  const dismissInfo = key => setShowInfos(s => ({...s, [key]: false}));

  // Tab navigation via custom event (from child components)
  useEffect(() => {
    const nav = e => switchTab(e.detail);
    window.addEventListener("id4drive-nav", nav);
    return () => window.removeEventListener("id4drive-nav", nav);
  }, []);

  // Load bookings from Firebase
  useEffect(() => {
    if (!adminUser) return;
    return onValue(ref(db, "bookings"), snap => {
      const data = snap.val();
      if (!data) return;
      const all = [];
      Object.entries(data).forEach(([uid, userBkgs]) => {
        Object.values(userBkgs).forEach(b => {
          all.push({
            ...b,
            id:        b.id || `fb_${uid}_${Math.random()}`,
            userId:    uid,
            day:       dateToDayIdx(b.date),
            startMin:  b.startMin ?? (parseInt((b.time||"0:0").split(":")[0])*60 + parseInt((b.time||"0:0").split(":")[1])),
            durMin:    b.durMin   ?? (b.durationHours ? b.durationHours*60 : 60),
            name:      b.studentName || b.name || "Без імені",
            type:      b.serviceType || b.type || "private",
          });
        });
      });
      setBookings(all);
    });
  }, [adminUser]);

  // Debounce map for move/resize saves (avoids Firebase write on every pointermove)
  const moveSaveTimers = React.useRef({});

  const handleSetBookings = fn => {
    setBookings(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      const prevMap = new Map(prev.map(b => [b.id, b]));
      const nextIds  = new Set(next.map(b => b.id));

      // 1. Deleted bookings → remove from Firebase
      prev.forEach(b => {
        if (!nextIds.has(b.id) && b.userId && b.id) {
          remove(ref(db, `bookings/${b.userId}/${b.id}`)).catch(() => {});
        }
      });

      // 2. Changed bookings
      next.forEach(b => {
        if (!b.userId || !b.id) return;
        const p = prevMap.get(b.id);
        if (!p) return;

        if (p.status !== b.status) {
          // Status change → save immediately
          update(ref(db, `bookings/${b.userId}/${b.id}`), { status: b.status }).catch(() => {});

        } else if (p.startMin !== b.startMin || p.durMin !== b.durMin || p.day !== b.day) {
          // Move/resize → debounce 600ms so we don't spam Firebase on every pointermove
          clearTimeout(moveSaveTimers.current[b.id]);
          moveSaveTimers.current[b.id] = setTimeout(() => {
            const hh = String(Math.floor(b.startMin / 60)).padStart(2, "0");
            const mm = String(b.startMin % 60).padStart(2, "0");
            update(ref(db, `bookings/${b.userId}/${b.id}`), {
              startMin: b.startMin,
              durMin:   b.durMin,
              durationHours: b.durMin / 60,
              day:      b.day,
              time:     `${hh}:${mm}`,
            }).catch(() => {});
            delete moveSaveTimers.current[b.id];
          }, 600);
        }
      });

      return next;
    });
  };

  const lang = settings.language || 'uk';
  useEffect(() => { setGlobalLang(lang); }, [lang]);

  if (adminUser === undefined) return null;
  if (adminUser === null) return <LoginScreen/>;

  return (
    <LangContext.Provider value={lang}>
    <>
      <style>{CSS}</style>
      <div style={{
        minHeight:"100vh",background:BG,color:TEXT,
        fontFamily:"ui-sans-serif,-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        paddingBottom:90
      }}>
        <TopBar tab={tab} onChange={switchTab}/>
        <div className="tab-anim" key={`${tab}-${tabVisits[tab]||0}`} style={{padding: tab==="schedule" ? "4px 3px 0" : "14px 14px 0"}}>
          <Suspense fallback={<Loader/>}>
            <ViewRenderer tab={tab} settings={settings} setSettings={setSettings} bookings={bookings} setBookings={handleSetBookings} onSlotClick={setSelectedBooking} onEmptySlotClick={setNewBookingData} showInfos={showInfos} dismissInfo={dismissInfo}/>
          </Suspense>
        </div>
        <BottomNav active={tab} onChange={switchTab} settings={settings}/>
      </div>
    </>
    </LangContext.Provider>
  );
}
