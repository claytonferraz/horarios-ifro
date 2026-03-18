"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown } from "lucide-react";

export const SearchableSelect = ({ value, onChange, options, colorClass, placeholder = "Pesquisar...", isDarkMode }) => {
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

  const filteredOptions = useMemo(() => 
    options.filter(o => o.toString().toLowerCase().includes(search.toLowerCase()))
  , [options, search]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`w-full appearance-none border font-semibold py-2 px-3 pr-8 rounded-lg focus:outline-none cursor-pointer flex justify-between items-center text-[11px] uppercase tracking-wide transition-all ${colorClass}`}
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
      >
        <span className="truncate block pr-2">{value || 'Selecione...'}</span>
        <ChevronDown size={14} className={`absolute right-2 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className={`absolute z-[100] w-full mt-1 border rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-1.5 border-b sticky top-0 z-10 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
            <input 
              type="text" 
              className={`w-full border rounded md px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="overflow-y-auto p-1">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
               const isSelected = value === opt;
               let itemClasses = "px-2 py-1.5 text-[11px] uppercase rounded-md cursor-pointer transition-colors ";
               if (isSelected) {
                   itemClasses += isDarkMode ? "bg-emerald-900/40 text-emerald-300 font-bold" : "bg-emerald-50 text-emerald-800 font-bold";
               } else {
                   itemClasses += isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100";
               }

               return (
                <li 
                  key={opt}
                  className={itemClasses}
                  onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                >
                  {opt}
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
