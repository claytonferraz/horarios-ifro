import React from 'react';
import { Link as LinkIcon, Download, Loader2, X } from 'lucide-react';

export function ImportUrlModal({
  importUrlModal,
  setImportUrlModal,
  isDarkMode,
  processUrlUpload,
  uploadType,
  isLoading
}) {
  if (!importUrlModal.show) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`rounded-3xl w-full max-w-lg shadow-2xl relative border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            <LinkIcon size={18} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}/>
            <h3 className="font-bold uppercase tracking-widest text-sm">Importar via URL</h3>
          </div>
          <button onClick={() => setImportUrlModal({ show: false, url: '' })} className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <form onSubmit={processUrlUpload} className="space-y-4">
            <p className={`text-sm font-medium mb-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Insira o link direto do arquivo CSV (ex: Google Planilhas) para importar os dados como <strong className={`font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{uploadType.toUpperCase()}</strong>.
            </p>
            <input 
              type="url" 
              required 
              placeholder="https://..." 
              className={`w-full font-medium py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`} 
              value={importUrlModal.url} 
              onChange={(e) => setImportUrlModal({...importUrlModal, url: e.target.value})} 
              disabled={isLoading} 
            />
            
            <button type="submit" disabled={isLoading} className={`w-full flex justify-center items-center gap-2 text-white font-black py-3 rounded-xl transition-all shadow-md mt-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'}`}>
              {isLoading ? <><Loader2 size={18} className="animate-spin" /> Processando...</> : <><Download size={18} /> Baixar Arquivo</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
