import React, { useState } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save } from 'lucide-react';

export function MasterGrid({ isDarkMode, subjectHoursMeta, ...props }) {
  const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const horarios = ['07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:20 - 11:10', '11:10 - 12:00'];

  return (
    <div className={`flex flex-col gap-6 animate-in fade-in duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
      
      {/* CABEÇALHO DO GRID */}
      <div className={`p-4 rounded-xl border shadow-sm flex justify-between items-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <CalendarDays className="text-emerald-500" size={24} />
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest">Quadro de Comando (Master Grid)</h2>
            <p className="text-xs text-slate-400 font-bold tracking-wider">Modo de Edição Livre (Drag-and-Drop)</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm">
          <Save size={16} /> Salvar Grade Oficial
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ÁREA NEUTRA (Aulas aguardando alocação) */}
        <div className={`lg:col-span-1 p-4 rounded-xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2 border-b pb-2 border-slate-700/50">
            <AlertCircle size={14} /> Área Neutra (Aguardando)
          </h3>
          <div className="flex-1 border-2 border-dashed rounded-lg p-3 min-h-[400px] flex flex-col gap-2 border-slate-500/30 bg-slate-900/10">
            
            {/* Exemplo de Card de Aula para arrastar */}
            <div className={`p-3 rounded border flex items-center gap-3 cursor-grab hover:ring-2 ring-emerald-500 transition-all ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <GripVertical size={16} className="text-slate-400" />
              <div>
                <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Matemática</div>
                <div className="text-xs font-bold">Prof. João Silva</div>
              </div>
            </div>

            <div className={`p-3 rounded border flex items-center gap-3 cursor-grab hover:ring-2 ring-emerald-500 transition-all ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <GripVertical size={16} className="text-slate-400" />
              <div>
                <div className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Química</div>
                <div className="text-xs font-bold">Prof. Maria Souza</div>
              </div>
            </div>

          </div>
        </div>

        {/* A GRADE PRINCIPAL */}
        <div className={`lg:col-span-3 p-4 rounded-xl border shadow-sm overflow-x-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="py-2 px-3 w-24"></th>
                {diasSemana.map(dia => (
                  <th key={dia} className="py-3 px-2 text-center text-xs font-black uppercase tracking-widest border-b border-slate-700/50">
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map((hora, index) => (
                <tr key={index}>
                  <td className="py-4 px-2 text-center text-[10px] font-bold text-slate-400 border-r border-slate-700/30">
                    {hora}
                  </td>
                  {diasSemana.map(dia => (
                    <td key={`${dia}-${hora}`} className="p-1 border border-slate-700/30">
                      <div className={`w-full h-16 rounded border-2 border-dashed flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-700 bg-slate-900/30 hover:bg-slate-700/50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                         <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-50">Soltar Aula</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}