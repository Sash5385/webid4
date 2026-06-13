import { createContext } from "react";

// ─────────────────────────────────────────────────────────────
// Helper bases (used by glow/shade/ink in views):
//   GLOW  → specular highlights on raised/colored elements (light on BOTH themes)
//   SHADE → drop/contact shadows (dark on BOTH themes; warm-brown on coffee)
//   INK   → subtle fills, dividers, hairlines on the FLAT neutral surface
//           (must CONTRAST the surface → light-on-dark, dark-on-light)
// On DARK these all equal the original literals (255,255,255 / 0,0,0),
// so existing dark styling is byte-for-byte unchanged.
// ─────────────────────────────────────────────────────────────

export const DARK = {
  BG: "#1c1d21", BG_DEEP: "#161719",
  SURFACE: "#26282c", SURF_HI: "#2e3034", SURF_LO: "#1f2125",
  BORDER: "rgba(255,255,255,0.06)",
  TEXT: "#e8e8ea", DIM: "#8b8d93", FAINT: "#5a5c62",
  ACCENT: "#ff5a3c", ACC_HI: "#ff7a5c",
  GREEN: "#7ed957", BLUE: "#5b9bff", PURPLE: "#c084fc",
  GOLD: "#f7c948", RED: "#ef4444", TEAL: "#2dd4bf",
  SO: "0 2px 10px rgba(0,0,0,0.4)",
  SI: "inset 2px 2px 6px rgba(0,0,0,0.45),inset -1px -1px 3px rgba(255,255,255,0.02)",
  GLOW: "255,255,255", SHADE: "0,0,0", INK: "255,255,255",
  // dark stripe pattern endpoints (blocked slots / sheet hero)
  STRIPE_A: "#1a1b1f", STRIPE_B: "#222428",
};

// ─── COFFEE GRAPHIC BACKGROUND (кавові шари, темна еспресо → крем) ──
const COFFEE_LAYERS = ["#5C2A1A","#7A4A2E","#95603A","#B07C4E","#C49A6C","#D8B68C","#E9D2AE","#F5E8D0"];
const buildCoffeeWaves = () => {
  const W = 1440, H = 1024;
  const lines = [150, 290, 430, 570, 710, 840, 950]; // верхня лінія шарів 2..8
  let paths = `<rect width="${W}" height="${H}" fill="${COFFEE_LAYERS[0]}"/>`;
  lines.forEach((y, i) => {
    const A = 60 - i * 4;
    const s = i % 2 === 0 ? 1 : -1;
    const d = `M0,${y} `
      + `C${W*0.18},${y - A*s} ${W*0.34},${y + A*s} ${W*0.5},${y} `
      + `C${W*0.66},${y - A*s} ${W*0.82},${y + A*s} ${W},${y - A*0.4*s} `
      + `L${W},${H} L0,${H} Z`;
    paths += `<path d="${d}" fill="${COFFEE_LAYERS[i + 1]}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
export const COFFEE_BG = buildCoffeeWaves();

export const LIGHT = {
  BG: "#efe2cf", BG_DEEP: "#e3d0b4",
  SURFACE: "#faf2e7", SURF_HI: "#fff8ef", SURF_LO: "#ecd9bf",
  BORDER: "rgba(92,42,26,0.14)",
  TEXT: "#3a200f", DIM: "#7c5331", FAINT: "#a9845c",
  ACCENT: "#9c5a34", ACC_HI: "#b87142",
  GREEN: "#3a8c1e", BLUE: "#2060b8", PURPLE: "#7a3ab8",
  GOLD: "#9a7010", RED: "#c02020", TEAL: "#1a8878",
  SO: "0 2px 12px rgba(92,42,26,0.18)",
  SI: "inset 2px 2px 6px rgba(92,42,26,0.12),inset -1px -1px 3px rgba(255,255,255,0.6)",
  // coffee tuning: cream specular, espresso shadow, espresso ink for fills/lines
  GLOW: "255,250,243", SHADE: "92,42,26", INK: "92,42,26",
  // light coffee stripes (latte ↔ foam) for blocked slots / sheet hero
  STRIPE_A: "#e3d0b4", STRIPE_B: "#d8bf9c",
  BG_IMAGE: COFFEE_BG,
};

export const ThemeContext = createContext(DARK);
export const getTheme = (mode) => mode === "light" ? LIGHT : DARK;

// backward-compat static exports (dark theme)
export const { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT,
  ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, TEAL, SO, SI,
  GLOW, SHADE, INK, STRIPE_A, STRIPE_B } = DARK;
