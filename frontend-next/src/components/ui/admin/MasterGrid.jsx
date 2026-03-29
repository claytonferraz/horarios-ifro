import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save, Filter, MapPin, Loader2, Download, X, Check, Layers, Trash2, Eye, EyeOff, Target, CheckCircle2, AlertTriangle, Clock, Bell } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { MAP_DAYS, getColorHash, resolveTeacherName, isTeacherPending } from '@/lib/dates';
import { apiClient, getHeaders } from '@/lib/apiClient';
import { FloatingRequestsWidget } from './FloatingRequestsWidget';
import { SearchableSelect } from '../SearchableSelect';

const getCardStyle = (courseId, classId, subjectName, isDarkMode) => {
    const strToNum = (str) => {
        let hash = 0;
        if (!str) return 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return Math.abs(hash);
    };
    
    // 1. Tom base fixo gerado a partir do ID do curso
    const baseHue = strToNum(String(courseId)) % 360;
    
    // 2. Variação significativa do Tom baseada na Disciplina (Cores Distintas)
    // Desloca a cor no círculo cromático em até 80 graus (+ ou -)
    const subjectHueShift = (strToNum(String(subjectName)) % 160) - 80; 
    const finalHue = (baseHue + subjectHueShift + 360) % 360;
    
    // 3. Pequena variação de luminosidade para textura visual
    const subjectLightShift = (strToNum(String(subjectName)) % 16) - 8;
    
    const lightness = isDarkMode ? (30 + subjectLightShift) : (85 + subjectLightShift);
    const borderLightness = isDarkMode ? (45 + subjectLightShift) : (70 + subjectLightShift);
    
    return {
        backgroundColor: `hsl(${finalHue}, 75%, ${lightness}%)`,
        borderColor: `hsl(${finalHue}, 75%, ${borderLightness}%)`,
        color: isDarkMode ? `hsl(${finalHue}, 90%, 90%)` : `hsl(${finalHue}, 90%, 15%)`
    };
};

// SUBCOMPONENTE OTIMIZADO DE CÉLULA
const GridCell = React.memo(({ 
  slotKey,
  turmaId,
  diaId,
  hora,
  aulaNesteSlot, 
  isDarkMode, 
  onDragStart, 
  onDragOver, 
  onDrop, 
  onOpenModal,
  onRemoveCard,
  alertasObj
}) => {
  const hasAlert = alertasObj?.prof || alertasObj?.sala;

  return (
    <td 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, turmaId, diaId, hora)}
      className={`p-1.5 h-[62px] min-w-[130px] transition-all border group relative ${
        isDarkMode ? 'border-slate-800/40' : 'border-slate-100'
      }`}
    >
      {aulaNesteSlot ? (
        <div 
          draggable 
          onDragStart={(e) => onDragStart(e, aulaNesteSlot, slotKey)}
          onClick={() => onOpenModal && onOpenModal(aulaNesteSlot, slotKey)}
          className={`w-full h-full rounded-xl transition-all p-2 flex flex-col cursor-grab active:cursor-grabbing relative overflow-hidden glass-card ${
            hasAlert ? 'ring-1 ring-rose-500/50 inner-glow-rose' : 'hover:scale-[1.02] hover:shadow-xl'
          } ${aulaNesteSlot.isDisponibilizada ? 'vacant-slot-card' : ''}`}
          style={{ 
            ...getCardStyle(aulaNesteSlot.courseId, aulaNesteSlot.classId, aulaNesteSlot.disciplina, isDarkMode),
            borderWidth: '1px'
          }}
        >
          {/* Indicadores de Status */}
          {aulaNesteSlot.isDisponibilizada && (
            <div className="absolute top-0 left-0 z-10 print:hidden shadow-sm pointer-events-none">
              <span className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded-br-md bg-orange-600 border-none shadow-sm block">VAGA</span>
            </div>
          )}
          {aulaNesteSlot.isPermuted && (
            <div className="absolute top-0 left-0 z-10 print:hidden shadow-sm pointer-events-none">
              <span className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded-br-md bg-amber-600 block shadow-sm">PERMUTADA</span>
            </div>
          )}
          {aulaNesteSlot.isSubstituted && !aulaNesteSlot.isDisponibilizada && !aulaNesteSlot.isPermuted && (
             <div className="absolute top-0 left-0 z-10 print:hidden shadow-sm pointer-events-none">
                <span className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded-br-md bg-indigo-600 block shadow-sm">SUBSTITUIÇÃO</span>
             </div>
          )}
          
          <div className="flex flex-col flex-1 shrink-0 mt-2.5">
             <span className="text-[9px] font-black uppercase tracking-tight leading-[1.1] truncate">{aulaNesteSlot.disciplina}</span>
             <span className="text-[7px] font-bold opacity-70 truncate mt-0.5">{aulaNesteSlot.className}</span>
          </div>

          <div className="flex justify-between items-center mt-auto pt-1 gap-1">
             <div className={`flex items-center gap-1 overflow-hidden flex-1 ${alertasObj?.prof ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold'}`}>
                <span className="truncate text-[8px]">
                   {aulaNesteSlot.professores?.join(' + ').split(' ')[0] || 'Docente'}
                </span>
             </div>
             {aulaNesteSlot.sala && (
               <span title={aulaNesteSlot.sala} className="text-[7.5px] font-black bg-black/5 dark:bg-white/10 px-1 rounded flex items-center gap-0.5 shrink-0 max-w-[80px] overflow-hidden whitespace-nowrap">
                  <MapPin size={6} className="shrink-0" /> <span className="truncate">{aulaNesteSlot.sala}</span>
               </span>
             )}
          </div>
          
          {/* Efeito Visual Hover Glass */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Botão Remover X */}
          {onRemoveCard && (
            <button
               title="Remover da Grade"
               onClick={(e) => { e.stopPropagation(); onRemoveCard(slotKey); }}
               className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-rose-500/90 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-20 print:hidden cursor-pointer hover:scale-110"
            >
               <X size={10} strokeWidth={3} />
            </button>
          )}
        </div>
      ) : (
        <div className={`w-full min-h-[58px] rounded-xl border-2 border-dashed flex items-center justify-center transition-colors group/empty ${
          isDarkMode ? 'border-slate-800 hover:bg-slate-800/40 hover:border-slate-700' : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200'
        }`}>
          <div className="w-1.5 h-1.5 bg-slate-400/10 rounded-full group-hover/empty:scale-150 group-hover/empty:bg-slate-400/30 transition-all" />
        </div>
      )}
    </td>
  );
});

export function MasterGrid({ isDarkMode, ...props }) {
  const { globalTeachers: globalTeachersList, activeDays, classTimes, academicWeeks, selectedConfigYear, setSelectedConfigYear, academicYearsMeta, exchangeRequests } = useData();


  const [selectedCourses, setSelectedCourses] = useState([]);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [hiddenClasses, setHiddenClasses] = useState([]);
 
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceYear, setCloneSourceYear] = useState('');

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [dismissedRequests, setDismissedRequests] = useState(() => {
     if (typeof window !== 'undefined') return JSON.parse(localStorage.getItem('dismissed_requests') || '[]');
     return [];
  });

  const [aulasNeutras, setAulasNeutras] = useState([]);
  const [grade, setGrade] = useState({});
  const [originalGrade, setOriginalGrade] = useState({}); // Dirty State Tracking
  const [disabledDays, setDisabledDays] = useState(new Set());
  
  // ESTADO DA TELA PRINCIPAL (O que o usuário está visualizando)
  const [selectedType, setSelectedType] = useState('previa'); 
  const [selectedWeek, setSelectedWeek] = useState('');
  const [shiftFilter, setShiftFilter] = useState('todos');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [draggedItem, setDraggedItem] = useState(null);

  const [ofertasModal, setOfertasModal] = useState([]);
  
  useEffect(() => {
     if (selectedWeek && exchangeRequests) {
         const pendentes = exchangeRequests.filter(req => req.status === 'pendente' && req.action_type === 'oferta_vaga' && String(req.return_week) === String(selectedWeek));
         if (pendentes.length > 0) {
             setOfertasModal(pendentes);
         } else {
             setOfertasModal([]);
         }
     }
  }, [selectedWeek, exchangeRequests]);

  const [pendingDrop, setPendingDrop] = useState(null); // Modal DND 
  const [dropAlert, setDropAlert] = useState(null); // Alerta Simples

  const [systemDialog, setSystemDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });
  const [modalMode, setModalMode] = useState(null); // 'save' | 'import' | null
  const [saveOptions, setSaveOptions] = useState({ type: 'previa', weekId: '' });
  const [importOptions, setImportOptions] = useState({ type: 'previa', weekId: '' });

  const handleLimparTela = () => {
      setSystemDialog({
          isOpen: true,
          type: 'confirm',
          title: 'Limpar Grade da Tela',
          message: 'Deseja remover todas as alocações da tela e enviá-las para os Pendentes? (O banco de dados NÃO será apagado até você clicar em Salvar).',
          onConfirm: () => setGrade({})
      });
  };

  const [classesList, setClassesList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [changeRequests, setChangeRequests] = useState([]);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [isRequestsWidgetOpen, setIsRequestsWidgetOpen] = useState(false);
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  
  // BUG 6 FIX: recarregar quando refreshTrigger muda (ex: após salvar grade) e também ao montar
  const loadPendingRequests = React.useCallback(() => {
    apiClient.getRequests()
      .then(data => setPendingRequests(data.filter(r => r.status === 'pronto_para_homologacao')))
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests, refreshTrigger]);

  const horariosExibidos = useMemo(() => {
    if (!classTimes || classTimes.length === 0) {
      return ['07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:20 - 11:10', '11:10 - 12:00'];
    }
    return classTimes.filter(t => {
       if (shiftFilter === 'todos') return true;
       if (shiftFilter === 'diurno') return t.shift === 'Matutino' || t.shift === 'Vespertino';
       if (shiftFilter === 'noturno') return t.shift === 'Noturno';
       return true;
    }).map(t => t.timeStr);
  }, [classTimes, shiftFilter]);
  const defaultDays = useMemo(() => ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'], []);
  const diasExibidos = activeDays && activeDays.length > 0 ? activeDays : defaultDays;

  // Auto-preenche os Cursos com base nos dados salvos no respectivo Padrão/Semana
  useEffect(() => {
    if (!schedules || schedules.length === 0) {
        if (schedules && schedules.length === 0) setSelectedCourses([]);
        return;
    }
    const coursesWithData = new Set();
    
    // First figure out which courses they teach via curriculumData
    const teachableCourses = new Set();
    if (teacherFilter && curriculumData) {
       curriculumData.forEach(disc => {
          if (disc.teacherIds && disc.teacherIds.includes(String(teacherFilter))) {
             teachableCourses.add(String(disc.courseId));
          }
       });
    }

    schedules.forEach(s => {
      if (
        s.type === selectedType &&
        (String(s.academic_year) === String(selectedConfigYear) || !s.academic_year) &&
        (selectedType === 'padrao' 
          ? (String(s.week_id) === String(selectedWeek) || (!s.week_id && selectedWeek === 'V1')) 
          : String(s.week_id) === String(selectedWeek)
        )
      ) {
        if (teacherFilter) {
           if (s.courseId && (teachableCourses.has(String(s.courseId)) || (s.teacherId && String(s.teacherId).includes(String(teacherFilter))))) {
              coursesWithData.add(String(s.courseId));
           }
        } else {
           if (s.courseId) coursesWithData.add(String(s.courseId));
        }
      }
    });
    setSelectedCourses(Array.from(coursesWithData));
  }, [selectedType, selectedWeek, selectedConfigYear, schedules, teacherFilter, curriculumData]);

  useEffect(() => {
    if (selectedType === 'padrao' || !selectedWeek || !academicWeeks) {
      setDisabledDays(new Set());
      return;
    }
    const w = academicWeeks.find(week => String(week.id) === String(selectedWeek));
    if (!w || !w.start_date || !w.end_date) {
      setDisabledDays(new Set());
      return;
    }
    const disabledOpts = new Set();
    const [sy, sm, sd] = w.start_date.split('-').map(Number);
    const [ey, em, ed] = w.end_date.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);

    diasExibidos.forEach(diaNome => {
      const dayIndex = MAP_DAYS.indexOf(diaNome);
      let isIncluded = false;
      let cur = new Date(start);
      while (cur <= end) {
          if (cur.getDay() === dayIndex) { isIncluded = true; break; }
          cur.setDate(cur.getDate() + 1);
      }
      if (!isIncluded) disabledOpts.add(diaNome);
    });
    setDisabledDays(disabledOpts);
  }, [selectedWeek, selectedType, academicWeeks, diasExibidos]);

  const toggleDisabledDay = (diaNome) => {
    setDisabledDays(prev => {
        const nextSet = new Set(prev);
        if (nextSet.has(diaNome)) nextSet.delete(diaNome);
        else nextSet.add(diaNome);
        return nextSet;
    });
  };

  const handleTypeChange = (e) => {
     const newType = e.target.value;
     setSelectedType(newType);

     const s = new Set();
     if (schedules && Array.isArray(schedules)) {
         schedules.forEach(sch => {
            if (sch.type === newType && String(sch.academic_year) === String(selectedConfigYear)) {
               if (selectedCourses.length === 0 || selectedCourses.includes(String(sch.courseId))) {
                   if (sch.week_id) s.add(String(sch.week_id));
               }
            }
         });
     }

     if (newType === 'padrao') {
         if (s.size > 0) {
             const maxV = Math.max(1, ...Array.from(s).filter(v => typeof v === 'string' && v.startsWith('V')).map(v => parseInt(v.replace('V', '')) || 1));
             setSelectedWeek(`V${maxV}`);
         } else {
             setSelectedWeek('');
         }
     } else {
         if (s.size > 0) {
             const available = Array.from(s);
             const found = academicWeeks?.find(w => String(w.academic_year) === String(selectedConfigYear) && available.includes(String(w.id)));
             setSelectedWeek(found ? String(found.id) : available[0]);
         } else {
             setSelectedWeek('');
         }
     }
  };

  // Carrega os currículos e turmas direto da fonte
  useEffect(() => {
    async function loadAdminData() {
      setLoadingInitial(true);
      try {
        const [loadedMatrices, loadedClasses, dbSchedules, allRequests] = await Promise.all([
          apiClient.fetchCurriculum('matrix'),
          apiClient.fetchCurriculum('class'),
          fetch(`/api/schedules?academicYear=${selectedConfigYear}`, { headers: getHeaders() }).then(r => r.json()).catch(() => []),
          apiClient.fetchRequests().catch(() => [])
        ]);

        setChangeRequests(allRequests || []);

        const uniqueCourses = (loadedMatrices || []).map(m => ({ id: m.id, name: `${m.course} (${m.name})` }));
        setCourses(uniqueCourses);
        
        const safeClasses = loadedClasses || [];
        setClassesList(safeClasses.map(c => ({ ...c, courseId: c.matrixId })));

        const flatData = [];
        safeClasses.forEach(cls => {
          const matrix = (loadedMatrices || []).find(m => m.id === cls.matrixId);
          if (!matrix) return;
          const serie = matrix.series?.find(s => s.id === cls.serieId);
          if (!serie) return;

          serie.disciplines?.forEach(disc => {
             const profs = cls.professorAssignments?.[disc.id];
             const teacherIds = (profs && profs.length > 0) ? profs : ['A Definir'];
             const classRoom = cls.roomAssignments?.[disc.id] || cls.room || '';
             
             // Calcula a quantidade padrao esperada na matriz (Prio 1: Aulas Semanais preenchidas. Prio 2: Cálculo por Carga Horária)
             let numAulas = 1;
             if (disc.aulas_semanais !== undefined && disc.aulas_semanais !== null && disc.aulas_semanais > 0) {
                 numAulas = Number(disc.aulas_semanais);
             } else if (disc.hours && disc.hours > 0) {
                 numAulas = Math.floor(disc.hours / 40);
             } else if (disc.workload && disc.workload > 0) {
                 numAulas = Math.floor(disc.workload / 40);
             }

             flatData.push({
                  id: `${cls.id}_${disc.id}`,
                  disciplineId: String(disc.id),
                  classId: String(cls.id),
                  courseId: cls.matrixId,
                  className: cls.name,
                  subjectName: disc.name,
                  teacherIds: teacherIds.map(String),
                  room: classRoom,
                  numAulas: numAulas
             });
          });
        });
        setCurriculumData(flatData);
        setSchedules(Array.isArray(dbSchedules) ? dbSchedules : []);

      } catch (err) {
        console.warn("Erro ao buscar currículo para MasterGrid:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadAdminData();
  }, [selectedConfigYear, refreshTrigger]); // Recarrega os dados caso o usuário mude o ano letivo na interface

  // Pega todas as turmas dos cursos selecionados
  const turmasDoCurso = useMemo(() => {
    if (selectedCourses.length === 0 || !classesList) return [];
    
    // Primeiro avalia se a turma possui o professor da busca (via currículo ou via schedule)
    const validClassIds = new Set();
    if (teacherFilter) {
       if (curriculumData) {
         curriculumData.forEach(disc => {
            if (disc.teacherIds && disc.teacherIds.includes(String(teacherFilter))) {
               validClassIds.add(String(disc.classId));
            }
         });
       }
       if (schedules) {
         schedules.forEach(s => {
            if (
              s.type === selectedType &&
              (selectedType === 'padrao' 
                ? (String(s.week_id) === String(selectedWeek) || (!s.week_id && selectedWeek === 'V1')) 
                : String(s.week_id) === String(selectedWeek)
              ) &&
              s.teacherId && String(s.teacherId).includes(String(teacherFilter))
            ) {
               validClassIds.add(String(s.classId));
            }
         });
       }
    }

    return classesList.filter(cls => {
        if (!selectedCourses.includes(String(cls.courseId))) return false;
        if (teacherFilter && !validClassIds.has(String(cls.id))) return false;
        return true;
      })
      .sort((a, b) => {
        // Agrupa pelo Curso primeiro
        const courseCompare = String(a.courseId).localeCompare(String(b.courseId));
        if (courseCompare !== 0) return courseCompare;
        // Depois ordena alfabeticamente pela Turma
        return a.name.localeCompare(b.name);
      });
  }, [selectedCourses, classesList, teacherFilter, curriculumData, schedules, selectedType, selectedWeek]);

 // Estrutura do Grid Baseado no Estado Global de Schedules + Alocação Neutra
// Estrutura do Grid Baseado no Estado Global de Schedules + Alocação Neutra
  useEffect(() => {
    if (selectedCourses.length === 0 || turmasDoCurso.length === 0 || !curriculumData) {
      setAulasNeutras([]); setGrade({}); return;
    }
    const idsTurmas = turmasDoCurso.map(t => String(t.id));
    const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
    const aulasReais = disciplinasDoCurso.map(disciplina => ({
      id: disciplina.id || Math.random().toString(),
      disciplineId: disciplina.disciplineId,
      classId: String(disciplina.classId),
      courseId: String(disciplina.courseId),
      className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
      disciplina: disciplina.subjectName,
      teacherIds: disciplina.teacherIds,
      professores: disciplina.teacherIds.map(id => resolveTeacherName(id, globalTeachersList)),
      sala: disciplina.room || '', 
      cor: getColorHash(disciplina.subjectName),
      numAulas: disciplina.numAulas || 1
    }));
    const initialGrade = {}; const aulasAlocadasIds = [];
    if (schedules && schedules.length > 0) {
      const filtered = schedules.filter(s =>
        selectedCourses.includes(String(s.courseId)) &&
        s.type === selectedType &&
        (s.academic_year === selectedConfigYear || !s.academic_year) &&
        (selectedType === 'padrao' ? (String(s.week_id) === String(selectedWeek) || (!s.week_id && selectedWeek === 'V1')) : String(s.week_id) === String(selectedWeek)) &&
        (!teacherFilter || String(s.teacherId).includes(String(teacherFilter)))
      );
      filtered.forEach(schedule => {
        let refCard;
        if (schedule.disciplineId) {
            refCard = aulasReais.find(a => String(a.id) === `${schedule.classId}_${schedule.disciplineId}` || String(a.id) === String(schedule.disciplineId));
        }
        if (!refCard) refCard = aulasReais.find(a => String(a.classId) === String(schedule.classId) && a.teacherIds?.join(',') === String(schedule.teacherId));
        if (refCard) {
             const dbTeacherIds = schedule.teacherId ? String(schedule.teacherId).split(',') : null;
             const currentTeacherIds = refCard.teacherIds || [];
             
             let teacherChanged = false;
             if (dbTeacherIds) {
                 // Compara se os IDs do banco são diferentes dos IDs do currículo atual (independente da ordem)
                 const sortedDb = [...dbTeacherIds].sort();
                 const sortedCurr = [...currentTeacherIds].sort();
                 teacherChanged = dbTeacherIds.length !== currentTeacherIds.length || sortedDb.some((val, idx) => val !== sortedCurr[idx]);
             }
             
             let flagIsSubstituted = false;
             let flagIsPermuted = false;
             let flagOriginalSubject = null;
             let flagIsDisponibilizada = false;
             let flagClassType = null; // New declaration
             let flagIsExtra = false;
             if (schedule.records) {
                 try {
                     const recs = JSON.parse(schedule.records);
                     if (recs.isSubstituted) {
                         flagIsSubstituted = true;
                         flagOriginalSubject = recs.originalSubject || null;
                     }
                     if (recs.isPermuted) {
                         flagIsPermuted = true;
                     }
                     if (recs.isDisponibilizada) {
                         flagIsDisponibilizada = true;
                     }
                     if (recs.classType) { // New logic
                         flagClassType = recs.classType;
                     }
                     if (recs.isExtra) {
                         flagIsExtra = recs.isExtra;
                     }
                     if (Array.isArray(recs)) {
                         const found = recs.find(r => String(r.day) === String(schedule.dayOfWeek) && String(r.time) === String(schedule.slotId));
                         if (found?.isSubstituted) {
                             flagIsSubstituted = true;
                             flagOriginalSubject = found?.originalSubject || null;
                         }
                         if (found?.isPermuted) {
                             flagIsPermuted = true;
                         }
                         if (found?.isDisponibilizada) {
                             flagIsDisponibilizada = true;
                         }
                         if (found?.classType) { // New logic
                             flagClassType = found.classType;
                         }
                         if (found?.isExtra) {
                             flagIsExtra = found.isExtra;
                         }
                     }
                 } catch(e) {}
             }

             const dbDayNorm = isNaN(schedule.dayOfWeek) ? String(schedule.dayOfWeek) : String(MAP_DAYS[schedule.dayOfWeek]);
             initialGrade[`${schedule.classId}|${dbDayNorm}|${schedule.slotId}`] = { 
                 ...refCard, 
                 sala: schedule.room || refCard.sala,
                 teacherIds: dbTeacherIds || currentTeacherIds,
                 professores: dbTeacherIds ? dbTeacherIds.map(id => resolveTeacherName(id, globalTeachersList)) : refCard.professores,
                 teacherChanged: teacherChanged,
                 isSubstituted: flagIsSubstituted,
                 isPermuted: flagIsPermuted,
                 originalSubject: flagOriginalSubject,
                 isDisponibilizada: flagIsDisponibilizada,
                 classType: flagClassType,
                 isExtra: flagIsExtra
             };
             aulasAlocadasIds.push(String(refCard.id));
        }
      });
    }
    setAulasNeutras(aulasReais); 
    setGrade(initialGrade);
    setOriginalGrade(JSON.parse(JSON.stringify(initialGrade))); // Clone profundo para rastreio
  }, [selectedCourses, turmasDoCurso, curriculumData, globalTeachersList, schedules, selectedType, selectedWeek, selectedConfigYear, teacherFilter]);

  // Agrupa as aulas pendentes por Turma (Ordenadas Alfabeticamente)
  const neutrasPorTurma = useMemo(() => {
    const agrupado = aulasNeutras.reduce((acc, aula) => {
      if (!acc[aula.className]) acc[aula.className] = [];
      acc[aula.className].push(aula);
      return acc;
    }, {});
    
    Object.keys(agrupado).forEach(turma => {
      agrupado[turma].sort((a, b) => a.disciplina.localeCompare(b.disciplina));
    });

    return agrupado;
  }, [aulasNeutras]);

  // === MOTOR DE PREVENÇÃO DE CONFLITOS (CHOQUE DE HORÁRIO) ===
  const verificarChoqueHorario = (teacherIdsArray, sala, diaId, hora, currentClassId) => {
    let pMsg = [];
    let sMsg = null;
    let profDetails = []; // { tId, otherClassName }
    let salaDetail = null; // { sala, otherClassName }

    // 1. Verifica na grade que está sendo editada na tela agora
    for (const [key, aula] of Object.entries(grade)) {
      const [kClassId, kDiaId, kHora] = key.split('|');
      if (kDiaId === String(diaId) && kHora === hora && kClassId !== String(currentClassId)) {
         for (const tId of teacherIdsArray) {
           if (tId && !isTeacherPending(tId) && aula.teacherIds?.includes(tId)) {
              const msg = `O professor ${tId} já está na turma ${aula.className}.`;
              if (!pMsg.includes(msg)) pMsg.push(msg);
              profDetails.push({ tId, otherClassName: aula.className });
           }
         }
         if (sala && aula.sala && aula.sala === sala) {
            sMsg = `O ambiente "${sala}" já está alocado para a turma ${aula.className}.`;
            salaDetail = { sala, otherClassName: aula.className };
         }
      }
    }

    // 2. Verifica no banco global (outros cursos)
    const relRows = schedules?.filter(s => {
       const dbD = isNaN(s.dayOfWeek) ? String(s.dayOfWeek) : String(MAP_DAYS[s.dayOfWeek]);
       return dbD === String(diaId) && s.slotId === hora && String(s.classId) !== String(currentClassId);
    }) || [];
    for (const row of relRows) {
       for (const tId of teacherIdsArray) {
         if (tId && !isTeacherPending(tId) && row.teacherId && String(row.teacherId).split(',').includes(String(tId))) {
            const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
            const msg = `Este professor ${tId} já está alocado na turma externa "${turmaConflito?.name || 'Desconhecida'}".`;
            if (!pMsg.includes(msg)) pMsg.push(msg);
            profDetails.push({ tId, otherClassName: turmaConflito?.name || 'Externa' });
         }
       }
       if (sala && row.room && row.room === sala) {
          const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
          sMsg = `O espaço/sala "${sala}" já está sendo usado pela turma "${turmaConflito?.name || 'Externa'}".`;
          salaDetail = { sala, otherClassName: turmaConflito?.name || 'Externa' };
       }
    }
    
    if (pMsg.length > 0 || sMsg) {
      return { 
        profMsg: pMsg.join(' '), 
        salaMsg: sMsg, 
        profDetails, 
        salaDetail 
      };
    }
    return null;
  };

  // === FUNÇÕES DE DRAG AND DROP ===
  const handleDragStart = (e, aula, origem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ aula, origem }));
    setDraggedItem({ aula, origem });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDropSlot = (e, classId, diaId, hora) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const { aula, origem } = JSON.parse(data);
    
    if (String(aula.classId) !== String(classId)) {
      setDropAlert(`Ação bloqueada: Tentativa de alocar turma ${aula.className} em coluna de outra turma.`);
      return;
    }

    const slotKey = `${classId}|${diaId}|${hora}`;

    if (grade[slotKey] && origem === 'neutra') {
      setDropAlert("Este card já está ocupado por outra disciplina desta turma!");
      return;
    }

    // Calcula de antemão os slots que tentará preencher
    const dropsToMake = [];
    if (origem !== 'neutra') {
       dropsToMake.push({ slotKey, hora });
    } else {
         const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];
         const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id) && !extraTypes.includes(g.classType)).length;
         const maxEsperado = aula.numAulas || 1;
         const faltando = maxEsperado - countInGrid;
         const aulasAmount = faltando > 0 ? faltando : 1;
         
         const startIndex = horariosExibidos.indexOf(hora);
         if (startIndex !== -1) {
             let placed = 0;
             let currentIdx = startIndex;
             
             // Descobre em qual turno o card foi solto inicialmente
             const getShift = (timeStr) => {
                 const h = parseInt(timeStr.split(':')[0], 10);
                 if (h < 12) return 'M';
                 if (h >= 12 && h < 18) return 'T';
                 return 'N';
             };
             const startShift = getShift(hora);

             while (placed < aulasAmount && currentIdx < horariosExibidos.length) {
                 const targetHora = horariosExibidos[currentIdx];
                 
                 // Regra de Negócio: Impede que a alocação em cascata invada o próximo turno
                 if (getShift(targetHora) !== startShift) {
                     break;
                 }

                 const slotK = `${classId}|${diaId}|${targetHora}`;
                 
                 // Preenche se o slot estiver vazio (ou sobrescreve o primeiro se o usuário forçou)
                 if (!grade[slotK] || placed === 0) {
                     dropsToMake.push({ slotKey: slotK, hora: targetHora });
                     placed++;
                 }
                 currentIdx++;
             }
         }
    }

    // Identifica todos os conflitos dos drops agrupados
    const conflicts = [];
    for (const drop of dropsToMake) {
        const check = verificarChoqueHorario(aula.teacherIds, aula.sala, diaId, drop.hora, classId);
        if (check) {
           conflicts.push(`[${drop.hora}] ${[check.profMsg, check.salaMsg].filter(Boolean).join(' | ')}`);
        }
    }

    if (conflicts.length > 0) {
       setPendingDrop({
          aula, origem, classId, diaId,
          dropsToMake,
          conflicts
       });
    } else {
       executeDrop(aula, origem, dropsToMake);
    }
  };

  const executeDrop = (aula, origem, dropsToMake) => {
      setGrade(prev => {
         const novaGrade = { ...prev };
         if (origem !== 'neutra') {
            delete novaGrade[origem];
            novaGrade[dropsToMake[0].slotKey] = aula;
         } else {
            dropsToMake.forEach(d => {
               novaGrade[d.slotKey] = aula;
            });
         }
         return novaGrade;
      });
      setPendingDrop(null);
  };

  const handleDropNeutra = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const { origem } = JSON.parse(data);

    if (origem !== 'neutra') {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
    }
  };

  const handleClonePreviousYear = async () => {
    if (!cloneSourceYear) return;
    try {
      const response = await fetch('/api/schedules?academicYear=' + cloneSourceYear, { headers: getHeaders() });
      if (!response.ok) throw new Error("Falha ao buscar grade do ano anterior");
      const data = await response.json();
      
      const filtered = data.filter(s => 
        selectedCourses.includes(String(s.courseId)) && 
        s.type === 'padrao'
      );
      
      const idsTurmas = turmasDoCurso.map(t => String(t.id));
      const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
      const aulasReais = disciplinasDoCurso.map(disciplina => ({
        id: disciplina.id || Math.random().toString(),
        disciplineId: disciplina.disciplineId,
        classId: String(disciplina.classId),
        courseId: String(disciplina.courseId),
        className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
        disciplina: disciplina.subjectName,
        teacherIds: disciplina.teacherIds,
        professores: disciplina.teacherIds.map(id => resolveTeacherName(id, globalTeachersList)),
        sala: disciplina.room || '', 
        cor: getColorHash(disciplina.subjectName),
        numAulas: disciplina.numAulas || 1
      }));

      const clonedGrade = {};
      const aulasAlocadasIds = [];
      filtered.forEach(schedule => {
        let refCard;
        if (schedule.disciplineId) {
            refCard = aulasReais.find(a => String(a.id) === `${schedule.classId}_${schedule.disciplineId}` || String(a.id) === String(schedule.disciplineId));
        }
        if (!refCard) refCard = aulasReais.find(a => String(a.classId) === String(schedule.classId) && a.teacherIds?.join(',') === String(schedule.teacherId));
        if (refCard) {
             const dbTeacherIds = schedule.teacherId ? String(schedule.teacherId).split(',') : null;
             const currentTeacherIds = refCard.teacherIds || [];
             
             let teacherChanged = false;
             if (dbTeacherIds) {
                 const sortedDb = [...dbTeacherIds].sort();
                 const sortedCurr = [...currentTeacherIds].sort();
                 teacherChanged = dbTeacherIds.length !== currentTeacherIds.length || sortedDb.some((val, idx) => val !== sortedCurr[idx]);
             }

             const dbDayNorm = isNaN(schedule.dayOfWeek) ? String(schedule.dayOfWeek) : String(MAP_DAYS[schedule.dayOfWeek]);
             clonedGrade[`${schedule.classId}|${dbDayNorm}|${schedule.slotId}`] = {
                 ...refCard,
                 sala: schedule.room || refCard.sala,
                 teacherIds: dbTeacherIds || currentTeacherIds,
                 professores: dbTeacherIds ? dbTeacherIds.map(id => resolveTeacherName(id, globalTeachersList)) : refCard.professores,
                 teacherChanged: teacherChanged
             };
             aulasAlocadasIds.push(String(refCard.id));
        }
      });
      
      setAulasNeutras(aulasReais);
      setGrade(clonedGrade);
      setOriginalGrade(JSON.parse(JSON.stringify(clonedGrade)));
      
      setShowCloneModal(false);
      setCloneSourceYear('');
      setSystemDialog({ isOpen: true, type: 'alert', title: 'Clonagem Concluída', message: 'Grade baseada no padrão do ano anterior carregada na tela. Faça os ajustes e depois clique em Salvar Novo para registrar.' });
    } catch (err) {
      setSystemDialog({ isOpen: true, type: 'alert', title: 'Erro de Clonagem', message: err.message });
    }
  };

  // === CONCENTRADOR GLOBAL DE ALERTAS ===
  const [isSaving, setIsSaving] = useState(false);

  // FUNÇÃO DE SALVAMENTO FUNCIONAL (Fase 5 - Restaurando Modal de Pipeline)
  const handleSaveSchedule = () => {
    if ((!isDirty && selectedType !== 'padrao') || isSaving) return;
    setSaveOptions({ type: selectedType || 'previa', weekId: selectedWeek || '' });
    setModalMode('save');
  };

  const dashboardAlerts = useMemo(() => {
    const alerts = [];
    const cellAlerts = {}; 
    const teacherConflictsTracker = new Set();
    const roomConflictsTracker = new Set();

    Object.entries(grade).forEach(([slotKey, aula]) => {
      const [classId, diaId, hora] = slotKey.split('|');
      cellAlerts[slotKey] = { profAlert: false, profAlertMsg: [], salaAlert: false, salaText: '' };

      if (aula && aula.teacherIds && aula.teacherIds.length > 0 && aula.teacherIds[0] !== 'A Definir' && aula.teacherIds[0] !== '-') {
         const strConflito = verificarChoqueHorario(aula.teacherIds, aula.sala, diaId, hora, classId);
         if (strConflito) {
            if (strConflito.profDetails && strConflito.profDetails.length > 0) {
                cellAlerts[slotKey].profAlert = true;
                cellAlerts[slotKey].profAlertMsg.push(strConflito.profMsg);
                
                strConflito.profDetails.forEach(detail => {
                    const uniqueKey = `${detail.tId}_${diaId}_${hora}_${classId}_${detail.otherClassName}`;
                    if (!teacherConflictsTracker.has(uniqueKey)) {
                        teacherConflictsTracker.add(uniqueKey);
                        const profName = resolveTeacherName(detail.tId, globalTeachersList) || detail.tId;
                        alerts.push(`[${diaId} às ${hora} | Turma: ${aula.className}] - Choque de Professor: ${profName} também está alocado(a) na turma ${detail.otherClassName}.`);
                    }
                });
            }

            if (strConflito.salaDetail) {
                cellAlerts[slotKey].salaAlert = true;
                cellAlerts[slotKey].salaText = strConflito.salaMsg;
                
                const detail = strConflito.salaDetail;
                const uniqueKey = `${detail.sala}_${diaId}_${hora}_${classId}_${detail.otherClassName}`;
                if (!roomConflictsTracker.has(uniqueKey)) {
                    roomConflictsTracker.add(uniqueKey);
                    alerts.push(`[${diaId} às ${hora} | Turma: ${aula.className}] - Choque de Ambiente: '${detail.sala}' também está alocado para a turma ${detail.otherClassName}.`);
                }
            }
         }

         aula.teacherIds.forEach(tId => {
             if (isTeacherPending(tId)) return;
             const profSlots = new Set();
             for (const [k, dObj] of Object.entries(grade)) {
                 if (k.split('|')[1] === diaId && dObj.teacherIds?.includes(tId)) profSlots.add(k.split('|')[2]);
             }
             schedules?.forEach(s => {
                 const dbD = isNaN(s.dayOfWeek) ? String(s.dayOfWeek) : String(MAP_DAYS[s.dayOfWeek]);
                 if (dbD === diaId && s.teacherId && String(s.teacherId).split(',').includes(String(tId))) profSlots.add(s.slotId);
             });

             let m = false; let t = false; let n = false;
             const morningEnds = horariosExibidos.filter(h => parseInt(h.split(':')[0], 10) < 12).pop();
             const afternoonStarts = horariosExibidos.find(h => { const v = parseInt(h.split(':')[0],10); return v >= 12 && v < 18; });
             if (profSlots.has(morningEnds) && profSlots.has(afternoonStarts) && (hora === morningEnds || hora === afternoonStarts)) {
                 const noRest = "Sem descanso (Manhã -> Tarde).";
                 cellAlerts[slotKey].profAlertMsg.push(noRest);
                 cellAlerts[slotKey].profAlert = true;
                 const pName = resolveTeacherName(tId, globalTeachersList);
                 if (!alerts.some(a => a.includes(`[${diaId}] Professor(a) ${pName} leciona sem descanso`))) {
                     alerts.push(`[${diaId}] Professor(a) ${pName} leciona sem descanso entre Turnos (M->T).`);
                 }
             }

             profSlots.forEach(pt => {
                const val = parseInt(pt.split(':')[0], 10);
                if (val < 12) m = true; else if (val >= 12 && val < 18) t = true; else n = true;
             });
             if (m && t && n) {
                const threeShifts = "Alocado em 3 Turnos no dia.";
                cellAlerts[slotKey].profAlertMsg.push(threeShifts);
                cellAlerts[slotKey].profAlert = true;
                const pName = resolveTeacherName(tId, globalTeachersList);
                if (!alerts.some(a => a.includes(`[${diaId}] Professor(a) ${pName} atua`))) {
                     alerts.push(`[${diaId}] Professor(a) ${pName} atua em 3 Turnos diferentes.`);
                }
             }
         });
      }
    });
    // Filtro de desduplicação cruzada de alertas (Ex: Turma A acusando B, e Turma B acusando A)
    const uniqueAlerts = [];
    const seenMsgs = new Set();
    
    alerts.forEach(a => {
        let signature = a;
        // Processamento Regex para capturar os espelhos bidirecionais
        const choqueMatch = a.match(/\[(.*?) \| Turma: (.*?)\] - Choque de (.*?): .* turma (.*?)\.?$/);
        
        if (choqueMatch) {
             const [_, diaHora, turmaA, tipoChoque, turmaB] = choqueMatch;
             // Remove aspas caso seja a mensagem de "turma externa" e limpa espaços
             const cleanTurmaA = String(turmaA).trim();
             const cleanTurmaB = String(turmaB).replace(/["']/g, '').trim();
             // Ordena para que choque A->B tenha a mesma assinatura que choque B->A
             const turmasEspelhadas = [cleanTurmaA, cleanTurmaB].sort().join('<->');
             signature = `${diaHora}|${tipoChoque}|${turmasEspelhadas}`;
        }
        
        if (!seenMsgs.has(signature)) {
            seenMsgs.add(signature);
            uniqueAlerts.push(a);
        }
    });

    return { list: uniqueAlerts, perCell: cellAlerts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, schedules, horariosExibidos]);

  const weeksWithData = useMemo(() => {
     if (!schedules || !Array.isArray(schedules)) return new Set();
     const s = new Set();
     schedules.forEach(sch => {
        if (sch.type === selectedType && String(sch.academic_year) === String(selectedConfigYear)) {
           if (selectedCourses.length === 0 || selectedCourses.includes(String(sch.courseId))) {
               if (sch.week_id) s.add(String(sch.week_id));
           }
        }
     });
     return s;
  }, [schedules, selectedType, selectedConfigYear, selectedCourses]);

  const activeRequestsForWeek = useMemo(() => {
     if (selectedType === 'padrao' || !selectedWeek || changeRequests.length === 0) return [];
     return changeRequests
       .filter(req => String(req.week_id) === String(selectedWeek))
       .sort((a, b) => {
         const ta = new Date(a.updated_at || a.created_at || a.createdAt || 0).getTime();
         const tb = new Date(b.updated_at || b.created_at || b.createdAt || 0).getTime();
         return tb - ta;
       });
  }, [changeRequests, selectedWeek, selectedType]);

  const filteredRequests = activeRequestsForWeek.filter(req => !dismissedRequests.includes(req.id));
  const requestAlertsCount = filteredRequests.length;
  const gradeAlertsCount = dashboardAlerts.list.length;
  const totalAlerts = requestAlertsCount + gradeAlertsCount;
  const quickBadgeCount = (pendingRequests?.length || 0) + gradeAlertsCount;

  const [isAlertsMinimized, setIsAlertsMinimized] = useState(false);
  const [prevAlertCount, setPrevAlertCount] = useState(0);

  useEffect(() => {
     if (totalAlerts > prevAlertCount) {
         setIsAlertsMinimized(false);
     }
     setPrevAlertCount(totalAlerts);
  }, [totalAlerts, prevAlertCount]);

  const isDirty = useMemo(() => {
    return JSON.stringify(grade) !== JSON.stringify(originalGrade);
  }, [grade, originalGrade]);

  return (
    <div className={`flex flex-col gap-4 animate-in fade-in duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
      
      {ofertasModal.length > 0 && (
          <div className="fixed inset-0 z-[200] flex justify-center items-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
             <div className={`w-full max-w-lg rounded-2xl shadow-xl border overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-200'}`}>
                <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-rose-900/20 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
                   <div className="flex items-center gap-3 text-rose-500">
                      <AlertCircle size={24} />
                      <h3 className="font-black uppercase tracking-widest text-sm">Avisos de Aulas Disponíveis</h3>
                   </div>
                   <button onClick={() => setOfertasModal([])} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                   <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Detectamos que professores disponibilizaram suas aulas na semana atualmente selecionada.
                   </p>
                   {ofertasModal.map(req => (
                      <div key={req.id} className={`p-4 rounded-xl border flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                         <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-widest text-indigo-500">{req.subject}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded outline outline-1 outline-current">{req.target_class}</span>
                         </div>
                         <span className="text-[10px] uppercase font-bold tracking-widest text-rose-500">Prof: {resolveTeacherName(req.requester_id, globalTeachersList)}</span>
                         <span className="text-[10px] italic opacity-80 mt-1">{req.reason} | {req.obs}</span>
                      </div>
                   ))}
                </div>
                <div className={`p-4 border-t text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-3 leading-tight">As marcações destas vagas (e avisos de "Oferecida") já aparecem visualmente no Mastergrid.<br/>Para aprová-las definitivamente para aceite dos professores, use a aba "Solicitações".</p>
                   <button onClick={() => setOfertasModal([])} className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all w-full">ESTOU CIENTE</button>
                </div>
             </div>
          </div>
      )}

      {/* CABEÇALHO */}
      {/* CABEÇALHO ORGANIZADO EM DUAS LINHAS */}
      <div className={`p-5 rounded-xl border shadow-sm flex flex-col gap-5 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        
        {/* LINHA 1: TÍTULO E BOTÕES DE AÇÃO PRIMÁRIOS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
               <CalendarDays size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest">Matriz do Curso</h2>
              <p className="text-xs text-slate-400 font-bold tracking-wider mt-0.5">Visão simultânea de todas as turmas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {hiddenClasses.length > 0 && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-sm transition-colors ${isDarkMode ? 'bg-rose-900/10 border-rose-800/30' : 'bg-rose-50 border-rose-200'}`}>
                 <Eye size={16} className={isDarkMode ? 'text-rose-400' : 'text-rose-600'} />
                 <select
                    value=""
                    onChange={(e) => {
                       const val = e.target.value;
                       if (val === 'all') {
                          setHiddenClasses([]);
                       } else if (val) {
                          setHiddenClasses(prev => prev.filter(id => id !== val));
                       }
                    }}
                    className={`bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer w-full max-w-[180px] truncate ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}
                    title="Restaurar turmas ocultas"
                 >
                    <option value="" disabled className={isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700'}>
                       {hiddenClasses.length} Oculta(s)...
                    </option>
                    <option value="all" className={`font-bold ${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-600'}`}>
                       ++ Restaurar Todas
                    </option>
                    <optgroup label="Restaurar Individual:" className={isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500'}>
                      {hiddenClasses.map(hcId => {
                         const turmaOculta = classesList?.find(c => String(c.id) === String(hcId));
                         return (
                           <option key={hcId} value={hcId} className={isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700'}>
                             {turmaOculta?.name || 'Turma Desconhecida'}
                           </option>
                         );
                      })}
                    </optgroup>
                 </select>
              </div>
            )}

            <button onClick={() => setShowCloneModal(true)} disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm">
               <Layers size={16} /> Clonar Anterior
            </button>

            <button 
             onClick={handleLimparTela} 
             className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
           >
              <Trash2 size={16} /> Limpar
           </button>

           <div className="relative group">
               <button 
                 onClick={handleSaveSchedule} 
                 disabled={selectedCourses.length === 0 || (!isDirty && selectedType !== 'padrao') || isSaving} 
                 className={`flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                   isDirty 
                     ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.5)] border-emerald-400/50 cursor-pointer' 
                     : (selectedType === 'padrao' && selectedCourses.length > 0)
                       ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 cursor-pointer shadow-sm'
                       : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                 }`}
               >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                  <span>{isSaving ? 'Salvando...' : (isDirty ? 'Publicar Alterações' : (selectedType === 'padrao' ? 'Desdobrar Padrão' : 'Sem Pendências'))}</span>
                  {isDirty && !isSaving && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-white shadow-lg animate-bounce">!</div>}
               </button>
               {isDirty && !isSaving && (
                 <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 p-2 px-3 rounded-lg bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                    Há mudanças não salvas na grade
                 </div>
               )}
            </div>
           
           <button onClick={() => setIsRightPanelOpen(true)} className={`relative flex items-center justify-center gap-2 disabled:opacity-50 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              <Bell size={16} /> Central de Alertas
              {totalAlerts > 0 && <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white w-5 h-5 flex flex-col items-center justify-center rounded-full text-[10px] animate-pulse shadow">{totalAlerts > 9 ? '9+' : totalAlerts}</span>}
           </button>
          </div>
        </div>

        {/* LINHA 2: BARRA DE FILTROS E CONFIGURAÇÕES DE VISUALIZAÇÃO */}
        <div className={`p-3 rounded-xl flex flex-wrap items-center gap-3 border ${isDarkMode ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm">
             <CalendarDays size={14} className="text-emerald-500" />
             <select 
               value={String(selectedConfigYear)} 
               onChange={(e) => { setSelectedCourses([]); setGrade({}); setAulasNeutras([]); setSelectedConfigYear(e.target.value); }}
               className="bg-transparent text-sm font-black outline-none cursor-pointer w-[60px] text-emerald-700 dark:text-emerald-400"
             >
               {academicYearsMeta && Object.keys(academicYearsMeta).length > 0 ? (
                 Object.keys(academicYearsMeta).sort((a,b)=>b-a).map(yr => <option key={yr} value={yr}>{yr}</option>)
               ) : <option value={selectedConfigYear}>{selectedConfigYear}</option>}
             </select>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden sm:block"></div>



          <select value={selectedType} onChange={handleTypeChange} className={`px-4 py-2.5 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
              <option value="padrao">Padrão Anual (Base)</option>
              <option value="previa">Prévia Semanal</option>
              <option value="atual">Horário Atual</option>
              <option value="oficial">Histórico Oficial</option>
          </select>

          {selectedType === 'padrao' ? (
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className={`px-4 py-2.5 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
              <option value="">-- Versão do Padrão --</option>
              {Array.from({ length: Math.max(4, schedules.filter(s => s.type === 'padrao' && s.week_id?.startsWith('V')).reduce((max, s) => Math.max(max, parseInt(s.week_id.replace('V', '')) || 1), 1)) }).map((_, i) => {
                  const vLabel = `V${i + 1}`;
                  // Versão 1 trata nulo/vazio como "V1" por ser a versão raiz histórica
                  const hasData = weeksWithData.has(vLabel) || (i === 0 && weeksWithData.has('')); 
                  return (
                    <option key={vLabel} value={vLabel} className={hasData ? (isDarkMode ? 'bg-emerald-900/60 text-emerald-400 font-black' : 'bg-emerald-100 text-emerald-700 font-black') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                       {hasData ? '✔ ' : '⏳ '}Versão {i + 1} ({vLabel}) {hasData ? '(Preenchida)' : ''}
                    </option>
                  );
              })}
            </select>
          ) : (
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className={`px-4 py-2.5 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
              <option value="">-- Semana --</option>
              {academicWeeks?.filter(w => String(w.academic_year) === String(selectedConfigYear)).sort((a,b) => (a.start_date || '').localeCompare(b.start_date || '') || ((parseInt((a.name||'').replace(/\\D/g, ''))||0) - (parseInt((b.name||'').replace(/\\D/g, ''))||0))).map(w => {
                 const hasData = weeksWithData.has(String(w.id));
                 const d1 = w.start_date?.split('-');
                 const d2 = w.end_date?.split('-');
                 const dateLabel = (d1?.length === 3 && d2?.length === 3) ? ` (${d1[2]}/${d1[1]} a ${d2[2]}/${d2[1]})` : '';
                 return (
                    <option key={w.id} value={w.id} className={hasData ? (isDarkMode ? 'bg-emerald-900/60 text-emerald-400 font-black' : 'bg-emerald-100 text-emerald-700 font-black') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                       {hasData ? '✔ ' : '⏳ '}{w.name}{dateLabel} {hasData ? '(Preenchida)' : ''}
                    </option>
                 )
              })}
            </select>
          )}

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden sm:block"></div>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
             <div onClick={() => setIsCoursesOpen(!isCoursesOpen)} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border shadow-sm cursor-pointer transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                   <Filter size={14} className="text-slate-400" />
                   <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                     {selectedCourses.length === 0 ? 'Selecionar Cursos' : `${selectedCourses.length} Curso(s) da Matriz`}
                   </span>
                </div>
                <span className="text-[9px] opacity-50">{isCoursesOpen ? '▲' : '▼'}</span>
             </div>
             
             {isCoursesOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setIsCoursesOpen(false)} />
                   <div className="absolute top-12 left-0 w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl flex flex-col z-50 max-h-64 overflow-y-auto gap-1">
                      {courses?.map(c => (
                       <label key={c.id} className="flex items-center gap-3 text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2.5 rounded-lg transition-colors group/label">
                         <input type="checkbox" className="accent-emerald-500 w-4 h-4 cursor-pointer" checked={selectedCourses.includes(String(c.id))} onChange={(e) => {
                           if (e.target.checked) setSelectedCourses(p => [...p, String(c.id)]);
                           else setSelectedCourses(p => p.filter(id => id !== String(c.id)));
                         }} />
                         <span className="group-hover/label:text-emerald-600 dark:group-hover/label:text-emerald-400">{c.name}</span>
                       </label>
                     ))}
                     {courses?.length === 0 && <span className="text-xs p-3 text-center opacity-50">Nenhum curso.</span>}
                   </div>
                 </>
             )}
           </div>
           <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} className={`px-4 py-2.5 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
              <option value="todos">Todos os Turnos</option>
              <option value="diurno">Diurno (Mat/Vesp)</option>
              <option value="noturno">Noturno</option>
           </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* ÁREA NEUTRA (Lateral Esquerda) */}
        <div 
          className={`lg:w-[22.5%] shrink-0 p-3 rounded-xl border shadow-sm flex flex-col h-[75vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          onDragOver={handleDragOver}
          onDrop={handleDropNeutra}
        >
          {(() => {
            const filteredNeutras = Object.entries(neutrasPorTurma)
              .sort((a, b) => {
                const turmaA = turmasDoCurso.find(c => c.name === a[0]);
                const turmaB = turmasDoCurso.find(c => c.name === b[0]);
                if (!turmaA || !turmaB) return 0;
                
                const courseCompare = String(turmaA.courseId).localeCompare(String(turmaB.courseId));
                if (courseCompare !== 0) return courseCompare;
                
                return turmaA.name.localeCompare(turmaB.name);
              })
              .filter(([nomeTurma]) => {
                const turmaObj = turmasDoCurso.find(t => t.name === nomeTurma);
                return turmaObj && !hiddenClasses.includes(turmaObj.id);
              });

            const totalMissing = filteredNeutras.reduce((acc, [_, aulas]) => {
              return acc + aulas.reduce((sum, aula) => {
                const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];
                const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id) && !extraTypes.includes(g.classType)).length;
                const qtyPadrao = aula.numAulas || 1;
                return sum + (qtyPadrao - countInGrid);
              }, 0);
            }, 0);

            return (
              <>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between border-b pb-2 border-slate-700/50">
                  <span className="flex items-center gap-2"><AlertCircle size={14} /> Disciplinas Pendentes</span>
                  <span className={`px-2 py-0.5 rounded text-white shadow-sm ${totalMissing > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} title="Saldo de aulas (Vermelho = Faltam na Grade / Verde = Grade Completa ou Excedente)">
                    {totalMissing}
                  </span>
                </h3>
                
                <div className="flex flex-col gap-4">
                  {selectedCourses.length === 0 && (
                    <div className="text-center text-slate-400 text-xs mt-10 p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                      Selecione os Cursos para carregar as disciplinas.
                    </div>
                  )}

                  {filteredNeutras.map(([nomeTurma, aulas]) => (
              <div key={nomeTurma} className="mb-2">
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{nomeTurma}</div>
                <div className="flex flex-col gap-2">
                  {aulas.map(aula => {
                    const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];
                    const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id) && !extraTypes.includes(g.classType)).length;
                    const qtyPadrao = aula.numAulas || 1;
                    const isZero = countInGrid === 0;

                    return (
                      <div 
                        key={aula.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, aula, 'neutra')}
                        onDragEnd={handleDragEnd}
                        className={`w-full p-2 rounded border shadow-sm flex flex-col gap-1 cursor-grab hover:ring-2 hover:border-emerald-500 ring-emerald-500 transition-all ${isZero ? (isDarkMode ? 'bg-amber-950/20 border-amber-600/50' : 'bg-orange-50/60 border-orange-300') : 'border-l-4 border-l-emerald-500'}`}
                        style={!isZero ? getCardStyle(aula.courseId, aula.classId, aula.disciplina, isDarkMode) : {}}
                      >
                       <div className="flex justify-between items-start gap-1">
                         <div className="flex items-start gap-1 overflow-hidden pt-0.5">
                           <GripVertical size={12} className={`shrink-0 ${isZero ? 'text-amber-500' : 'text-slate-400'}`} />
                           <div className={`flex flex-col w-[85%] leading-none pt-0.5 ${isZero ? 'text-amber-600 dark:text-amber-500' : ''}`} title={`${aula.disciplina} - ${aula.className}`}>
                             <span className="text-[10px] font-black uppercase tracking-widest truncate">{aula.disciplina}</span>
                             <span className="text-[7px] opacity-75 font-bold tracking-widest truncate mt-0.5">{aula.className}</span>
                           </div>
                         </div>
                         <div title="Meta de Aulas Semanais Recomendadas / Aulas Já Alocadas" className={`flex items-center gap-1.5 text-[7px] font-black px-1 py-[2px] rounded flex-shrink-0 shadow-sm ${isZero ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-emerald-100 text-emerald-750 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                           <span className="flex items-center gap-0.5" title="Carga Horária Semanal"><Target size={8} /> {qtyPadrao}</span>
                           <span className="opacity-40 font-light">/</span>
                           <span className={`flex items-center gap-0.5 ${countInGrid >= qtyPadrao && countInGrid > 0 ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : ''}`} title="Alocadas neste Horário"><CheckCircle2 size={8} /> {countInGrid}</span>
                         </div>
                       </div>
                       <div className="flex justify-between items-center pl-4 pr-1 mt-1">
                          <span className="text-[8px] font-bold text-slate-500 truncate max-w-[80px]">{aula.professores?.map(p => p.split(' ')[0]).join(' + ')}</span>
                          <span className="text-[8px] text-slate-400 flex items-center gap-0.5 truncate bg-black/5 dark:bg-white/5 px-1 py-[1px] rounded"><MapPin size={8} /> {aula.sala ? aula.sala.slice(0, 8) : 'S/Sala'}</span>
                       </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          </>
        );
      })()}
    </div>

        {/* GRADE MATRIZ PRINCIPAL (As Turmas lado a lado) */}
        <div className={`w-full p-4 rounded-xl border shadow-sm h-[75vh] overflow-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {selectedCourses.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-400 font-bold">
               Nenhum curso selecionado.
             </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px] print:w-full print:min-w-0 print:max-w-none print:table-fixed print:border-collapse">
              <thead className={`sticky top-0 z-40 shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                <tr>
                  <th className={`py-2 px-2 w-20 sticky left-0 top-0 z-50 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}></th>
                  {turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).map(turma => {
                    const aulasDaTurma = aulasNeutras.filter(a => String(a.classId) === String(turma.id));
                    const saldoTurma = aulasDaTurma.reduce((acc, aula) => {
                      const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];
                      const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id) && !extraTypes.includes(g.classType)).length;
                      const qtyPadrao = aula.numAulas || 1;
                      return acc + (qtyPadrao - countInGrid);
                    }, 0);

                    return (
                    <th key={turma.id} className={`py-2 px-2 text-center text-[11px] font-black uppercase tracking-widest border-b-2 bg-inherit group/th transition-all duration-300 ${draggedItem && String(draggedItem.aula.classId) !== String(turma.id) ? 'opacity-30 grayscale pointer-events-none' : ''} ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-center gap-2 relative w-full h-full">
                         <span className="truncate max-w-[120px]">{turma.name}</span>
                         <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black text-white shadow-sm min-w-[20px] ${saldoTurma > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} title={saldoTurma > 0 ? `Faltam ${saldoTurma} aulas na grade` : saldoTurma < 0 ? `Excedente de ${Math.abs(saldoTurma)} aulas` : 'Grade Completa'}>
                           {saldoTurma}
                         </span>
                         <div className="absolute right-0 flex items-center gap-1 opacity-0 group-hover/th:opacity-100 transition-opacity bg-inherit pl-2">
                            <button 
                               onClick={() => {
                                  const otherClassIds = turmasDoCurso.map(t => String(t.id)).filter(id => id !== String(turma.id));
                                  if (otherClassIds.length === 0) return;
                                  const isIsolated = otherClassIds.every(id => hiddenClasses.includes(id));
                                  if (isIsolated) {
                                      setHiddenClasses([]); // Volta para todas as turmas
                                  } else {
                                      setHiddenClasses(otherClassIds); // Foca nesta turma (ocultando as demais)
                                  }
                               }} 
                               title={hiddenClasses.length > 0 && turmasDoCurso.map(t => String(t.id)).filter(id => id !== String(turma.id)).every(id => hiddenClasses.includes(id)) ? "Remover Modo Foco (Mostrar todas as turmas)" : "Modo Foco: Mostrar apenas esta turma"} 
                               className={`hover:text-indigo-500 transition-colors rounded shadow-sm border p-0.5 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}
                             >
                                <Target size={12} />
                             </button>
                            <button 
                              onClick={() => setHiddenClasses(prev => [...prev, turma.id])} 
                              title="Ocultar Turma" 
                              className={`hover:text-rose-500 transition-colors rounded shadow-sm border p-0.5 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}
                            >
                               <EyeOff size={12} />
                            </button>
                         </div>
                      </div>
                    </th>
                  )})}
                </tr>
              </thead>
              <tbody>
                {diasExibidos.map((diaNome) => {
                  const diaId = diaNome;
                  return (
                  <React.Fragment key={diaId}>
                    {/* Linha Divisória do Dia com Botão de Feriado */}
                    <tr>
                      <td className={`py-2 px-1 text-center sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[80px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className="flex flex-col items-center gap-1.5">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{diaNome.split('-')[0]}</span>
                           <button onClick={() => toggleDisabledDay(diaNome)} title={disabledDays.has(diaNome) ? "Ativar dia letivo manual" : "Marcar como Feriado ou Não Letivo"} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${disabledDays.has(diaNome) ? 'bg-rose-500 text-white' : 'bg-transparent border border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'}`}>
                              {disabledDays.has(diaNome) ? "Feriado" : "Letivo"}
                           </button>
                        </div>
                      </td>
                      <td colSpan={turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).length} className={`p-0 border-none ${isDarkMode ? 'bg-slate-700/50' : 'bg-emerald-50'}`}></td>
                    </tr>
                    
                    {disabledDays.has(diaNome) && (
                      <tr className={`border-b-4 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                         <td className={`py-8 text-center sticky left-0 z-30 text-[9px] uppercase tracking-[0.3em] font-black opacity-30 ${isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-500 bg-slate-100'}`}></td>
                         <td colSpan={turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).length} className="text-center font-black uppercase tracking-[0.5em] text-xs py-8 opacity-40 select-none">
                            <div className="flex flex-col items-center justify-center gap-2">
                               NÃO LETIVO / FERIADO
                            </div>
                         </td>
                      </tr>
                    )}

                    {/* Horários do Dia */}
                    {!disabledDays.has(diaNome) && horariosExibidos.map((hora, index) => {
                      const numHora = parseInt(hora.split(':')[0], 10);
                      
                      const isMorning = numHora < 12;
                      const isAfternoon = numHora >= 12 && numHora < 18;
                      const isEven = index % 2 === 0;

                      let rowBgClass = '';
                      if (isMorning) {
                          rowBgClass = isEven ? (isDarkMode ? 'bg-sky-950/20' : 'bg-sky-50/40') : (isDarkMode ? 'bg-sky-950/10' : 'bg-sky-50/10');
                      } else if (isAfternoon) {
                          rowBgClass = isEven ? (isDarkMode ? 'bg-amber-950/20' : 'bg-amber-50/40') : (isDarkMode ? 'bg-amber-950/10' : 'bg-amber-50/10');
                      } else {
                          rowBgClass = isEven ? (isDarkMode ? 'bg-indigo-950/20' : 'bg-indigo-50/40') : (isDarkMode ? 'bg-indigo-950/10' : 'bg-indigo-50/10');
                      }

                      const isAfternoonStart = index > 0 && numHora >= 12 && parseInt(horariosExibidos[index-1].split(':')[0], 10) < 12;
                      const isNightStart = index > 0 && numHora >= 18 && parseInt(horariosExibidos[index-1].split(':')[0], 10) < 18;
                      
                      return (
                      <React.Fragment key={`${diaId}-${hora}`}>
                        {(isAfternoonStart || isNightStart) && (
                           <tr>
                              <td className={`p-0 h-[3px] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></td>
                              <td colSpan={turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).length} className="p-0 h-[3px] bg-slate-300 dark:bg-slate-700 border-none"></td>
                           </tr>
                        )}
                        <tr key={`${diaId}-${hora}-row`} className={rowBgClass}>
                          <td className={`py-2 px-2 text-center text-[9px] font-bold text-slate-400 border-r border-slate-700/30 whitespace-nowrap align-middle sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                            {hora}
                          </td>
                        
                        {/* Colunas das Turmas */}
                        {turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).map(turma => {
                          const slotKey = `${turma.id}|${diaId}|${hora}`;
                          const aulaNesteSlot = grade[slotKey];
                          const alertasObj = dashboardAlerts.perCell[slotKey];
                          
                          return (
                            <GridCell
                              key={slotKey}
                              slotKey={slotKey}
                              turmaId={turma.id}
                              diaId={diaId}
                              hora={hora}
                              aulaNesteSlot={aulaNesteSlot}
                              isDarkMode={isDarkMode}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDropSlot}
                              onOpenModal={(aula) => {
                                 setModalMode('editAula');
                                 setSaveOptions(prev => ({ ...prev, aulaToEdit: aula, keyToEdit: slotKey }));
                              }}
                              onRemoveCard={(keyToDelete) => {
                                 setGrade(prev => {
                                    const nv = {...prev};
                                    delete nv[keyToDelete];
                                    return nv;
                                 });
                              }}
                              alertasObj={alertasObj}
                            />
                          );
                        })}
                      </tr>
                      </React.Fragment>
                    )})}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* COMPONENTES DE MODAL INLINE PARA MASTERGRID */}
      {dropAlert && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-xl p-5 shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col gap-4 text-center items-center">
                  <AlertCircle size={40} className="text-amber-500" />
                  <h2 className="text-lg font-bold">Ação Bloqueada</h2>
                  <p className="text-xs opacity-80">{dropAlert}</p>
                  <button onClick={() => setDropAlert(null)} className="mt-2 w-full bg-slate-200 dark:bg-slate-700 py-2 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Entendi</button>
               </div>
            </div>
         </div>
      )}

      {pendingDrop && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
               <div className="bg-rose-500/10 p-5 flex border-b border-rose-500/20">
                  <AlertTriangle size={24} className="text-rose-500 shrink-0 mr-3 mt-1" />
                  <div>
                    <h2 className={`font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Atenção: Choque Detectado</h2>
                    <p className={`text-[11px] font-bold mt-1 leading-snug ${isDarkMode ? 'text-rose-300/70' : 'text-rose-800/70'}`}>A matriz relatará incorreções operacionais e os registros podem não aprovar caso estes choques sejam salvos como Oficiais e Transversais.</p>
                  </div>
               </div>
               
               <div className="p-5 overflow-y-auto max-h-[40vh] bg-slate-50/50 dark:bg-slate-900/20">
                  <ul className="flex flex-col gap-2">
                     {pendingDrop.conflicts.map((c, i) => (
                        <li key={i} className={`text-[11px] font-bold flex gap-2 p-2.5 rounded whitespace-pre-wrap ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 border shadow-sm'}`}>
                           <span className="text-rose-500 font-black shrink-0">•</span>
                           <span>{c}</span>
                        </li>
                     ))}
                  </ul>
               </div>

               <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-end gap-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button onClick={() => setPendingDrop(null)} className={`w-full sm:w-auto px-4 py-2.5 rounded font-bold text-xs transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-white border hover:bg-slate-50 text-slate-600 border-slate-300'}`}>
                     Cancelar Soltura e Voltar
                  </button>
                  <button onClick={() => executeDrop(pendingDrop.aula, pendingDrop.origem, pendingDrop.dropsToMake)} className="w-full sm:w-auto px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded font-bold text-xs shadow hover:shadow-lg transition-all">
                     Forçar Alocação Completa
                  </button>
               </div>
            </div>
         </div>
      )}

      {modalMode === 'save' && (
         <SaveMatrixModal 
           isDarkMode={isDarkMode} grade={grade} selectedCourses={selectedCourses} courses={courses} 
           saveOptions={saveOptions} setSaveOptions={setSaveOptions} 
           academicWeeks={academicWeeks} schedules={schedules} selectedConfigYear={selectedConfigYear}
           loadedType={selectedType} loadedWeek={selectedWeek} 
           onClose={() => setModalMode(null)} 
           onSuccess={() => { setModalMode(null); setSystemDialog({ isOpen: true, type: 'alert', title: 'Sucesso!', message: 'Grade armazenada com sucesso no banco de dados.' }); setRefreshTrigger(prev => prev + 1); }} 
           setSystemDialog={setSystemDialog}
         />
      )}

      {modalMode === 'import' && (
         <ImportMatrixModal 
           isDarkMode={isDarkMode} selectedCourses={selectedCourses}
           importOptions={importOptions} setImportOptions={setImportOptions}
           academicWeeks={academicWeeks} schedules={schedules} selectedConfigYear={selectedConfigYear}
           curriculumData={curriculumData} globalTeachersList={globalTeachersList}
           setGrade={setGrade} setAulasNeutras={setAulasNeutras}
           onClose={() => setModalMode(null)} 
         />
      )}

      {showCloneModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className={`w-full max-w-sm rounded-xl p-5 shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'}`}>
              <h2 className="text-lg font-bold mb-4">Clonar Base de Ano Anterior</h2>
              <p className="text-xs opacity-80 mb-4">Atenção: Isso buscará horários do tipo 'Padrão Anual' dos cursos selecionados do ano fonte e jogará na tela atual. Depois de revisar, salve.</p>
              
              <select
                value={cloneSourceYear}
                onChange={e => setCloneSourceYear(e.target.value)}
                className={`w-full p-3 rounded-lg border text-sm font-bold mb-4 focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                <option value="">-- Selecione o Ano Letivo Fonte --</option>
                {academicYearsMeta && Object.keys(academicYearsMeta)
                  .filter(y => y !== String(selectedConfigYear))
                  .sort((a,b)=>b-a)
                  .map(y => <option key={y} value={y}>{y}</option>)
                }
              </select>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                 <button onClick={() => setShowCloneModal(false)} className="px-4 py-2 rounded-lg font-bold text-xs bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancelar</button>
                 <button onClick={handleClonePreviousYear} disabled={!cloneSourceYear} className="px-4 py-2 rounded-lg font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">Confirmar Clonagem</button>
              </div>
           </div>
        </div>
      )}
      {systemDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 border'}`}>
             <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
               <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                  {systemDialog.type === 'confirm' ? <AlertTriangle className="text-amber-500" /> : <AlertCircle className="text-indigo-500" />}
                  {systemDialog.title}
               </h3>
               <p className={`mt-3 text-sm font-bold leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{systemDialog.message}</p>
             </div>
             <div className={`p-4 flex items-center justify-end gap-3 ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
               {systemDialog.type === 'confirm' && (
                 <button onClick={() => setSystemDialog({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null })} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'}`}>Cancelar</button>
               )}
               <button onClick={() => { if(systemDialog.onConfirm) systemDialog.onConfirm(); setSystemDialog({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null }); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all ${systemDialog.type === 'confirm' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                  {systemDialog.type === 'confirm' ? 'Confirmar Ação' : 'OK, Entendi'}
               </button>
             </div>
          </div>
        </div>
      )}

      {dashboardAlerts.list.length > 0 && (
         <div className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[9990] flex flex-col items-start gap-2 max-w-[90vw] sm:max-w-sm transition-all duration-300 pointer-events-none`}>
            {!isAlertsMinimized ? (
               <div className={`w-full rounded-2xl shadow-2xl border overflow-hidden flex flex-col pointer-events-auto animate-in slide-in-from-bottom-5 fade-in ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                  <div className={`p-3 border-b flex justify-between items-center ${isDarkMode ? 'bg-red-950/40 border-slate-800' : 'bg-red-50 border-slate-100'}`}>
                     <div className="flex flex-col gap-0.5">
                        <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                           <AlertTriangle size={14} className="animate-pulse shrink-0" /> Choques Operacionais ({dashboardAlerts.list.length})
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Alerta em Tempo Real</span>
                     </div>
                     <button onClick={() => setIsAlertsMinimized(true)} className={`p-1.5 rounded transition-colors self-start shrink-0 ${isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-black'}`}>
                        <X size={16} />
                     </button>
                  </div>
                  <div className="p-3 max-h-[30vh] sm:max-h-[40vh] overflow-y-auto w-full">
                     <ul className="flex flex-col gap-2">
                        {dashboardAlerts.list.map((msg, i) => (
                           <li key={i} className={`text-[10px] font-bold flex items-start gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-300/80 border border-red-500/10' : 'bg-red-50 text-red-800/80 border border-red-200/50 shadow-sm'}`}>
                              <span className="mt-0.5 pointer-events-none shrink-0">•</span> <span>{msg}</span>
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>
            ) : (
               <button onClick={() => setIsAlertsMinimized(false)} className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border backdrop-blur-md transition-all hover:scale-105 active:scale-95 animate-in zoom-in duration-300 ${isDarkMode ? 'bg-red-950/90 border-red-800/50 text-red-400' : 'bg-white border-red-200 text-red-600'}`}>
                  <AlertTriangle size={16} className="animate-pulse shrink-0" /> <span className="text-[10px] font-black uppercase tracking-widest">{dashboardAlerts.list.length} Choque(s) Ativo(s)</span>
               </button>
            )}
         </div>
      )}

      {isRightPanelOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998]" onClick={() => setIsRightPanelOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] shadow-2xl z-[9999] transition-transform transform duration-300 flex flex-col ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'} ${isDarkMode ? 'bg-slate-900 border-l border-slate-700' : 'bg-slate-50 border-l border-slate-300'}`}>
         <div className={`p-5 border-b flex justify-between items-center shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
               <Bell size={18} className="text-indigo-500" />
               Central de Alertas ({totalAlerts})
            </h2>
            <button onClick={() => setIsRightPanelOpen(false)} className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
               <X size={20} />
            </button>
         </div>
         <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-6">
            <div className={`p-3 rounded-xl border flex items-center justify-between text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800/70 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
               <span>Choques da Grade: {gradeAlertsCount}</span>
               <span>Solicitações: {requestAlertsCount}</span>
            </div>

            {gradeAlertsCount > 0 && (
               <div className={`p-4 rounded-xl border flex flex-col gap-3 shadow-sm ${isDarkMode ? 'bg-rose-950/20 border-rose-900/50' : 'bg-white border-rose-200'}`}>
                  <h3 className={`text-[12px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                     <AlertTriangle size={16} /> Choques Operacionais ({gradeAlertsCount})
                  </h3>
                  <div className="flex-1 border-t border-rose-500/20"></div>
                  <ul className="flex flex-col gap-2 mt-1">
                     {dashboardAlerts.list.map((msg, idx) => (
                        <li key={`grid-alert-${idx}`} className={`p-2.5 rounded-lg text-[11px] font-bold leading-relaxed border ${isDarkMode ? 'bg-rose-900/15 border-rose-900/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                           {msg}
                        </li>
                     ))}
                  </ul>
               </div>
            )}

            {filteredRequests.length > 0 && (
               <div className={`p-4 rounded-xl border flex flex-col gap-3 shadow-sm ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-white border-indigo-200'}`}>
                  <h3 className={`text-[12px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                     <AlertCircle size={16} /> Status de Solicitações ({filteredRequests.length})
                  </h3>
                  <div className="flex-1 border-t border-indigo-500/20"></div>
                  <div className="flex flex-col gap-3 mt-1">
                     {filteredRequests.map((req, i) => {
                        const profName = globalTeachersList?.find(t => t.siape === req.siape)?.nome_exibicao || req.siape;
                        return (
                           <div key={i} className={`p-3.5 rounded-xl border flex flex-col gap-2 shadow-sm relative group transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-indigo-100'}`}>
                              <button onClick={() => setDismissedRequests(p => { const nv = [...p, req.id]; if(typeof window !== 'undefined') localStorage.setItem('dismissed_requests', JSON.stringify(nv)); return nv; })} title="Finalizar/Ocultar Notificação para Mim" className={`absolute -top-3 -right-3 p-1.5 rounded-full shadow-lg border transition-transform opacity-0 group-hover:opacity-100 group-hover:scale-110 ${isDarkMode ? 'bg-slate-700 border-slate-600 hover:bg-rose-900 text-slate-300 hover:text-rose-400' : 'bg-white border-slate-200 hover:bg-rose-100 text-slate-500 hover:text-rose-600'}`}>
                                 <X size={12} strokeWidth={3} />
                              </button>
                              <div className="flex items-center justify-between">
                                 <span className={`text-[10px] font-black uppercase truncate max-w-[150px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{profName}</span>
                                 <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                    req.status === 'aprovado' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-50 text-emerald-600') :
                                    req.status === 'rejeitado' ? (isDarkMode ? 'bg-rose-900/30 text-rose-500' : 'bg-rose-50 text-rose-600') :
                                    (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600')
                                 }`}>{req.status}</span>
                              </div>
                              <p className={`text-[11px] font-bold leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{req.description}</p>
                           </div>
                        );
                     })}
                  </div>
               </div>
            )}

            {totalAlerts === 0 && (
               <div className="flex flex-col items-center justify-center p-8 mt-10 text-center opacity-50">
                  <Bell size={48} className="mb-4 stroke-1" />
                  <p className="text-sm font-bold uppercase tracking-widest">Tudo Limpo!</p>
                  <p className="text-[11px] font-bold mt-2 max-w-[200px]">Não há nenhuma notificação ou choque para visualizar no momento.</p>
               </div>
            )}
         </div>
      </div>
      
      {/* WIDGETS FLUTUANTES (DAPE, etc) */}
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 print:hidden">
         {(!isRequestsWidgetOpen && !isRightPanelOpen) && (
            <>
               {isWidgetMenuOpen ? (
                  <div className={`p-4 rounded-2xl shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-5 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                     <div className="flex justify-between items-center mb-2 border-b pb-2 border-slate-200 dark:border-slate-700">
                        <span className="font-black text-[10px] uppercase tracking-widest text-slate-500">Central de Avisos</span>
                        <button onClick={() => setIsWidgetMenuOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold px-2">X</button>
                     </div>
                     <button onClick={() => { setIsRequestsWidgetOpen(true); setIsWidgetMenuOpen(false); }} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white'}`}>
                        <span>🔔 DAPE Central de Pedidos</span>
                        {pendingRequests?.length > 0 && <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-[10px]">{pendingRequests.length}</span>}
                     </button>
                     <button onClick={() => { setIsRightPanelOpen(true); setIsWidgetMenuOpen(false); }} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-amber-900/40 text-amber-300 hover:bg-amber-500 hover:text-slate-900' : 'bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white'}`}>
                        <span>⚠️ Alertas da Grade {gradeAlertsCount > 0 && `(${gradeAlertsCount})`}</span>
                        {gradeAlertsCount > 0 && <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-[10px]">{gradeAlertsCount}</span>}
                     </button>
                  </div>
               ) : (
                  <button onClick={() => setIsWidgetMenuOpen(true)} className={`p-4 rounded-full text-white shadow-2xl hover:scale-110 transition-all flex items-center justify-center relative border-2 ${isDarkMode ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-600'}`}>
                     <Bell size={24} />
                     {quickBadgeCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full min-w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold shadow-lg px-1 border-2 border-slate-800">
                           {quickBadgeCount}
                        </span>
                     )}
                  </button>
               )}
            </>
         )}
         
         {isRequestsWidgetOpen && (
           <div className="animate-in slide-in-from-bottom-10 z-[100]">
             <FloatingRequestsWidget 
               isDarkMode={isDarkMode} 
               userRole="admin" 
               appMode="admin" 
               controlledIsOpen={isRequestsWidgetOpen} 
               setControlledIsOpen={setIsRequestsWidgetOpen} 
               hideButton={true} 
             />
           </div>
         )}
      </div>

    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENTES DE AÇÃO (SALVAR E IMPORTAR)
// -------------------------------------------------------------
function SaveMatrixModal({ isDarkMode, grade, selectedCourses, courses, saveOptions, setSaveOptions, academicWeeks, schedules, selectedConfigYear, loadedType, loadedWeek, onClose, onSuccess, setSystemDialog, formatWeekLabel }) {
  const [isSaving, setIsSaving] = useState(false);
  const [padraoBaseVersion, setPadraoBaseVersion] = useState('V1');

  const maxPadraoV = useMemo(() => {
     let m = 1;
     schedules.forEach(s => {
       if (s.type === 'padrao' && s.week_id && s.week_id.startsWith('V')) {
          const num = parseInt(s.week_id.replace('V', ''));
          if (!isNaN(num) && num > m) m = num;
       }
     });
     return m;
  }, [schedules]);

  const currentYearWeeks = useMemo(() => {
    return (academicWeeks?.filter(w => String(w.academic_year) === String(selectedConfigYear)) || []).sort((a,b) => (a.start_date || '').localeCompare(b.start_date || '') || ((parseInt((a.name||'').replace(/\\D/g, ''))||0) - (parseInt((b.name||'').replace(/\\D/g, ''))||0)));
  }, [academicWeeks, selectedConfigYear]);

  const availableOptions = useMemo(() => {
    if (loadedType === 'padrao') return [{ value: 'padrao', label: '0. Atualizar: Padrão Anual (Base)' }, { value: 'previa', label: '1. Criar: Prévia Semanal' }];
    if (loadedType === 'previa') return [{ value: 'previa', label: '1. Atualizar: Prévia' }, { value: 'atual', label: '2. Promover para: Atual' }];
    if (loadedType === 'atual') return [{ value: 'atual', label: '2. Atualizar: Atual' }, { value: 'oficial', label: '3. Promover para: Oficial' }];
    if (loadedType === 'oficial') return [{ value: 'oficial', label: '3. Retificar: Oficial' }];
    return [{ value: 'padrao', label: '0. Criar: Padrão Anual (Base)' }, { value: 'previa', label: '1. Criar: Prévia Semanal' }];
  }, [loadedType]);

  useEffect(() => {
    if (saveOptions.type === 'padrao') {
      setSaveOptions(p => ({...p, weekId: (loadedType === 'padrao' && loadedWeek) ? loadedWeek : `V${maxPadraoV + 1}`}));
    } else {
      setSaveOptions(p => ({...p, weekId: (loadedType !== 'padrao' && loadedWeek) ? loadedWeek : ''}));
    }
  }, [saveOptions.type, loadedType, loadedWeek, setSaveOptions, maxPadraoV]);

  const executarSalvamentoNoBackend = async () => {
    const payload = Object.entries(grade).map(([key, aula]) => {
      const [classId, dayOfWeek, slotId] = key.split('|');
      return { 
        courseId: aula.courseId, classId, dayOfWeek, slotId, 
        teacherId: aula.teacherIds ? aula.teacherIds.join(',') : 'A Definir', 
        disciplineId: aula.disciplineId || aula.id, room: aula.sala,
        isSubstituted: aula.isSubstituted || false,
        isPermuted: aula.isPermuted || false,
        originalSubject: aula.originalSubject || null,
        isDisponibilizada: aula.isDisponibilizada || false,
        classType: aula.classType || null,
        isExtra: aula.isExtra || false
      };
    });

    if (saveOptions.type !== 'padrao') {
        const padraoBase = schedules.filter(s => s.type === 'padrao' && selectedCourses.includes(String(s.courseId)) && (s.week_id === padraoBaseVersion || (!s.week_id && padraoBaseVersion === 'V1')));
        
        padraoBase.forEach(pSlot => {
            const normDbDay = isNaN(pSlot.dayOfWeek) ? String(pSlot.dayOfWeek) : String(MAP_DAYS[pSlot.dayOfWeek]);
            const exists = payload.some(pl => String(pl.classId) === String(pSlot.classId) && String(pl.dayOfWeek) === normDbDay && String(pl.slotId) === String(pSlot.slotId));
            if (!exists) {
                payload.push({
                    courseId: pSlot.courseId, classId: pSlot.classId, dayOfWeek: normDbDay,
                    slotId: pSlot.slotId, teacherId: 'A Definir', disciplineId: pSlot.disciplineId, room: pSlot.room,
                    isSubstituted: false, isPermuted: false, originalSubject: null, isDisponibilizada: false, classType: null, isExtra: false
                });
            }
        });
    }

    let weekText = saveOptions.weekId;
    if (saveOptions.weekId && saveOptions.type !== 'padrao') {
        const wObj = academicWeeks?.find(w => String(w.id) === String(saveOptions.weekId));
        if (wObj && wObj.start_date && wObj.end_date) {
            const d1 = wObj.start_date.split('-');
            const d2 = wObj.end_date.split('-');
            if (d1.length === 3 && d2.length === 3) weekText = `de ${d1[2]}/${d1[1]} a ${d2[2]}/${d2[1]}`;
        }
    }

    setIsSaving(true);
    try {
        const resp = await fetch('/api/schedules/bulk-course', {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ courseIds: selectedCourses, type: saveOptions.type, weekId: saveOptions.weekId || null, weekLabel: weekText, academicYear: selectedConfigYear, schedules: payload })
        });
        if(!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || 'Erro Crítico desconhecido no Backend!');
        }
        onSuccess();
    } catch(e) { setSystemDialog({ isOpen: true, type: 'alert', title: 'Falha ao Salvar', message: e.message }); } finally { setIsSaving(false); }
  };

  const handleConfirmSave = async () => {
    if (!saveOptions.weekId) return setSystemDialog({ isOpen: true, type: 'alert', title: 'Atenção', message: 'Selecione uma semana/versão de destino!' });
    if (saveOptions.type === 'oficial') {
      setSystemDialog({
        isOpen: true, type: 'confirm', title: 'Confirmação Crítica',
        message: 'Você está prestes a salvar um histórico Oficial e Imutável. Tem certeza que deseja consolidar essa grade?',
        onConfirm: () => executarSalvamentoNoBackend()
      });
      return;
    }
    executarSalvamentoNoBackend();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl rounded-2xl p-6 shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}>
        <h2 className="text-xl font-black uppercase mb-6 tracking-widest text-indigo-500">Pipeline de Gravação</h2>

        <div className={`grid ${saveOptions.type !== 'padrao' ? 'grid-cols-2' : 'grid-cols-1'} gap-5 mb-6`}>
          <div>
            <label className="block text-[10px] font-black uppercase opacity-60 mb-2">Ação Permitida</label>
            <select value={saveOptions.type} onChange={e => setSaveOptions(p => ({...p, type: e.target.value}))} className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-700 focus:border-indigo-500' : 'bg-white border-slate-300 focus:border-indigo-500 text-black'}`}>
               {availableOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          {saveOptions.type !== 'padrao' ? (
            <div>
              <label className="block text-[10px] font-black uppercase opacity-60 mb-2">Semana Destino</label>
              <select value={saveOptions.weekId} onChange={e => setSaveOptions(p => ({...p, weekId: e.target.value}))} className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-700 focus:border-indigo-500' : 'bg-white border-slate-300 focus:border-indigo-500 text-black'}`}>
                 <option value="">Selecione...</option>
                 {currentYearWeeks.map(w => {
                     const d1 = w.start_date?.split('-');
                     const d2 = w.end_date?.split('-');
                     const dateLabel = (d1?.length === 3 && d2?.length === 3) ? ` (${d1[2]}/${d1[1]} a ${d2[2]}/${d2[1]})` : '';
                     return (
                         <option key={w.id} value={w.id}>{w.name}{dateLabel}</option>
                     );
                 })}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black uppercase opacity-60 mb-2">Salvar como Versão do Padrão</label>
              <select value={saveOptions.weekId} onChange={e => setSaveOptions(p => ({...p, weekId: e.target.value}))} className={`w-full p-3.5 rounded-xl border text-sm font-black outline-none transition-colors ${isDarkMode ? 'bg-slate-950 border-rose-500/50 text-rose-400' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
                 {(loadedType === 'padrao' && loadedWeek) && (
                     <option value={loadedWeek}>Atualizar Versão Existente ({loadedWeek})</option>
                 )}
                 <option value={`V${maxPadraoV + 1}`}>Salvar Nova Versão (V{maxPadraoV + 1})</option>
              </select>
            </div>
          )}
       </div>

       {saveOptions.type !== 'padrao' && (
           <div className="mb-6 p-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <label className="block text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-500 mb-2">Motor de Aulas Vagas</label>
              <p className="text-[11px] text-amber-700 dark:text-amber-600 mb-4 font-medium">O sistema comparará o que está na tela com o Padrão Anual. Os buracos da tela serão injetados automaticamente no banco como "Aulas Vagas" para substituição. Qual versão do Padrão usar como espelho?</p>
              <select value={padraoBaseVersion} onChange={e => setPadraoBaseVersion(e.target.value)} className={`w-full p-3 rounded-lg border border-amber-300 text-sm font-black outline-none cursor-pointer ${isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-white text-amber-700'}`}>
                 {Array.from({ length: maxPadraoV }).map((_, i) => (
                     <option key={`V${i + 1}`} value={`V${i + 1}`}>Espelhar com Padrão V{i + 1}</option>
                 ))}
              </select>
           </div>
       )}

       <div className="flex justify-end gap-3 border-t pt-5 border-slate-200 dark:border-slate-700">
           <button onClick={onClose} className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
           <button onClick={handleConfirmSave} disabled={isSaving} className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 ${isSaving ? 'bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>{isSaving ? 'Gravando...' : 'Confirmar Gravação'}</button>
       </div>
    </div>
  </div>
  );
}
