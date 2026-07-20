// Одноразовий локальний скрипт для отримання Google OAuth2 refresh token.
// НЕ деплоїться як Cloud Function — запускається вручну на своєму комп'ютері.
//
// Перед запуском:
// 1. Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID.
//    Тип застосунку: "Desktop app".
// 2. Увімкнути Google Calendar API для проекту (APIs & Services → Library).
//
// Запуск (з папки functions, після "npm install" — потрібен пакет googleapis):
//   node scripts/get-google-refresh-token.js <client_id> <client_secret>
//
// Скрипт відкриє посилання — перейти по ньому в браузері, залогінитись під
// акаунтом, чий календар синхронізуємо, дозволити доступ. Після редіректу на
// localhost скрипт сам забере code, обміняє на токени і виведе refresh_token.
// Отриманий refresh_token зберегти командою:
//   firebase functions:secrets:set GOOGLE_CALENDAR_REFRESH_TOKEN

const http = require("http");
const { URL } = require("url");
const { google } = require("googleapis");

const [, , clientId, clientSecret] = process.argv;

if (!clientId || !clientSecret) {
  console.error("Використання: node get-google-refresh-token.js <client_id> <client_secret>");
  process.exit(1);
}

const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/calendar"],
});

console.log("\nВідкрий це посилання в браузері та дозволь доступ:\n");
console.log(authUrl, "\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Авторизацію відхилено, можна закрити вкладку.");
    console.error(`Помилка авторизації: ${error}`);
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end("Немає коду авторизації.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Готово, можна закрити вкладку і повернутись у термінал.");

    console.log("\nGOOGLE_CALENDAR_REFRESH_TOKEN:\n");
    console.log(tokens.refresh_token || "(refresh_token відсутній — можливо доступ вже видавався раніше; " +
      "видали доступ застосунку в https://myaccount.google.com/permissions і повтори)");
    console.log("\nЗбережи його:  firebase functions:secrets:set GOOGLE_CALENDAR_REFRESH_TOKEN\n");
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Помилка обміну коду на токени, дивись термінал.");
    console.error("Помилка обміну коду на токени:", e.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Очікую редірект на ${REDIRECT_URI} ...`);
});
