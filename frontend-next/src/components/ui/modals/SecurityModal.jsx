import React from 'react';
import { KeyRound, X, CheckCircle, UserPlus } from 'lucide-react';

export function SecurityModal({
  pwdModal,
  setPwdModal,
  securityTab,
  setSecurityTab,
  isDarkMode,
  handleSecuritySubmit,
  newUserForm,
  setNewUserForm
}) {
  if (!pwdModal.show) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`rounded-3xl w-full max-w-sm shadow-2xl relative border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
             <KeyRound size={18} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}/>
             <h3 className="font-bold uppercase tracking-widest text-sm">Segurança</h3>
          </div>
          <button onClick={() => setPwdModal({ show: false, current: '', newPwd: '', confirm: '', error: '', success: '' })} className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <X size={20} />
          </button>
        </div>

        <div className={`flex border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
          <button onClick={() => setSecurityTab('password')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${securityTab === 'password' ? (isDarkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700')}`}>
            Alterar Senha
          </button>
          <button onClick={() => setSecurityTab('user')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${securityTab === 'user' ? (isDarkMode ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-emerald-600 border-b-2 border-emerald-600') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700')}`}>
            Novo Usuário
          </button>
        </div>

        <div className="p-6">
          {pwdModal.success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 animate-in zoom-in">
              <CheckCircle size={48} className="text-emerald-500" />
              <p className={`font-bold uppercase tracking-widest text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{pwdModal.success}</p>
            </div>
          ) : securityTab === 'password' ? (
            <form onSubmit={handleSecuritySubmit} className="space-y-4 animate-in fade-in slide-in-from-left-4">
              <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Preencha para alterar a senha do usuário atual.</p>
              <input type="password" required placeholder="Senha Atual" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={pwdModal.current} onChange={(e) => setPwdModal({...pwdModal, current: e.target.value})} />
              <input type="password" required placeholder="Nova Senha" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={pwdModal.newPwd} onChange={(e) => setPwdModal({...pwdModal, newPwd: e.target.value})} />
              <input type="password" required placeholder="Confirmar Nova Senha" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={pwdModal.confirm} onChange={(e) => setPwdModal({...pwdModal, confirm: e.target.value})} />
              {pwdModal.error && <p className="text-xs font-bold text-red-600 uppercase tracking-widest text-center">{pwdModal.error}</p>}
              <button type="submit" className={`w-full text-white font-black py-3 rounded-xl transition-all shadow-md mt-2 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800 hover:bg-slate-900'}`}>Salvar Nova Senha</button>
            </form>
          ) : (
            <form onSubmit={handleSecuritySubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Crie um novo login de administrador.</p>
              <input type="text" required placeholder="Nome de Usuário" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})} />
              <select required className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={newUserForm.role} onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}>
                <option value="publico">Público</option>
                <option value="admin">Administrador (Mestre)</option>
                <option value="gestao">Gestão</option>
                <option value="professor">Professor</option>
                <option value="caed">CAED</option>
                <option value="monitor">Monitor</option>
                <option value="lider">Líder</option>
              </select>
              <input type="password" required placeholder="Senha" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} />
              <input type="password" required placeholder="Confirmar Senha" className={`w-full font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} value={newUserForm.confirm} onChange={(e) => setNewUserForm({...newUserForm, confirm: e.target.value})} />
              {pwdModal.error && <p className="text-xs font-bold text-red-600 uppercase tracking-widest text-center">{pwdModal.error}</p>}
              <button type="submit" className={`w-full text-white font-black py-3 rounded-xl transition-all shadow-md mt-2 flex justify-center items-center gap-2 ${isDarkMode ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <UserPlus size={18}/> Criar Usuário
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
