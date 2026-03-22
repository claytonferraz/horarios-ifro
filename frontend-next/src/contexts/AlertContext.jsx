"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useTheme } from "./ThemeContext";

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.customAlert = (msg, type = 'error') => {
      const id = Date.now() + Math.random();
      // Add alert
      setAlerts(prev => [...prev, { id, msg, type }]);
      
      // Auto-dismiss
      const timeoutMs = type === 'error' ? 8000 : 5000; // Errors persist longer
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, timeoutMs);
    };
    
    // Override native JS window.alert entirely with our beautiful Toast modal
    window.oldAlert = window.alert;
    window.alert = (msg) => {
        let type = 'error'; // Error is default for most generic blocked rules
        const msgLow = String(msg).toLowerCase();
        
        // Smart heuristic for picking standard colors based on string content
        if (msgLow.includes('sucesso') || msgLow.includes('registrada') || msgLow.includes('importados') || msgLow.includes('atualizado')) type = 'success';
        else if (msgLow.includes('atenção') || msgLow.includes('analisada') || msgLow.includes('vaga') || msgLow.includes('substituir')) type = 'warning';
        
        window.customAlert(msg, type);
    };
  }, []);

  const removeAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <AlertContext.Provider value={{ showAlert: (msg, type) => window.customAlert(msg, type) }}>
      {children}
      
      {/* Toast Render Area - Fixed Overlay on top of everything */}
      <div className="fixed top-20 right-4 sm:right-6 lg:right-8 z-[999999] flex flex-col gap-3 min-w-[320px] max-w-[90vw] sm:max-w-md pointer-events-none">
        {alerts.map(a => (
          <div key={a.id} className={`pointer-events-auto overflow-hidden animate-in slide-in-from-top-12 fade-in duration-300 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.2)] flex flex-col transition-all hover:scale-[1.02] active:scale-[0.98] ${isDarkMode ? 'bg-slate-900 border border-slate-700/50 ring-1 ring-white/10' : 'bg-white border ring-1 ring-black/5'}`}>
            
            {/* Type Indicator Top Line */}
            <div className={`h-1.5 w-full ${a.type === 'error' ? 'bg-rose-500' : a.type === 'success' ? 'bg-emerald-500' : a.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
            
            <div className="p-4 flex gap-4 items-start">
               {/* Animated Elegant Icon */}
               <div className={`mt-0.5 shrink-0 ${a.type === 'error' ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse' : a.type === 'success' ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : a.type === 'warning' ? 'text-amber-500' : 'text-indigo-500'}`}>
                 {a.type === 'error' ? <AlertTriangle size={24} /> : a.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
               </div>
               
               <div className="flex-1 font-black text-xs sm:text-[13px] uppercase tracking-widest leading-relaxed pr-2 flex items-center min-h-[24px]">
                  <p className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{a.msg}</p>
               </div>
               
               {/* Close Button */}
               <button onClick={() => removeAlert(a.id)} className={`shrink-0 p-1.5 rounded-lg transition-all bg-black/5 hover:bg-black/10 hover:rotate-90 dark:bg-white/5 dark:hover:bg-white/10 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <X size={16} strokeWidth={3} />
               </button>
            </div>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);
