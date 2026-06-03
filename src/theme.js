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
  BG: "#f0e6d6", BG_DEEP: "#e6d4be",
  SURFACE: "#faf3ea", SURF_HI: "#fff8f2", SURF_LO: "#e2cdb0",
  BORDER: "rgba(140,88,36,0.14)",
  TEXT: "#28180a", DIM: "#7a5430", FAINT: "#c0986a",
  ACCENT: "#c04020", ACC_HI: "#e05030",
  GREEN: "#3a8c1e", BLUE: "#1a5cb0", PURPLE: "#7a3ab8",
  GOLD: "#9a6c10", RED: "#b82020", TEAL: "#1a8070",
  SO: "0 2px 12px rgba(140,88,36,0.18)",
  SI: "inset 2px 2px 6px rgba(140,88,36,0.16),inset -1px -1px 3px rgba(255,248,240,0.8)",
};

export const ThemeContext = createContext(DARK);
export const getTheme = (mode) => mode === "light" ? LIGHT : DARK;

// backward-compat static exports (dark theme)
export const { BG, BG_DEEP, SURFACE, SURF_HI, SURF_LO, BORDER, TEXT, DIM, FAINT,
  ACCENT, ACC_HI, GREEN, BLUE, PURPLE, GOLD, RED, TEAL, SO, SI } = DARK;
