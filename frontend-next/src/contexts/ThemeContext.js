"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// =============================================
// SISTEMA DE TEMAS: light | dim | dark
// ——————————————————————————————————————————
// dim  →  Tema claro com identidade visual do IFRO
//         Base creme-esverdeada (#f0f7f3) + verde institucional #00813C.
//         isDarkMode=false no dim: todos os componentes herdam estilos claros
//         automaticamente. Use isDim para aplicar acentos verdes específicos.
// =============================================

const ThemeContext = createContext();

const THEMES = ["light", "dim", "dark"];

// Paleta "dim": tema claro com identidade visual IFRO (verde #00813C)
// As variáveis aqui devem ser idênticas ao bloco .dim no globals.css
const DIM_VARS = {
  "--dim-bg"         : "#f0f7f3",   // fundo de página creme-esverdeado
  "--dim-surface"    : "#ffffff",   // cards e painéis
  "--dim-surface-2"  : "#e8f5ee",   // hover, zebra
  "--dim-surface-3"  : "#d4edde",   // selecionado/ativo
  "--dim-border"     : "#c8e6d4",   // bordas suaves
  "--dim-border-2"   : "#8dc9a5",   // bordas de ênfase
  "--dim-text"       : "#0f2d1f",   // texto principal (verde muito escuro)
  "--dim-text-2"     : "#3d6e52",   // texto secundário
  "--dim-text-3"     : "#6fa384",   // placeholders
  "--dim-accent"     : "#00813C",   // verde IFRO principal
  "--dim-accent-h"   : "#006830",   // hover
  "--dim-accent-l"   : "#e6f4ec",   // fundo de badge suave
  "--dim-accent-glow": "rgba(0,129,60,0.15)",
  "--dim-success"    : "#00813C",
  "--dim-warning"    : "#92600a",
  "--dim-danger"     : "#be1b1b",
};

function applyDimVars(active) {
  const root = document.documentElement;
  if (active) {
    Object.entries(DIM_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
    root.classList.add("dim");
    root.classList.remove("dark");
  } else {
    Object.keys(DIM_VARS).forEach((k) => root.style.removeProperty(k));
    root.classList.remove("dim");
  }
}

export function ThemeProvider({ children }) {
  // theme: "light" | "dim" | "dark"
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial = THEMES.includes(saved) ? saved : (
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );
    applyThemeToDOM(initial);
    setThemeState(initial);
  }, []);

  function applyThemeToDOM(t) {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("dim");
      applyDimVars(false);
    } else if (t === "dim") {
      root.classList.remove("dark");
      applyDimVars(true);
    } else {
      root.classList.remove("dark");
      applyDimVars(false);
    }
  }

  const setTheme = (t) => {
    if (!THEMES.includes(t)) return;
    localStorage.setItem("theme", t);
    applyThemeToDOM(t);
    setThemeState(t);
  };

  // Cicla light → dim → dark → light
  const toggleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  };

  // isDarkMode = true SOMENTE para o tema dark.
  // O dim é um tema CLARO (base esverdeada) — isDarkMode=false garante que
  // todos os componentes existentes (isDarkMode ? escuro : claro) usem
  // automaticamente o estilo claro. Use isDim para acentos verdes IFRO.
  const isDarkMode = theme === "dark";
  const isDim      = theme === "dim";
  const isLight    = theme === "light";
  const isDark     = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, isDim, isLight, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
