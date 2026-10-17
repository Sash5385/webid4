import { DARK } from "./theme.js";

// Стиль «Туман» (з Juno): напівпрозорі скляні картки поверх синьо-індиго фону.
// GLASS — напівпрозорі картки; FOG — позначка теми для сторінок з туманом; wrap — фон сторінки.
const TUMAN_ACCENT = { ACCENT: "#60a5fa", ACC_HI: "#93c5fd" };

export const FOG_STYLE = {
  id: "29",
  name: "29 · Туман",
  wrap: "radial-gradient(circle 400px at 0% 0%,rgba(96,165,250,.30),transparent),radial-gradient(circle 370px at 100% 80%,rgba(129,140,248,.26),transparent),#10141c",
  theme: {
    ...DARK,
    GLOW: "255,255,255", SHADE: "0,0,0", INK: "255,255,255",
    SURFACE: "rgba(255,255,255,0.07)", SURF_HI: "rgba(255,255,255,0.12)", SURF_LO: "rgba(255,255,255,0.04)",
    BORDER: "rgba(255,255,255,0.14)", SO: "0 6px 20px rgba(0,0,0,0.25)", GLASS: true,
    BG: "#10141c", BG_DEEP: "#0b0f16", TEXT: "#e8edf6", DIM: "#c0c9d9", FAINT: "#b0bacc",
    ...TUMAN_ACCENT, FOG: true,
    SHEET: "linear-gradient(180deg,#1a2132,#10141c)",
    BTN_R: 16, CARD_R: 18, CHIP_R: 99, MODAL_R: 28, TABS: "seg",
    BTN_TX: "#06182e", BTN_GRAD: `linear-gradient(165deg,${TUMAN_ACCENT.ACC_HI},${TUMAN_ACCENT.ACCENT})`, BTN_SH: `0 6px 16px ${TUMAN_ACCENT.ACCENT}59`,
  },
};
