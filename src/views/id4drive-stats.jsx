import { useState, useEffect, useContext } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { LangContext } from "../App";
import { createT } from "../lang";

import { ThemeContext } from "../theme.js";
import { UICss, Card, useFX } from "../ui";

const UK_MONTHS     = ["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];
const UK_WEEK_LABELS= ["Пн","Вт","Ср","Чт","Пт","Сб"];

// ─── HELPERS ────────────────────────────────────────────────────
const fmtK = n => n>=1000?`${(n/1000).toFixed(1)}к ₴`:`${n} ₴`;

function getDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function bkType(b) { return b.serviceType || b.type || "private"; }
// Ціна послуги на дату уроку: якщо задано nextPrice/nextPriceFrom і дата
// уроку вже досягла nextPriceFrom — використовуємо нову ціну (див. id4drive-admin-v5.jsx).
function effectivePrice(svc, dateStr) {
  if (!svc) return 0;
  if (svc.nextPrice != null && svc.nextPriceFrom && dateStr && dateStr >= svc.nextPriceFrom) {
    return svc.nextPrice;
  }
  return svc.price;
}
function bkIncome(b, svcs) {
  if (b.manualPrice != null) return b.manualPrice;
  const svc = (svcs||[]).find(s => s.id === b.serviceId);
  const dur = b.durMin || (b.durationHours ? b.durationHours * 60 : 60);
  if (svc && svc.price && svc.duration) return Math.round((effectivePrice(svc, b.date) / svc.duration) * dur);
  if (b.price && b.durationHours && b.durMin) return Math.round((b.price / (b.durationHours * 60)) * b.durMin);
  return b.price || 0;
}

// Сусідні (без розриву в часі) записи одного учня в один день адмінка
// показує ОДНІЄЮ карткою в розкладі — тут так само рахуємо їх ОДНИМ уроком,
// а не по кожному окремому Firebase-запису (інакше 2-годинний урок,
// збережений як два сусідні 1-годинні записи, рахувався як "2 уроки").
function markMergedContinuations(bookings) {
  const byGroup = {};
  bookings.forEach(b => {
    const st = b.status || "confirmed";
    if ((st !== "confirmed" && st !== "pending") || !b.date || b.startMin == null || !b.durMin) return;
    (byGroup[`${b.date}_${b._uid}`] ||= []).push(b);
  });
  const continuations = new Set();
  Object.values(byGroup).forEach(list => {
    list.sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < list.length; i++) {
      if (list[i].startMin === list[i-1].startMin + list[i-1].durMin) continuations.add(list[i]._key);
    }
  });
  return continuations;
}

function aggregateBuckets(buckets, bookings, getKey, svcs) {
  const map = {};
  buckets.forEach(b => { map[b.key] = { ...b, income:0, lessons:0, school:0, private:0, noshow:0, cancel:0 }; });
  const continuations = markMergedContinuations(bookings);
  bookings.forEach(b => {
    const k = getKey(b);
    if (!map[k]) return;
    const st = b.status || "confirmed";
    if (st === "confirmed" || st === "pending") {
      map[k].income += bkIncome(b, svcs);
      if (!continuations.has(b._key)) {
        map[k].lessons += 1;
        if (bkType(b) === "school") map[k].school++;
        else map[k].private++;
      }
    } else if (st === "noshow")    { map[k].noshow++; }
    else if (st === "cancelled")  { map[k].cancel++; }
  });
  return buckets.map(b => map[b.key]);
}

function computeDayData(bookings, offsetDays = 0, svcs) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const dateStr = getDateStr(d);
  const buckets = Array.from({length: 10}, (_, i) => {
    const h = 8 + i;
    return { key: `${dateStr}_${h}`, label: `${String(h).padStart(2,'0')}:00` };
  });
  return aggregateBuckets(buckets, bookings, b => {
    if (!b.date || b.date !== dateStr) return '';
    const h = parseInt((b.time || '').split(':')[0], 10);
    return `${b.date}_${h}`;
  }, svcs);
}

function computeWeekData(bookings, offset = 0, svcs) {
  const now = new Date();
  const wd  = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (wd === 0 ? 6 : wd - 1) + offset * 7);
  weekStart.setHours(0, 0, 0, 0);
  const buckets = UK_WEEK_LABELS.map((label, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    return { key: getDateStr(d), label };
  });
  return aggregateBuckets(buckets, bookings, b => b.date || "", svcs);
}

// Бакети по днях довільного місяця (рік/місяць передаються напряму —
// потрібно для навігації календаря вперед/назад, не лише "поточний ± offset").
function computeCalendarMonthData(bookings, year, month, svcs) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets = Array.from({length: daysInMonth}, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { key: getDateStr(d), label: String(i + 1) };
  });
  return aggregateBuckets(buckets, bookings, b => b.date || "", svcs);
}

function computeMonthData(bookings, offsetMonths = 0, svcs) {
  const now = new Date();
  return computeCalendarMonthData(bookings, now.getFullYear(), now.getMonth() + offsetMonths, svcs);
}

function computeYearData(bookings, offsetYears = 0, svcs) {
  const now = new Date();
  const buckets = Array.from({length: 12}, (_, i) => {
    const d = new Date(now.getFullYear() + offsetYears, now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { key, label: UK_MONTHS[d.getMonth()] };
  });
  return aggregateBuckets(buckets, bookings, b => (b.date||"").slice(0, 7), svcs);
}

function filterByPeriod(bookings, data, period, cfrom, cto) {
  if (period === 'custom') return bookings.filter(b => cfrom && cto && b.date >= cfrom && b.date <= cto);
  const keys = new Set(data.map(b => b.key));
  return bookings.filter(b => {
    if (period === 'day') return keys.has(`${b.date}_${parseInt((b.time||'').split(':')[0], 10)}`);
    if (period === 'week' || period === 'month') return keys.has(b.date||'');
    return keys.has((b.date||'').slice(0, 7));
  });
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function computeCustomData(bookings, from, to, svcs) {
  if (!from || !to || from > to) return [];
  const fromD = parseLocalDate(from), toD = parseLocalDate(to);
  const diffDays = Math.round((toD - fromD) / 86400000) + 1;
  if (diffDays <= 62) {
    const buckets = Array.from({length: diffDays}, (_, i) => {
      const d = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate() + i);
      const key = getDateStr(d);
      return { key, label: `${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}` };
    });
    return aggregateBuckets(buckets, bookings, b => b.date || '', svcs);
  }
  const arr = [];
  const cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
  const end = new Date(toD.getFullYear(), toD.getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
    arr.push({ key, label: UK_MONTHS[cur.getMonth()] });
    cur.setMonth(cur.getMonth() + 1);
  }
  return aggregateBuckets(arr, bookings, b => (b.date||'').slice(0, 7), svcs);
}

function computeTopStudents(bookings, sortBy = 'paid', svcs) {
  const map = {};
  bookings.filter(b => b.status === "confirmed" || b.status === "pending").forEach(b => {
    const name = b.studentName || b.name || "Без імені";
    if (!map[name]) {
      map[name] = {
        name, paid: 0, hours: 0,
        type: bkType(b),
        hue: Math.abs((name.charCodeAt(0)||0)*53 + (name.charCodeAt(1)||0)*17) % 360,
      };
    }
    map[name].paid  += bkIncome(b, svcs);
    map[name].hours += (b.durMin || (b.durationHours ? b.durationHours*60 : 60)) / 60;
  });
  return Object.values(map)
    .sort((a, b) => sortBy === 'lessons' ? b.hours - a.hours : b.paid - a.paid)
    .slice(0, 5)
    .map(s => ({...s, hours: Math.round(s.hours * 10) / 10}));
}

function computePopularSlots(bookings, svcs) {
  const map = {};
  bookings.filter(b => (b.status === "confirmed" || b.status === "pending") && b.time).forEach(b => {
    const h = String(parseInt((b.time||'').split(':')[0], 10)).padStart(2,'0');
    if (!map[h]) map[h] = { hour: `${h}:00`, count: 0, income: 0 };
    map[h].count++;
    map[h].income += bkIncome(b, svcs);
  });
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6);
}


function periodSum(data) {
  return {
    income:  data.reduce((s, d) => s + d.income,  0),
    lessons: data.reduce((s, d) => s + d.lessons, 0),
    noshow:  data.reduce((s, d) => s + (d.noshow||0), 0),
  };
}

function trendPct(cur, prev) {
  if (!prev) return null; // немає з чим порівнювати — не вигадуємо фальшиві +100%
  return Math.round(((cur - prev) / prev) * 100);
}

function exportCSV(bookings, svcs) {
  const rows = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'pending')
    .sort((a, b) => (b.date||'').localeCompare(a.date||''))
    .map(b => [
      b.date||'', b.time||'',
      (b.studentName||b.name||'').replace(/,/g,' '),
      b.serviceType||'', bkIncome(b, svcs), b.durMin || (b.durationHours ? b.durationHours*60 : 60),
    ].join(','));
  const csv = ['Дата,Час,Учень,Тип,Сума,Хвилин', ...rows].join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `id4drive-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CHIP ────────────────────────────────────────────────────────
const Chip = ({label, active, onClick, color}) => {
  const { ACC_HI, ACCENT, SURF_HI, SURFACE, DIM, SO } = useContext(ThemeContext);
  return (
    <button onClick={onClick} style={{
      padding:"6px 12px", borderRadius:9, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, flexShrink:0, fontFamily:"inherit",
      background: active ? `linear-gradient(145deg,${color||ACC_HI},${color?color+"bb":ACCENT})` : `linear-gradient(145deg,${SURF_HI},${SURFACE})`,
      color: active ? "#fff" : DIM, boxShadow: active ? "none" : SO,
    }}>{label}</button>
  );
};

// ─── MAIN ────────────────────────────────────────────────────────
export default function StatsView() {
  const { BG_DEEP, SURFACE, SURF_HI, BORDER, TEXT, DIM, FAINT, ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, SO, SI } = useContext(ThemeContext);
  const lang = useContext(LangContext);
  const t = createT(lang);
  const [period,     setPeriod]    = useState("month");
  const [bookings,   setBookings]  = useState([]);
  const [services,   setServices]  = useState([]);
  const [topBy,      setTopBy]     = useState("paid");
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const today0 = new Date();
  const [calViewY, setCalViewY] = useState(today0.getFullYear());
  const [calViewM, setCalViewM] = useState(today0.getMonth());

  const css = `
@keyframes bar-grow{from{height:0%}to{height:var(--h)}}
@keyframes line-draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
.line-anim{animation:line-draw 1s ease both}
@keyframes fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fade-up .2s ease both}
`;

  useEffect(() => {
    return onValue(ref(db, "bookings"), snap => {
      const d = snap.val();
      if (!d) { setBookings([]); return; }
      const all = [];
      Object.entries(d).forEach(([uid, userBkgs]) => {
        if (!userBkgs) return;
        Object.entries(userBkgs).forEach(([bkId, raw]) => {
          if (!raw) return;
          all.push({ ...raw, _uid: uid, _key: bkId,
            name: raw.studentName || raw.name || "Без імені",
          });
        });
      });
      setBookings(all);
    }, () => {});
  }, []);

  useEffect(() => {
    return onValue(ref(db, "admin_settings/services"), snap => {
      const d = snap.val();
      setServices(Array.isArray(d) ? d : []);
    }, () => {});
  }, []);

  const data     = period === "week"   ? computeWeekData(bookings, 0, services)
                 : period === "year"   ? computeYearData(bookings, 0, services)
                 : period === "day"    ? computeDayData(bookings, 0, services)
                 : period === "custom" ? computeCustomData(bookings, customFrom, customTo, services)
                 :                       computeMonthData(bookings, 0, services);

  const prevData = period === "custom" ? data
                 : period === "week"   ? computeWeekData(bookings, -1, services)
                 : period === "year"   ? computeYearData(bookings, -1, services)
                 : period === "day"    ? computeDayData(bookings, -1, services)
                 :                       computeMonthData(bookings, -1, services);

  const cur  = periodSum(data);
  const prev = periodSum(prevData);

  const totalIncome  = cur.income;
  const totalLessons = cur.lessons;
  const totalSchool  = data.reduce((s, d) => s + d.school,  0);
  const totalPrivate = data.reduce((s, d) => s + d.private, 0);
  const avgCheck     = totalLessons ? Math.round(totalIncome / totalLessons) : 0;
  const prevAvgCheck = prev.lessons ? Math.round(prev.income / prev.lessons) : 0;

  const customDiffDays = customFrom && customTo ? Math.round((new Date(customTo) - new Date(customFrom)) / 86400000) + 1 : 0;
  const periodBookings = filterByPeriod(bookings, data, period, customFrom, customTo);
  const topStudents  = computeTopStudents(periodBookings, topBy, services);
  const popularSlots = computePopularSlots(periodBookings, services);
  const byPeriodLabel= period === "day" ? "По годинах" : period === "week" || period === "month" ? "По днях" : period === "custom" && customDiffDays <= 62 ? "По днях" : "По місяцях";

  // Календар завжди на екрані (замість модалки/полів дат) — швидкий вибір
  // місяця (тап на назву місяця), тижня чи конкретного дня (тап на день).
  const todayStr = getDateStr(new Date());
  const calMonthData = computeCalendarMonthData(bookings, calViewY, calViewM, services);
  const calFirstDow  = (new Date(calViewY, calViewM, 1).getDay() + 6) % 7;
  const calDaysInMonth = new Date(calViewY, calViewM + 1, 0).getDate();
  const calMonthLabel = new Date(calViewY, calViewM, 1).toLocaleDateString("uk-UA", { month: "long", year: "numeric" }).replace(/\s*р\.?$/i, "");
  const calGoMonth = (delta) => {
    let m = calViewM + delta, y = calViewY;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCalViewM(m); setCalViewY(y);
  };
  const calTierColor = (n) => n <= 3 ? RED : n <= 6 ? GOLD : GREEN;
  const calPickDay = (dateStr) => { setCustomFrom(dateStr); setCustomTo(dateStr); setPeriod("custom"); };
  const calPickMonth = () => {
    const first = getDateStr(new Date(calViewY, calViewM, 1));
    const last  = getDateStr(new Date(calViewY, calViewM, calDaysInMonth));
    setCustomFrom(first); setCustomTo(last); setPeriod("custom");
  };

  return (
    <>
      <UICss/>
      <style>{css}</style>
      <div style={{display:"flex",flexDirection:"column",gap:8,fontFamily:"ui-sans-serif,-apple-system,system-ui,sans-serif",color:TEXT}}>

        {/* ── PERIOD ── */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {[["day","День"],["week",t('st2.week')],["month",t('st2.month')],["year",t('st2.year')],["custom","Період"]].map(([k,l])=>(
            <Chip key={k} label={l} active={period===k} onClick={()=>setPeriod(k)}/>
          ))}
        </div>

        {/* ── CALENDAR (завжди відкритий — швидкий вибір місяця/тижня/дня) ── */}
        <Card className="fu" style={{padding:"12px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
            <button onClick={()=>calGoMonth(-1)} style={{
              width:24,height:24,borderRadius:7,border:"none",cursor:"pointer",fontFamily:"inherit",
              background:SURF_HI,color:DIM,fontSize:12,fontWeight:700,
            }}>‹</button>
            <button onClick={calPickMonth} title="Обрати весь місяць" style={{
              border:"none",cursor:"pointer",fontFamily:"inherit",background:"transparent",
              fontSize:13,fontWeight:800,color:TEXT,textTransform:"capitalize",padding:"4px 10px",borderRadius:8,
            }}>{calMonthLabel}</button>
            <button onClick={()=>calGoMonth(1)} style={{
              width:24,height:24,borderRadius:7,border:"none",cursor:"pointer",fontFamily:"inherit",
              background:SURF_HI,color:DIM,fontSize:12,fontWeight:700,
            }}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
            {["Пн","Вт","Ср","Чт","Пт","Сб","Нд"].map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:8,color:FAINT,fontWeight:700,textTransform:"uppercase"}}>{d}</div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {Array.from({length:calFirstDow}, (_,i)=><div key={`b${i}`}/>)}
            {Array.from({length:calDaysInMonth}, (_,i)=>{
              const day = i+1;
              const dateStr = getDateStr(new Date(calViewY, calViewM, day));
              const bucket = calMonthData[i];
              const n = bucket ? bucket.lessons : 0;
              const isToday = dateStr === todayStr;
              const inRange = period === "custom" && customFrom && customTo && customFrom !== customTo && dateStr >= customFrom && dateStr <= customTo;
              const isSel = period === "custom" && customFrom === customTo && dateStr === customFrom;
              let bg = SURF_HI, color = DIM;
              if (n > 0) { const tier = calTierColor(n); bg = `${tier}22`; color = tier; }
              if (inRange) { bg = `${ACCENT}2a`; color = ACCENT; }
              return (
                <button key={day} onClick={()=>calPickDay(dateStr)} style={{
                  aspectRatio:"1", borderRadius:6, cursor:"pointer", fontFamily:"inherit",
                  border: isToday ? `1.5px solid ${ACCENT}` : "none",
                  background: isSel ? ACCENT : bg,
                  color: isSel ? "#04231f" : color,
                  fontSize:10, fontWeight:700,
                }}>{day}</button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:8}}>
            {[[RED,"мало"],[GOLD,"середньо"],[GREEN,"багато"]].map(([c,l])=>(
              <span key={l} style={{fontSize:8,color:FAINT,fontWeight:700,display:"flex",alignItems:"center",gap:3}}>
                <i style={{width:6,height:6,borderRadius:2,background:c,display:"inline-block"}}/>{l}
              </span>
            ))}
          </div>
          {period === "custom" && customFrom && (
            <div style={{marginTop:9,textAlign:"center",fontSize:10.5,fontWeight:700,color:ACCENT,background:`${ACCENT}1a`,borderRadius:8,padding:"6px 0"}}>
              {customFrom === customTo ? customFrom : `${customFrom} – ${customTo}`}
            </div>
          )}
        </Card>

        {/* ── KPI 3 ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
          {[
            {label:"Дохід",        value:fmtK(totalIncome),               sub:"за період",                         color:GOLD,  trend:trendPct(cur.income,  prev.income)},
            {label:"Уроків",       value:totalLessons,                    sub:`${totalSchool}а · ${totalPrivate}п`, color:BLUE,  trend:trendPct(cur.lessons, prev.lessons)},
            {label:"Серед. чек",   value:fmtK(avgCheck),                  sub:"дохід / урок",                      color:GREEN, trend:trendPct(avgCheck, prevAvgCheck)},
          ].map((k, i) => (
            <Card key={i} className="fu" style={{
              padding:"10px 9px",
              background:`linear-gradient(155deg,color-mix(in srgb,${k.color} 20%,${BG_DEEP}),color-mix(in srgb,${k.color} 6%,${BG_DEEP}))`,
              border:`1px solid color-mix(in srgb,${k.color} 30%,transparent)`,
            }}>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.6)",letterSpacing:0.6,textTransform:"uppercase",fontWeight:700,marginBottom:6}}>{k.label}</div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.3,marginBottom:3,lineHeight:1.05}}>{k.value}</div>
              <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>{k.sub}</div>
                {k.trend != null && k.trend !== 0 && (
                  <span style={{
                    fontSize:8, fontWeight:800, padding:"1px 5px", borderRadius:5,
                    color:k.trend>=0?GREEN:RED,
                    background:k.trend>=0?`${GREEN}1f`:`${RED}1f`,
                  }}>{k.trend>=0?"+":""}{k.trend}%</span>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* ── РОЗПОДІЛ + ПО ДНЯХ ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          <Card className="fu" style={{
            padding:"12px",
            background:`linear-gradient(155deg,color-mix(in srgb,${GREEN} 14%,${BG_DEEP}),color-mix(in srgb,${GREEN} 3%,${BG_DEEP}))`,
            border:`1px solid color-mix(in srgb,${GREEN} 24%,transparent)`,
          }}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:9}}>Розподіл</div>
            {(() => {
              const totalRatio = totalSchool + totalPrivate;
              const schoolPct = totalRatio ? Math.round((totalSchool/totalRatio)*100) : 0;
              return (
                <>
                  <div style={{display:"flex",gap:8,marginBottom:9}}>
                    {[[GREEN,"Автошкола",totalSchool],[GOLD,"Приватний",totalPrivate]].map(([c,l,v])=>(
                      <div key={l} style={{flex:1,textAlign:"center"}}>
                        <div style={{fontSize:19,fontWeight:900,color:c,lineHeight:1}}>{v}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:3}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",height:8,borderRadius:5,overflow:"hidden",boxShadow:SI}}>
                    <div style={{width:`${totalRatio?schoolPct:50}%`,background:GREEN,transition:"width .5s ease"}}/>
                    <div style={{width:`${totalRatio?100-schoolPct:50}%`,background:GOLD,transition:"width .5s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                    <span style={{fontSize:9,color:GREEN,fontWeight:700}}>{schoolPct}%</span>
                    <span style={{fontSize:9,color:GOLD,fontWeight:700}}>{100-schoolPct}%</span>
                  </div>
                </>
              );
            })()}
          </Card>

          <Card className="fu" style={{
            padding:"12px",
            background:`linear-gradient(155deg,color-mix(in srgb,${GOLD} 14%,${BG_DEEP}),color-mix(in srgb,${GOLD} 3%,${BG_DEEP}))`,
            border:`1px solid color-mix(in srgb,${GOLD} 24%,transparent)`,
          }}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:9}}>{byPeriodLabel}</div>
            {data.map((d, i) => {
              const maxI = Math.max(...data.map(x => x.income), 1);
              const pct  = d.income / maxI;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:700,width:16,textAlign:"right",flexShrink:0}}>{d.label}</span>
                  <div style={{flex:1,height:5,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,background:`linear-gradient(90deg,${GOLD},${GREEN})`,transition:"width .5s ease"}}/>
                  </div>
                  <span style={{fontSize:9,color:GOLD,fontWeight:800,width:34,textAlign:"right",flexShrink:0}}>{d.income ? fmtK(d.income) : <span style={{color:FAINT}}>—</span>}</span>
                </div>
              );
            })}
          </Card>
        </div>

        {/* ── ПОПУЛЯРНІ СЛОТИ ── */}
        {popularSlots.length > 0 && (
          <Card className="fu" style={{
            padding:"12px 13px",
            background:`linear-gradient(155deg,color-mix(in srgb,${GOLD} 14%,${BG_DEEP}),color-mix(in srgb,${GOLD} 3%,${BG_DEEP}))`,
            border:`1px solid color-mix(in srgb,${GOLD} 24%,transparent)`,
          }}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Популярні слоти</div>
            {popularSlots.map((s, i) => {
              const maxCount = popularSlots[0].count;
              const pct = s.count / maxCount;
              return (
                <div key={s.hour} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                  <span style={{fontSize:11,color:i===0?GOLD:FAINT,fontWeight:700,width:36,flexShrink:0}}>{s.hour}</span>
                  <div style={{flex:1,height:6,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,
                      background:i===0?`linear-gradient(90deg,${GOLD},${GREEN})`:`linear-gradient(90deg,${PURPLE},${ACCENT})`,
                      transition:"width .5s ease"}}/>
                  </div>
                  <span style={{fontSize:10,color:i===0?GOLD:PURPLE,fontWeight:800,width:44,textAlign:"right",flexShrink:0}}>
                    {s.count} ур.
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── ТОП-5 ── */}
        {topStudents.length > 0 && (
          <Card className="fu" style={{padding:"12px 13px 8px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>Топ-5 учнів</div>
              <div style={{display:"flex",gap:5}}>
                {[["paid","₴"],["lessons","год"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setTopBy(k)} style={{
                    padding:"3px 8px", borderRadius:6, border:"none", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"inherit",
                    background:topBy===k?GOLD:`linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                    color:topBy===k?"#1a1a1a":FAINT, boxShadow:SO,
                  }}>{l}</button>
                ))}
              </div>
            </div>
            {topStudents.map((s, i) => {
              const maxH = topStudents[0][topBy === 'lessons' ? 'hours' : 'paid'];
              const barVal = topBy === 'lessons' ? s.hours : s.paid;
              const medals = [GOLD,"#c7ccd1","#c9814f"];
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:9,
                  padding:"9px 8px",
                  marginBottom: i < topStudents.length-1 ? 4 : 0,
                  borderRadius:11,
                  background: i<3 ? `linear-gradient(155deg,color-mix(in srgb,${medals[i]} 22%,${BG_DEEP}),color-mix(in srgb,${medals[i]} 5%,${BG_DEEP}))` : "transparent",
                  border: i<3 ? `1px solid color-mix(in srgb,${medals[i]} 30%,transparent)` : "none",
                }}>
                  <div style={{
                    width:24, height:24, borderRadius:7, flexShrink:0,
                    background: i<3 ? `linear-gradient(145deg,${medals[i]},${medals[i]}88)` : `linear-gradient(145deg,${SURF_HI},${SURFACE})`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:900, color:i<3?"#1a1a1a":"#fff", boxShadow:SO,
                  }}>{i+1}</div>
                  <div style={{
                    width:32, height:32, borderRadius:9, flexShrink:0,
                    background:`linear-gradient(145deg,hsl(${s.hue},60%,44%),hsl(${(s.hue+35)%360},70%,28%))`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:"#fff", boxShadow:`0 2px 8px hsla(${s.hue},50%,30%,.5)`,
                  }}>{s.name.split(" ").map(w=>w[0]).join("")}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                    <div style={{height:4,background:BG_DEEP,borderRadius:3,boxShadow:SI,overflow:"hidden"}}>
                      <div style={{
                        height:"100%", width:`${(barVal/maxH)*100}%`, borderRadius:3,
                        background: s.type==="school" ? `linear-gradient(90deg,${BLUE},${GREEN})` : `linear-gradient(90deg,${PURPLE},${GOLD})`,
                      }}/>
                    </div>
                  </div>
                  <div style={{flexShrink:0,textAlign:"right"}}>
                    {topBy === 'lessons'
                      ? <><div style={{fontSize:12,fontWeight:800,color:BLUE}}>{s.hours} год</div><div style={{fontSize:9,color:FAINT}}>{fmtK(s.paid)}</div></>
                      : <><div style={{fontSize:12,fontWeight:800,color:GOLD}}>{fmtK(s.paid)}</div><div style={{fontSize:9,color:FAINT}}>{s.hours} год</div></>
                    }
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── ЕКСПОРТ ── */}
        <Card className="fu" style={{padding:"12px"}}>
          <div style={{fontSize:9,color:FAINT,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Експорт</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:7}}>
            {[
              {label:"Excel", emoji:"📊", color:GREEN, sub:"Статистика",     onClick:()=>exportCSV(bookings, services)},
              {label:"PDF",   emoji:"📄", color:RED,   sub:"Для податкової", onClick:()=>window.print()},
            ].map(e=>(
              <button key={e.label} onClick={e.onClick} style={{
                padding:"11px 6px", borderRadius:11, border:"none", cursor:"pointer", fontFamily:"inherit",
                background:`linear-gradient(155deg,color-mix(in srgb,${e.color} 22%,${BG_DEEP}),color-mix(in srgb,${e.color} 6%,${BG_DEEP}))`,
                display:"flex", flexDirection:"column", alignItems:"center", gap:5, boxShadow:SO,
              }}>
                <div style={{
                  width:34, height:34, borderRadius:10,
                  background:`linear-gradient(145deg,${e.color}55,${e.color}22)`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                  boxShadow:`0 2px 8px ${e.color}33`,
                }}>{e.emoji}</div>
                <span style={{fontSize:11,fontWeight:800,color:"#fff"}}>{e.label}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.55)"}}>{e.sub}</span>
              </button>
            ))}
          </div>
        </Card>

        <div style={{height:8}}/>
      </div>
    </>
  );
}
