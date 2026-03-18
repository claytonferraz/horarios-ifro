"use client";

import React, { useState, useEffect } from "react";

export const InlineInput = ({ value, onSave, placeholder, isDarkMode, type = "number" }) => {
  const [val, setVal] = useState(value ?? '');

  // Update local state when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setVal(value ?? '');
    }
  }, [value]);

  const handleBlur = () => {
    if (val !== (value || '')) onSave(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.target.blur(); // Força o blur que vai disparar o save
    }
  };

  return (
    <input 
      type={type}
      className={`w-full max-w-[80px] text-center font-bold px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
