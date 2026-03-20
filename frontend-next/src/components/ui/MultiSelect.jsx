"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

export const MultiSelect = ({ values = [], onChange, options = [], colorClass, placeholder = "Selecione...", isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, []);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return { value: opt.value, label: opt.label || String(opt.value) };
      }
      return { value: opt, label: String(opt) };
    });
  }, [options]);

  const filteredOptions = useMemo(() => 
    normalizedOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  , [normalizedOptions, search]);

  const toggleOption = (optValue) => {
    if (values.includes(optValue)) {
      onChange(values.filter(v => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  };

  const displayValue = !values || values.length === 0 
    ? placeholder 
    : values.length === 1 
      ? (normalizedOptions.find(o => o.value === values[0])?.label || values[0])
      : `${values.length} selecionados`;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`w-full appearance-none border font-semibold py-2 px-3 pr-8 rounded-lg focus:outline-none cursor-pointer flex justify-between items-center text-[11px] uppercase tracking-wide transition-all ${colorClass}`}
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
      >
        <span className="truncate block pr-2">{displayValue}</span>
        <ChevronDown size={14} className={`absolute right-2 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className={`absolute z-[100] w-full mt-1 border rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-2 border-b flex flex-col gap-2 sticky top-0 z-10 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
            <input 
              type="text" 
              className={`w-full border rounded md px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="flex justify-between items-center px-1">
              <button onClick={() => onChange(normalizedOptions.map(o => o.value))} className={`text-[9px] font-black uppercase tracking-wider hover:opacity-70 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Sel. Todos</button>
              <button onClick={() => onChange([])} className={`text-[9px] font-black uppercase tracking-wider hover:opacity-70 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Limpar</button>
            </div>
          </div>
          <ul className="overflow-y-auto p-1">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
               const isSelected = values.includes(opt.value);
               let itemClasses = "px-2 py-2 text-[11px] uppercase rounded-md cursor-pointer transition-colors flex items-center gap-2 ";
               if (isSelected) {
                   itemClasses += isDarkMode ? "bg-emerald-900/40 text-emerald-300 font-bold" : "bg-emerald-50 text-emerald-800 font-bold";
               } else {
                   itemClasses += isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100";
               }

               return (
                <li 
                  key={opt.value}
                  className={itemClasses}
                  onClick={() => toggleOption(opt.value)}
                >
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : (isDarkMode ? 'border-slate-500' : 'border-slate-300')}`}>
                    {isSelected && <Check size={10} strokeWidth={4} />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </li>
               )
            }) : (
              <li className={`px-2 py-3 text-[11px] text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum resultado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
