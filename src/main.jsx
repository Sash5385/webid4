import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initErrorReporter } from './errorReporter.js'

initErrorReporter()

// Після деплою старі файли застосунку зникають із сервера: відкрита (або закешована) стара версія просить «чанк», якого вже немає,
// і замість JS отримує index.html (помилка «text/html is not a valid JavaScript MIME type»). Тоді просто перезавантажуємо сторінку
// на нову версію. Один раз за 30 с, щоб не зациклитись, якщо сервер справді недоступний.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('dp_chunk_reload') || 0)
    if (Date.now() - last < 30000) return
    sessionStorage.setItem('dp_chunk_reload', String(Date.now()))
  } catch { /* сховище недоступне */ }
  // preventDefault тут не викликаємо: інакше import() повертає undefined і React.lazy падає з «reading 'default'»
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
