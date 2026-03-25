"use client";

import React from "react";
import { HomeApp } from "@/components/HomeApp";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomePage() {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Navbar />
      <HomeApp appMode="home" />
      <Footer isDarkMode={isDarkMode} />
    </div>
  );
}
