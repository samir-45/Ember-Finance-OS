/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#f6f3f1",
      "foreground": "#211d1a",
      "border": "#e5d8d3",
      "card": "#fffaf7",
      "cardForeground": "#211d1a",
      "popover": "#fffaf7",
      "popoverForeground": "#211d1a",
      "primary": "#c72d1d",
      "primaryForeground": "#ffffff",
      "secondary": "#f0e5df",
      "secondaryForeground": "#30211c",
      "muted": "#efe9e5",
      "mutedForeground": "#685e58",
      "accent": "#7a0a0a",
      "accentForeground": "#fff8f5",
      "destructive": "#b42318",
      "destructiveForeground": "#ffffff",
      "input": "#dfd2cc",
      "ring": "#c72d1d",
      "chart1": "#c72d1d",
      "chart2": "#277a50",
      "chart3": "#bd6b1c",
      "chart4": "#8155a5",
      "chart5": "#9f5265",
      "sidebar": "#f2ece8",
      "sidebarForeground": "#302824",
      "sidebarBorder": "#e5d8d3",
      "sidebarPrimary": "#c72d1d",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#e9d8d0",
      "sidebarAccentForeground": "#30211c",
      "sidebarRing": "#c72d1d"
    },
    "dark": {
      "background": "#050505",
      "foreground": "#f6f1ee",
      "border": "#302522",
      "card": "#11100f",
      "cardForeground": "#f6f1ee",
      "popover": "#12100f",
      "popoverForeground": "#f6f1ee",
      "primary": "#ff3b1f",
      "primaryForeground": "#210904",
      "secondary": "#1b1715",
      "secondaryForeground": "#eee7e2",
      "muted": "#171514",
      "mutedForeground": "#b2a7a1",
      "accent": "#7a0a0a",
      "accentForeground": "#fff8f5",
      "destructive": "#e04435",
      "destructiveForeground": "#ffffff",
      "input": "#352722",
      "ring": "#ff6a2b",
      "chart1": "#ff3b1f",
      "chart2": "#7ad9a0",
      "chart3": "#ffac58",
      "chart4": "#cf85ff",
      "chart5": "#b9bfd4",
      "sidebar": "#080707",
      "sidebarForeground": "#eae1dc",
      "sidebarBorder": "#261d1a",
      "sidebarPrimary": "#ff3b1f",
      "sidebarPrimaryForeground": "#210904",
      "sidebarAccent": "#1c1715",
      "sidebarAccentForeground": "#f6f1ee",
      "sidebarRing": "#ff6a2b"
    }
  },
  "fontFamily": {
    "sans": [
      "Geist",
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Geist Mono",
      "monospace"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
