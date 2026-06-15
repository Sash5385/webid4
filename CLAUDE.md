# CLAUDE.md — webid4 (Admin, еталон)

## Workflow

Нові функції та виправлення спочатку тут, потім портуються в `webolhadrive` / `webolhadriveclient`.
GitHub акаунт: `sash5385`

## Стек

- React + Vite + JSX (не TypeScript, не Next.js)
- Firebase Realtime Database
- Firebase Hosting (проєкт: `id4drive-booking-44182`)
- Теми: dark / light(coffee) — `ThemeContext` в `src/theme.js`

## Хости

| Репо | Firebase URL |
|------|-------------|
| webid4 | id4drive-admin.web.app |
| webID4client | id4drive-booking-44182.web.app |

## Деплой

SA ключ: `/home/user/id4drive-sa.json` (завантажується з Firebase Console на початку сесії)

```bash
# webid4
cd /home/user/webid4
GOOGLE_APPLICATION_CREDENTIALS=/home/user/id4drive-sa.json npm run build
GOOGLE_APPLICATION_CREDENTIALS=/home/user/id4drive-sa.json firebase deploy --only hosting

# webID4client
cd /home/user/webID4client
GOOGLE_APPLICATION_CREDENTIALS=/home/user/id4drive-sa.json npm run build
GOOGLE_APPLICATION_CREDENTIALS=/home/user/id4drive-sa.json firebase deploy --only hosting
```

## Правила

- Мінімальні зміни — не переписувати робочий код без причини
- Не змінювати UI без прямого запиту (кольори, відступи, структура)
- Не виконувати без підтвердження: `rm -rf`, `git reset --hard`, `git push --force`
- Перед змінами Firebase структури — показати що зміниться

## Стиль відповідей

- Мінімум тексту: що зроблено + файл/рядок, без пояснень якщо не питали
- Після кожного повідомлення виводити **Повідомлення #N**
- Після 30 повідомлень — запропонувати новий чат з підсумками
