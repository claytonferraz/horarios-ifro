import React from 'react';
import { GraduationCap, UserCheck, Settings, Globe, Book } from 'lucide-react';

export function PublicHome({ isDarkMode, navigateTo }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-10 text-center">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className={`text-4xl md:text-5xl font-black tracking-tighter mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bem-vindo ao portal de horários</h2>
        <p className={`text-lg font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecione o seu perfil de acesso abaixo para visualizar as grades e diários de classe.</p>
      </div>

      {/* ACESSO INSTITUCIONAL RÁPIDO - NO TOPO PARA MÁXIMA VISIBILIDADE */}
      <div className="max-w-4xl w-full mb-12 flex flex-wrap items-center justify-center gap-4 no-print animate-in slide-in-from-top-4 duration-700">
        <a href="https://suap.ifro.edu.br/" target="_blank" rel="noopener noreferrer" className={`group flex items-center gap-4 px-8 py-5 rounded-[2rem] border transition-all hover:scale-[1.03] active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-emerald-500/50' : 'bg-white border-slate-200 shadow-sm hover:border-emerald-300 shadow-emerald-500/5'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-emerald-950 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
            <Globe size={24} />
          </div>
          <div className="text-left">
            <h4 className={`font-black uppercase tracking-widest text-[12px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SUAP</h4>
            <p className={`text-[9px] font-bold opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Admin. Pública IFRO</p>
          </div>
        </a>

        <a href="https://virtual.ifro.edu.br/jiparana/" target="_blank" rel="noopener noreferrer" className={`group flex items-center gap-4 px-8 py-5 rounded-[2rem] border transition-all hover:scale-[1.03] active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-300 shadow-indigo-500/5'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-indigo-950 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
            <Book size={24} />
          </div>
          <div className="text-left">
            <h4 className={`font-black uppercase tracking-widest text-[12px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>AVA Ji-Paraná</h4>
            <p className={`text-[9px] font-bold opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Moodle Institucional</p>
          </div>
        </a>
      </div>

      {/* PERFIS DE ACESSO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <button onClick={() => navigateTo('aluno')} className={`group flex flex-col items-center text-center p-10 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-inner ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <GraduationCap size={44} />
          </div>
          <h3 className={`text-2xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Área do Aluno</h3>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Visualize a rotina diária ou o horário de aulas completo da sua turma.</p>
        </button>

        <button onClick={() => navigateTo('professor')} className={`group flex flex-col items-center text-center p-10 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <UserCheck size={44} />
          </div>
          <h3 className={`text-2xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Área do Professor</h3>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Acesse sua grade pessoal, matriz de cursos e diário detalhado.</p>
        </button>

        <button onClick={() => navigateTo('admin')} className={`group flex flex-col items-center text-center p-10 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-800'}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white transition-all duration-300 shadow-inner ${isDarkMode ? 'bg-slate-700 text-slate-300 group-hover:bg-slate-600' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-900'}`}>
            <Settings size={44} />
          </div>
          <h3 className={`text-2xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Administração</h3>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gestão de horários, permutas e base de dados institucional.</p>
        </button>
      </div>
    </div>
  );
}
