"use client";

import { HomeApp } from "@/components/HomeApp";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function GestaoDapePage() {
  const { isDarkMode } = useTheme();
  return (
    <>
      <Navbar />
      <HomeApp appMode="gestao_dape" />
      <Footer isDarkMode={isDarkMode} />
    </>
  );
}
