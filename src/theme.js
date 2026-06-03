import { createContext } from "react";

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
};

export const LIGHT = {
  BG: "#f0e4d4", BG_DEEP: "#e6d8c6",
  SURFACE: "#f8f0e8", SURF_HI: "#fdf6f0", SURF_LO: "#e8d4bc",
  BORDER: "rgba(120,80,40,0.12)",
  TEXT: "#2a1a0e", DIM: "#7a5840", FAINT: "#b09070",
  ACCENT: "#c94428", ACC_HI: "#e05838",
  GREEN: "#3a8c1e", BLUE: "#2060b8", PURPLE: "#7a3ab8",
  GOLD: "#9a7010", RED: "#c02020", TEAL: "#1a8878",
  SO: "0 2px 10px rgba(120,80,40,0.2)",
  SI: "inset 2px 2px 6px rgba(120,80,40,0.12),inset -1px -1px 3px rgba(255,255,255,0.55)",
};

export const ThemeContext = createContext(DARK);
export const getTheme = (mode) => mode === "light" ? LIGHT : DARK;

// backward-compat static exports (dark theme)
export const { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT,
  ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, TEAL, SO, SI } = DARK;
