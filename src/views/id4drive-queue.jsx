import { useState, useEffect, useRef } from "react";
import { ref, onValue, update, push, remove } from "firebase/database";
import { db } from "../firebase";
import { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, SO, SI } from "../theme.js";

const PURPLE2 = "#c084fc";
const TEAL    = "#2dd4bf";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
.icon3d{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;position:relative;overflow:hidden;flex-shrink:0;box-shadow:-2px 4px 10px rgba(0,0,0,0.5),inset 1px 1px 0 rgba(255,255,255,0.25),inset -1px -1px 0 rgba(0,0,0,0.3)}
.icon3d::before{content:'';position:absolute;top:0;right:0;width:60%;height:50%;background:radial-gradient(ellipse at top right,rgba(255,255,255,0.4) 0%,transparent 70%);pointer-events:none}
.drag-item{transition:transform .12s,box-shadow .12s;touch-action:none}
.drag-item.dragging{opacity:.85;box-shadow:0 16px 40px rgba(0,0,0,0.6),0 0 0 2px ${PURPLE2};z-index:50;transform:scale(1.01)}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fade-in .18s ease both}
@keyframes modal-in{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
.modal-in{animation:modal-in .22s ease both}
`;

const SERVICES = {
  sv1:{ name:"Автошкола 1г", color:GREEN  },
  sv2:{ name:"Автошкола 2г", color:GREEN  },
  sv3:{ name:"Приватний 1г", color:GOLD   },
  sv4:{ name:"Приватний 2г", color:GOLD   },
};

const STATUS_CFG = {
  waiting:  { label:"Очікує",       color:PURPLE2, bg:"rgba(192,132,252,0.15)" },
  offered:  { label:"Запрошено",    color:GOLD,    bg:"rgba(247,201,72,0.15)"  },
  booked:   { label:"Записаний",    color:GREEN,   bg:"rgba(126,217,87,0.15)"  },
  archived: { label:"Архів",        color:FAINT,   bg:"rgba(255,255,255,0.06)" },
};

function fmtWait(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins} хв`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} год` : `${Math.floor(h/24)} дн`;
}

// ─── DRAG REORDER ────────────────────────────────────────────────
function useDragReorder(items, setItems) {
  const dragIdx = useRef(null);
  const overIdx = useRef(null);
  const getHandlers = (idx) => ({
    onPointerDown: (e) => { e.stopPropagation(); dragIdx.current = idx; overIdx.current = idx; },
    onPointerMove: (e) => {
      if (dragIdx.current === null) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el?.closest("[data-drag-idx]");
      if (card) {
        const newIdx = parseInt(card.dataset.dragIdx);
        if (newIdx !== overIdx.current) {
          overIdx.current = newIdx;
          setItems(prev => {
            const arr = [...prev];
            const [moved] = arr.splice(dragIdx.current, 1);
            arr.splice(newIdx, 0, moved);
            dragIdx.current = newIdx;
            return arr;
          });
        }
      }
    },
    onPointerUp: () => { dragIdx.current = null; overIdx.current = null; },
  });
  return { getHandlers };
}

// ─── ADD TO QUEUE MODAL ──────────────────────────────────────────
function AddModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name:"", phone:"", svcId:"sv1", note:"" });
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.name.trim() && form.phone.trim();
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} className="modal-in" style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"20px 18px 36px",
      }}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 16px"}}/>
        <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:18}}>⏳ Додати до черги</div>
        {[
          {k:"name",  label:"Ім'я учня",  placeholder:"Ім'я Прізвище"},
          {k:"phone", label:"Телефон",     placeholder:"+380..."},
        ].map(f=>(
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:5}}>{f.label.toUpperCase()}</div>
            <input value={form[f.k]} onChange={e=>upd(f.k,e.target.value)} placeholder={f.placeholder}
              style={{width:"100%",background:BG_DEEP,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 14px",color:TEXT,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
        ))}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:6}}>ПОСЛУГА</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(SERVICES).map(([id,s])=>(
              <button key={id} onClick={()=>upd("svcId",id)} style={{
                padding:"7px 12px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:form.svcId===id?`linear-gradient(145deg,${s.color}55,${s.color}22)`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                color:form.svcId===id?s.color:DIM,boxShadow:SO,
              }}>{s.name}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:5}}>НОТАТКА</div>
          <input value={form.note} onChange={e=>upd("note",e.target.value)} placeholder="Побажання, зручний час…"
            style={{width:"100%",background:BG_DEEP,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 14px",color:TEXT,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Скасувати</button>
          <button onClick={()=>valid&&onSave(form)} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:valid?"linear-gradient(165deg,#c084fc,#7c3aed)":`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
            color:valid?"#fff":FAINT,
            boxShadow:valid?"0 4px 14px rgba(192,132,252,0.4),inset 1px 1px 0 rgba(255,255,255,0.2)":SO,
          }}>Додати до черги</button>
        </div>
      </div>
    </div>
  );
}

// ─── QUEUE ITEM ROW ──────────────────────────────────────────────
function QueueRow({ item, pos, onInvite, onBooked, onArchive, onDelete, dragHandleProps, isDragging }) {
  const svc = SERVICES[item.svcId] || {};
  const st  = STATUS_CFG[item.status] || STATUS_CFG.waiting;
  const ini = (item.name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  return (
    <div className={`drag-item fade-in ${isDragging?"dragging":""}`} style={{
      background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
      borderRadius:13,marginBottom:8,overflow:"hidden",
      boxShadow:SO,border:`1px solid ${BORDER}`,
    }}>
      {/* main row */}
      <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px"}}>
        <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:st.color,flexShrink:0}}/>
        {/* drag handle */}
        <div {...dragHandleProps} style={{cursor:"grab",touchAction:"none",color:FAINT,fontSize:16,flexShrink:0,lineHeight:1}}>
          ⠿
        </div>
        {/* position badge */}
        <div style={{
          width:22,height:22,borderRadius:6,background:`linear-gradient(145deg,${st.color}44,${st.color}22)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:11,fontWeight:900,color:st.color,flexShrink:0,
        }}>{pos}</div>
        {/* avatar */}
        <div className="icon3d" style={{
          width:34,height:34,borderRadius:10,flexShrink:0,
          background:`linear-gradient(145deg,${PURPLE2}44,${PURPLE2}18)`,
          fontSize:12,fontWeight:900,color:PURPLE2,
        }}>{ini}</div>
        {/* info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:800,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
          <div style={{fontSize:10,color:DIM,marginTop:1}}>
            {item.phone}
            {item.slotKey && <> · <span style={{color:GOLD,fontWeight:700}}>{item.slotKey.replace("_"," ")}</span></>}
            {svc.name && <> · <span style={{color:svc.color}}>{svc.name}</span></>}
            {item.studentType && !svc.name && <> · <span style={{color:TEAL}}>{item.studentType==="school"?"Автошкола":"Приватний"}{item.durationHours ? ` ${item.durationHours}г` : ""}</span></>}
            {item.note && <> · <span style={{color:FAINT,fontStyle:"italic"}}>{item.note}</span></>}
          </div>
        </div>
        {/* wait time */}
        <div style={{fontSize:9,color:FAINT,flexShrink:0,textAlign:"right"}}>
          {fmtWait(item.addedAt)}
        </div>
        {/* status chip */}
        <span style={{background:st.bg,color:st.color,padding:"3px 8px",borderRadius:7,fontSize:10,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>
          {st.label}
        </span>
      </div>

      {/* actions row */}
      {item.status !== "archived" && (
        <div style={{display:"grid",gridTemplateColumns:`repeat(${item.status==="waiting"?4:item.status==="offered"?3:2},1fr)`,borderTop:`1px solid ${BORDER}`}}>
          {item.status === "waiting" && (
            <button onClick={onInvite} style={{padding:"8px 0",border:"none",borderRight:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:PURPLE2,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <div className="icon3d" style={{width:22,height:22,background:"linear-gradient(165deg,#c084fc,#7c3aed)",borderRadius:7}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{position:"relative",zIndex:1}}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </div>
              Запросити
            </button>
          )}
          {(item.status === "waiting" || item.status === "offered") && (
            <button onClick={onBooked} style={{padding:"8px 0",border:"none",borderRight:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:GREEN,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <div className="icon3d" style={{width:22,height:22,background:"linear-gradient(165deg,#9ee07a,#5fb83d)",borderRadius:7}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" style={{position:"relative",zIndex:1}}><polyline points="5 12 10 17 19 8"/></svg>
              </div>
              Записаний
            </button>
          )}
          <button onClick={onArchive} style={{padding:"8px 0",border:"none",borderRight:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:FAINT,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <div className="icon3d" style={{width:22,height:22,background:`linear-gradient(165deg,#5a5e66,#3a3e44)`,borderRadius:7}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{position:"relative",zIndex:1}}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </div>
            Архів
          </button>
          <button onClick={onDelete} style={{padding:"8px 0",border:"none",cursor:"pointer",background:"transparent",color:"rgba(248,113,113,0.8)",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <div className="icon3d" style={{width:22,height:22,background:`linear-gradient(165deg,#f87171,#dc2626)`,borderRadius:7}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{position:"relative",zIndex:1}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            Відмінити
          </button>
        </div>
      )}
      {item.status === "archived" && (
        <div style={{display:"flex",justifyContent:"flex-end",padding:"4px 12px 8px"}}>
          <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",color:RED,fontSize:11,fontWeight:700}}>🗑 Видалити</button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function QueueView({ settings }) {
  const [all,       setAll]       = useState([]);
  const [showAdd,   setShowAdd]   = useState(false);
  const [showArch,  setShowArch]  = useState(false);

  // Firebase sync — підтримує і клієнтську структуру queue/${slotKey}/entries/${uid}
  useEffect(() => {
    return onValue(ref(db, "queue"), snap => {
      const d = snap.val();
      if (!d) { setAll([]); return; }
      const entries = [];
      Object.entries(d).forEach(([key, val]) => {
        if (val?.entries) {
          // Клієнтська структура: queue/${slotKey}/entries/${uid}
          Object.entries(val.entries).forEach(([uid, e]) => {
            entries.push({ id: `${key}/entries/${uid}`, slotKey: key, uid, ...e });
          });
        } else if (val && typeof val === "object" && !Array.isArray(val)) {
          // Стара плоска структура (ручне додавання адміном)
          entries.push({ id: key, ...val });
        }
      });
      entries.sort((a,b) => (a.order ?? a.addedAt ?? 0) - (b.order ?? b.addedAt ?? 0));
      setAll(entries);
    }, ()=>{});
  }, []);

  // drag reorder
  const { getHandlers } = useDragReorder(all, newArr => {
    setAll(newArr);
    newArr.forEach((item,i) => update(ref(db,`queue/${item.id}`),{order:i}));
  });

  const active   = all.filter(q => q.status !== "archived");
  const archived = all.filter(q => q.status === "archived");

  const setStatus = (id, status) => update(ref(db,`queue/${id}`),{status});
  const invite    = id => setStatus(id,"offered");
  const booked    = id => setStatus(id,"booked");
  const archive   = id => setStatus(id,"archived");
  const del       = id => remove(ref(db,`queue/${id}`));
  const add       = form => push(ref(db,"queue"),{...form,addedAt:Date.now(),status:"waiting",order:all.length});

  const queueMode = settings?.queueAutoFifo ? "fifo"
    : settings?.queueBroadcast ? "broadcast" : "manual";

  const waiting  = active.filter(q=>q.status==="waiting").length;
  const offered  = active.filter(q=>q.status==="offered").length;
  const booked_c = active.filter(q=>q.status==="booked").length;

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",gap:10,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── STATS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {label:"Очікують", val:waiting,  c:PURPLE2},
            {label:"Запрошено",val:offered,  c:GOLD},
            {label:"Записані", val:booked_c, c:GREEN},
          ].map(s=>(
            <div key={s.label} style={{background:BG_DEEP,borderRadius:10,boxShadow:SI,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.val}</div>
              <div style={{fontSize:9,color:FAINT,marginTop:2,letterSpacing:0.5}}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* ── MODE BADGE ── */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`linear-gradient(145deg,rgba(192,132,252,0.1),rgba(124,58,237,0.05))`,borderRadius:10,border:`1px solid ${PURPLE2}30`}}>
          <span style={{fontSize:13}}>⚙️</span>
          <span style={{fontSize:12,color:DIM}}>Режим черги:</span>
          <span style={{fontSize:12,fontWeight:800,color:PURPLE2}}>
            {queueMode==="fifo"?"FIFO — перший автоматично":queueMode==="broadcast"?"Broadcast — всім одразу":"Ручний — вибір вручну"}
          </span>
        </div>

        {/* ── ACTIVE QUEUE ── */}
        <div
          onPointerMove={e=>getHandlers(0).onPointerMove(e)}
          onPointerUp={()=>getHandlers(0).onPointerUp()}
        >
          {active.length === 0 ? (
            <div style={{textAlign:"center",padding:"32px 20px",color:FAINT}}>
              <div style={{fontSize:32,marginBottom:8}}>⏳</div>
              <div style={{fontSize:14,fontWeight:700,color:DIM}}>Черга порожня</div>
              <div style={{fontSize:12,marginTop:4}}>Додайте учнів нижче</div>
            </div>
          ) : active.map((item, idx) => (
            <div key={item.id} data-drag-idx={idx}>
              <QueueRow
                item={item}
                pos={idx+1}
                isDragging={false}
                onInvite={()=>invite(item.id)}
                onBooked={()=>booked(item.id)}
                onArchive={()=>archive(item.id)}
                onDelete={()=>del(item.id)}
                dragHandleProps={getHandlers(idx)}
              />
            </div>
          ))}
        </div>

        {/* ── ADD BUTTON ── */}
        <button onClick={()=>setShowAdd(true)} style={{
          width:"100%",padding:"13px",borderRadius:14,border:"none",cursor:"pointer",
          background:"linear-gradient(165deg,#c084fc,#7c3aed)",color:"#fff",
          fontSize:13,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          boxShadow:"0 4px 14px rgba(192,132,252,0.4),inset 1px 1px 0 rgba(255,255,255,0.2)",
        }}>
          <div className="icon3d" style={{width:26,height:26,background:"rgba(255,255,255,0.2)",borderRadius:8}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" style={{position:"relative",zIndex:1}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          Додати до черги
        </button>

        {/* ── ARCHIVE ── */}
        {archived.length > 0 && (
          <div style={{background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,borderRadius:13,overflow:"hidden",boxShadow:SO,border:`1px solid ${BORDER}`}}>
            <div onClick={()=>setShowArch(v=>!v)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
              <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:FAINT,flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,fontWeight:700,color:DIM}}>📦 Архів ({archived.length})</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
                style={{transform:showArch?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            {showArch && (
              <div style={{borderTop:`1px solid ${BORDER}`,padding:"8px 12px"}}>
                {archived.map(item=>(
                  <QueueRow
                    key={item.id} item={item} pos="—" isDragging={false}
                    onInvite={()=>{}} onBooked={()=>{}} onArchive={()=>{}}
                    onDelete={()=>del(item.id)}
                    dragHandleProps={{}}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {showAdd && <AddModal onSave={form=>{add(form);setShowAdd(false);}} onClose={()=>setShowAdd(false)}/>}
    </>
  );
}
