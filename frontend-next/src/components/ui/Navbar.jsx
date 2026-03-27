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
    
    const baseStyles = "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2";
    
    if (isDim) {
      return `${baseStyles} ${
        isActive 
          ? "text-[var(--dim-accent)] bg-[var(--dim-surface-2)] shadow-sm" 
          : "text-[var(--dim-text-2)] hover:text-[var(--dim-text)] hover:bg-[var(--dim-surface-2)]/50"
      }`;
    }
    
    return `${baseStyles} ${
      isActive
        ? isDarkMode 
          ? "text-blue-400 bg-blue-950/30 border border-blue-900/40 shadow-sm" 
          : "text-blue-600 bg-blue-50 border border-blue-100 shadow-sm"
        : isDarkMode 
          ? "text-slate-400 hover:text-white hover:bg-slate-800" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    }`;
  };

  // light → exibe lua (próximo: dim/IFRO), dim → exibe lua escura (próximo: dark), dark → exibe sol (próximo: light)
  const themeIcon  = theme === 'light' ? <Moon size={20} /> : theme === 'dim' ? <Contrast size={20} /> : <Sun size={20} />;
  const themeLabel = theme === 'light' ? 'Ativar tema Verde IFRO' : theme === 'dim' ? 'Ativar tema Escuro' : 'Ativar tema Claro';

  return (
    <header
      className={`border-b sticky top-0 z-50 transition-colors shadow-sm print:hidden ${
        isDim
          ? "border-[var(--dim-border)] bg-[var(--dim-surface)]/95 backdrop-blur-sm"
          : isDarkMode
          ? "bg-slate-900 border-slate-800"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="w-full max-w-none mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigateTo("/")}
        >
          <div
            className={`p-2 rounded-lg ${
              isDim
                ? "bg-[var(--dim-accent)] shadow-md shadow-emerald-200"
                : isDarkMode
                ? "bg-blue-600"
                : "bg-blue-600 shadow-md shadow-blue-200"
            }`}
          >
            <Calendar className="text-white" size={20} />
          </div>
          <div className="hidden sm:block">
            <h1
              className={`text-lg font-black tracking-tight leading-none ${
                isDim ? "text-[var(--dim-text)]" : isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Horários
              <span className={isDim ? "text-[var(--dim-accent)]" : isDarkMode ? "text-blue-400" : "text-blue-600"}>
                {" "}
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
