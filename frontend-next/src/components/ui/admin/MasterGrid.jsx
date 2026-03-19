import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save, Trash2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { getColorHash, MAP_DAYS } from '@/lib/dates';
import { apiClient } from '@/lib/apiClient';

export function MasterGrid({ isDarkMode, subjectHoursMeta, activeData, selectedWeek, scheduleMode, ...props }) {
  const { classTimes, activeDays, refreshData } = useData();

  // 1. ESTADO: Aulas na Área Neutra (Aguardando alocação)
  const [aulasNeutras, setAulasNeutras] = useState([]);

  // 2. ESTADO: Aulas já alocadas na Grade (Mapeamento Dia-Hora -> Aula)
  const [grade, setGrade] = useState({});

  // 3. Inicialização e extração das informações reais
  useEffect(() => {
    if (activeData && Array.isArray(activeData)) {
      const g = {};
      const neutras = [];
      
      activeData.forEach(r => {
        const aulaInfo = {
          id: r.id,
          disciplina: r.subject,
          professor: r.teacher,
          className: r.className,
          cor: getColorHash(r.subject, isDarkMode),
          originalRecord: r
        };

        if (r.day && r.time && r.day !== 'A Definir' && r.time !== 'A Definir' && r.day !== '-') {
          g[`${r.day}_${r.time}`] = aulaInfo;
        } else {
          neutras.push(aulaInfo);
        }
      });
      
      setGrade(g);
      setAulasNeutras(neutras);
    }
  }, [activeData, isDarkMode]);

  // 4. Mapeamento Real dos Dias (MAP_DAYS) usando activeDays do banco (ou Segunda a Sexta por padrão)
  const diasSemana = useMemo(() => {
    const days = (activeDays && activeDays.length > 0) ? activeDays : ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
    return [...days].sort((a,b) => MAP_DAYS.indexOf(a) - MAP_DAYS.indexOf(b));
  }, [activeDays]);

  // 5. Mapeamento Real dos Horários e Turnos
  const horarios = useMemo(() => {
    if (!classTimes || classTimes.length === 0) return ['07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:20 - 11:10', '11:10 - 12:00'];
    const order = { 'Matutino': 1, 'Vespertino': 2, 'Noturno': 3 };
    return [...classTimes].sort((a,b) => {
      const oA = order[a.shift] || 99;
      const oB = order[b.shift] || 99;
      if (oA !== oB) return oA - oB;
      return a.timeStr.localeCompare(b.timeStr);
    }).map(t => t.timeStr);
  }, [classTimes]);

  // === FUNÇÕES DE DRAG AND DROP ===

  const handleDragStart = (e, aula, origem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ aula, origem }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropSlot = (e, dia, hora) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const { aula, origem } = JSON.parse(data);
    const slotKey = `${dia}_${hora}`;

    if (grade[slotKey]) {
      alert("Este horário já está ocupado! Remova a aula atual primeiro.");
      return;
    }

    setGrade(prev => ({ ...prev, [slotKey]: aula }));

    if (origem === 'neutra') {
      setAulasNeutras(prev => prev.filter(item => item.id !== aula.id));
    } else {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
    }
  };

  const handleDropNeutra = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const { aula, origem } = JSON.parse(data);

    if (origem !== 'neutra') {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
      setAulasNeutras(prev => [...prev, aula]);
    }
  };

  // === SALVAR GRADE NO BANCO ===
  const handleSave = async () => {
    if (!selectedWeek || !activeData) {
      alert("Selecione uma semana com dados antes de salvar.");
      return;
    }

    try {
      const allUpdatedRecords = activeData.map(record => {
        let foundInGrid = null;
        for (const [key, gradeItem] of Object.entries(grade)) {
          if (gradeItem.id === record.id) {
            foundInGrid = key;
            break;
          }
        }

        if (foundInGrid) {
          const splitIndex = foundInGrid.indexOf('_');
          const dia = foundInGrid.substring(0, splitIndex);
          const hora = foundInGrid.substring(splitIndex + 1);
          return { ...record, day: dia, time: hora };
        } 
        
        // Se ela foi parar na área neutra
        const foundInNeutro = aulasNeutras.find(n => n.id === record.id);
        if (foundInNeutro) {
          return { ...record, day: 'A Definir', time: 'A Definir' };
        }

        // Se não mudou, retorna original
        return record;
      });

      const fileName = `MasterGrid_${Date.now()}`;
      
      const payload = {
        id: selectedWeek,
        week: selectedWeek,
        type: scheduleMode || 'previa',
        fileName: fileName,
        records: JSON.stringify(allUpdatedRecords)
      };

      await apiClient.saveSchedule(payload);
      alert("Grade salva com sucesso!");
      if (refreshData) refreshData();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  return (
    <div className={`flex flex-col gap-6 animate-in fade-in duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
      
      {/* CABEÇALHO */}
      <div className={`p-4 rounded-xl border shadow-sm flex justify-between items-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <CalendarDays className="text-emerald-500" size={24} />
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest">Montagem de Horários</h2>
            <p className="text-xs text-slate-400 font-bold tracking-wider">Arraste as disciplinas para os horários correspondentes</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm"
        >
          <Save size={16} /> Salvar Grade
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ÁREA NEUTRA (Aulas aguardando alocação) */}
        <div 
          className={`lg:col-span-1 p-4 rounded-xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          onDragOver={handleDragOver}
          onDrop={handleDropNeutra}
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between border-b pb-2 border-slate-700/50">
            <span className="flex items-center gap-2"><AlertCircle size={14} /> Aguardando</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{aulasNeutras.length}</span>
          </h3>
          
          <div className="flex-1 flex flex-col gap-2 min-h-[400px]">
            {aulasNeutras.length === 0 && (
              <div className="text-center text-slate-400 text-xs mt-10 p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                Nenhuma aula pendente. <br/>Arraste aulas da grade para cá para removê-las.
              </div>
            )}

            {aulasNeutras.map((aula) => (
              <div 
                key={aula.id}
                draggable
                onDragStart={(e) => handleDragStart(e, aula, 'neutra')}
                className={`p-3 rounded border flex items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-2 ring-emerald-500 transition-all shadow-sm ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
              >
                <GripVertical size={16} className="text-slate-400" />
                <div className="flex-1 overflow-hidden">
                  <div className={`text-[10px] font-black uppercase tracking-widest truncate px-2 py-0.5 rounded border ${aula.cor}`}>{aula.disciplina}</div>
                  <div className="text-xs font-bold mt-1 truncate">{aula.professor}</div>
                  {aula.className && <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1 truncate">{aula.className}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* A GRADE PRINCIPAL */}
        <div className={`lg:col-span-3 p-4 rounded-xl border shadow-sm overflow-x-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="py-2 px-3 w-24"></th>
                {diasSemana.map(dia => (
                  <th key={dia} className="py-3 px-2 text-center text-xs font-black uppercase tracking-widest border-b border-slate-700/50 w-1/5">
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map((hora) => (
                <tr key={hora}>
                  <td className="py-4 px-2 text-center text-[10px] font-bold text-slate-400 border-r border-slate-700/30 whitespace-nowrap">
                    {hora}
                  </td>
                  
                  {diasSemana.map(dia => {
                    const slotKey = `${dia}_${hora}`;
                    const aulaNesteSlot = grade[slotKey];

                    return (
                      <td 
                        key={slotKey} 
                        className="p-1 border border-slate-700/30 w-1/5"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropSlot(e, dia, hora)}
                      >
                        {aulaNesteSlot ? (
                          // CARD DA AULA DENTRO DA GRADE
                          <div 
                            draggable
                            onDragStart={(e) => handleDragStart(e, aulaNesteSlot, slotKey)}
                            className={`w-full h-16 rounded border flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shadow-sm hover:ring-2 ring-emerald-500 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
                          >
                            <span className={`text-[9px] w-full text-center truncate px-1 font-black uppercase tracking-widest ${aulaNesteSlot.cor || 'text-slate-500'}`}>
                              {aulaNesteSlot.disciplina}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 truncate w-full text-center px-1">
                              {aulaNesteSlot.professor}
                            </span>
                            {aulaNesteSlot.className && (
                              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 truncate w-full text-center px-1 mt-0.5">
                                {aulaNesteSlot.className}
                              </span>
                            )}
                          </div>
                        ) : (
                          // SLOT VAZIO
                          <div className={`w-full h-16 rounded border-2 border-dashed flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-700 bg-slate-900/30 hover:bg-slate-700/50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-0 hover:opacity-100 transition-opacity">
                              Soltar Aqui
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}