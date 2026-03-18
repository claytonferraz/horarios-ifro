"use client";

import { HomeApp } from "@/components/HomeApp";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfessorPage() {
  const { isUnlocked, isLoadingAuth, userRole } = useAuth();
  const { isDarkMode } = useTheme();
  
  // Use generic window.location for simplicity, or router if imported
  if (!isLoadingAuth && !isUnlocked) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
      return null;
    }
  }

  if (isLoadingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <HomeApp appMode="professor" />
      <Footer isDarkMode={isDarkMode} />
    </>
  );
}
