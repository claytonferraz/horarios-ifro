"use client";

import React, { useState } from "react";
import { Calendar, Sun, Moon, Power, Menu } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
    const { isDarkMode, toggleTheme } = useTheme();
  const { isUnlocked, logout, userName, userRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (path) => {
    router.push(path);
    setMobileMenuOpen(false);
  };

  const getLinkClass = (path) => {
    const isActive = pathname === path || (path === "/" && pathname === "/");
    return `text-sm font-bold transition-colors ${
      isActive
        ? isDarkMode
          ? "text-blue-400"
          : "text-blue-600"
        : isDarkMode
        ? "text-slate-400 hover:text-white"
        : "text-slate-500 hover:text-slate-900"
    }`;
  };

  return (
    <header
      className={`border-b sticky top-0 z-50 transition-colors shadow-sm ${
        isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigateTo("/")}
        >
          <div
            className={`p-2 rounded-lg ${
              isDarkMode ? "bg-blue-600" : "bg-blue-600 shadow-md shadow-blue-200"
            }`}
          >
            <Calendar className="text-white" size={20} />
          </div>
          <div className="hidden sm:block">
            <h1
              className={`text-lg font-black tracking-tight leading-none ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Horários
              <span className={` ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                {" "}
                ADM IFRO
              </span>
            </h1>
          </div>
        </div>

        {/* Links Desktop */}
        <nav className="hidden md:flex items-center gap-6 z-10">
          <button onClick={() => navigateTo("/")} className={getLinkClass("/")}>
            Início
          </button>
          <button onClick={() => navigateTo("/aluno")} className={getLinkClass("/aluno")}>
            Área do Aluno
          </button>
          <button onClick={() => navigateTo("/professor")} className={getLinkClass("/professor")}>
            Área do Professor
          </button>
          <button onClick={() => navigateTo("/admin")} className={getLinkClass("/admin")}>
            Administração
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {isUnlocked && (
            <div className="hidden sm:flex flex-col items-end mr-1 mt-1 justify-center">
              <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {userName || "Autenticado"}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
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
                isDarkMode
                  ? "text-red-400 hover:bg-slate-800"
                  : "text-red-500 hover:bg-red-50"
              }`}
            >
              <Power size={20} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors focus:outline-none ${
              isDarkMode
                ? "text-slate-400 hover:bg-slate-800"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-md focus:outline-none ${
              isDarkMode
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
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <button
            onClick={() => navigateTo("/")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-bold ${
              isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Início
          </button>
          <button
            onClick={() => navigateTo("/aluno")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-bold ${
              isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Área do Aluno
          </button>
          <button
            onClick={() => navigateTo("/professor")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-bold ${
              isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Área do Professor
          </button>
          <button
            onClick={() => navigateTo("/admin")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-bold ${
              isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Administração
          </button>
        </div>
      )}
    </header>
  );
}
