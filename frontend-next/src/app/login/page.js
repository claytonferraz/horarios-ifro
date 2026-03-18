"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSecurityActions } from "@/hooks/useSecurityActions";
import { AuthModal } from "@/components/ui/modals/AuthModal";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function LoginPage() {
  const { isUnlocked, login, isLoadingAuth } = useAuth();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  
  const security = useSecurityActions({ isUnlocked, login });

  useEffect(() => {
    if (!isLoadingAuth && !isUnlocked) {
      security.setAuthModal({ show: true, pendingAction: null, mode: 'login' });
    } else if (!isLoadingAuth && isUnlocked) {
      router.push("/professor");
    }
  }, [isLoadingAuth, isUnlocked, router]);

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
      <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <AuthModal 
          isDarkMode={isDarkMode}
          {...security}
        />
        <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:px-6 mt-2 space-y-4 flex flex-col items-center justify-center">
             <div className={`p-8 rounded-full mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <span className="text-4xl text-center block">🔒</span>
             </div>
             <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-widest mb-4 text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Acesso Restrito</h2>
             <p className={`mb-8 font-medium text-center max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Faça login com seu SIAPE para continuar.</p>
             <button onClick={() => security.setAuthModal({ show: true, pendingAction: null, mode: 'login' })} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 w-full max-w-xs">
               Fazer Login
             </button>
        </main>
      </div>
      <Footer isDarkMode={isDarkMode} />
    </>
  );
}
