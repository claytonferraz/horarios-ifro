import React from "react";

export const Footer = ({ isDarkMode }) => (
  <footer className={`mt-auto py-6 w-full text-center text-[10px] uppercase font-medium tracking-widest no-print ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
    &copy; {new Date().getFullYear()} IFRO - Campus Ji-paraná. Desenvolvido por: Clayton Ferraz.
  </footer>
);
