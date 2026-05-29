import { useState, useEffect, useContext } from "react";
import { ref, onValue, update, push, remove } from "firebase/database";
import { db } from "../firebase";
import { LangContext } from "../App";
import { createT, T } from "../lang";

import { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, SO, SI } from "../theme.js";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
textarea{color-scheme:dark}
.icon3d{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;position:relative;overflow:hidden;flex-shrink:0;box-shadow:-2px 4px 10px rgba(0,0,0,0.5),inset 1px 1px 0 rgba(255,255,255,0.25),inset -1px -1px 0 rgba(0,0,0,0.3)}
.icon3d::before{content:'';position:absolute;top:0;right:0;width:60%;height:50%;background:radial-gradient(ellipse at top right,rgba(255,255,255,0.4) 0%,transparent 70%);pointer-events:none}
.icon3d>svg{position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))}
@keyframes expand-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.expand-body{animation:expand-in .18s ease both}
@keyframes bk-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.bk-in{animation:bk-in .2s ease both}
`;

// ─── DATA ──────────────────────────────────────────────────────
const SERVICES = {
  sv1:{ name:"Автошкола 1г", color:GREEN, type:"school"  },
  sv2:{ name:"Автошкола 2г", color:GREEN, type:"school"  },
  sv3:{ name:"Приватний 1г", color:GOLD,  type:"private" },
  sv4:{ name:"Приватний 2г", color:GOLD,  type:"private" },
};
const CATEGORIES = {
  "cat-vip":{ name:"VIP",      color:"#c084fc" },
  "cat-std":{ name:"Стандарт", color:BLUE      },
  "cat-new":{ name:"Новачок",  color:"#2dd4bf" },
};
const RAW = [];

// ─── HELPERS ───────────────────────────────────────────────────
const fmtTime = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const fmtDate = d => {
  const months=["","Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];
  const [,mo,dy]=d.split("-");
  return `${parseInt(dy)} ${months[parseInt(mo)]}`;
};
const priceOf  = b => { const s=SERVICES[b.svcId]; return s?(b.durMin/60)*(b.type==="school"?600:700):0; };
const initials = n => n.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase();
const typeColor = t => t==="school" ? GREEN : GOLD;
const typeGrad  = t => t==="school"
  ? "linear-gradient(145deg,#223020,#182215)"
  : "linear-gradient(145deg,#352d10,#211c08)";

const STATUS_MAP_BASE = {
  pending:   { color:ACCENT,  bg:"rgba(255,90,60,0.15)"   },
  confirmed: { color:GREEN,   bg:"rgba(126,217,87,0.15)"  },
  cancelled: { color:FAINT,   bg:"rgba(255,255,255,0.07)" },
  noshow:    { color:RED,     bg:"rgba(239,68,68,0.18)"   },
};
const getStatusMap = t => ({
  pending:   { ...STATUS_MAP_BASE.pending,   label:t('bk.status.pending')   },
  confirmed: { ...STATUS_MAP_BASE.confirmed, label:t('bk.status.confirmed') },
  cancelled: { ...STATUS_MAP_BASE.cancelled, label:t('bk.status.cancelled') },
  noshow:    { ...STATUS_MAP_BASE.noshow,    label:t('bk.status.noshow')    },
});

// ─── SHARED UI ─────────────────────────────────────────────────
function Chip({ label, color, bg }) {
  return (
    <span style={{background:bg,color,padding:"2px 9px",borderRadius:7,fontSize:10,fontWeight:700,letterSpacing:0.3,whiteSpace:"nowrap"}}>{label}</span>
  );
}

function InfoChip({ value, color }) {
  return (
    <div style={{background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,boxShadow:SI,borderRadius:8,padding:"5px 11px"}}>
      <span style={{fontSize:12,fontWeight:700,color}}>{value}</span>
    </div>
  );
}

function Progress({ hours, total=40 }) {
  const pct  = Math.min(100,Math.round((hours/total)*100));
  const done = hours >= total;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:10,color:FAINT}}>{hours}/{total} год</span>
        <span style={{fontSize:10,fontWeight:700,color:done?ACCENT:GREEN}}>{pct}%</span>
      </div>
      <div style={{height:4,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
        <div style={{
          height:"100%",width:`${pct}%`,borderRadius:3,
          background:done?`linear-gradient(90deg,${ACC_HI},${ACCENT})`:`linear-gradient(90deg,${BLUE},${GREEN})`,
          boxShadow:`0 0 8px ${done?ACCENT:GREEN}55`,
        }}/>
      </div>
    </div>
  );
}

// ─── ACTION BUTTON ─────────────────────────────────────────────
function ActionBtn({ label, gr, icon, onClick }) {
  return (
    <button onClick={e=>{e.stopPropagation();onClick();}} style={{
      background:gr, border:"none", borderRadius:12, padding:"10px 4px",
      cursor:"pointer", display:"flex", flexDirection:"column",
      alignItems:"center", gap:6,
      boxShadow:"-2px 4px 12px rgba(0,0,0,0.4),inset 1px 1px 0 rgba(255,255,255,0.18)",
    }}>
      <div style={{width:30,height:30,borderRadius:9,background:"rgba(0,0,0,0.22)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {icon}
      </div>
      <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.9)",textAlign:"center",lineHeight:1.2}}>{label}</span>
    </button>
  );
}

// ─── ICONS (inline SVG) ─────────────────────────────────────────
const Ico = {
  phone:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.82 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.09 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  viber:    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 1C6.48 1 2 5.48 2 11c0 3.18 1.49 6.01 3.82 7.88V22l3.78-2.1A10.07 10.07 0 0 0 12 20.07c5.52 0 10-4.5 10-10S17.52 1 12 1zm4.5 13.5c-.28.27-.65.42-1.03.42-.37 0-.73-.14-1-.41L12.53 12.57c-.55-.55-.55-1.44 0-1.99l.38-.38c.27-.27.27-.71 0-.98-.27-.27-.71-.27-.98 0l-.38.38c-1.1 1.1-1.1 2.88 0 3.98l1.94 1.94c.55.55.55 1.44 0 1.99l-.01.01c-.55.55-1.44.55-1.99 0L9.99 16.02c-1.17-1.17-1.17-3.07 0-4.24l.79-.79 1.03-1.03c.55-.55 1.44-.55 1.99 0l1.94 1.94c.27.27.27.71 0 .98-.27.27-.71.27-.98 0L12.82 10.94c-.55-.55-1.44-.55-1.99 0l-.79.79c-.47.47-.47 1.23 0 1.7l1.94 1.94c1.65 1.65 1.65 4.34 0 5.99z"/></svg>,
  telegram: <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 8"/></svg>,
  noshow:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  trash:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  reschedule:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>,
  chevron:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

// ─── BOOKING CARD (expand / collapse) ──────────────────────────
function BookingCard({ b, expanded, onToggle, onConfirm, onCancel, onNoshow }) {
  const svc   = SERVICES[b.svcId];
  const cat   = b.catId ? CATEGORIES[b.catId] : null;
  const STATUS_MAP = getStatusMap(T);
  const st    = STATUS_MAP[b.status] || STATUS_MAP.confirmed;
  const tc    = typeColor(b.type);
  const price = priceOf(b);

  const actions = [
    { label:"Дзвонити", gr:"linear-gradient(145deg,#34d399,#059669)", icon:Ico.phone,    fn:()=>window.location.href=`tel:${b.phone}` },
    { label:"Viber",    gr:"linear-gradient(145deg,#9b5ff5,#6d28d9)", icon:Ico.viber,    fn:()=>window.location.href=`viber://chat?number=%2B${b.phone.replace(/\D/g,"")}` },
    { label:"Telegram", gr:"linear-gradient(145deg,#5b9bff,#2563eb)", icon:Ico.telegram, fn:()=>window.open(`https://t.me/${b.phone.replace(/[^0-9]/g,"")}`) },
    ...(b.status==="pending" ? [
      { label:"Підтвердити", gr:"linear-gradient(145deg,#9ee07a,#5fb83d)", icon:Ico.check, fn:()=>onConfirm(b.id) },
    ] : []),
    ...(b.status!=="noshow" ? [
      { label:"Не прийшов", gr:"linear-gradient(145deg,#f87171,#dc2626)", icon:Ico.noshow, fn:()=>onNoshow(b.id) },
    ] : []),
    ...(b.status!=="cancelled" ? [
      { label:"Скасувати", gr:"linear-gradient(145deg,#ef4444,#b91c1c)", icon:Ico.trash, fn:()=>onCancel(b.id) },
    ] : []),
  ];

  return (
    <div
      className="bk-in"
      style={{
        background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
        borderRadius:13,
        border:`1px solid ${BORDER}`,
        boxShadow:SO,
        overflow:"hidden",
      }}
    >
      {/* ── COLLAPSED HEADER (always visible) ── */}
      <div
        onClick={onToggle}
        style={{
          borderBottom: expanded ? `1px solid ${BORDER}` : "none",
          padding:"9px 12px",
          display:"flex", alignItems:"center", gap:9,
          cursor:"pointer",
        }}
      >
        {/* left bar */}
        <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:tc,flexShrink:0}}/>
        {/* Avatar */}
        <div className="icon3d" style={{
          width:36, height:36,
          borderRadius:11, flexShrink:0,
          background:`linear-gradient(145deg,${tc}44,${tc}18)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:13, fontWeight:900, color:tc, letterSpacing:-0.5,
        }}>{initials(b.name)}</div>

        {/* Info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13,fontWeight:800,color:TEXT,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.name}</div>
          {expanded ? (
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              <Chip label={st.label} color={st.color} bg={st.bg}/>
              {cat && <Chip label={cat.name} color={cat.color} bg={`${cat.color}20`}/>}
              {svc && <Chip label={svc.name} color={tc} bg={`${tc}16`}/>}
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"nowrap",overflow:"hidden"}}>
              <Chip label={st.label} color={st.color} bg={st.bg}/>
              <span style={{fontSize:11,color:FAINT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {fmtDate(b.date)} · {fmtTime(b.startMin)} · {price}₴
              </span>
            </div>
          )}
        </div>

        {/* Quick confirm/cancel icon3d */}
        {!expanded && b.status==="pending" && (
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();onConfirm(b.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
              <div className="icon3d" style={{width:26,height:26,background:"linear-gradient(145deg,#9ee07a,#5fb83d)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ico.check}</div>
            </button>
            <button onClick={e=>{e.stopPropagation();onCancel(b.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
              <div className="icon3d" style={{width:26,height:26,background:"linear-gradient(145deg,#f87171,#dc2626)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ico.trash}</div>
            </button>
          </div>
        )}
        {/* Chevron */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round" flexShrink="0"
          style={{transform:expanded?"rotate(180deg)":"none",transition:"transform .22s",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* ── EXPANDED BODY ── */}
      {expanded && (
        <div className="expand-body" style={{padding:"14px 14px 16px"}}>

          {/* Phone + TSC */}
          <div style={{fontSize:12,color:DIM,marginBottom:13,paddingLeft:2}}>{b.phone}{b.tsc?` · ${b.tsc}`:""}</div>

          {/* Info chips */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:b.type==="school"?12:0}}>
            <InfoChip value={fmtDate(b.date)}                                        color={TEXT}/>
            <InfoChip value={`${fmtTime(b.startMin)}–${fmtTime(b.startMin+b.durMin)}`} color={BLUE}/>
            <InfoChip value={`${price} ₴`}                                          color={GOLD}/>
          </div>

          {/* Progress bar (school only) */}
          {b.type==="school" && (
            <div style={{
              background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,
              borderRadius:12, padding:"11px 13px", boxShadow:SI, marginTop:10, marginBottom:14,
            }}>
              <div style={{fontSize:9,color:FAINT,letterSpacing:1.5,textTransform:"uppercase",marginBottom:7}}>Прогрес навчання</div>
              <Progress hours={b.hours}/>
            </div>
          )}

          {/* Actions grid */}
          <div style={{
            display:"grid",
            gridTemplateColumns:`repeat(${Math.min(4,actions.length)},1fr)`,
            gap:7,
            marginTop: b.type==="school"?0:14,
          }}>
            {actions.map((a,i)=>(
              <ActionBtn key={i} label={a.label} gr={a.gr} icon={a.icon} onClick={a.fn}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUICK STATUS FILTERS ──────────────────────────────────────
function QuickFilters({ active, onChange }) {
  const opts=[
    {k:"all",      l:"Всі",         c:DIM  },
    {k:"pending",  l:"Очікують",    c:ACCENT},
    {k:"confirmed",l:"Підтверджено",c:GREEN },
    {k:"noshow",   l:"Не прийшли",  c:RED  },
    {k:"cancelled",l:"Скасовано",   c:FAINT},
  ];
  return (
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
      {opts.map(o=>(
        <button key={o.k} onClick={()=>onChange(o.k)} style={{
          flexShrink:0, padding:"6px 14px", borderRadius:10, border:"none", cursor:"pointer",
          background: active===o.k?`${o.c}22`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
          color: active===o.k?o.c:FAINT,
          fontSize:11, fontWeight:700,
          boxShadow: active===o.k?`inset 0 0 0 1.5px ${o.c}44`:SO,
          transition:"all .15s",
        }}>{o.l}</button>
      ))}
    </div>
  );
}

// ─── FILTER SHEET ───────────────────────────────────────────────
function FilterSheet({ filters, setFilters, sortBy, setSortBy, groupBy, setGroupBy, onClose }) {
  const FChip = ({label,active,onClick}) => (
    <button onClick={onClick} style={{
      padding:"7px 14px", borderRadius:12, border:"none", cursor:"pointer",
      fontSize:12, fontWeight:700,
      background:active?`linear-gradient(165deg,${ACC_HI},${ACCENT})`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
      color:active?"#fff":DIM, boxShadow:active?`inset 1px 1px 0 rgba(255,255,255,0.25)`:SO,
    }}>{label}</button>
  );
  const FRow = ({label,children}) => (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,color:FAINT,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{children}</div>
    </div>
  );
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:150,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"14px 18px 40px",
        maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -12px 48px rgba(0,0,0,0.6)",
      }}>
        <div style={{width:38,height:4,borderRadius:2,background:"rgba(255,255,255,0.1)",margin:"0 auto 20px"}}/>
        <div style={{fontSize:16,fontWeight:800,marginBottom:20,color:TEXT}}>Фільтр і сортування</div>
        <FRow label="Статус">
          {[["all","Всі"],["pending","Очікує"],["confirmed","Підтверджено"],["cancelled","Скасовано"],["noshow","Не прийшов"]].map(([k,l])=>(
            <FChip key={k} label={l} active={filters.status===k} onClick={()=>setFilters(f=>({...f,status:k}))}/>
          ))}
        </FRow>
        <FRow label="Тип">
          {[["all","Всі"],["school","Автошкола"],["private","Приватний"]].map(([k,l])=>(
            <FChip key={k} label={l} active={filters.type===k} onClick={()=>setFilters(f=>({...f,type:k}))}/>
          ))}
        </FRow>
        <FRow label="Послуга">
          <FChip label="Всі" active={!filters.svcId} onClick={()=>setFilters(f=>({...f,svcId:null}))}/>
          {Object.entries(SERVICES).map(([id,s])=>(
            <FChip key={id} label={s.name} active={filters.svcId===id} onClick={()=>setFilters(f=>({...f,svcId:id}))}/>
          ))}
        </FRow>
        <FRow label="Категорія">
          <FChip label="Всі" active={!filters.catId} onClick={()=>setFilters(f=>({...f,catId:null}))}/>
          {Object.entries(CATEGORIES).map(([id,c])=>(
            <FChip key={id} label={c.name} active={filters.catId===id} onClick={()=>setFilters(f=>({...f,catId:id}))}/>
          ))}
        </FRow>
        <FRow label="Дата">
          {[["all","Всі"],["today","Сьогодні"],["tmrw","Завтра"],["week","Тиждень"],["month","Місяць"]].map(([k,l])=>(
            <FChip key={k} label={l} active={filters.datePreset===k} onClick={()=>setFilters(f=>({...f,datePreset:k}))}/>
          ))}
        </FRow>
        <FRow label="Сортування">
          {[["date-asc","Дата ↑"],["date-desc","Дата ↓"],["name-asc","Ім'я А-Я"],["price-desc","Сума ↓"]].map(([k,l])=>(
            <FChip key={k} label={l} active={sortBy===k} onClick={()=>setSortBy(k)}/>
          ))}
        </FRow>
        <FRow label="Групування">
          {[[null,"Без групи"],["date","По датах"],["status","По статусу"],["type","По типу"]].map(([k,l])=>(
            <FChip key={k||"none"} label={l} active={groupBy===k} onClick={()=>setGroupBy(k)}/>
          ))}
        </FRow>
        <button onClick={onClose} style={{
          width:"100%",padding:"14px",borderRadius:14,border:"none",cursor:"pointer",
          background:`linear-gradient(165deg,${ACC_HI},${ACCENT})`,color:"#fff",
          fontSize:13,fontWeight:700,
          boxShadow:`-2px 5px 14px rgba(255,90,60,0.45),inset 1px 1px 0 rgba(255,255,255,0.3)`,
        }}>Готово</button>
      </div>
    </div>
  );
}

// ─── ADD TO QUEUE MODAL ─────────────────────────────────────────
function AddToQueueModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name:"", phone:"", svcId:"sv1" });
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.name.trim() && form.phone.trim();
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:150,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"20px 18px 36px",
      }}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 16px"}}/>
        <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:16}}>⏳ Додати до черги</div>
        {[
          {k:"name",  label:"Ім'я учня",   placeholder:"Ім'я Прізвище", type:"text"},
          {k:"phone", label:"Телефон",      placeholder:"+380...",       type:"tel"},
        ].map(f=>(
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:5}}>{f.label.toUpperCase()}</div>
            <input type={f.type} value={form[f.k]} onChange={e=>upd(f.k,e.target.value)}
              placeholder={f.placeholder}
              style={{width:"100%",background:BG_DEEP,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 14px",color:TEXT,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:5}}>ПОСЛУГА</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(SERVICES).map(([id,s])=>(
              <button key={id} onClick={()=>upd("svcId",id)} style={{
                padding:"6px 12px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:form.svcId===id?`linear-gradient(145deg,${s.color}44,${s.color}22)`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                color:form.svcId===id?s.color:DIM,boxShadow:SO,
              }}>{s.name}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Скасувати</button>
          <button onClick={()=>valid&&onSave(form)} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:valid?"linear-gradient(165deg,#c084fc,#7c3aed)":`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
            color:valid?"#fff":FAINT,
            boxShadow:valid?"0 4px 14px rgba(192,132,252,0.4)":SO,
          }}>Додати до черги</button>
        </div>
      </div>
    </div>
  );
}

// ─── QUEUE OFFER MODAL ──────────────────────────────────────────
function QueueOfferModal({ cancelledBk, waiting, queueMode, onInvite, onClose }) {
  const [selected, setSelected] = useState(
    queueMode === "fifo" ? [waiting[0]?.id] : queueMode === "broadcast" ? waiting.map(q=>q.id) : []
  );
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:150,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"20px 18px 36px",
      }}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 14px"}}/>
        <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:4}}>⏳ Слот вільний!</div>
        <div style={{fontSize:12,color:DIM,marginBottom:16}}>
          Запис скасовано. Є <b style={{color:PURPLE}}>{waiting.length}</b> {waiting.length===1?"учень":"учнів"} в черзі.
          Режим: <b style={{color:GOLD}}>{queueMode==="fifo"?"FIFO":queueMode==="broadcast"?"Broadcast":"Ручний"}</b>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {waiting.map(q=>(
            <div key={q.id} onClick={()=>queueMode==="manual"&&toggle(q.id)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:11,
              background:selected.includes(q.id)?`linear-gradient(145deg,rgba(192,132,252,0.2),rgba(124,58,237,0.1))`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
              border:selected.includes(q.id)?`1px solid ${PURPLE}44`:`1px solid transparent`,
              cursor:queueMode==="manual"?"pointer":"default",boxShadow:SO,
            }}>
              <div style={{width:4,height:32,borderRadius:3,background:PURPLE,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:TEXT}}>{q.name}</div>
                <div style={{fontSize:10,color:DIM}}>{q.phone} · {SERVICES[q.svcId]?.name||q.svcId}</div>
              </div>
              {selected.includes(q.id) && <span style={{fontSize:16}}>✓</span>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Пізніше</button>
          <button onClick={()=>selected.length>0&&onInvite(selected)} disabled={selected.length===0} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:selected.length>0?"linear-gradient(165deg,#c084fc,#7c3aed)":`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
            color:selected.length>0?"#fff":FAINT,
            boxShadow:selected.length>0?"0 4px 14px rgba(192,132,252,0.4)":SO,
          }}>👑 Запросити ({selected.length})</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN VIEW ─────────────────────────────────────────────────
export default function BookingsView({ infoOpen = false, onToggleInfo, settings }) {
  const lang = useContext(LangContext);
  const t = createT(lang);
  const [data,       setData]       = useState(RAW); // RAW as initial fallback

  useEffect(() => {
    return onValue(ref(db, "bookings"), snap => {
      const d = snap.val();
      if (!d) return;
      const all = [];
      Object.entries(d).forEach(([uid, userBkgs]) => {
        Object.values(userBkgs).forEach(raw => {
          const timeStr = raw.time || "00:00";
          const [hh, mm] = timeStr.split(":").map(Number);
          all.push({
            ...raw,
            userId:   uid,
            name:     raw.studentName || raw.name || "Без імені",
            phone:    raw.phone    || "",
            tsc:      raw.tsc      || "",
            date:     raw.date     || "",
            startMin: raw.startMin ?? (hh * 60 + (mm || 0)),
            durMin:   raw.durMin   ?? (raw.durationHours ? raw.durationHours * 60 : 60),
            type:     raw.serviceType || raw.type || "private",
            svcId:    raw.svcId    || ((raw.serviceType || raw.type) === "school" ? "sv1" : "sv3"),
            catId:    raw.catId    || null,
            status:   raw.status   || "pending",
            hours:    raw.hours    || 0,
          });
        });
      });
      all.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.startMin || 0) - (b.startMin || 0));
      setData(all);
    }, () => {}); // on error keep mock data
  }, []);
  const [filters,    setFilters]    = useState({status:"all",type:"all",svcId:null,catId:null,datePreset:"all"});
  const [sortBy,     setSortBy]     = useState("date-asc");
  const [groupBy,    setGroupBy]    = useState("date");
  const [search,     setSearch]     = useState("");
  const [showFilters,setShowFilters]= useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // ── ЧЕРГА ──────────────────────────────────────────────────────
  const [queue,        setQueue]        = useState([]);
  const [queueOpen,    setQueueOpen]    = useState(false);
  const [addQueueOpen, setAddQueueOpen] = useState(false);
  const [queueOffer,   setQueueOffer]   = useState(null); // { cancelledBk, queue }

  useEffect(() => {
    return onValue(ref(db, "queue"), snap => {
      const d = snap.val();
      if (!d) { setQueue([]); return; }
      const arr = Object.entries(d).map(([id, v]) => ({id, ...v}))
        .sort((a,b) => (a.addedAt||0) - (b.addedAt||0));
      setQueue(arr);
    }, () => {});
  }, []);

  const addToQueue = (form) => {
    push(ref(db, "queue"), { ...form, addedAt: Date.now(), status: "waiting" });
  };
  const removeFromQueue = (id) => remove(ref(db, `queue/${id}`));
  const markOffered = (id) => update(ref(db, `queue/${id}`), { status: "offered", offeredAt: Date.now() });

  const queueMode = settings?.queueAutoFifo ? "fifo"
    : settings?.queueBroadcast ? "broadcast" : "manual";

  // ── СТАТУСИ ────────────────────────────────────────────────────
  const toggle  = id => setExpandedId(prev => prev===id ? null : id);
  const setStatus = (id, status) => {
    setData(d => d.map(b => b.id===id ? {...b, status} : b));
    setExpandedId(null);
    const bk = data.find(b => b.id === id);
    if (bk?.userId) update(ref(db, `bookings/${bk.userId}/${id}`), { status });
    if (status === "cancelled" && queue.filter(q => q.status === "waiting").length > 0) {
      setQueueOffer({ cancelledBk: bk, waiting: queue.filter(q => q.status === "waiting") });
    }
  };
  const confirm = id => setStatus(id, "confirmed");
  const cancel  = id => setStatus(id, "cancelled");
  const noshow  = id => setStatus(id, "noshow");

  const applyDate = b => {
    const today = new Date().toISOString().split("T")[0];
    const tmrw  = new Date(Date.now()+86400000).toISOString().split("T")[0];
    if (filters.datePreset==="today") return b.date===today;
    if (filters.datePreset==="tmrw")  return b.date===tmrw;
    if (filters.datePreset==="week") {
      const d=new Date(b.date),now=new Date();
      const s=new Date(now); s.setDate(now.getDate()-now.getDay());
      const e=new Date(s); e.setDate(s.getDate()+6);
      return d>=s && d<=e;
    }
    if (filters.datePreset==="month") return b.date.startsWith(new Date().toISOString().slice(0,7));
    return true;
  };

  let list = data.filter(b =>
    (filters.status==="all" || b.status===filters.status) &&
    (filters.type==="all"   || b.type===filters.type) &&
    (!filters.svcId  || b.svcId===filters.svcId) &&
    (!filters.catId  || b.catId===filters.catId) &&
    applyDate(b) &&
    (!search || (b.name||"").toLowerCase().includes(search.toLowerCase()) ||
      (b.phone||"").includes(search) || (b.tsc||"").toLowerCase().includes(search.toLowerCase()) ||
      (b.date||"").includes(search))
  );
  list = [...list].sort((a,b) => {
    if (sortBy==="date-asc")  return (a.date||"").localeCompare(b.date||"")||(a.startMin||0)-(b.startMin||0);
    if (sortBy==="date-desc") return (b.date||"").localeCompare(a.date||"")||(a.startMin||0)-(b.startMin||0);
    if (sortBy==="name-asc")  return (a.name||"").localeCompare(b.name||"");
    if (sortBy==="price-desc")return priceOf(b)-priceOf(a);
    return 0;
  });

  const pendingCount = data.filter(b=>b.status==="pending").length;

  const grouped = (() => {
    if (!groupBy) return [{key:null,items:list}];
    const map={};
    list.forEach(b=>{
      const k=groupBy==="date"?b.date:groupBy==="status"?b.status:b.type==="school"?"Автошкола":"Приватний";
      if(!map[k])map[k]=[];
      map[k].push(b);
    });
    return Object.entries(map).map(([key,items])=>({key,items}));
  })();

  const groupLabel = key => {
    if (groupBy==="date")   return fmtDate(key);
    if (groupBy==="status") return ({pending:"Очікують",confirmed:"Підтверджено",cancelled:"Скасовано",noshow:"Не прийшли"})[key]||key;
    return key;
  };

  const activeFiltersCount = [filters.status!=="all",filters.type!=="all",!!filters.svcId,!!filters.catId,filters.datePreset!=="all"].filter(Boolean).length;

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",gap:10,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── INFO ── */}
        <div style={{background:`linear-gradient(145deg,${ACCENT}0d,${ACCENT}05)`,border:`1px solid ${ACCENT}30`,borderRadius:10,overflow:"hidden"}}>
          <div onClick={onToggleInfo} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",cursor:"pointer"}}>
            <span style={{fontSize:11,fontWeight:700,color:ACCENT}}>💡 Букінги</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" style={{transform:infoOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          {infoOpen && (
            <div style={{padding:"0 12px 10px",fontSize:11,color:DIM,lineHeight:1.6}}>
              Список записів учнів. Натисніть на картку — побачите деталі, телефон і кнопки дій.
              Очікуючі записи підтвердіть або скасуйте. Використовуйте пошук і фільтр для швидкого доступу.
            </div>
          )}
        </div>

        {/* ── PENDING ALERT ── */}
        {pendingCount>0 && (
          <div style={{
            background:"linear-gradient(135deg,rgba(255,90,60,0.18),rgba(255,90,60,0.07))",
            borderRadius:18, border:"1px solid rgba(255,90,60,0.3)",
            padding:"14px 16px", display:"flex", alignItems:"center", gap:12,
            boxShadow:"0 0 24px rgba(255,90,60,0.12)",
          }}>
            <div style={{
              width:44,height:44,borderRadius:13,flexShrink:0,
              background:`linear-gradient(145deg,${ACC_HI},${ACCENT})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:19,fontWeight:900,color:"#fff",
              boxShadow:"-2px 4px 12px rgba(255,90,60,0.45),inset 1px 1px 0 rgba(255,255,255,0.3)",
            }}>{pendingCount}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:TEXT}}>Потрібна дія</div>
              <div style={{fontSize:12,color:DIM,marginTop:1}}>{pendingCount} {pendingCount===1?"букінг":"букінги"} очікують підтвердження</div>
            </div>
            <button onClick={()=>setFilters(f=>({...f,status:"pending"}))} style={{
              background:`linear-gradient(145deg,${ACC_HI},${ACCENT})`,border:"none",
              borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#fff",
              fontSize:12,fontWeight:700,flexShrink:0,
              boxShadow:"-2px 4px 10px rgba(255,90,60,0.4),inset 1px 1px 0 rgba(255,255,255,0.25)",
            }}>Показати →</button>
          </div>
        )}

        {/* ── SEARCH + FILTER ── */}
        <div style={{
          display:"flex",alignItems:"center",gap:8,
          background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,
          borderRadius:14,padding:"4px 12px",boxShadow:SI,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Ім'я, телефон, ТСЦ, дата…"
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,padding:"10px 0",fontSize:14,fontFamily:"inherit"}}
          />
          {search && <button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:20,padding:0,lineHeight:1}}>×</button>}
          <button onClick={()=>setShowFilters(true)} style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeFiltersCount>0?ACCENT:FAINT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {activeFiltersCount>0 && (
              <span style={{position:"absolute",top:-5,right:-5,background:ACCENT,color:"#fff",borderRadius:8,padding:"0 5px",fontSize:8,fontWeight:800,lineHeight:"14px"}}>{activeFiltersCount}</span>
            )}
          </button>
        </div>

        {/* ── GROUPED CARD LIST ── */}
        {grouped.map(({key,items})=>(
          <div key={key||"all"}>
            {key && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px 4px"}}>
                <div style={{flex:1,height:1,background:BORDER}}/>
                <span style={{fontSize:11,color:FAINT,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>{groupLabel(key)}</span>
                <span style={{
                  background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
                  padding:"2px 9px",borderRadius:8,fontSize:10,color:DIM,fontWeight:700,boxShadow:SO,
                }}>{items.length}</span>
                <div style={{flex:1,height:1,background:BORDER}}/>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {items.map(b=>(
                <BookingCard
                  key={b.id}
                  b={b}
                  expanded={expandedId===b.id}
                  onToggle={()=>toggle(b.id)}
                  onConfirm={confirm}
                  onCancel={cancel}
                  onNoshow={noshow}
                />
              ))}
            </div>
          </div>
        ))}

        {/* ── EMPTY ── */}
        {list.length===0 && (
          <div style={{textAlign:"center",padding:"50px 20px",color:FAINT}}>
            <div style={{fontSize:36,marginBottom:12}}>📭</div>
            <div style={{fontSize:15,fontWeight:700,color:DIM}}>Нічого не знайдено</div>
            <div style={{fontSize:12,marginTop:6}}>Змініть фільтри або пошуковий запит</div>
          </div>
        )}

        {/* ── ЧЕРГА ── */}
        <div style={{background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,borderRadius:13,overflow:"hidden",boxShadow:SO,border:`1px solid ${BORDER}`}}>
          {/* header */}
          <div onClick={()=>setQueueOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
            <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:PURPLE,flexShrink:0}}/>
            <span style={{fontSize:18}}>⏳</span>
            <span style={{flex:1,fontSize:13,fontWeight:800,color:TEXT}}>Черга очікування</span>
            {queue.filter(q=>q.status==="waiting").length > 0 && (
              <span style={{background:PURPLE,color:"#fff",borderRadius:8,padding:"1px 8px",fontSize:11,fontWeight:700}}>
                {queue.filter(q=>q.status==="waiting").length}
              </span>
            )}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
              style={{transform:queueOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {/* list */}
          {queueOpen && (
            <div style={{borderTop:`1px solid ${BORDER}`,padding:"8px 12px 4px"}}>
              {queue.length === 0 ? (
                <div style={{textAlign:"center",padding:"16px 0",color:FAINT,fontSize:12}}>Черга порожня</div>
              ) : queue.map(q => {
                const svc = SERVICES[q.svcId] || {};
                const isOffered = q.status === "offered";
                return (
                  <div key={q.id} style={{
                    display:"flex",alignItems:"center",gap:8,padding:"8px 4px",
                    borderBottom:`1px solid ${BORDER}`,opacity:isOffered?0.6:1
                  }}>
                    <div style={{width:4,height:32,borderRadius:3,background:isOffered?GOLD:PURPLE,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.name}</div>
                      <div style={{fontSize:10,color:DIM}}>
                        {q.phone} · {svc.name||q.svcId||"—"}
                        {isOffered && <span style={{color:GOLD,fontWeight:700}}> · Запропоновано</span>}
                      </div>
                    </div>
                    {!isOffered && (
                      <button onClick={()=>markOffered(q.id)} style={{
                        background:`linear-gradient(145deg,${PURPLE}99,#7c3aed55)`,border:"none",
                        borderRadius:8,padding:"5px 10px",cursor:"pointer",color:PURPLE,fontSize:11,fontWeight:700,
                      }}>Запросити</button>
                    )}
                    <button onClick={()=>removeFromQueue(q.id)} style={{
                      background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:16,padding:"0 2px",
                    }}>×</button>
                  </div>
                );
              })}
              <button onClick={()=>setAddQueueOpen(true)} style={{
                width:"100%",padding:"10px",margin:"8px 0 4px",borderRadius:10,border:"none",cursor:"pointer",
                background:`linear-gradient(145deg,rgba(192,132,252,0.15),rgba(124,58,237,0.08))`,
                border:`1px dashed ${PURPLE}55`,color:PURPLE,fontSize:12,fontWeight:700,
              }}>+ Додати до черги</button>
            </div>
          )}
        </div>

      </div>

      {/* FILTER SHEET */}
      {showFilters && (
        <FilterSheet
          filters={filters}    setFilters={setFilters}
          sortBy={sortBy}      setSortBy={setSortBy}
          groupBy={groupBy}    setGroupBy={setGroupBy}
          onClose={()=>setShowFilters(false)}
        />
      )}

      {/* ADD TO QUEUE MODAL */}
      {addQueueOpen && <AddToQueueModal onSave={form=>{addToQueue(form);setAddQueueOpen(false);}} onClose={()=>setAddQueueOpen(false)}/>}

      {/* QUEUE OFFER MODAL */}
      {queueOffer && (
        <QueueOfferModal
          cancelledBk={queueOffer.cancelledBk}
          waiting={queueOffer.waiting}
          queueMode={queueMode}
          onInvite={ids=>{ids.forEach(id=>markOffered(id));setQueueOffer(null);}}
          onClose={()=>setQueueOffer(null)}
        />
      )}
    </>
  );
}
