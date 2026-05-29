import { useState, useRef, useEffect, useContext } from "react";
import { LangContext } from "../App";
import { createT } from "../lang";

import { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, SO, SI } from "../theme.js";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}

.bubble-out{
  background:linear-gradient(135deg,#2a5298,#1a3a70);
  border-radius:16px 16px 3px 16px;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
}
.bubble-in{
  background:linear-gradient(135deg,${SURF_HI},${SURFACE});
  border-radius:16px 16px 16px 3px;
  box-shadow:0 2px 8px rgba(0,0,0,0.25);
}
.bubble-sys{
  background:rgba(255,255,255,0.04);
  border-radius:10px;
  border:1px solid ${BORDER};
}

.chat-row{cursor:pointer;transition:background .12s;user-select:none}
.chat-row:active{background:rgba(255,255,255,0.03)}
.chat-row.open{background:linear-gradient(135deg,rgba(91,155,255,0.1),rgba(91,155,255,0.04))}

.msg-input{background:transparent;border:none;outline:none;color:${TEXT};font-size:13px;resize:none;font-family:inherit;flex:1;padding:0;line-height:1.4;max-height:80px;overflow-y:auto}

@keyframes drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.drop{animation:drop .18s ease both}

@keyframes msg-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.msg-in{animation:msg-in .15s ease both}
`;

// ─── DATA ────────────────────────────────────────────────────────
const CONTACTS = [
  { id:"c1", name:"Марія Коваль",   phone:"+380671234567", hue:160, unread:2, online:true,
    lastMsg:"Дякую! До зустрічі", lastTime:"15:30",
    messages:[
      {id:"m1",from:"student",  text:"Доброго дня! Коли наступний урок?",             time:"10:00"},
      {id:"m2",from:"me",       text:"Привіт! Завтра о 10:00 — підтверджую 👍",       time:"10:02"},
      {id:"m3",from:"student",  text:"Чудово! Чи можна взяти 2 год?",                time:"10:05"},
      {id:"m4",from:"me",       text:"Так, 2 год вільно. Записую 10:00–12:00",        time:"10:06"},
      {id:"m5",from:"student",  text:"Дякую! До зустрічі",                           time:"15:30"},
    ]
  },
  { id:"c2", name:"Іван Петренко",  phone:"+380509876543", hue:220, unread:3, online:false,
    lastMsg:"Можна перенести на п'ятницю?", lastTime:"13:15",
    messages:[
      {id:"m1",from:"student",  text:"Доброго ранку",                                time:"09:00"},
      {id:"m2",from:"me",       text:"Доброго! Чим можу допомогти?",                 time:"09:05"},
      {id:"m3",from:"student",  text:"Можна перенести на п'ятницю?",                 time:"13:15"},
      {id:"m4",from:"student",  text:"О 14:00 якщо є місце",                         time:"13:16"},
    ]
  },
  { id:"c3", name:"Олена Мороз",    phone:"+380631112233", hue:30,  unread:0, online:false,
    lastMsg:"Ок, зрозуміла 👌", lastTime:"вчора",
    messages:[
      {id:"m1",from:"me",       text:"Нагадую: урок завтра о 9:00",                  time:"вчора"},
      {id:"m2",from:"student",  text:"Ок, зрозуміла 👌",                             time:"вчора"},
    ]
  },
  { id:"c4", name:"Дмитро Сало",    phone:"+380961234567", hue:280, unread:1, online:true,
    lastMsg:"Пришли рахунок",         lastTime:"14:00",
    messages:[
      {id:"m1",from:"student",  text:"Привіт, коли оплачувати?",                     time:"13:50"},
      {id:"m2",from:"me",       text:"Можна на місці або на картку 💳",              time:"13:55"},
      {id:"m3",from:"student",  text:"Пришли рахунок",                               time:"14:00"},
    ]
  },
  { id:"c5", name:"Юлія Денисюк",   phone:"+380935023739", hue:340, unread:0, online:true,
    lastMsg:"Супер, чекаю! 🎉",       lastTime:"12:00",
    messages:[
      {id:"m1",from:"me",       text:"Юліє, завтра перший урок! Зустрічаємось о 15:00", time:"12:00"},
      {id:"m2",from:"student",  text:"Супер, чекаю! 🎉",                             time:"12:01"},
    ]
  },
];

const QUICK = ["Підтверджую урок ✅","Урок скасовано ❌","Нагадую: завтра","Будь ласка, підтвердіть","До зустрічі 👋"];

// ─── HELPERS ────────────────────────────────────────────────────
const Ava = ({ name, hue, size=36, online }) => {
  const ini = name.split(" ").map(w=>w[0]).slice(0,2).join("");
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <div style={{
        width:size,height:size,borderRadius:size/2,
        background:`linear-gradient(145deg,hsl(${hue},60%,44%),hsl(${(hue+35)%360},70%,28%))`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:size*.3,fontWeight:800,color:"#fff",
        boxShadow:`0 2px 8px hsla(${hue},50%,30%,.5)`,
      }}>{ini}</div>
      {online && <div style={{position:"absolute",bottom:1,right:1,width:9,height:9,borderRadius:5,background:GREEN,border:`2px solid ${BG}`}}/>}
    </div>
  );
};

// ─── CONVERSATION ────────────────────────────────────────────────
function Conversation({ contact, onSend }) {
  const [msgs,  setMsgs]  = useState(contact.messages);
  const [text,  setText]  = useState("");
  const [quick, setQuick] = useState(false);
  const bottomRef = useRef(null);
  const taRef     = useRef(null);

  // re-init when contact changes
  useEffect(() => { setMsgs(contact.messages); setText(""); }, [contact.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);

  const send = () => {
    if (!text.trim()) return;
    const m = { id:`m${Date.now()}`, from:"me", text:text.trim(), time:new Date().toLocaleTimeString("uk",{hour:"2-digit",minute:"2-digit"}) };
    setMsgs(ms=>[...ms,m]);
    onSend(contact.id, m);
    setText("");
    taRef.current?.focus();
  };

  return (
    <div className="drop" style={{display:"flex",flexDirection:"column",borderTop:`1px solid ${BORDER}`,background:BG_DEEP}}>

      {/* messages */}
      <div style={{height:280,overflowY:"auto",padding:"10px 0",display:"flex",flexDirection:"column",gap:3}}>
        {msgs.map(m => {
          if (m.type==="sys") return (
            <div key={m.id} style={{display:"flex",justifyContent:"center",padding:"2px 0"}}>
              <span className="bubble-sys msg-in" style={{padding:"4px 12px",fontSize:10,color:DIM}}>{m.text}</span>
            </div>
          );
          const isMe = m.from==="me";
          return (
            <div key={m.id} className="msg-in" style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",padding:"1px 10px"}}>
              <div className={isMe?"bubble-out":"bubble-in"} style={{maxWidth:"72%",padding:"8px 12px"}}>
                <div style={{fontSize:13,color:isMe?"#fff":TEXT,lineHeight:1.4,wordBreak:"break-word"}}>{m.text}</div>
                <div style={{fontSize:9,color:isMe?"rgba(255,255,255,0.5)":FAINT,marginTop:3,textAlign:"right"}}>{m.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* quick replies */}
      {quick && (
        <div style={{display:"flex",gap:6,padding:"6px 10px",overflowX:"auto",borderTop:`1px solid ${BORDER}`}}>
          {QUICK.map((q,i)=>(
            <button key={i} onClick={()=>{setText(q);setQuick(false);taRef.current?.focus();}} style={{
              background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
              border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",
              color:DIM,fontSize:11,fontWeight:600,whiteSpace:"nowrap",boxShadow:SO,
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{padding:"8px 10px",borderTop:`1px solid ${BORDER}`,background:SURF_LO,display:"flex",alignItems:"flex-end",gap:7}}>
        <button onClick={()=>setQuick(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",color:quick?GOLD:FAINT,fontSize:16,padding:"4px",flexShrink:0}}>⚡</button>
        <div style={{flex:1,background:BG_DEEP,borderRadius:11,boxShadow:SI,padding:"8px 12px",display:"flex",alignItems:"flex-end",gap:8}}>
          <textarea ref={taRef} className="msg-input" value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Повідомлення…" rows={1}/>
          <button onClick={send} disabled={!text.trim()} style={{
            width:32,height:32,borderRadius:8,border:"none",flexShrink:0,
            cursor:text.trim()?"pointer":"default",
            background:text.trim()?`linear-gradient(145deg,${ACC_HI},${ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:text.trim()?`0 3px 10px rgba(255,90,60,0.4)`:SO,
            transition:"all .15s",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function ChatsView() {
  const lang = useContext(LangContext);
  const t = createT(lang);
  const [contacts, setContacts] = useState(CONTACTS);
  const [openId,   setOpenId]   = useState(null);
  const [search,   setSearch]   = useState("");

  const toggle = id => {
    setOpenId(prev => prev===id ? null : id);
    setContacts(cs => cs.map(c => c.id===id ? {...c, unread:0} : c));
  };

  const handleSend = (contactId, msg) => {
    setContacts(cs => cs.map(c => c.id===contactId
      ? {...c, lastMsg:msg.text, lastTime:msg.time, messages:[...c.messages, msg]}
      : c
    ));
  };

  const filtered = contacts.filter(c =>
    (c.name||"").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone||"").includes(search)
  );

  const totalUnread = contacts.reduce((s,c)=>s+c.unread, 0);

  return (
    <>
      <style>{CSS}</style>
      <div style={{fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── SEARCH ── */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
          <div style={{flex:1,background:BG_DEEP,borderRadius:11,boxShadow:SI,padding:"4px 11px",display:"flex",alignItems:"center",gap:7}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('ch.search_ph')}
              style={{flex:1,background:"transparent",border:"none",outline:"none",color:TEXT,padding:"8px 0",fontSize:13}}/>
            {search && <button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:FAINT,fontSize:16,padding:0,lineHeight:1}}>×</button>}
          </div>
          {totalUnread>0 && (
            <div style={{background:ACCENT,color:"#fff",borderRadius:10,padding:"3px 9px",fontSize:11,fontWeight:800,flexShrink:0,boxShadow:`0 0 8px ${ACCENT}66`}}>
              {totalUnread}
            </div>
          )}
        </div>

        {/* ── ACCORDION LIST ── */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filtered.map(c => {
            const isOpen = openId === c.id;
            const ini = c.name.split(" ").map(w=>w[0]).slice(0,2).join("");
            return (
              <div key={c.id} style={{
                background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
                borderRadius:13,
                overflow:"hidden",
                boxShadow:SO, border:`1px solid ${isOpen?`rgba(91,155,255,0.25)`:BORDER}`,
              }}>
                {/* ── contact row ── */}
                <div className={`chat-row${isOpen?" open":""}`}
                  onClick={()=>toggle(c.id)}
                  style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px"}}
                >
                  {/* left bar */}
                  <div style={{width:4,alignSelf:"stretch",borderRadius:3,background:`hsl(${c.hue},60%,55%)`,flexShrink:0}}/>
                  <Ava name={c.name} hue={c.hue} size={36} online={c.online}/>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:13,fontWeight:800,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                      {c.online && <span style={{fontSize:9,color:GREEN,fontWeight:700}}>●</span>}
                    </div>
                    <div style={{fontSize:11,color:DIM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.lastMsg}</div>
                  </div>

                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <span style={{fontSize:10,color:FAINT}}>{c.lastTime}</span>
                    {c.unread>0
                      ? <span style={{background:ACCENT,color:"#fff",borderRadius:9,padding:"1px 6px",fontSize:10,fontWeight:800,boxShadow:`0 0 6px ${ACCENT}55`}}>{c.unread}</span>
                      : <span style={{width:8,height:8,borderRadius:4,background:BORDER,display:"inline-block"}}/>
                    }
                  </div>

                  {/* chevron */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round"
                    style={{flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .22s"}}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* ── conversation (drops below) ── */}
                {isOpen && (
                  <Conversation
                    key={c.id}
                    contact={{...c, messages: c.messages}}
                    onSend={handleSend}
                  />
                )}
              </div>
            );
          })}

          {filtered.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:36,opacity:.3,marginBottom:8}}>💬</div>
              <div style={{fontSize:14,fontWeight:700,color:DIM}}>Нікого не знайдено</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
