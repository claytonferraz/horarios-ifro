"use client";

import React, { useState } from "react";
import { 
  Calendar, Sun, Moon, Contrast, Power, Menu, 
  Home, GraduationCap, UserCheck, LayoutDashboard, Settings 
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
    const { theme, isDarkMode, isDim, toggleTheme } = useTheme();
  const { isUnlocked, logout, userName, userRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (path) => {
    const finalPath = (path === "/professor" || path === "/aluno") ? `${path}?t=${Date.now()}` : path;
    router.push(finalPath);
    setMobileMenuOpen(false);
  };

  const getLinkClass = (path) => {
    const isActive = pathname === path || (path === "/" && pathname === "/");
    
    const baseStyles = "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 relative overflow-hidden group";
    
    if (isActive) {
      if (isDim) return `${baseStyles} text-white bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]`;
      if (isDarkMode) return `${baseStyles} text-emerald-400 bg-emerald-950/40 border border-emerald-500/30`;
      return `${baseStyles} text-white bg-emerald-600 shadow-lg shadow-emerald-500/20`;
    }

    return `${baseStyles} ${
      isDim ? "text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-950/30" :
      isDarkMode ? "text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50" :
      "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
    }`;
  };

  // light → exibe lua (próximo: dim/IFRO), dim → exibe lua escura (próximo: dark), dark → exibe sol (próximo: light)
  const themeIcon  = theme === 'light' ? <Moon size={20} /> : theme === 'dim' ? <Contrast size={20} /> : <Sun size={20} />;
  const themeLabel = theme === 'light' ? 'Ativar tema Verde IFRO' : theme === 'dim' ? 'Ativar tema Escuro' : 'Ativar tema Claro';

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 border-b no-print ${
        isDim
          ? "bg-[var(--dim-surface)]/80 backdrop-blur-xl border-emerald-900/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
          : isDarkMode
          ? "bg-slate-950/80 backdrop-blur-xl border-slate-800"
          : "bg-white/80 backdrop-blur-xl border-slate-100 shadow-sm"
      }`}
    >
      <div className="w-full max-w-none mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigateTo("/")}
        >
          <div
            className={`p-2 rounded-xl transition-all duration-500 ${
              isDim
                ? "bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                : isDarkMode
                ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "bg-emerald-600 shadow-lg shadow-emerald-500/20"
            }`}
          >
            <Calendar className="text-white" size={22} strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <h1
              className={`text-lg font-black tracking-tighter leading-none transition-colors duration-500 ${
                isDim ? "text-emerald-50" : isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Horários
              <span className="text-emerald-500 ml-1">
                ADM IFRO
              </span>
            </h1>
          </div>
        </div>

        {/* Links Desktop */}
        <nav className="hidden md:flex items-center gap-6 z-10">
          <button onClick={() => navigateTo("/")} className={getLinkClass("/")}>
            <Home size={16} /> Início
          </button>
          <button onClick={() => navigateTo("/aluno")} className={getLinkClass("/aluno")}>
            <GraduationCap size={16} /> Horários
          </button>
          <button onClick={() => navigateTo("/professor")} className={getLinkClass("/professor")}>
            <UserCheck size={16} /> Docente
          </button>
          {isUnlocked && ['admin', 'gestao'].includes(userRole) && (
            <button onClick={() => navigateTo("/gestao-dape")} className={getLinkClass("/gestao-dape")}>
              <LayoutDashboard size={16} /> Gestão
            </button>
          )}
          {isUnlocked && userRole === 'admin' && (
            <button onClick={() => navigateTo("/admin")} className={getLinkClass("/admin")}>
              <Settings size={16} /> Sistema
            </button>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isUnlocked && (
            <div className="hidden sm:flex flex-col items-end mr-1 mt-1 justify-center">
              <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${
                isDim ? 'text-[var(--dim-text)]' : isDarkMode ? 'text-slate-200' : 'text-slate-800'
              }`}>
                {userName || "Autenticado"}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${
                isDim ? 'text-[var(--dim-accent)]' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
              }`}>
                {userRole === 'admin' ? 'Administrador' : (userRole === 'gestao' ? 'Gestão' : 'Servidor(a)')}
              </span>
            </div>
          )}
          {isUnlocked && (
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              title="Sair da Conta"
              className={`p-2 rounded-full transition-colors focus:outline-none ${
                isDim
                  ? "text-rose-600 hover:bg-rose-50"
                  : isDarkMode
                  ? "text-red-400 hover:bg-slate-800"
                  : "text-red-500 hover:bg-red-50"
              }`}
            >
              <Power size={20} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            title={themeLabel}
            aria-label={themeLabel}
            className={`p-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isDim
                ? "text-[var(--dim-text-2)] hover:text-[var(--dim-text)] hover:bg-[var(--dim-surface-2)]"
                : isDarkMode
                ? "text-slate-400 hover:bg-slate-800"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {themeIcon}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
            className={`md:hidden p-2 rounded-md focus:outline-none ${
              isDim
                ? "text-[var(--dim-text-2)] hover:bg-[var(--dim-surface-2)]"
                : isDarkMode
                ? "text-slate-400 hover:bg-slate-800"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden absolute top-16 left-0 w-full border-b shadow-xl py-4 flex flex-col gap-2 px-4 z-50 animate-in slide-in-from-top-4 ${
            isDim
              ? "bg-[var(--dim-surface)] border-[var(--dim-border)]"
              : isDarkMode
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          {[
            ['/', 'Início', <Home size={18} key="h" />], 
            ['/aluno', 'Horários', <GraduationCap size={18} key="g" />], 
            ['/professor', 'Docente', <UserCheck size={18} key="u" />]
          ].map(([path, label, icon]) => (
            <button
              key={path}
              onClick={() => navigateTo(path)}
              className={`text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 ${
                isDim
                  ? "text-[var(--dim-accent)] hover:bg-[var(--dim-surface-2)]"
                  : isDarkMode
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {icon} {label}
            </button>
          ))}
          {isUnlocked && ['admin', 'gestao'].includes(userRole) && (
            <button
              onClick={() => navigateTo("/gestao-dape")}
              className={`text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 ${
                isDim
                  ? "text-[var(--dim-accent)] hover:bg-[var(--dim-surface-2)]"
                  : isDarkMode
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard size={18} /> Gestão
            </button>
          )}
          {isUnlocked && userRole === 'admin' && (
            <button
              onClick={() => navigateTo("/admin")}
              className={`text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 ${
                isDim
                  ? "text-[var(--dim-accent)] hover:bg-[var(--dim-surface-2)]"
                  : isDarkMode
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Settings size={18} /> Sistema
            </button>
          )}
        </div>
      )}
    </header>
  );
}
