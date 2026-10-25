# Фікс: години/історія учня не враховують записи з `bookings/guest_<телефон>`

Для Claude Code в репозиторіях **webOlhaDrive** та **webOlhaDriveClient** (у webid4 вже виправлено, версія v25.10.1).

## Симптом
В картці учня (історія/сума годин) не враховуються уроки. Приклад: Вікторія Улибіна, уроки 07.10 і 09.10 (по 2 год, `confirmed`) — у підсумку годин відсутні 4 год.

## Причина
Коли адмін створює запис учню, у якого ще немає акаунта, запис пишеться під синтетичний uid `bookings/guest_<цифри_телефону>/<bookingId>` (див. `id4drive-admin-v5.jsx` ~рядок 4804: `update(ref(db, \`bookings/guest_${phone}/${b.id}\`), ...)`).
Після реєстрації учня нові записи лягають у `bookings/<realUid>/...`. Тож в одного учня дві гілки:
- `bookings/guest_380962799951/` — уроки 07.10, 09.10 (`durMin:120`, `status:confirmed`)
- `bookings/GVX4BH…/` — решта уроків (той самий `phone`)

Картка учня (`toggleHistory` у `id4drive-students.jsx`) читала лише `bookings/${s.id}` → гілка `guest_…` губилась.
Загальна статистика (`id4drive-stats.jsx`) обходить усі uid, тому там записи враховуються (крім групування «Топ учнів» за іменем — перевірити, що ім'я збігається).

## Фікс (мінімальний, дані не змінюються)
У `toggleHistory` (`src/views/id4drive-students.jsx`) читати дві гілки й злити; основний uid має пріоритет при збігу id:

```js
const guestDigits = (s.phone||"").replace(/\D/g,"");
const guestUid = guestDigits && !String(s.id).startsWith("guest_") ? `guest_${guestDigits}` : null;
Promise.all([
  get(ref(db, `bookings/${s.id}`)),
  guestUid ? get(ref(db, `bookings/${guestUid}`)).catch(() => null) : Promise.resolve(null),
]).then(([snap, gSnap]) => {
  const data = { ...((gSnap && gSnap.val()) || {}), ...(snap.val() || {}) };
  const list = Object.entries(data).filter(([, b]) => b).map(([id, b]) => ({ id, ...b }))
    /* … далі як було: filter за датою, sort … */;
  setHistory(list);
}).catch(() => setHistory([]))
  .finally(() => setHistoryLoading(false));
```

Перевірити в кожному репо: чи є аналогічне читання `bookings/${uid}` в клієнтському застосунку (webOlhaDriveClient — вкладка історії/статистики клієнта), і додати те саме читання `guest_<телефон>`. Правила БД: перевірити, що читання `bookings/guest_*` дозволено відповідній ролі (у webid4 адмін читає все).

## Перевірка
`npm run build`; відкрити картку учня з гостьовими записами → «Історія» → години збігаються з очікуваними.

## Відкат
Повернути одиночне `get(ref(db, \`bookings/${s.id}\`))` у `toggleHistory`.

## Ризики
Низькі: тільки читання. Якщо учень має той самий `bookingId` у обох гілках — береться запис основного uid.

## Далі (окремо, потребує підтвердження)
Міграція `guest_<телефон>` → реальний uid після реєстрації (враховує Google Calendar sync і `functions/index.js:578`, де `guest_*` пропускаються).
