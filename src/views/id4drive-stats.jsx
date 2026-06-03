import { useState, useContext } from "react";
import { LangContext } from "../App";
import { createT } from "../lang";

import { BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, SO, SI } from "../theme.js";

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
@keyframes bar-grow{from{height:0%}to{height:var(--h)}}
@keyframes line-draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
.line-anim{animation:line-draw 1s ease both}
@keyframes fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fade-up .2s ease both}
`;

// ─── DATA ────────────────────────────────────────────────────────
const DATA_WEEK = [
  {label:"Пн",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
  {label:"Вт",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
  {label:"Ср",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
  {label:"Чт",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
  {label:"Пт",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
  {label:"Сб",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0},
];
const DATA_MONTH = [
  {label:"Лют",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0,newStudents:0},
  {label:"Бер",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0,newStudents:0},
  {label:"Кві",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0,newStudents:0},
  {label:"Тра",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0,newStudents:0},
  {label:"Чер",income:0,lessons:0,school:0,private:0,noshow:0,cancel:0,newStudents:0},
];
const DATA_YEAR = ["Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру","Січ"].map(l=>({
  label:l, income:0, lessons:0, school:0, private:0, noshow:0, cancel:0,
}));
const TOP_STUDENTS = [];

// ─── HELPERS ────────────────────────────────────────────────────
const fmtK = n => n>=1000?`${(n/1000).toFixed(1)}к ₴`:`${n} ₴`;
const fmt  = n => n>=1000?`${(n/1000).toFixed(1)}к`:String(n);

// Card container
const Card = ({children, style={}}) => (
  <div className="fu" style={{
    background:`linear-gradient(155deg,${SURF_HI},${SURFACE})`,
    borderRadius:13,overflow:"hidden",
    boxShadow:`0 2px 8px rgba(0,0,0,.35),0 0 0 1px ${BORDER}`,
    ...style,
  }}>{children}</div>
);

// Inset background
const Inset = ({children,style={}}) => (
  <div style={{background:BG_DEEP,borderRadius:10,boxShadow:SI,...style}}>{children}</div>
);

// ─── SVG LINE CHART ─────────────────────────────────────────────
function LineChart({ data, valueKey, color, height=120 }) {
  const W=320,H=height,P=12;
  const vals = data.map(d=>d[valueKey]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const range = max-min||1;
  const pts = vals.map((v,i)=>({
    x: P+(i/(vals.length-1))*(W-P*2),
    y: H-P-((v-min)/range)*(H-P*2-10),
  }));
  const path = pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length-1].x},${H-P} L${pts[0].x},${H-P} Z`;
  const len  = pts.reduce((s,p,i)=>i===0?0:s+Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y),0);
  const gid  = `g${color.replace(/[^a-z0-9]/gi,"")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28"/>
          <stop offset="100%" stopColor={color} stopOpacity=".01"/>
        </linearGradient>
      </defs>
      {[0,.25,.5,.75,1].map(t=>(
        <line key={t} x1={P} y1={P+(1-t)*(H-P*2-10)} x2={W-P} y2={P+(1-t)*(H-P*2-10)} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
      ))}
      <path d={area} fill={`url(#${gid})`}/>
      <path className="line-anim" d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{"--len":len,strokeDasharray:len}}/>
      {pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} style={{filter:`drop-shadow(0 0 4px ${color}88)`}}/>
      ))}
      {data.map((d,i)=>(
        <text key={i} x={pts[i].x} y={H} textAnchor="middle" fill={FAINT} fontSize="9" fontWeight="700">{d.label}</text>
      ))}
    </svg>
  );
}

// ─── SVG BAR CHART ───────────────────────────────────────────────
function BarChart({ data, valueKey, color, height=120 }) {
  const W=320,H=height,P=12;
  const vals = data.map(d=>d[valueKey]);
  const max  = Math.max(...vals)||1;
  const gap  = (W-P*2)/data.length;
  const bW   = gap*.6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{overflow:"visible"}}>
      <defs>
        {data.map((_,i)=>(
          <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".85"/>
            <stop offset="100%" stopColor={color} stopOpacity=".35"/>
          </linearGradient>
        ))}
      </defs>
      {[0,.5,1].map(t=>(
        <line key={t} x1={P} y1={P+(1-t)*(H-P*2-10)} x2={W-P} y2={P+(1-t)*(H-P*2-10)} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
      ))}
      {data.map((d,i)=>{
        const bH = ((d[valueKey]||0)/max)*(H-P*2-10);
        const x  = P+i*gap+gap*.2;
        const y  = H-P-10-bH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={bH} rx="4" fill={`url(#bg${i})`}
              style={{filter:`drop-shadow(0 2px 5px ${color}44)`}}/>
            <text x={x+bW/2} y={H} textAnchor="middle" fill={FAINT} fontSize="9" fontWeight="700">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── DONUT ───────────────────────────────────────────────────────
function Donut({ school, total, size=76 }) {
  const pct = total?school/total:0;
  const r=26,cx=size/2,cy=size/2,c=2*Math.PI*r;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={SURF_HI} strokeWidth="9"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={GREEN} strokeWidth="9"
        strokeDasharray={`${pct*c} ${c}`} strokeDashoffset={c*.25} strokeLinecap="round"
        style={{filter:`drop-shadow(0 0 5px ${GREEN}66)`}}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={GOLD} strokeWidth="9"
        strokeDasharray={`${(1-pct)*c} ${c}`} strokeDashoffset={-(pct*c-c*.25)} strokeLinecap="round"
        style={{filter:`drop-shadow(0 0 5px ${GOLD}66)`}}/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={TEXT} fontSize="12" fontWeight="800">{Math.round(pct*100)}%</text>
    </svg>
  );
}

// ─── CHIP ────────────────────────────────────────────────────────
const Chip = ({label,active,onClick,color}) => (
  <button onClick={onClick} style={{
    padding:"6px 12px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0,
    background:active?`linear-gradient(145deg,${color||ACC_HI},${color?color+"bb":ACCENT})`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
    color:active?"#fff":DIM, boxShadow:active?"none":SO,
  }}>{label}</button>
);

// ─── MAIN ────────────────────────────────────────────────────────
export default function StatsView() {
  const lang = useContext(LangContext);
  const t = createT(lang);
  const [period,    setPeriod]    = useState("month");
  const [chartType, setChartType] = useState("line");
  const [metric,    setMetric]    = useState("income");

  const data = period==="week"?DATA_WEEK:period==="year"?DATA_YEAR:DATA_MONTH;

  const totalIncome  = data.reduce((s,d)=>s+d.income,0);
  const totalLessons = data.reduce((s,d)=>s+d.lessons,0);
  const totalSchool  = data.reduce((s,d)=>s+d.school,0);
  const totalPrivate = data.reduce((s,d)=>s+d.private,0);
  const totalNoshow  = data.reduce((s,d)=>s+(d.noshow||0),0);
  const totalCancel  = data.reduce((s,d)=>s+(d.cancel||0),0);
  const avgCheck     = totalLessons?Math.round(totalIncome/totalLessons):0;
  const noshowPct    = totalLessons?Math.round((totalNoshow/totalLessons)*100):0;

  const METRICS = [
    {id:"income", label:t('income')+' ₴', color:GOLD},
    {id:"lessons",label:t('lessons'),     color:BLUE},
    {id:"school", label:t('school'),      color:GREEN},
    {id:"private",label:t('private'),     color:PURPLE},
  ];
  const cur = METRICS.find(m=>m.id===metric);

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",gap:8,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── PERIOD ── */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {[["week",t('st2.week')],["month",t('st2.month')],["year",t('st2.year')]].map(([k,l])=>(
            <Chip key={k} label={l} active={period===k} onClick={()=>setPeriod(k)}/>
          ))}
        </div>

        {/* ── KPI 2×2 ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {[
            {label:"Дохід",        value:fmtK(totalIncome),  sub:"за період",       color:GOLD,   trend:+12},
            {label:"Уроків",       value:totalLessons,        sub:`${totalSchool}а · ${totalPrivate}п`, color:BLUE,  trend:+8},
            {label:"Серед. чек",   value:fmtK(avgCheck),      sub:"дохід / урок",    color:GREEN,  trend:+3},
            {label:"No-show",      value:`${noshowPct}%`,     sub:`скасувань: ${totalCancel}`, color:noshowPct>5?RED:DIM, trend:-2},
          ].map((k,i)=>(
            <Card key={i} style={{padding:"12px 13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>{k.label}</div>
                <span style={{
                  fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:6,
                  color:k.trend>=0?GREEN:RED,
                  background:k.trend>=0?"rgba(126,217,87,0.12)":"rgba(239,68,68,0.12)",
                }}>{k.trend>=0?"+":""}{k.trend}%</span>
              </div>
              <div style={{fontSize:22,fontWeight:900,color:k.color,letterSpacing:-0.5,marginBottom:2}}>{k.value}</div>
              <div style={{fontSize:10,color:FAINT}}>{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* ── CHART ── */}
        <Card style={{padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:13,fontWeight:800,color:TEXT}}>Динаміка</span>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {METRICS.map(m=>(
                <button key={m.id} onClick={()=>setMetric(m.id)} style={{
                  padding:"4px 8px",borderRadius:7,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                  background:metric===m.id?`${m.color}22`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                  color:metric===m.id?m.color:FAINT,boxShadow:SO,
                }}>{m.label}</button>
              ))}
              <button onClick={()=>setChartType(t=>t==="line"?"bar":"line")} style={{
                padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,
                background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,color:DIM,boxShadow:SO,
              }}>{chartType==="line"?"📊":"📈"}</button>
            </div>
          </div>
          <Inset style={{padding:"10px 8px 4px"}}>
            {chartType==="line"
              ? <LineChart data={data} valueKey={metric} color={cur.color} height={120}/>
              : <BarChart  data={data} valueKey={metric} color={cur.color} height={120}/>
            }
          </Inset>
          <div style={{display:"flex",gap:14,marginTop:9,justifyContent:"center",flexWrap:"wrap"}}>
            {METRICS.map(m=>(
              <div key={m.id} onClick={()=>setMetric(m.id)} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{
                  width:7,height:7,borderRadius:4,background:m.color,
                  boxShadow:`0 0 5px ${m.color}88`,
                  transform:metric===m.id?"scale(1.5)":"scale(1)",transition:"transform .15s",
                }}/>
                <span style={{fontSize:10,color:metric===m.id?m.color:FAINT,fontWeight:700}}>{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── РОЗПОДІЛ + ЗАВАНТАЖЕННЯ ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>

          <Card style={{padding:"12px"}}>
            <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:9}}>Розподіл</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Donut school={totalSchool} total={totalSchool+totalPrivate}/>
              <div style={{flex:1}}>
                {[[GREEN,"Автошкола",totalSchool],[GOLD,"Приватний",totalPrivate]].map(([c,l,v])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                    <div style={{width:7,height:7,borderRadius:4,background:c,flexShrink:0}}/>
                    <span style={{fontSize:10,color:DIM,flex:1}}>{l}</span>
                    <span style={{fontSize:12,fontWeight:800,color:c}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card style={{padding:"12px"}}>
            <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:9}}>По днях</div>
            {DATA_WEEK.map((d,i)=>{
              const pct = d.lessons/Math.max(...DATA_WEEK.map(x=>x.lessons));
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,color:FAINT,fontWeight:700,width:16,textAlign:"right",flexShrink:0}}>{d.label}</span>
                  <div style={{flex:1,height:5,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,background:`linear-gradient(90deg,${BLUE},${PURPLE})`,transition:"width .5s ease"}}/>
                  </div>
                  <span style={{fontSize:9,color:DIM,fontWeight:700,width:12,flexShrink:0}}>{d.lessons}</span>
                </div>
              );
            })}
          </Card>
        </div>

        {/* ── ТОП-5 ── */}
        <Card style={{padding:"12px 13px 8px"}}>
          <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Топ-5 учнів</div>
          {TOP_STUDENTS.map((s,i)=>{
            const maxH = TOP_STUDENTS[0].hours;
            const medals = [GOLD,"#94a3b8","#fb923c"];
            return (
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:9,
                padding:"9px 0",
                borderBottom:i<TOP_STUDENTS.length-1?`1px solid ${BORDER}`:"none",
              }}>
                <div style={{
                  width:24,height:24,borderRadius:7,flexShrink:0,
                  background:i<3?`linear-gradient(145deg,${medals[i]},${medals[i]}88)`:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:900,color:i<3?"#1a1a1a":"#fff",boxShadow:SO,
                }}>{i+1}</div>
                <div style={{
                  width:32,height:32,borderRadius:9,flexShrink:0,
                  background:`linear-gradient(145deg,hsl(${s.hue},60%,44%),hsl(${(s.hue+35)%360},70%,28%))`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:800,color:"#fff",boxShadow:`0 2px 8px hsla(${s.hue},50%,30%,.5)`,
                }}>{s.name.split(" ").map(w=>w[0]).join("")}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:TEXT,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                  <div style={{height:4,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
                    <div style={{
                      height:"100%",width:`${(s.hours/maxH)*100}%`,borderRadius:3,
                      background:s.type==="school"?`linear-gradient(90deg,${BLUE},${GREEN})`:`linear-gradient(90deg,${PURPLE},${GOLD})`,
                    }}/>
                  </div>
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <div style={{fontSize:12,fontWeight:800,color:GOLD}}>{(s.paid/1000).toFixed(1)}к ₴</div>
                  <div style={{fontSize:9,color:FAINT}}>{s.hours} год</div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* ── ЕКСПОРТ ── */}
        <Card style={{padding:"12px"}}>
          <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Експорт</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
            {[
              {label:"Excel", emoji:"📊",color:GREEN, sub:"Статистика"},
              {label:"PDF",   emoji:"📄",color:RED,   sub:"Для податкової"},
              {label:"Share", emoji:"↗️",color:BLUE,  sub:"Поділитись"},
            ].map(e=>(
              <button key={e.label} style={{
                padding:"11px 6px",borderRadius:11,border:"none",cursor:"pointer",
                background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                display:"flex",flexDirection:"column",alignItems:"center",gap:5,boxShadow:SO,
              }}>
                <div style={{
                  width:34,height:34,borderRadius:10,
                  background:`linear-gradient(145deg,${e.color}33,${e.color}11)`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                  boxShadow:`0 2px 8px ${e.color}22`,
                }}>{e.emoji}</div>
                <span style={{fontSize:11,fontWeight:800,color:e.color}}>{e.label}</span>
                <span style={{fontSize:9,color:FAINT}}>{e.sub}</span>
              </button>
            ))}
          </div>
        </Card>

        <div style={{height:8}}/>
      </div>
    </>
  );
}
