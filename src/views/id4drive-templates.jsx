import { useState, useRef, useContext, useEffect } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import { LangContext } from "../App";
import { createT } from "../lang";

import { ThemeContext, GOLD, GREEN, RED, TEAL, BLUE, PURPLE } from "../theme.js";

// ─── CSS ────────────────────────────────────────────────────────
const makeCSS = (SURF_HI, SURFACE, SURF_LO) => `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
.pillow{background:linear-gradient(155deg,${SURF_HI},${SURFACE});border:1px solid rgba(255,255,255,0.06);border-radius:13px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.35)}
.icon3d{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;position:relative;overflow:hidden;flex-shrink:0;box-shadow:-2px 4px 10px rgba(0,0,0,0.5),inset 1px 1px 0 rgba(255,255,255,0.25),inset -1px -1px 0 rgba(0,0,0,0.3)}
.icon3d::before{content:'';position:absolute;top:0;right:0;width:60%;height:50%;background:radial-gradient(ellipse at top right,rgba(255,255,255,0.4) 0%,transparent 70%);pointer-events:none}
.icon3d>svg{position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))}
.toggle{width:46px;height:26px;border-radius:13px;cursor:pointer;position:relative;transition:background .2s;background:${SURF_LO};box-shadow:inset 2px 2px 5px rgba(0,0,0,0.4)}
.toggle.on{background:linear-gradient(165deg,${GREEN},#5fb83d)}
.toggle-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:linear-gradient(135deg,#fff,#ccc);transition:left .2s;box-shadow:-1px 2px 4px rgba(0,0,0,0.3)}
.toggle.on .toggle-thumb{left:23px}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fade-in .2s ease both}
@keyframes modal-in{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
.modal-in{animation:modal-in .25s ease both}
/* bubble preview */
.bubble-preview{
  background:linear-gradient(135deg,#2a5298,#1e3a6e);
  border-radius:14px 14px 4px 14px;
  padding:10px 14px;
  font-size:13px;color:#fff;line-height:1.5;
  box-shadow:-2px 4px 12px rgba(0,0,0,0.35),inset 1px 1px 0 rgba(255,255,255,0.12);
  position:relative;word-break:break-word;
}
.var-chip{
  display:inline-block;background:rgba(91,155,255,0.25);color:${BLUE};
  border-radius:6px;padding:1px 6px;font-size:12px;font-weight:700;
  border:1px solid rgba(91,155,255,0.35);cursor:pointer;
  transition:background .12s;
}
.var-chip:hover{background:rgba(91,155,255,0.4)}
`;

// ─── DATA ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"reminder",  label:"Нагадування", emoji:"🔔", color:GOLD   },
  { id:"confirm",   label:"Підтвердження",emoji:"✅", color:GREEN  },
  { id:"cancel",    label:"Скасування",  emoji:"❌", color:RED    },
  { id:"welcome",   label:"Вітання",     emoji:"👋", color:TEAL   },
  { id:"queue",     label:"Черга",       emoji:"⏳", color:PURPLE },
  { id:"custom",    label:"Власні",      emoji:"✏️", color:BLUE   },
];

const CHANNELS = [
  { id:"chat",     label:"Чат",      emoji:"💬", color:BLUE   },
  { id:"sms",      label:"SMS",      emoji:"📱", color:GREEN  },
  { id:"viber",    label:"Viber",    emoji:"📲", color:PURPLE },
  { id:"telegram", label:"Telegram", emoji:"✈️", color:"#2AABEE" },
  { id:"push",     label:"Push",     emoji:"🔔", color:GOLD   },
];

const TRIGGERS = [
  { id:"auto_reminder",  label:"Авто: за N год до уроку" },
  { id:"auto_confirm",   label:"Авто: після підтвердження" },
  { id:"auto_cancel",    label:"Авто: після скасування" },
  { id:"auto_welcome",   label:"Авто: при реєстрації" },
  { id:"auto_queue",     label:"Авто: пропозиція з черги" },
  { id:"manual",         label:"Ручна відправка" },
];

const VARS = ["{ім'я}","{дата}","{час}","{послуга}","{ціна}","{ТСЦ}","{інструктор}"];

const INIT_TEMPLATES = [
  { id:"t1", catId:"reminder", title:"Нагадування за 24 год", channel:"push", trigger:"auto_reminder", active:true,
    body:"Привіт, {ім'я}! 🔔 Нагадуємо про урок завтра {дата} о {час}. Чекаємо на тебе! Якщо потрібно перенести — напиши нам." },
  { id:"t2", catId:"reminder", title:"Нагадування за 2 год",  channel:"sms",  trigger:"auto_reminder", active:true,
    body:"ID4Drive: урок сьогодні о {час}. Адреса: Верховинна 44. Інструктор: {інструктор}" },
  { id:"t3", catId:"confirm",  title:"Підтвердження запису",  channel:"chat", trigger:"auto_confirm",  active:true,
    body:"✅ {ім'я}, твій урок підтверджено!\n📅 {дата} о {час}\n🚗 {послуга} — {ціна} ₴\nЧекаємо!" },
  { id:"t4", catId:"cancel",   title:"Скасування букінгу",    channel:"chat", trigger:"auto_cancel",   active:true,
    body:"❌ {ім'я}, на жаль урок {дата} о {час} скасовано. Якщо хочеш записатись на інший час — напиши нам або відкрий додаток." },
  { id:"t5", catId:"welcome",  title:"Вітання нового учня",   channel:"chat", trigger:"auto_welcome",  active:true,
    body:"👋 Привіт, {ім'я}! Раді бачити тебе в ID4Drive!\nЯ — {інструктор}, твій інструктор.\nЗаписуйся на перший урок і побачимось на дорозі! 🚗" },
  { id:"t6", catId:"queue",    title:"Пропозиція вільного слоту", channel:"push", trigger:"auto_queue", active:true,
    body:"⏳ {ім'я}, з'явився вільний урок {дата} о {час}! Підтвердити запис → відкрий додаток." },
  { id:"t7", catId:"custom",   title:"Прохання про відгук",   channel:"sms",  trigger:"manual",        active:true,
    body:"Привіт, {ім'я}! Як пройшов урок {дата}? Буду вдячний за відгук 🙏" },
  { id:"t8", catId:"custom",   title:"Особливі умови",        channel:"chat", trigger:"manual",        active:false,
    body:"Привіт! Для тебе діє спеціальна пропозиція: {послуга} за {ціна} ₴. Діє тільки цього тижня!" },
];

const STUDENTS = ["Марія Коваль","Іван Петренко","Олена Мороз","Дмитро Сало","Юлія Денисюк"];

// ─── HELPERS ────────────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return <span style={{background:bg,color,padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{label}</span>;
}
function Toggle({ on, onChange }) {
  return <div className={`toggle ${on?"on":""}`} onClick={()=>onChange(!on)}><div className="toggle-thumb"/></div>;
}
function Inset({ children, style={} }) {
  const { BG_DEEP, SURF_LO, SI } = useContext(ThemeContext);
  return <div style={{background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,borderRadius:12,boxShadow:SI,padding:"10px 14px",...style}}>{children}</div>;
}
const chOf  = id => CHANNELS.find(c=>c.id===id)||CHANNELS[0];
const catOf = id => CATEGORIES.find(c=>c.id===id)||CATEGORIES[5];
const trigOf= id => TRIGGERS.find(t=>t.id===id)||TRIGGERS[5];

// render body with colored vars
function BodyPreview({ body, style={} }) {
  if (!body) return null;
  const parts = body.split(/(\{[^}]+\})/g);
  return (
    <span style={style}>
      {parts.map((p,i) =>
        p.startsWith("{") && p.endsWith("}")
          ? <span key={i} style={{color:BLUE,fontWeight:700}}>{p}</span>
          : p
      )}
    </span>
  );
}

// ─── SEND MODAL ──────────────────────────────────────────────────
function SendModal({ tpl, onClose }) {
  const { SURFACE, BG, DIM, FAINT, SURF_HI, ACC_HI, ACCENT, SO, TEXT } = useContext(ThemeContext);
  const [selected, setSelected] = useState([]);
  const [channel, setChannel] = useState(tpl.channel);
  const [preview, setPreview] = useState(tpl.body);
  const ch = chOf(channel);

  const toggle = s => setSelected(sel => sel.includes(s) ? sel.filter(x=>x!==s) : [...sel,s]);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} className="modal-in" style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"20px 18px 34px",
        maxHeight:"90vh",overflowY:"auto"
      }}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 18px"}}/>
        <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Надіслати шаблон</div>
        <div style={{fontSize:12,color:DIM,marginBottom:18}}>«{tpl.title}»</div>

        {/* channel select */}
        <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>КАНАЛ</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {CHANNELS.map(c=>(
            <button key={c.id} onClick={()=>setChannel(c.id)} style={{
              padding:"7px 12px",borderRadius:12,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:channel===c.id?`linear-gradient(165deg,${c.color}99,${c.color}55)`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
              color:channel===c.id?c.color:DIM,boxShadow:SO
            }}>{c.emoji} {c.label}</button>
          ))}
        </div>

        {/* students */}
        <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>КОМУ НАДІСЛАТИ</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          <button onClick={()=>setSelected(STUDENTS)} style={{
            padding:"7px 12px",borderRadius:12,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
            background:selected.length===STUDENTS.length?`linear-gradient(165deg,${ACC_HI},${ACCENT})`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
            color:selected.length===STUDENTS.length?"#fff":DIM,boxShadow:SO
          }}>Всі учні</button>
          {STUDENTS.map(s=>(
            <button key={s} onClick={()=>toggle(s)} style={{
              padding:"7px 12px",borderRadius:12,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:selected.includes(s)?`linear-gradient(165deg,${BLUE}99,${BLUE}44)`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
              color:selected.includes(s)?BLUE:DIM,boxShadow:SO
            }}>{s}</button>
          ))}
        </div>

        {/* preview bubble */}
        <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>ПОПЕРЕДНІЙ ПЕРЕГЛЯД</div>
        <div style={{marginBottom:6}}>
          <div style={{fontSize:10,color:ch.color,marginBottom:6,fontWeight:700}}>{ch.emoji} {ch.label}</div>
          <div className="bubble-preview">
            <BodyPreview body={preview}/>
          </div>
        </div>

        {/* editable preview */}
        <Inset style={{marginBottom:18,padding:"10px 14px"}}>
          <div style={{fontSize:9,color:FAINT,letterSpacing:1,marginBottom:6}}>РЕДАГУВАТИ ПЕРЕД ВІДПРАВКОЮ</div>
          <textarea value={preview} onChange={e=>setPreview(e.target.value)} rows={4}
            style={{width:"100%",background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,resize:"none",fontFamily:"inherit",lineHeight:1.5}}/>
        </Inset>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Скасувати</button>
          <button onClick={()=>{ if(selected.length>0){ alert(`✅ Надіслано ${selected.length} учням через ${ch.label}`); onClose(); }}} disabled={selected.length===0} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:selected.length>0?`linear-gradient(165deg,${ACC_HI},${ACCENT})`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
            color:selected.length>0?"#fff":FAINT,
            boxShadow:selected.length>0?`-2px 5px 14px rgba(255,90,60,0.45),inset 1px 1px 0 rgba(255,255,255,0.3)`:SO
          }}>
            {ch.emoji} Надіслати {selected.length>0?`(${selected.length})`:""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT FORM MODAL ─────────────────────────────────────────────
function EditModal({ tpl, onSave, onClose }) {
  const { SURFACE, BG, DIM, FAINT, SURF_HI, ACC_HI, ACCENT, SO, SI, BG_DEEP, SURF_LO, TEXT } = useContext(ThemeContext);
  const isNew = !tpl;
  const [form, setForm] = useState(tpl || {
    id:`t-${Date.now()}`, catId:"custom", title:"", channel:"chat",
    trigger:"manual", active:true, body:""
  });
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const insertVar = v => setForm(f=>({...f, body: f.body + v}));

  const Chip = ({label,active,onClick,color})=>(
    <button onClick={onClick} style={{
      padding:"6px 12px",borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
      background:active?`linear-gradient(165deg,${color||ACC_HI},${color||ACCENT}66)`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
      color:active?(color||ACC_HI):DIM,boxShadow:SO,
      border:active?`1px solid ${color||ACCENT}55`:"1px solid transparent"
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} className="modal-in" style={{
        width:"100%",maxWidth:520,margin:"0 auto",
        background:`linear-gradient(180deg,${SURFACE},${BG})`,
        borderRadius:"24px 24px 0 0",padding:"20px 18px 36px",
        maxHeight:"92vh",overflowY:"auto"
      }}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.12)",margin:"0 auto 18px"}}/>
        <div style={{fontSize:16,fontWeight:800,marginBottom:20}}>{isNew?"Новий шаблон":"Редагування шаблону"}</div>

        {/* title */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:6}}>НАЗВА ШАБЛОНУ</div>
          <Inset style={{padding:"4px 14px"}}>
            <input value={form.title} onChange={e=>upd("title",e.target.value)}
              placeholder="Наприклад: Нагадування за 24 год"
              style={{width:"100%",background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:14,fontWeight:700,padding:"10px 0"}}/>
          </Inset>
        </div>

        {/* category */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>КАТЕГОРІЯ</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {CATEGORIES.map(c=>(
              <Chip key={c.id} label={`${c.emoji} ${c.label}`} active={form.catId===c.id} onClick={()=>upd("catId",c.id)} color={c.color}/>
            ))}
          </div>
        </div>

        {/* channel */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>КАНАЛ</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {CHANNELS.map(c=>(
              <Chip key={c.id} label={`${c.emoji} ${c.label}`} active={form.channel===c.id} onClick={()=>upd("channel",c.id)} color={c.color}/>
            ))}
          </div>
        </div>

        {/* trigger */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>УМОВА ВІДПРАВКИ</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {TRIGGERS.map(t=>(
              <button key={t.id} onClick={()=>upd("trigger",t.id)} style={{
                padding:"10px 14px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left",
                background:form.trigger===t.id?`linear-gradient(135deg,rgba(91,155,255,0.2),rgba(91,155,255,0.08))`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
                color:form.trigger===t.id?BLUE:DIM,fontSize:12,fontWeight:700,
                boxShadow:SO,
                borderLeft:form.trigger===t.id?`3px solid ${BLUE}`:"3px solid transparent"
              }}>
                {t.id==="manual"?"✋":"⚡"} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* body */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:8}}>ТЕКСТ ПОВІДОМЛЕННЯ</div>
          <div style={{fontSize:10,color:FAINT,marginBottom:6}}>Змінні — клікни щоб вставити:</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {VARS.map(v=>(
              <span key={v} className="var-chip" onClick={()=>insertVar(v)}>{v}</span>
            ))}
          </div>
          <Inset style={{padding:"10px 14px"}}>
            <textarea value={form.body} onChange={e=>upd("body",e.target.value)} rows={5}
              placeholder="Текст повідомлення з {ім'я} та {датою}…"
              style={{width:"100%",background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,resize:"none",fontFamily:"inherit",lineHeight:1.5}}/>
          </Inset>
        </div>

        {/* live bubble preview */}
        {form.body.trim() && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:FAINT,letterSpacing:1,marginBottom:6}}>ПОПЕРЕДНІЙ ПЕРЕГЛЯД</div>
            <div className="bubble-preview"><BodyPreview body={form.body}/></div>
          </div>
        )}

        {/* active */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,padding:"12px 14px",background:`linear-gradient(135deg,${BG_DEEP},${SURF_LO})`,borderRadius:12,boxShadow:SI}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Активний шаблон</div>
            <div style={{fontSize:11,color:DIM,marginTop:2}}>Вимкнений шаблон не відправляється автоматично</div>
          </div>
          <Toggle on={form.active} onChange={v=>upd("active",v)}/>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,color:DIM,fontSize:13,fontWeight:700,boxShadow:SO}}>Скасувати</button>
          <button onClick={()=>{if((form.title||'').trim()&&(form.body||'').trim())onSave(form);}} style={{
            flex:2,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:(form.title||'').trim()&&(form.body||'').trim()?`linear-gradient(165deg,${ACC_HI},${ACCENT})`:`linear-gradient(135deg,${SURF_HI},${SURFACE})`,
            color:(form.title||'').trim()&&(form.body||'').trim()?"#fff":FAINT,
            boxShadow:(form.title||'').trim()&&(form.body||'').trim()?`-2px 5px 14px rgba(255,90,60,0.45),inset 1px 1px 0 rgba(255,255,255,0.3)`:SO
          }}>{isNew?"Створити":"Зберегти"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE CARD ───────────────────────────────────────────────
function TemplateCard({ tpl, onEdit, onSend, onToggle, onDelete, viewMode }) {
  const { SURF_HI, SURFACE, SO, TEXT, DIM, FAINT, BORDER, ACCENT } = useContext(ThemeContext);
  const [expanded, setExpanded] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [inlineBody, setInlineBody] = useState(tpl.body);

  const cat = catOf(tpl.catId);
  const ch  = chOf(tpl.channel);
  const tr  = trigOf(tpl.trigger);

  const handlePointerDown = () => {
    const t = setTimeout(()=>{ onEdit(tpl); }, 600);
    setLongPressTimer(t);
  };
  const handlePointerUp = () => {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null); }
  };

  if (viewMode === "rows") {
    return (
      <div className="fade-in" style={{
        display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
        background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
        borderRadius:10,marginBottom:4,boxShadow:SO,
        opacity:tpl.active?1:0.5,
        borderLeft:`3px solid ${cat.color}`,
      }}>
        <span style={{fontSize:17,flexShrink:0,lineHeight:1,width:22,textAlign:"center"}}>{cat.emoji}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tpl.title}</div>
          <div style={{fontSize:10,color:DIM,marginTop:1,display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:ch.color,fontWeight:600}}>{ch.emoji} {ch.label}</span>
            <span style={{color:FAINT}}>·</span>
            <span style={{color:tpl.trigger==="manual"?DIM:GOLD}}>{tpl.trigger==="manual"?"✋":"⚡"}</span>
          </div>
        </div>
        <Toggle on={tpl.active} onChange={v=>onToggle(tpl.id,v)}/>
        {[
          {grad:`linear-gradient(165deg,${ACC_HI},${ACCENT})`, fn:()=>onSend(tpl),
            svg:<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>},
          {grad:"linear-gradient(165deg,#a78bfa,#6d28d9)", fn:()=>onEdit(tpl),
            svg:<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>},
          {grad:"linear-gradient(165deg,#f87171,#dc2626)", fn:()=>onDelete(tpl.id),
            svg:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>},
        ].map((b,i)=>(
          <button key={i} onClick={b.fn} style={{background:"none",border:"none",cursor:"pointer",padding:"0 2px",flexShrink:0}}>
            <div className="icon3d" style={{width:24,height:24,background:b.grad,borderRadius:7}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{position:"relative",zIndex:1}}>{b.svg}</svg>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // CARD MODE
  return (
    <div
      className="pillow fade-in"
      style={{marginBottom:10,opacity:tpl.active?1:0.6,overflow:"visible"}}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ROW 1: emoji·title·toggle·chevron */}
      <div onClick={e=>{e.stopPropagation();setExpanded(v=>!v);}}
        style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}>
        <div style={{
          width:36,height:36,borderRadius:11,flexShrink:0,
          background:`linear-gradient(155deg,${cat.color}99,${cat.color}33)`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
        }}>{cat.emoji}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:800,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{tpl.title}</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            <Pill label={`${ch.emoji} ${ch.label}`} color={ch.color} bg={`${ch.color}22`}/>
            <Pill label={tpl.trigger==="manual"?"✋ Ручна":"⚡ Авто"} color={tpl.trigger==="manual"?DIM:GOLD} bg={tpl.trigger==="manual"?"rgba(255,255,255,0.05)":"rgba(247,201,72,0.12)"}/>
          </div>
        </div>
        <Toggle on={tpl.active} onChange={v=>{v||null; onToggle(tpl.id,v);}}/>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
          style={{transform:expanded?"rotate(180deg)":"none",transition:"transform .22s",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {expanded && (
        <>
          {/* ROW 2: body */}
          <div style={{borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`,padding:"10px 14px"}}>
            {inlineEdit ? (
              <textarea autoFocus value={inlineBody} onChange={e=>setInlineBody(e.target.value)}
                onBlur={()=>setInlineEdit(false)} onClick={e=>e.stopPropagation()} rows={3}
                style={{width:"100%",background:"transparent",border:"none",outline:"none",color:TEXT,fontSize:13,resize:"none",fontFamily:"inherit",lineHeight:1.5}}/>
            ) : (
              <div onClick={e=>{e.stopPropagation();setInlineEdit(true);}} style={{cursor:"text"}}>
                <div style={{fontSize:13,color:DIM,lineHeight:1.5,marginBottom:4}}><BodyPreview body={tpl.body}/></div>
                <div style={{fontSize:10,color:FAINT,fontStyle:"italic"}}>Клік — редагувати · Утримати — повна форма</div>
              </div>
            )}
          </div>

          {/* ROW 3: actions */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
            <button onClick={e=>{e.stopPropagation();onSend(tpl);}} style={{padding:"11px 0",border:"none",borderRight:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:ACCENT,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,borderRadius:"0 0 0 13px"}}>➤ Надіслати</button>
            <button onClick={e=>{e.stopPropagation();onEdit(tpl);}} style={{padding:"11px 0",border:"none",borderRight:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:BLUE,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>✏️ Редагувати</button>
            <button onClick={e=>{e.stopPropagation();onDelete(tpl.id);}} style={{padding:"11px 0",border:"none",cursor:"pointer",background:"transparent",color:RED,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,borderRadius:"0 0 13px 0"}}>🗑 Видалити</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function TemplatesView() {
  const { TEXT, FAINT, ACC_HI, ACCENT, SURF_HI, SURFACE, SURF_LO } = useContext(ThemeContext);
  const css = makeCSS(SURF_HI, SURFACE, SURF_LO);
  const lang = useContext(LangContext);
  const t = createT(lang);
  const [templates, setTemplates] = useState(INIT_TEMPLATES);
  const [loaded, setLoaded] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [sendTpl, setSendTpl] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    get(ref(db, 'admin_data/templates')).then(snap => {
      const d = snap.val();
      if (Array.isArray(d)) setTemplates(d);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      set(ref(db, 'admin_data/templates'), templates).catch(() => {});
    }, 800);
  }, [templates, loaded]);

  const onSave = (form) => {
    setTemplates(ts=>{
      const idx = ts.findIndex(t=>t.id===form.id);
      if(idx>=0){const n=[...ts];n[idx]=form;return n;}
      return [...ts,form];
    });
    setEditTpl(null);
  };
  const onToggle = (id,v) => setTemplates(ts=>ts.map(t=>t.id===id?{...t,active:v}:t));
  const onDelete = (id)   => setTemplates(ts=>ts.filter(t=>t.id!==id));

  const list = templates;

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",flexDirection:"column",gap:0,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── LIST ── */}
        {list.filter(Boolean).map(tpl=>(
          <TemplateCard
            key={tpl.id} tpl={tpl} viewMode="rows"
            onEdit={setEditTpl} onSend={setSendTpl}
            onToggle={onToggle} onDelete={onDelete}
          />
        ))}

        {list.length===0 && (
          <div style={{textAlign:"center",padding:"40px 20px",color:FAINT}}>
            <div style={{fontSize:32,marginBottom:10}}>📝</div>
            <div style={{fontSize:14,fontWeight:700}}>Шаблонів не знайдено</div>
          </div>
        )}

        {/* ── ADD ── */}
        <button onClick={()=>setEditTpl(false)} style={{
          width:"100%",padding:"14px",borderRadius:16,border:"none",cursor:"pointer",
          background:`linear-gradient(165deg,${ACC_HI},${ACCENT})`,color:"#fff",fontSize:13,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          boxShadow:`-2px 5px 14px rgba(255,90,60,0.45),inset 1px 1px 0 rgba(255,255,255,0.3)`,marginTop:4
        }}>
          <div className="icon3d" style={{width:28,height:28,background:"rgba(255,255,255,0.2)",borderRadius:8}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" style={{position:"relative",zIndex:1}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          Новий шаблон
        </button>

      </div>

      {editTpl !== null && <EditModal tpl={editTpl||null} onSave={onSave} onClose={()=>setEditTpl(null)}/>}
      {sendTpl && <SendModal tpl={sendTpl} onClose={()=>setSendTpl(null)}/>}
    </>
  );
}
