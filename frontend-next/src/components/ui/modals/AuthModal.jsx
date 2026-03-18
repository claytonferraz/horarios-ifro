import React from 'react';
import { ShieldCheck, Unlock, X } from 'lucide-react';

export function AuthModal({
  authModal,
  isDarkMode,
  closeAuthModal,
  handleAuthSubmit,
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  errorMsg
}) {
  if (!authModal.show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative border animate-in zoom-in-95 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <button onClick={closeAuthModal} className={`absolute top-4 right-4 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
          <X size={20} />
        </button>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`p-4 rounded-full mb-2 shadow-inner ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
            <ShieldCheck size={32} />
          </div>
          <h3 className={`text-xl font-bold uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            Área Restrita
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {authModal.mode === 'setup' ? 'Crie o usuário e senha mestre (primeiro acesso).' : 'Insira suas credenciais para acessar.'}
          </p>
          <form onSubmit={handleAuthSubmit} className="w-full space-y-4">
            <input
              type="text"
              autoFocus
              required
              placeholder="Nome de usuário"
              className={`w-full font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="Senha"
              className={`w-full font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            <button
              type="submit"
              className={`w-full text-white font-black py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              <Unlock size={18} /> {authModal.mode === 'setup' ? 'Criar Mestre e Entrar' : 'Entrar'}
            </button>
          </form>
          {errorMsg && <p className="text-xs font-bold text-red-600 uppercase tracking-widest">{errorMsg}</p>}
        </div>
      </div>
    </div>
  );
}
