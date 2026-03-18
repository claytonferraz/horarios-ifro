import React from 'react';
import { CalendarDays, AlertTriangle, X } from 'lucide-react';

export function PendingUploadModal({
  pendingUpload,
  setPendingUpload,
  isDarkMode,
  uploadType,
  academicWeeks,
  finalizeUpload,
  onGoToConfig
}) {
  if (!pendingUpload) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`rounded-3xl w-full max-w-lg shadow-2xl relative border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            <CalendarDays size={18} className={isDarkMode ? 'text-violet-400' : 'text-violet-600'}/>
            <h3 className="font-bold uppercase tracking-widest text-sm">Vincular Arquivo a uma Semana</h3>
          </div>
          <button onClick={() => setPendingUpload(null)} className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className={`text-sm font-medium mb-4 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            O sistema detectou um envio de grade do tipo <strong className={`font-black ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>{uploadType.toUpperCase()}</strong>.<br/>
            Por favor, escolha qual Semana Acadêmica estes horários representam:
          </p>
          
          <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-4 pr-1">
            {academicWeeks.length === 0 ? (
              <div className="text-center py-6 text-amber-500">
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-bold mb-1">Nenhuma semana cadastrada.</p>
                <p className="text-xs mb-4">Cadastre as semanas letivas na aba de Configurações de Horários primeiro.</p>
                {onGoToConfig && (
                  <button
                    onClick={() => { setPendingUpload(null); onGoToConfig(); }}
                    className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'}`}
                  >
                    Ir para Configurações de Horários →
                  </button>
                )}
              </div>
            ) : (
              academicWeeks.map(week => (
                <button 
                  key={week.id}
                  onClick={() => finalizeUpload(pendingUpload.parsedData, week.name, pendingUpload.fileName)}
                  className={`w-full text-left p-4 rounded-xl border flex flex-col transition-all hover:-translate-y-0.5 shadow-sm hover:shadow active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-violet-500/50' : 'bg-white border-slate-200 hover:border-violet-500/50 hover:bg-violet-50/50'}`}
                >
                  <h4 className="font-black text-sm">{week.name}</h4>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                    {new Date(week.start_date).toLocaleDateString('pt-BR')} até {new Date(week.end_date).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPendingUpload(null)} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all text-center ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Cancelar Envio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
