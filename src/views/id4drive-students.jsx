import { useState, useEffect } from "react";
import { ref, onValue, off, update } from "firebase/database";
import { db } from "../firebase";

import { BG_DEEP, SURFACE, SURF_HI, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, GOLD, RED, SO, SI } from "../theme.js";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
@keyframes ex{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.ex{animation:ex .16s ease both}
.btn{border:none;cursor:pointer;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:9px 4px;transition:transform .1s,filter .1s;font-family:inherit}
.btn:active{transform:scale(.92);filter:brightness(.8)}
.btn span{font-size:9px;font-weight:700;letter-spacing:.2px}
.icon3d{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;position:relative;overflow:hidden;flex-shrink:0;box-shadow:-2px 4px 10px rgba(0,0,0,0.5),inset 1px 1px 0 rgba(255,255,255,0.25),inset -1px -1px 0 rgba(0,0,0,0.3)}
.icon3d::before{content:'';position:absolute;top:0;right:0;width:60%;height:50%;background:radial-gradient(ellipse at top right,rgba(255,255,255,0.4) 0%,transparent 70%);pointer-events:none}
`;

const M = ["","Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];
const fmtS = d => { if(!d) return "—"; const [,m,day]=d.split("-"); return `${parseInt(day)} ${M[parseInt(m)]}`; };
const navTo = tab => window.dispatchEvent(new CustomEvent("id4drive-nav", {detail:tab}));

// SVG helper
const Svg = (d, s=18, c="white", w=2) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const ICONS = {
  phone:    Svg(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.05A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></>),
  viber:    Svg(<><path d="M21 12c0 5-4 8-9 8a16 16 0 0 1-4-.7L3 21l1-4C2.5 15.5 2 13.8 2 12c0-5 4-8 9-8s10 3 10 8z"/></>),
  telegram: Svg(<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>),
  chat:     Svg(<><path d="M21 12c0 5-4 8-9 8a16 16 0 0 1-4-.7L3 21l1-4C2.5 15.5 2 13.8 2 12c0-5 4-8 9-8s10 3 10 8z"/></>),
  edit:     Svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></>),
  ban:      Svg(<><circle cx="12" cy="12" r="9"/><line x1="6" y1="6" x2="18" y2="18"/></>, 18, "white", 2.2),
  unban:    Svg(<><polyline points="20 6 9 17 4 12"/></>, 18, "white", 2.5),
  chev:     Svg(<><polyline points="6 9 12 15 18 9"/></>, 16, FAINT),
  search:   Svg(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, 15, FAINT),
  filter:   Svg(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>, 16),
};


// ─── ACTION BUTTON ───────────────────────────────────────────────
function Btn({ icon, label, onClick, color, danger }) {
  const bg = danger
    ? "linear-gradient(145deg,rgba(239,68,68,.2),rgba(185,28,28,.12))"
    : color
      ? `linear-gradient(145deg,${color}22,${color}11)`
      : `linear-gradient(145deg,${SURF_HI},${SURFACE})`;
  const lc = danger ? "#fca5a5" : color || DIM;
  return (
    <button className="btn" onClick={onClick} style={{background:bg, boxShadow:SO}}>
      {icon}
      <span style={{color:lc}}>{label}</span>
    </button>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────────
function Progress({ hours }) {
  const pct = Math.min((hours / 40) * 100, 100);
  const done = pct >= 100;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,color:DIM}}>Прогрес автошколи</span>
        <span style={{fontSize:11,fontWeight:800,color:done?ACCENT:GREEN}}>{hours}/40 год · {Math.round(pct)}%</span>
      </div>
      <div style={{height:5,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
        <div style={{
          height:"100%",width:`${pct}%`,borderRadius:3,
          background:done?`linear-gradient(90deg,${ACC_HI},${ACCENT})`:`linear-gradient(90deg,${BLUE},${GREEN})`,
          boxShadow:`0 0 6px ${done?ACCENT:GREEN}44`,
        }}/>
      </div>
    </div>
  );
}

// ─── EDIT FORM ───────────────────────────────────────────────────
function EditForm({ s, onSave, onCancel }) {
  const [d, setD] = useState({ name:s.name, phone:s.phone, discount:s.discount??0, notes:s.notes||"", type:s.type });
  const inp = (k, label, opts={}) => (
    <div>
      <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
      <input type={opts.type||"text"} value={d[k]??""} onChange={e=>setD(x=>({...x,[k]:e.target.value}))}
        style={{background:BG_DEEP,border:`1.5px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,padding:"7px 10px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        {inp("name","Ім'я")}
        {inp("phone","Телефон")}
        {inp("discount","Знижка %",{type:"number"})}
        <div>
          <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Тип</div>
          <div style={{display:"flex",gap:6}}>
            {[["private","Приват."],["school","Автошк."]].map(([k,l])=>(
              <button key={k} onClick={()=>setD(x=>({...x,type:k}))} style={{
                flex:1,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",
                fontSize:11,fontWeight:700,
                background:d.type===k?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                color:d.type===k?"#fff":DIM,boxShadow:SO,
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Нотатки</div>
        <textarea value={d.notes} onChange={e=>setD(x=>({...x,notes:e.target.value}))} rows={2}
          style={{background:BG_DEEP,border:`1.5px solid ${BORDER}`,borderRadius:8,color:TEXT,fontSize:13,padding:"7px 10px",outline:"none",width:"100%",fontFamily:"inherit",resize:"none"}}/>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>onSave(d)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${ACC_HI},${ACCENT})`,color:"#fff",fontSize:13,fontWeight:700,boxShadow:SO}}>Зберегти</button>
        <button onClick={onCancel} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Скасувати</button>
      </div>
    </div>
  );
}

// ─── STUDENT CARD ────────────────────────────────────────────────
function Card({ s, expanded, onToggle, onBlock, onUpdate }) {
  const [editMode, setEditMode] = useState(false);

  const typeColor = s.type === "school" ? GREEN : GOLD;
  const typeLabel = s.type === "school" ? "Автошкола" : "Приватний";
  const phone = (s.phone||"").replace(/\D/g,"");

  const ini = s.name.split(" ").map(w=>w[0]).slice(0,2).join("");
  const barColor = s.blocked ? RED : typeColor;

  return (
    <div style={{
      background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
      borderRadius:13, overflow:"hidden",
      boxShadow:SO, border:`1px solid ${BORDER}`,
      opacity:s.blocked?0.8:1,
    }}>
      {/* ── COLLAPSED ROW ── */}
      <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",cursor:"pointer"}} onClick={()=>{ setEditMode(false); onToggle(s.id); }}>
        {/* left bar */}
        <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:barColor,flexShrink:0}}/>
        {/* initials icon3d */}
        <div className="icon3d" style={{
          width:36,height:36,borderRadius:11,flexShrink:0,
          background:`linear-gradient(145deg,${barColor}44,${barColor}18)`,
          fontSize:13,fontWeight:900,color:barColor,
        }}>{ini}</div>
        {/* name + type */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:800,color:s.blocked?DIM:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {s.name}{s.blocked && <span style={{fontSize:9,color:RED,fontWeight:700,marginLeft:6}}>🚫</span>}
          </div>
          <div style={{fontSize:10,color:typeColor,fontWeight:700,marginTop:2}}>{typeLabel}</div>
        </div>
        {/* chat icon3d */}
        <button onClick={e=>{ e.stopPropagation(); navTo("chats"); }} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
          <div className="icon3d" style={{width:26,height:26,background:"linear-gradient(145deg,rgba(91,155,255,.35),rgba(37,99,235,.2))",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {ICONS.chat}
          </div>
        </button>
        {/* chevron */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
          style={{transform:expanded?"rotate(180deg)":"none",transition:"transform .22s",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* ── EXPANDED ── */}
      {expanded && (
        <div className="ex" style={{borderTop:`1px solid ${BORDER}`,padding:"12px 12px 14px",display:"flex",flexDirection:"column",gap:11}}>

          {editMode ? (
            <EditForm s={s} onSave={patch=>{ onUpdate(s.id,patch); setEditMode(false); }} onCancel={()=>setEditMode(false)}/>
          ) : (
            <>
              {/* Phone + discount row */}
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,background:BG_DEEP,borderRadius:9,padding:"8px 11px",boxShadow:SI}}>
                  <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Телефон</div>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{s.phone||"—"}</div>
                </div>
                <div style={{width:90,background:BG_DEEP,borderRadius:9,padding:"8px 11px",boxShadow:SI,textAlign:"center"}}>
                  <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Знижка</div>
                  <div style={{fontSize:16,fontWeight:900,color:s.discount>0?GOLD:DIM}}>{s.discount||0}%</div>
                </div>
              </div>

              {/* Type + progress */}
              <div style={{background:BG_DEEP,borderRadius:9,padding:"9px 11px",boxShadow:SI}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:s.type==="school"?9:0}}>
                  <span style={{fontSize:11,fontWeight:800,color:typeColor}}>{typeLabel}</span>
                  {s.type==="school" && <span style={{fontSize:10,color:FAINT}}>· {s.hours}/40 год</span>}
                </div>
                {s.type==="school" && <Progress hours={s.hours}/>}
              </div>

              {/* 6 action buttons 3×2 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
                <Btn icon={ICONS.phone}    label="Дзвонити" onClick={()=>{window.location.href=`tel:${s.phone}`;}}    color={GREEN}/>
                <Btn icon={ICONS.viber}    label="Вайбер"   onClick={()=>{window.location.href=`viber://chat?number=%2B${phone}`;}} color={BLUE}/>
                <Btn icon={ICONS.telegram} label="Телеграм" onClick={()=>{window.open(`https://t.me/+${phone}`,"_blank");}} color="#5b9bff"/>
                <Btn icon={ICONS.chat}     label="Чат"      onClick={()=>navTo("chats")}         color={BLUE}/>
                <Btn icon={ICONS.edit}     label="Редагувати" onClick={()=>setEditMode(true)}/>
                <Btn icon={s.blocked?ICONS.unban:ICONS.ban} label={s.blocked?"Розблок.":"Заблок."} onClick={()=>onBlock(s.id)} danger={!s.blocked}/>
              </div>

              {/* Booking history */}
              {(s.bookings||[]).length > 0 && (
                <div>
                  <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:6}}>Історія записів</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {(s.bookings||[]).map((b,i)=>{
                      const [c,bg] = b.status==="confirmed"?[GREEN,"rgba(126,217,87,.1)"]:b.status==="noshow"?[RED,"rgba(239,68,68,.1)"]:[ACCENT,"rgba(255,90,60,.1)"];
                      const icon = b.status==="confirmed"?"✓":b.status==="noshow"?"✕":"⏳";
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,borderRadius:9,padding:"7px 11px",boxShadow:SO}}>
                          <span style={{fontSize:11,color:DIM,fontWeight:700,minWidth:48}}>{fmtS(b.date)}</span>
                          <span style={{fontSize:11,color:BLUE,fontWeight:700,minWidth:34}}>{b.time}</span>
                          <span style={{flex:1,fontSize:11,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.svc}</span>
                          <span style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:5,background:bg,color:c}}>{icon}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* notes if exist */}
              {s.notes && (
                <div style={{background:BG_DEEP,borderRadius:9,padding:"8px 11px",boxShadow:SI,fontSize:12,color:DIM,lineHeight:1.5}}>
                  📝 {s.notes}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function StudentsView() {
  const [students,   setStudents]   = useState([]);
  const [expanded,   setExpanded]   = useState(new Set());
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all");
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const r = ref(db, "users");
    const handler = onValue(r, snap => {
      const data = snap.val() || {};
      setStudents(Object.entries(data).map(([uid, u]) => {
        const p = u.profile || {};
        return {
          id:       uid,
          name:     p.name      || u.name      || "Учень",
          phone:    p.phone     || u.phone     || "",
          type:     p.type      || u.type      || "private",
          hours:    u.hours     || 0,
          discount: u.discount  || 0,
          notes:    u.notes     || "",
          blocked:  u.blocked   || false,
        };
      }));
      setLoading(false);
    });
    return () => off(r, "value", handler);
  }, []);

  const toggle = id => setExpanded(e => { const n=new Set(e); n.has(id)?n.delete(id):n.add(id); return n; });

  const block = id => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    const next = !s.blocked;
    setStudents(ss => ss.map(x => x.id===id ? {...x, blocked:next} : x));
    update(ref(db, `users/${id}`), { blocked: next }).catch(() => {});
  };

  const updateStudent = (id, patch) => {
    setStudents(ss => ss.map(x => x.id===id ? {...x, ...patch} : x));
    update(ref(db, `users/${id}`), patch).catch(() => {});
  };

  const q = search.toLowerCase();
  const list = students
    .filter(s =>
      (!q || (s.name||"").toLowerCase().includes(q) || (s.phone||"").includes(q)) &&
      (filterType==="all" || s.type===filterType)
    )
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",gap:7,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>


        {/* search */}
        <div style={{background:BG_DEEP,borderRadius:11,boxShadow:SI,padding:"3px 11px",display:"flex",alignItems:"center",gap:7}}>
          {ICONS.search}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ім'я або телефон…"
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,padding:"9px 0",fontSize:13,minWidth:0}}/>
          {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:16,padding:0,lineHeight:1}}>×</button>}
        </div>

        {/* filter pills */}
        <div style={{display:"flex",gap:7}}>
          {[["all","Всі"],["school","Автошкола"],["private","Приватний"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilterType(k)} style={{
              flex:1,padding:"9px 4px",borderRadius:11,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:700,
              background:filterType===k?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
              color:filterType===k?"#fff":DIM,boxShadow:SO,
            }}>{l}</button>
          ))}
        </div>

        {/* list */}
        {list.map(s=>(
          <Card key={s.id} s={s}
            expanded={expanded.has(s.id)}
            onToggle={toggle}
            onBlock={block}
            onUpdate={updateStudent}
          />
        ))}

        {loading && (
          <div style={{textAlign:"center",padding:"40px 20px",color:FAINT,fontSize:13}}>
            <div style={{width:24,height:24,border:`2px solid rgba(255,255,255,0.06)`,borderTopColor:ACCENT,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 10px"}}/>
            Завантаження…
          </div>
        )}
        {!loading && list.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:36,opacity:.3,marginBottom:8}}>👥</div>
            <div style={{fontSize:14,fontWeight:700,color:DIM}}>{search ? "Нікого не знайдено" : "Ще немає учнів"}</div>
          </div>
        )}
      </div>
    </>
  );
}
