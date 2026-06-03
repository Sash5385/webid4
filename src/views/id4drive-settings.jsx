import { useState, useContext, useEffect } from "react";
import { ref, update, onValue, off } from "firebase/database";
import { db } from "../firebase";
import { LangContext } from "../App";
import { createT } from "../lang";

// ─── TOKENS ─────────────────────────────────────────────────────
import { BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, TEAL, SO, SI } from "../theme.js";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;background:${BG_DEEP};outline:none;box-shadow:${SI}}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:9px;background:linear-gradient(145deg,${ACC_HI},${ACCENT});cursor:pointer;box-shadow:0 2px 6px rgba(255,90,60,0.5)}
select{color-scheme:dark}
@keyframes sec-open{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.sec-open{animation:sec-open .16s ease both}
`;

const PALETTE = [
  { id:"green",  color:"#7ed957" },
  { id:"yellow", color:"#f7c948" },
  { id:"blue",   color:"#5b9bff" },
  { id:"purple", color:"#c084fc" },
  { id:"red",    color:"#ff5a3c" },
  { id:"teal",   color:"#2dd4bf" },
  { id:"pink",   color:"#f472b6" },
  { id:"orange", color:"#fb923c" },
  { id:"indigo", color:"#818cf8" },
  { id:"lime",   color:"#a3e635" },
  { id:"sky",    color:"#38bdf8" },
];
const colorOf = id => PALETTE.find(p=>p.id===id)?.color || "#5b9bff";

const ALL_TABS = [
  { id:"schedule",  lk:"nav.schedule"  },
  { id:"bookings",  lk:"nav.bookings"  },
  { id:"students",  lk:"nav.students"  },
  { id:"services",  lk:"nav.services"  },
  { id:"chats",     lk:"nav.chats"     },
  { id:"templates", lk:"nav.templates" },
  { id:"stats",     lk:"nav.stats"     },
  { id:"settings",  lk:"nav.settings"  },
];

// ─── ATOMS ──────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div onClick={()=>onChange(!on)} style={{
      width:44,height:24,borderRadius:12,cursor:"pointer",position:"relative",
      background:on?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_LO},${BG_DEEP})`,
      boxShadow:on?`0 0 8px ${ACCENT}44`:SI,transition:"background .2s",flexShrink:0,
    }}>
      <div style={{
        position:"absolute",top:3,left:on?21:3,width:18,height:18,borderRadius:9,
        background:"linear-gradient(135deg,#fff,#ddd)",
        boxShadow:"0 1px 4px rgba(0,0,0,0.4)",transition:"left .2s",
      }}/>
    </div>
  );
}

function NumInput({ value, onChange, min=0, max=999, suffix="" }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:4,background:BG_DEEP,borderRadius:9,boxShadow:SI,padding:"4px 6px"}}>
      <button onClick={()=>onChange(Math.max(min,value-1))} style={{
        width:26,height:26,borderRadius:7,border:"none",cursor:"pointer",
        background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:TEXT,fontSize:14,
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:SO,
      }}>−</button>
      <span style={{fontSize:13,fontWeight:700,color:TEXT,minWidth:32,textAlign:"center"}}>
        {value}{suffix}
      </span>
      <button onClick={()=>onChange(Math.min(max,value+1))} style={{
        width:26,height:26,borderRadius:7,border:"none",cursor:"pointer",
        background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:TEXT,fontSize:14,
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:SO,
      }}>+</button>
    </div>
  );
}

function Radio({ on, onChange }) {
  return (
    <div onClick={onChange} style={{
      width:20,height:20,borderRadius:10,cursor:"pointer",flexShrink:0,
      border:`2px solid ${on?ACCENT:FAINT}`,
      background:on?ACCENT:"transparent",
      boxShadow:on?`0 0 8px ${ACCENT}55`:"none",
      transition:"all .15s",
    }}/>
  );
}

function Row({ label, hint, children, last }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
      padding:"11px 0",
      borderBottom:last?`none`:`1px solid ${BORDER}`,
    }}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:TEXT}}>{label}</div>
        {hint && <div style={{fontSize:10,color:FAINT,marginTop:2}}>{hint}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"6px 12px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
      background:active?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
      color:active?"#fff":DIM,boxShadow:active?"none":SO,
    }}>{label}</button>
  );
}

function Section({ title, icon, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
      borderRadius:13,overflow:"hidden",
      boxShadow:SO, border:`1px solid ${BORDER}`,
    }}>
      <div onClick={()=>setOpen(v=>!v)} style={{
        display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",userSelect:"none",
      }}>
        <div style={{
          width:32,height:32,borderRadius:9,flexShrink:0,
          background:`linear-gradient(145deg,${SURF_HI},${SURF_LO})`,
          boxShadow:SO,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
        }}>{icon}</div>
        <span style={{flex:1,fontSize:13,fontWeight:800,color:TEXT}}>{title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
          style={{transform:open?"rotate(180deg)":"none",transition:"transform .22s",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <div className="sec-open" style={{padding:"0 14px 14px",borderTop:`1px solid ${BORDER}`}}>
          {children}
        </div>
      )}
    </div>
  );
}

function Info({ title, text, color=BLUE }) {
  return (
    <div style={{
      background:`linear-gradient(145deg,${color}0d,${color}05)`,
      border:`1px solid ${color}30`,
      borderRadius:10,padding:"10px 12px",marginTop:10,
    }}>
      <div style={{fontSize:11,fontWeight:700,color,marginBottom:4}}>💡 {title}</div>
      <div style={{fontSize:11,color:DIM,lineHeight:1.6}}>{text}</div>
    </div>
  );
}

const TxtInput = ({ value, onChange, placeholder="" }) => (
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{
      background:BG_DEEP,border:`1.5px solid ${BORDER}`,borderRadius:8,
      color:TEXT,fontSize:13,padding:"7px 10px",outline:"none",
      width:"100%",fontFamily:"inherit",boxShadow:SI,
    }}/>
);

function ColorPicker({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {PALETTE.map(p=>(
        <div key={p.id} onClick={()=>onChange(p.id)} style={{
          width:26,height:26,borderRadius:8,cursor:"pointer",
          background:`linear-gradient(145deg,${p.color}cc,${p.color}55)`,
          border:value===p.id?`2.5px solid ${TEXT}`:`2px solid transparent`,
          boxShadow:value===p.id?`0 0 8px ${p.color}66`:`0 2px 5px rgba(0,0,0,0.3)`,
          transform:value===p.id?"scale(1.15)":"scale(1)",
          transition:"transform .12s",
        }}/>
      ))}
    </div>
  );
}

const DAY_NAMES = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];

function TimeInput({ value, onChange, min=0, max=24 }) {
  const v = Number(value) || 0;
  const h = Math.floor(v);
  const m = (v % 1 >= 0.5) ? 30 : 0;
  const disp = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  const dec = () => { const n = Math.round((v - 0.5) * 2) / 2; onChange(Math.max(min, n)); };
  const inc = () => { const n = Math.round((v + 0.5) * 2) / 2; onChange(Math.min(max, n)); };
  return (
    <div style={{display:"flex",alignItems:"center",background:BG_DEEP,borderRadius:7,boxShadow:SI,overflow:"hidden"}}>
      <button onClick={dec} style={{width:20,height:26,border:"none",cursor:"pointer",background:"transparent",color:FAINT,fontSize:14,padding:0,lineHeight:1}}>‹</button>
      <span style={{fontSize:11,fontWeight:700,color:TEXT,minWidth:36,textAlign:"center"}}>{disp}</span>
      <button onClick={inc} style={{width:20,height:26,border:"none",cursor:"pointer",background:"transparent",color:FAINT,fontSize:14,padding:0,lineHeight:1}}>›</button>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function SettingsView({ settings, setSettings }) {
  const lang = useContext(LangContext);
  const t = createT(lang);
  const upd = (k, v) => setSettings(s=>({...s,[k]:v}));

  // ── weekSchedule helpers ──────────────────────────────────────
  const weekSchedule = settings.weekSchedule || DAY_NAMES.map((_,i) => ({
    enabled: i < 6, start: i===5?10:9, end: i===5?15:18,
    lunchEnabled: i<5, lunchStart:12, lunchEnd:13,
  }));
  const updDay = (i, patch) => upd("weekSchedule", weekSchedule.map((d,idx) => idx===i ? {...d,...patch} : d));

  // ── date overrides state ──────────────────────────────────────
  const dateOverrides = settings.dateOverrides || [];
  const [addingOv, setAddingOv] = useState(false);
  const [newOv, setNewOv] = useState({ date:"", type:"closed", start:9, end:18, lunchEnabled:false, reason:"" });
  const addOverride = () => {
    if (!newOv.date) return;
    upd("dateOverrides", [...dateOverrides.filter(o=>o.date!==newOv.date), {...newOv}]);
    setAddingOv(false);
    setNewOv({ date:"", type:"closed", start:9, end:18, lunchEnabled:false, reason:"" });
  };
  const removeOverride = date => upd("dateOverrides", dateOverrides.filter(o=>o.date!==date));

  // ── slot management state (Option B) ─────────────────────────
  const [slotDate, setSlotDate] = useState("");
  const [dateSlots, setDateSlots] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  useEffect(() => {
    if (!slotDate) return;
    const r = ref(db, `timeslots/${slotDate}`);
    const h = onValue(r, snap => setDateSlots(snap.val() || {}));
    return () => off(r, "value", h);
  }, [slotDate]);

  const generateSlots = async () => {
    if (!slotDate) return;
    setGenLoading(true);
    const d = new Date(slotDate);
    const dow = (d.getDay() + 6) % 7;
    const ov = dateOverrides.find(o => o.date === slotDate);
    const day = ov ? (ov.type === "closed" ? null : { enabled:true, ...weekSchedule[dow], ...ov }) : weekSchedule[dow];
    if (!day?.enabled) { setGenLoading(false); return alert("Цей день вихідний або закрито"); }
    const interval = settings.snapMin || 30;
    const updates = {};
    for (let min = day.start*60; min < day.end*60; min += interval) {
      if (day.lunchEnabled && min >= day.lunchStart*60 && min < day.lunchEnd*60) continue;
      const h = String(Math.floor(min/60)).padStart(2,"0");
      const m = String(min%60).padStart(2,"0");
      const id = `slot${h}${m}`;
      if (!dateSlots[id]) {
        updates[`timeslots/${slotDate}/${id}/time`] = `${h}:${m}`;
        updates[`timeslots/${slotDate}/${id}/available`] = true;
      }
    }
    if (Object.keys(updates).length) await update(ref(db,"/"), updates);
    setGenLoading(false);
  };

  const clearSlots = async () => {
    if (!slotDate || !confirm("Видалити всі слоти на цю дату?")) return;
    const updates = {};
    Object.keys(dateSlots).forEach(id => { updates[`timeslots/${slotDate}/${id}`] = null; });
    if (Object.keys(updates).length) await update(ref(db,"/"), updates);
  };

  const toggleSlot = async (id, available) => {
    await update(ref(db, `timeslots/${slotDate}/${id}`), { available: !available });
  };

  // Queue mode helper — maps 3 booleans to single selection
  const queueMode = settings.queueAutoFifo ? "fifo" : settings.queueBroadcast ? "broadcast" : "manual";
  const setQueueMode = m => setSettings(s=>({
    ...s,
    queueAutoFifo:    m==="fifo",
    queueBroadcast:   m==="broadcast",
    queueManual:      m==="manual",
  }));

  // Reminders (array of 3)
  const reminders = settings.autoReminders || [
    {enabled:true, hoursBefore:24},
    {enabled:false,hoursBefore:2},
    {enabled:false,hoursBefore:1},
  ];
  const updReminder = (idx, patch) => upd("autoReminders", reminders.map((r,i)=>i===idx?{...r,...patch}:r));

  const days = t('set.days').split(',');

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",gap:8,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── ГРАФІК ── */}
        <Section title={t('set.schedule.title')} icon="🕐">
          <Info color={BLUE} title={t('set.schedule.info_t')} text={t('set.schedule.info')}/>
          <Row label={t('set.schedule.start')} hint={t('set.schedule.hint_s')}>
            <NumInput value={settings.workStart} onChange={v=>upd("workStart",v)} min={0} max={23} suffix=":00"/>
          </Row>
          <Row label={t('set.schedule.end')} hint={t('set.schedule.hint_e')}>
            <NumInput value={settings.workEnd} onChange={v=>upd("workEnd",v)} min={1} max={24} suffix=":00"/>
          </Row>
          <Row label={t('set.schedule.days')}>
            <NumInput value={settings.daysShown} onChange={v=>upd("daysShown",v)} min={1} max={30} suffix={` ${t('days')}`}/>
          </Row>
          {/* Тижневий шаблон (Option C) */}
          <div style={{paddingTop:12}}>
            <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Тижневий шаблон</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {DAY_NAMES.map((dayName, i) => {
                const day = weekSchedule[i];
                return (
                  <div key={i} style={{
                    borderRadius:9,padding:"8px 10px",
                    background:day.enabled?`linear-gradient(145deg,${SURF_HI},${SURFACE})`:`linear-gradient(145deg,${BG_DEEP},${SURF_LO})`,
                    boxShadow:day.enabled?SO:SI,
                  }}>
                    {/* Рядок 1: день + toggle + робочий час */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:24,fontSize:12,fontWeight:800,color:day.enabled?TEXT:FAINT,flexShrink:0}}>{dayName}</span>
                      <Toggle on={day.enabled} onChange={v=>updDay(i,{enabled:v})}/>
                      {day.enabled ? (<>
                        <span style={{flex:1}}/>
                        <TimeInput value={day.start} onChange={v=>updDay(i,{start:v})} min={0} max={23}/>
                        <span style={{fontSize:11,color:FAINT}}>—</span>
                        <TimeInput value={day.end} onChange={v=>updDay(i,{end:v})} min={0.5} max={24}/>
                      </>) : (
                        <span style={{fontSize:11,color:FAINT,marginLeft:4}}>Вихідний</span>
                      )}
                    </div>
                    {/* Рядок 2: обід (тільки якщо день увімкнений) */}
                    {day.enabled && (
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,paddingLeft:32}}>
                        <span style={{fontSize:13}}>🍽</span>
                        <Toggle on={!!day.lunchEnabled} onChange={v=>updDay(i,{lunchEnabled:v})}/>
                        {day.lunchEnabled ? (<>
                          <span style={{flex:1}}/>
                          <TimeInput value={day.lunchStart??12} onChange={v=>updDay(i,{lunchStart:v})} min={0} max={23}/>
                          <span style={{fontSize:11,color:FAINT}}>—</span>
                          <TimeInput value={day.lunchEnd??13} onChange={v=>updDay(i,{lunchEnd:v})} min={0.5} max={24}/>
                        </>) : (
                          <span style={{fontSize:11,color:FAINT}}>без перерви</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── ВИКЛЮЧЕННЯ (дати) ── */}
        <Section title="Виключення дат" icon="📅">
          <Info color={GOLD} title="Відпустки та особливі дні" text="Закрий або зміни графік на конкретну дату. Перекриває тижневий шаблон."/>
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:10}}>
            {dateOverrides.length === 0 && <div style={{fontSize:12,color:FAINT,textAlign:"center",padding:"8px 0"}}>Виключень немає</div>}
            {dateOverrides.sort((a,b)=>a.date.localeCompare(b.date)).map(ov => (
              <div key={ov.date} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:9,background:`linear-gradient(145deg,${BG_DEEP},${SURF_LO})`,boxShadow:SI}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{ov.date}</span>
                  <span style={{fontSize:11,color:ov.type==="closed"?RED:GOLD,marginLeft:8}}>
                    {ov.type==="closed" ? "🔴 Закрито" : `🟡 ${ov.start}:00–${ov.end}:00`}
                  </span>
                  {ov.reason && <span style={{fontSize:10,color:FAINT,marginLeft:6}}>({ov.reason})</span>}
                </div>
                <button onClick={()=>removeOverride(ov.date)} style={{background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:16,lineHeight:1}}>×</button>
              </div>
            ))}
            {!addingOv ? (
              <button onClick={()=>setAddingOv(true)} style={{
                padding:"8px",borderRadius:9,border:`1.5px dashed ${BORDER}`,cursor:"pointer",
                background:"transparent",color:DIM,fontSize:12,fontWeight:700,
              }}>+ Додати виключення</button>
            ) : (
              <div style={{padding:"12px",borderRadius:9,background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,boxShadow:SO,display:"flex",flexDirection:"column",gap:8}}>
                <input type="date" value={newOv.date} onChange={e=>setNewOv(v=>({...v,date:e.target.value}))}
                  style={{background:BG_DEEP,border:`1.5px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"inherit",colorScheme:"dark"}}/>
                <div style={{display:"flex",gap:8}}>
                  {["closed","custom"].map(type=>(
                    <button key={type} onClick={()=>setNewOv(v=>({...v,type}))} style={{
                      flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                      background:newOv.type===type?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                      color:newOv.type===type?"#fff":DIM,boxShadow:newOv.type===type?"none":SO,
                    }}>{type==="closed"?"🔴 Закрито":"🟡 Особливий"}</button>
                  ))}
                </div>
                {newOv.type==="custom" && (
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <TimeInput value={newOv.start} onChange={v=>setNewOv(n=>({...n,start:v}))} min={0} max={23}/>
                    <span style={{color:FAINT}}>–</span>
                    <TimeInput value={newOv.end} onChange={v=>setNewOv(n=>({...n,end:v}))} min={0.5} max={24}/>
                  </div>
                )}
                <TxtInput value={newOv.reason} onChange={v=>setNewOv(n=>({...n,reason:v}))} placeholder="Причина (необов'язково)"/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setAddingOv(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:12,fontWeight:700,boxShadow:SO}}>Скасувати</button>
                  <button onClick={addOverride} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${ACC_HI},${ACCENT})`,color:"#fff",fontSize:12,fontWeight:700}}>Зберегти</button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── УПРАВЛІННЯ СЛОТАМИ (Option B) ── */}
        <Section title="Управління слотами" icon="🔧">
          <Info color={TEAL} title="Ручне відкриття/закриття слотів" text="Обери дату → генеруй слоти автоматично або вмикай/вимикай кожен вручну."/>
          <div style={{paddingTop:12,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="date" value={slotDate} onChange={e=>setSlotDate(e.target.value)}
                style={{flex:1,background:BG_DEEP,border:`1.5px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"inherit",colorScheme:"dark"}}/>
              <button onClick={generateSlots} disabled={!slotDate||genLoading} style={{
                padding:"8px 12px",borderRadius:8,border:"none",cursor:slotDate?"pointer":"not-allowed",fontSize:12,fontWeight:700,
                background:`linear-gradient(145deg,${ACC_HI},${ACCENT})`,color:"#fff",opacity:slotDate?1:0.5,
              }}>{genLoading?"...":"↺ Генерувати"}</button>
              <button onClick={clearSlots} disabled={!slotDate||!Object.keys(dateSlots).length} style={{
                padding:"8px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:RED,boxShadow:SO,
              }}>✕</button>
            </div>
            {slotDate && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                {Object.entries(dateSlots).sort(([a],[b])=>a.localeCompare(b)).map(([id,slot]) => (
                  <button key={id} onClick={()=>toggleSlot(id,slot.available)} style={{
                    padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                    background:slot.available
                      ?`linear-gradient(145deg,rgba(126,217,87,0.3),rgba(126,217,87,0.1))`
                      :`linear-gradient(145deg,${SURF_LO},${BG_DEEP})`,
                    color:slot.available?GREEN:FAINT,
                    boxShadow:slot.available?`0 0 6px rgba(126,217,87,0.2)`:SI,
                    borderLeft:`2px solid ${slot.available?GREEN:FAINT}`,
                  }}>{slot.time || id.replace("slot","").replace(/(\d{2})(\d{2})/,"$1:$2")}</button>
                ))}
                {Object.keys(dateSlots).length===0 && (
                  <div style={{gridColumn:"span 4",textAlign:"center",color:FAINT,fontSize:12,padding:"16px 0"}}>
                    Слотів немає. Натисни «↺ Генерувати» щоб створити.
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ── СІТКА ── */}
        <Section title={t('set.snap.title')} icon="⏱">
          <Info color={TEAL} title={t('set.snap.info_t')} text={t('set.snap.info')}/>
          <div style={{paddingTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,color:DIM}}>{t('set.snap.label')}</span>
              <span style={{fontSize:13,fontWeight:800,color:ACCENT}}>{settings.snapMin} {t('min')}</span>
            </div>
            <input type="range" min={1} max={60} value={settings.snapMin} onChange={e=>upd("snapMin",+e.target.value)}/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
              {[1,5,10,15,30,60].map(v=>(
                <Chip key={v} label={`${v} ${t('min')}`} active={settings.snapMin===v} onClick={()=>upd("snapMin",v)}/>
              ))}
            </div>
          </div>
          <div style={{paddingTop:12,borderTop:`1px solid rgba(255,255,255,0.06)`,marginTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,color:DIM}}>Крок слота (довгий тап)</span>
              <span style={{fontSize:13,fontWeight:800,color:TEAL}}>{settings.slotCreateStep ?? 30} хв</span>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[5,10,15,30,60].map(v=>(
                <Chip key={v} label={`${v} хв`} active={(settings.slotCreateStep??30)===v} onClick={()=>upd("slotCreateStep",v)}/>
              ))}
            </div>
          </div>
        </Section>

        {/* ── ПОСЛУГИ ── */}
        <Section title={t('set.svc.title')} icon="🚗">
          <Info color={GREEN} title={t('set.svc.info_t')} text={t('set.svc.info')}/>
          <div style={{paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
            {settings.services.map(s=>(
              <div key={s.id} style={{background:`linear-gradient(145deg,${BG_DEEP},${SURF_LO})`,borderRadius:11,padding:"12px",boxShadow:SI,opacity:s.active?1:0.55}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:14,height:14,borderRadius:4,background:colorOf(s.colorId),flexShrink:0,boxShadow:`0 0 6px ${colorOf(s.colorId)}66`}}/>
                  <input value={s.name}
                    onChange={e=>upd("services",settings.services.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                    style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,fontWeight:700,fontFamily:"inherit"}}/>
                  <Toggle on={s.active} onChange={v=>upd("services",settings.services.map(x=>x.id===s.id?{...x,active:v}:x))}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:BG_DEEP,borderRadius:9,padding:"8px 10px",boxShadow:SI}}>
                    <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:6,textAlign:"center"}}>{t('set.svc.duration_lbl')}</div>
                    <NumInput value={s.duration}
                      onChange={v=>upd("services",settings.services.map(x=>x.id===s.id?{...x,duration:v}:x))}
                      min={5} max={480} suffix={` ${t('min')}`}/>
                  </div>
                  <div style={{background:BG_DEEP,borderRadius:9,padding:"8px 10px",boxShadow:SI}}>
                    <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:6,textAlign:"center"}}>{t('set.svc.price_lbl')}</div>
                    <NumInput value={s.price}
                      onChange={v=>upd("services",settings.services.map(x=>x.id===s.id?{...x,price:v}:x))}
                      min={0} max={99999} suffix=" ₴"/>
                  </div>
                </div>
                <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>{t('set.svc.color')}</div>
                <ColorPicker value={s.colorId} onChange={v=>upd("services",settings.services.map(x=>x.id===s.id?{...x,colorId:v}:x))}/>
                <button onClick={()=>upd("services",settings.services.filter(x=>x.id!==s.id))}
                  style={{marginTop:10,background:"none",border:"none",cursor:"pointer",color:RED,fontSize:11,fontWeight:700,padding:0}}>
                  {t('set.svc.del')}
                </button>
              </div>
            ))}
            <button onClick={()=>upd("services",[...settings.services,{
              id:`sv-${Date.now()}`,name:lang==="en"?"New service":"Нова послуга",type:"private",duration:60,price:0,colorId:"blue",active:true,description:""
            }])} style={{width:"100%",padding:"11px",borderRadius:11,border:`1px dashed ${BORDER}`,cursor:"pointer",background:"transparent",color:DIM,fontSize:13,fontWeight:700}}>
              {t('set.svc.add')}
            </button>
          </div>
        </Section>

        {/* ── КАТЕГОРІЇ ── */}
        <Section title={t('set.cat.title')} icon="🏷">
          <div style={{paddingTop:10,display:"flex",flexDirection:"column",gap:10}}>
            <Info color={PURPLE} title={t('set.cat.info_t')} text={t('set.cat.info')}/>
            {settings.categories.map(c=>(
              <div key={c.id} style={{background:`linear-gradient(145deg,${BG_DEEP},${SURF_LO})`,borderRadius:11,padding:"11px 12px",boxShadow:SI}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                  <div style={{width:12,height:12,borderRadius:3,background:colorOf(c.colorId),flexShrink:0,boxShadow:`0 0 6px ${colorOf(c.colorId)}66`}}/>
                  <input value={c.name}
                    onChange={e=>upd("categories",settings.categories.map(x=>x.id===c.id?{...x,name:e.target.value}:x))}
                    style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,fontWeight:700,fontFamily:"inherit"}}/>
                  <button onClick={()=>upd("categories",settings.categories.filter(x=>x.id!==c.id))}
                    style={{background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:16,padding:0,lineHeight:1}}>×</button>
                </div>
                <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{t('set.cat.color')}</div>
                <ColorPicker value={c.colorId} onChange={v=>upd("categories",settings.categories.map(x=>x.id===c.id?{...x,colorId:v}:x))}/>
              </div>
            ))}
            <button onClick={()=>upd("categories",[...settings.categories,{id:`cat-${Date.now()}`,name:t('set.cat.new'),colorId:"blue"}])}
              style={{width:"100%",padding:"10px",borderRadius:10,border:`1px dashed ${BORDER}`,cursor:"pointer",background:"transparent",color:DIM,fontSize:13,fontWeight:700}}>
              {t('set.cat.add')}
            </button>
          </div>
        </Section>

        {/* ── ОБМЕЖЕННЯ ── */}
        <Section title={t('set.restr.title')} icon="🔒">
          <Info color={RED} title={t('set.restr.info_t')} text={t('set.restr.info')}/>
          <Row label={t('set.restr.reschedule')}>
            <Toggle on={settings.studentCanReschedule} onChange={v=>upd("studentCanReschedule",v)}/>
          </Row>
          <Row label={t('set.restr.cancel')}>
            <Toggle on={settings.studentCanCancel} onChange={v=>upd("studentCanCancel",v)}/>
          </Row>
          <Row label={t('set.restr.cutoff')} hint={t('set.restr.cutoff_h')}>
            <NumInput value={settings.bookCutoffHours} onChange={v=>upd("bookCutoffHours",v)} min={0} max={48} suffix={` ${t('hr')}`}/>
          </Row>
          <Row label={t('set.restr.calendar')} hint={t('set.restr.calendar_h')} last>
            <NumInput value={settings.calendarOpenDays} onChange={v=>upd("calendarOpenDays",v)} min={1} max={365} suffix={` ${t('days')}`}/>
          </Row>
        </Section>

        {/* ── ПІДТВЕРДЖЕННЯ & ЧЕРГА ── */}
        <Section title={t('set.queue.title')} icon="✅">
          <Info color={GREEN} title={t('set.queue.info_t')} text={t('set.queue.info')}/>
          <Row label={t('set.queue.require')} hint={t('set.queue.require_h')} last>
            <Toggle on={settings.pendingEnabled} onChange={v=>upd("pendingEnabled",v)}/>
          </Row>
          <div style={{paddingTop:10}}>
            <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{t('set.queue.mode')}</div>
            {[
              {k:"fifo",      label:t('set.queue.fifo'),   hint:t('set.queue.fifo_h')   },
              {k:"broadcast", label:t('set.queue.bc'),     hint:t('set.queue.bc_h')     },
              {k:"manual",    label:t('set.queue.manual'), hint:t('set.queue.manual_h') },
            ].map((o,i,arr)=>(
              <Row key={o.k} label={o.label} hint={o.hint} last={i===arr.length-1}>
                <Radio on={queueMode===o.k} onChange={()=>setQueueMode(o.k)}/>
              </Row>
            ))}
          </div>
        </Section>

        {/* ── ПРИЛИПАННЯ ── */}
        <Section title={t('set.sticky.title')} icon="📌">
          <Info color={BLUE} title={t('set.sticky.info_t')} text={t('set.sticky.info')}/>
          <Row label={lang==="en"?"Enable feature":"Увімкнути функцію"} hint={lang==="en"?"When off — all adjacent free slots are shown":"Вимкнено — показуються всі суміжні вільні слоти"}>
            <Toggle on={settings.stickyTimeEnabled !== false} onChange={v=>upd("stickyTimeEnabled",v)}/>
          </Row>
          {settings.stickyTimeEnabled !== false && (
            <div>
              {[
                {v:"before", l:t('set.sticky.before')},
                {v:"after",  l:t('set.sticky.after') },
                {v:"both",   l:t('set.sticky.both')  },
              ].map((o,i,arr)=>(
                <Row key={o.v} label={o.l} last={i===arr.length-1}>
                  <Radio on={settings.stickyTime===o.v} onChange={()=>upd("stickyTime",o.v)}/>
                </Row>
              ))}
            </div>
          )}
        </Section>

        {/* ── АВТО-ПОВІДОМЛЕННЯ ── */}
        <Section title={t('set.auto.title')} icon="📨">
          <Info color={GOLD} title={t('set.auto.info_t')} text={t('set.auto.info')}/>

          {/* 3 reminder slots */}
          <div style={{paddingTop:10,display:"flex",flexDirection:"column",gap:7}}>
            <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>{t('set.auto.reminder')}</div>
            {reminders.map((r,i)=>(
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:10,
                background:`linear-gradient(145deg,${BG_DEEP},${SURF_LO})`,
                borderRadius:10,padding:"9px 12px",boxShadow:SI,
                opacity:r.enabled?1:0.55,
              }}>
                <Toggle on={r.enabled} onChange={v=>updReminder(i,{enabled:v})}/>
                <span style={{fontSize:12,color:DIM,flex:1}}>
                  {lang==="en"?"Reminder":"Нагадування"} #{i+1}
                </span>
                <NumInput value={r.hoursBefore} onChange={v=>updReminder(i,{hoursBefore:v})} min={1} max={168} suffix={` ${t('hr')}`}/>
                <span style={{fontSize:11,color:FAINT}}>{t('set.auto.rem_h')}</span>
              </div>
            ))}
          </div>

          <Row label={t('set.auto.confirm')}>
            <Toggle on={settings.autoConfirm.enabled} onChange={v=>setSettings(s=>({...s,autoConfirm:{...s.autoConfirm,enabled:v}}))}/>
          </Row>
          <Row label={t('set.auto.cancel')}>
            <Toggle on={settings.autoCancel.enabled} onChange={v=>setSettings(s=>({...s,autoCancel:{...s.autoCancel,enabled:v}}))}/>
          </Row>
          <Row label={t('set.auto.queue')} last>
            <Toggle on={settings.autoQueueOffer.enabled} onChange={v=>setSettings(s=>({...s,autoQueueOffer:{...s.autoQueueOffer,enabled:v}}))}/>
          </Row>
        </Section>

        {/* ── НАВІГАЦІЯ ── */}
        <Section title={t('set.nav.title')} icon="📱">
          <Info color={BLUE} title={t('set.nav.info_t')} text={t('set.nav.info')}/>
          {ALL_TABS.map((tab,i)=>(
            <Row key={tab.id} label={t(tab.lk)} last={i===ALL_TABS.length-1}>
              <Toggle
                on={settings.navTabs?.includes(tab.id) ?? true}
                onChange={v=>{
                  if(tab.id==="settings") return;
                  upd("navTabs", v
                    ? [...(settings.navTabs||[]),tab.id]
                    : (settings.navTabs||[]).filter(x=>x!==tab.id));
                }}/>
            </Row>
          ))}
        </Section>

        {/* ── ВИГЛЯД ── */}
        <Section title={t('set.look.title')} icon="🎨">
          <Info color={PURPLE} title={t('set.look.info_t')} text={t('set.look.info')}/>
          <Row label={t('set.look.theme')}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:DIM}}>🌙 {lang==="en"?"Dark only":"Тільки темна"}</span>
            </div>
          </Row>
          <Row label={t('set.look.lang')} last>
            <div style={{display:"flex",gap:6}}>
              {[["uk","🇺🇦 УКР"],["en","🇬🇧 ENG"]].map(([k,l])=>(
                <Chip key={k} label={l} active={settings.language===k} onClick={()=>upd("language",k)}/>
              ))}
            </div>
          </Row>
        </Section>

        <div style={{height:20}}/>
      </div>
    </>
  );
}
