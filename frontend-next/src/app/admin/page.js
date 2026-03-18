"use client";

import { HomeApp } from "@/components/HomeApp";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function AdminPage() {
  const { isDarkMode } = useTheme();
  return (
    <>
      <Navbar />
      <HomeApp appMode="admin" />
      <Footer isDarkMode={isDarkMode} />
    </>
  );
}
