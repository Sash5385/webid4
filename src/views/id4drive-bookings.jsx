import { useState } from "react";

// ─── TOKENS ────────────────────────────────────────────────────
const BG      = "#1c1d21";
const BG_DEEP = "#161719";
const SURFACE = "#26282c";
const SURF_HI = "#2e3034";
const SURF_LO = "#1f2125";
const BORDER  = "rgba(255,255,255,0.05)";
const TEXT    = "#e8e8ea";
const DIM     = "#8b8d93";
const FAINT   = "#5a5c62";
const ACCENT  = "#ff5a3c";
const ACC_HI  = "#ff7a5c";
const GREEN   = "#7ed957";
const BLUE    = "#5b9bff";
const GOLD    = "#f7c948";
const RED     = "#ef4444";

const SO = "6px 6px 16px rgba(0,0,0,0.45),-3px -3px 10px rgba(255,255,255,0.025)";
const SI = "inset 3px 3px 8px rgba(0,0,0,0.4),inset -2px -2px 6px rgba(255,255,255,0.025)";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
textarea{color-scheme:dark}
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
const RAW = [
  { id:"b01", date:"2026-05-23", startMin:8*60,  durMin:120, name:"Марія Коваль",   phone:"+380671234567", type:"school",  tsc:"ТСЦ 8041", svcId:"sv1", catId:null,      status:"pending",   hours:12 },
  { id:"b02", date:"2026-05-23", startMin:11*60, durMin:60,  name:"Іван Петренко",  phone:"+380509876543", type:"private", tsc:"",           svcId:"sv3", catId:"cat-std", status:"pending",   hours:5  },
  { id:"b03", date:"2026-05-23", startMin:14*60, durMin:120, name:"Олена Мороз",    phone:"+380631112233", type:"school",  tsc:"ТСЦ 8042", svcId:"sv1", catId:null,      status:"confirmed", hours:38 },
  { id:"b04", date:"2026-05-24", startMin:9*60,  durMin:60,  name:"Дмитро Сало",    phone:"+380961234567", type:"private", tsc:"",           svcId:"sv3", catId:"cat-vip", status:"confirmed", hours:9  },
  { id:"b05", date:"2026-05-24", startMin:13*60, durMin:60,  name:"Тетяна Кравець", phone:"+380731234567", type:"school",  tsc:"ТСЦ 8041", svcId:"sv2", catId:null,      status:"confirmed", hours:40 },
  { id:"b06", date:"2026-05-25", startMin:10*60, durMin:120, name:"Антон Білий",    phone:"+380501112233", type:"school",  tsc:"ТСЦ 8041", svcId:"sv1", catId:null,      status:"confirmed", hours:22 },
  { id:"b07", date:"2026-05-25", startMin:15*60, durMin:120, name:"Юлія Денисюк",   phone:"+380935023739", type:"private", tsc:"",           svcId:"sv4", catId:"cat-new", status:"pending",   hours:3  },
  { id:"b08", date:"2026-05-26", startMin:8*60,  durMin:60,  name:"Сергій Гук",     phone:"+380961234500", type:"private", tsc:"",           svcId:"sv3", catId:"cat-std", status:"confirmed", hours:14 },
  { id:"b09", date:"2026-05-26", startMin:11*60, durMin:120, name:"Наталія Бондар", phone:"+380671112244", type:"school",  tsc:"ТСЦ 8042", svcId:"sv2", catId:null,      status:"noshow",    hours:18 },
  { id:"b10", date:"2026-05-27", startMin:9*60,  durMin:120, name:"Андрій Чорний",  phone:"+380501234500", type:"school",  tsc:"ТСЦ 8041", svcId:"sv1", catId:null,      status:"confirmed", hours:30 },
  { id:"b11", date:"2026-05-27", startMin:14*60, durMin:60,  name:"Ірина Лесник",   phone:"+380967240853", type:"private", tsc:"",           svcId:"sv3", catId:"cat-new", status:"cancelled", hours:1  },
  { id:"b12", date:"2026-05-28", startMin:10*60, durMin:120, name:"Ангеліна Коник", phone:"+380681746071", type:"private", tsc:"",           svcId:"sv4", catId:"cat-vip", status:"confirmed", hours:6  },
];

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

const STATUS_MAP = {
  pending:   { color:ACCENT,  bg:"rgba(255,90,60,0.15)",   label:"Очікує"        },
  confirmed: { color:GREEN,   bg:"rgba(126,217,87,0.15)",  label:"Підтверджено"  },
  cancelled: { color:FAINT,   bg:"rgba(255,255,255,0.07)", label:"Скасовано"     },
  noshow:    { color:RED,     bg:"rgba(239,68,68,0.18)",   label:"Не прийшов"    },
};

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
        background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
        borderRadius:20,
        border: expanded ? `1px solid ${tc}28` : "1px solid rgba(255,255,255,0.04)",
        boxShadow: expanded ? `0 8px 32px rgba(0,0,0,0.5),0 0 0 1px ${tc}14` : SO,
        overflow:"hidden",
        transition:"border-color .2s, box-shadow .2s",
      }}
    >
      {/* ── COLLAPSED HEADER (always visible) ── */}
      <div
        onClick={onToggle}
        style={{
          background: expanded ? typeGrad(b.type) : "transparent",
          borderBottom: expanded ? `1px solid ${tc}18` : "none",
          padding: expanded ? "14px 14px 13px" : "12px 14px",
          display:"flex", alignItems:"center", gap:11,
          cursor:"pointer",
          transition:"background .2s, padding .2s, border-color .2s",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: expanded?50:42, height: expanded?50:42,
          borderRadius: expanded?16:13, flexShrink:0,
          background:`linear-gradient(145deg,${tc}28,${tc}12)`,
          border:`1.5px solid ${tc}${expanded?"44":"2a"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize: expanded?17:14, fontWeight:900, color:tc, letterSpacing:-0.5,
          boxShadow: expanded?`0 3px 12px ${tc}22`:"none",
          transition:"width .2s,height .2s,border-radius .2s,font-size .2s",
        }}>{initials(b.name)}</div>

        {/* Info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14,fontWeight:800,color:TEXT,marginBottom:expanded?5:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.name}</div>
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

        {/* Quick confirm/cancel — visible only when collapsed + pending */}
        {!expanded && b.status==="pending" && (
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();onConfirm(b.id);}} style={{
              width:32,height:32,borderRadius:9,border:"none",cursor:"pointer",
              background:"linear-gradient(145deg,#9ee07a,#5fb83d)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"-1px 2px 6px rgba(0,0,0,0.35),inset 1px 1px 0 rgba(255,255,255,0.2)",
            }}>{Ico.check}</button>
            <button onClick={e=>{e.stopPropagation();onCancel(b.id);}} style={{
              width:32,height:32,borderRadius:9,border:"none",cursor:"pointer",
              background:"linear-gradient(145deg,#5a5e66,#3a3e44)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"-1px 2px 6px rgba(0,0,0,0.35),inset 1px 1px 0 rgba(255,255,255,0.1)",
            }}>{Ico.trash}</button>
          </div>
        )}

        {/* Chevron */}
        <div style={{
          width:26,height:26,borderRadius:8,flexShrink:0,
          background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:SO,
          transform: expanded?"rotate(180deg)":"rotate(0deg)",
          transition:"transform .22s ease",
        }}>{Ico.chevron}</div>
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

// ─── MAIN VIEW ─────────────────────────────────────────────────
export default function BookingsView() {
  const [data,       setData]       = useState(RAW);
  const [filters,    setFilters]    = useState({status:"all",type:"all",svcId:null,catId:null,datePreset:"all"});
  const [sortBy,     setSortBy]     = useState("date-asc");
  const [groupBy,    setGroupBy]    = useState("date");
  const [search,     setSearch]     = useState("");
  const [showFilters,setShowFilters]= useState(false);
  const [expandedId, setExpandedId] = useState(null); // one card open at a time

  const toggle  = id => setExpandedId(prev => prev===id ? null : id);
  const confirm = id => { setData(d=>d.map(b=>b.id===id?{...b,status:"confirmed"}:b)); setExpandedId(null); };
  const cancel  = id => { setData(d=>d.map(b=>b.id===id?{...b,status:"cancelled"}:b)); setExpandedId(null); };
  const noshow  = id => { setData(d=>d.map(b=>b.id===id?{...b,status:"noshow"}:b));   setExpandedId(null); };

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
    (!search || b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search) || b.tsc.toLowerCase().includes(search.toLowerCase()) ||
      b.date.includes(search))
  );
  list = [...list].sort((a,b) => {
    if (sortBy==="date-asc")  return a.date.localeCompare(b.date)||a.startMin-b.startMin;
    if (sortBy==="date-desc") return b.date.localeCompare(a.date)||a.startMin-b.startMin;
    if (sortBy==="name-asc")  return a.name.localeCompare(b.name);
    if (sortBy==="price-desc")return priceOf(b)-priceOf(a);
    return 0;
  });

  const pendingCount = data.filter(b=>b.status==="pending").length;
  const totalPrice   = list.reduce((s,b)=>s+priceOf(b),0);
  const totalHours   = list.reduce((s,b)=>s+(b.durMin/60),0);

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

        {/* ── QUICK STATUS FILTERS ── */}
        <QuickFilters active={filters.status} onChange={s=>setFilters(f=>({...f,status:s}))}/>

        {/* ── STATS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {label:"Записів",val:list.length,          c:TEXT},
            {label:"Годин",  val:totalHours.toFixed(1), c:BLUE},
            {label:"Сума",   val:`${totalPrice.toLocaleString()} ₴`, c:GOLD},
          ].map(s=>(
            <div key={s.label} style={{
              background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,
              borderRadius:12,padding:"10px",textAlign:"center",boxShadow:SI,
            }}>
              <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase"}}>{s.label}</div>
              <div style={{fontSize:17,fontWeight:900,color:s.c,marginTop:3}}>{s.val}</div>
            </div>
          ))}
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
    </>
  );
}
