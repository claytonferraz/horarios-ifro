import React, { useState, useEffect } from "react";
import { UserCircle, Printer } from "lucide-react";
import { TeacherRequestsSection } from "../../ui/teacher/TeacherRequestsSection";

export const TeacherGrid = React.memo(
  ({
    mappedSchedules,
    isDarkMode,
    scheduleMode,
    appMode,
    viewMode,
    userRole,
    selectedTeacher,
    selectedColleague,
    globalTeachers,
    safeDays,
    safeTimes,
    dynamicWeeksList,
    selectedWeek,
    weekLabel,
    showVacantInMyClasses,
    setShowVacantInMyClasses,
    handlePrint,
    resolveTeacherName,
    isTeacherPending,
    checkPendingSwapRequest,
    setVacantRequestModal,
    setExchangeTarget,
    onReverseSwapClick,
    onEmptySlotClick,
    showEmptySlots,
    getColorHash,
    getFormattedDayLabel,
    recordsForWeek,
    activeDays,
    classTimes,
    setShowEmptySlots,
    profClassesMemo,
    showOnlyMyClasses,
    setShowOnlyMyClasses
  }) => {
    const activeTeacher = selectedColleague || selectedTeacher;
    const isGridInert = appMode === 'aluno' || scheduleMode === 'consolidado' || scheduleMode === 'oficial';
    // As turmas onde o professor logado leciona (para restrição de interação)
    const myClasses = profClassesMemo || new Set();
    
    // Filtro principal de registros do professor selecionado (ou colega sendo visualizado)
    const directRecords = mappedSchedules.filter(r => r.teacherId && activeTeacher && String(r.teacherId).split(',').includes(String(activeTeacher)));
    const targetClasses = new Set(directRecords.map(r => r.className));
    
    // Exibe as aulas do professor, as AULAS VAGAS e as aulas de OUTROS PROFESSORES nas turmas onde ele leciona
    // Se 'Apenas Minhas' estiver ativo, exibe somente directRecords
    let profRecords = showOnlyMyClasses 
        ? directRecords 
        : mappedSchedules.filter(r => targetClasses.has(r.className));

    const profItems = appMode === 'aluno' 
        ? [...new Set(profRecords.map((r) => r.className))].sort((a,b) => String(a).localeCompare(String(b)))
        : [...new Set(profRecords.map((r) => r.course))].sort((a, b) => String(a).localeCompare(String(b)));
        
    const [activeTab, setActiveTab] = useState("Todos");

    useEffect(() => {
      if (
        profItems.length > 0 &&
        (!activeTab ||
          (activeTab !== "Todos" &&
            !profItems.includes(activeTab)))
      ) {
        setActiveTab("Todos");
      }
    }, [profItems, activeTab]);

    const handlePrintClick = () => {
      const printWindow = window.open('', '_blank');
      const itemsToPrint = activeTab === "Todos" ? profItems : [activeTab];
      const labelStr = dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek;
      const teacherName = resolveTeacherName(selectedTeacher, globalTeachers);
      
      // Aplicar filtros de exibição nos dados de impressão
      let printingRecords = [...profRecords];
      
      let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Horário do Professor - IFRO</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4 landscape; margin: 5mm; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 10px; background: white; color: black; line-height: 1.2; }
            .course-page { page-break-after: always; padding-bottom: 20px; }
            .course-page:last-child { page-break-after: auto; }
            
            .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: 900; letter-spacing: 2px; }
            .header p { margin: 4px 0 0 0; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
            .meta-info { display: flex; justify-content: space-between; font-size: 8pt; font-weight: normal; margin-top: 5px; color: #333; }
            
            .course-name { font-size: 12pt; font-weight: 900; text-transform: uppercase; margin: 10px 0 8px 0; display: block; border-left: 6px solid black; padding-left: 8px; }
            
            table { width: 100%; border-collapse: collapse; border: 2pt solid black; table-layout: fixed; }
            th, td { border: 1pt solid black !important; padding: 4px 3px; text-align: center; vertical-align: middle; font-size: 7.5pt; }
            th { background-color: #f0f0f0; font-weight: 900; text-transform: uppercase; height: 28px; font-size: 7pt; }
            
            .day-divider { border-top: 2.5pt solid black !important; background-color: #f9f9f9 !important; }
            .day-label-container { 
               writing-mode: vertical-rl; 
               transform: rotate(180deg); 
               white-space: nowrap;
               font-weight: 900;
               font-size: 8.5pt;
               letter-spacing: 1px;
            }
            
            .subject { font-weight: 900; font-size: 7.2pt; text-transform: uppercase; }
            .room-info { display: block; font-size: 6pt; font-weight: bold; margin-top: 1px; color: #444; opacity: 0.8; }
            
            .footer-print { margin-top: 10px; font-size: 7pt; font-style: italic; text-align: right; border-top: 1px solid #eee; padding-top: 5px; }
          </style>
        </head>
        <body>
      `;

      itemsToPrint.forEach(item => {
        const records = appMode === 'aluno' 
            ? printingRecords.filter(r => r.className === item)
            : printingRecords.filter(r => r.course === item);

        if (records.length === 0) return;
        const classes = [...new Set(records.map(r => r.className))].sort();

        html += `<div class="course-page">
          <div class="header">
            <h1>IFRO Campus Ji-Paraná</h1>
            <p>${scheduleMode === 'padrao' 
                ? 'Horário Acadêmico Padrão | Versão 1' 
                : `Horário Acadêmico ${scheduleMode === 'previa' 
                    ? 'Prévia' 
                    : scheduleMode === 'consolidado' 
                      ? 'Consolidado' 
                      : 'Em execução'} | ${labelStr.replace("SEM ", "SEMANA ")}`}</p>
            <div class="meta-info">
              <span>Professor: <strong>${teacherName.toUpperCase()}</strong></span>
              <span>${appMode === 'aluno' ? 'Turma' : 'Curso'}: <strong>${item.toUpperCase()}</strong></span>
              <span>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40pt;">DIA</th>
                <th style="width: 80pt;">HORÁRIO</th>
                ${classes.map(cls => `<th>${cls}</th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

        safeDays.forEach(day => {
          const activeTimes = safeTimes.filter(t => {
            const ts = t.timeStr || t;
            return records.some(r => r.day === day && r.time === ts);
          });

          if (activeTimes.length > 0) {
            activeTimes.forEach((tObj, tIdx) => {
              const ts = tObj.timeStr || tObj;
              html += `<tr class="${tIdx === 0 ? 'day-divider' : ''}">`;
              if (tIdx === 0) {
                html += `<td rowspan="${activeTimes.length}" style="background: #f0f0f0; border-right: 1.5pt solid black !important;">
                  <div class="day-label-container">${day.substring(0,3).toUpperCase()}</div>
                </td>`;
              }
              html += `<td style="font-weight: 700; background: #fafafa; font-size: 7.5pt;">${ts}</td>`;
              
              classes.forEach(cls => {
                const r = records.find(rec => rec.className === cls && rec.day === day && rec.time === ts);
                if (r) {
                  html += `<td>
                    <div class="subject">${r.subject || "LANCAMENTO"}</div>
                    <div class="room-info">${r.room ? 'SALA ' + r.room : ''}</div>
                  </td>`;
                } else {
                  html += `<td style="color: #ddd;">-</td>`;
                }
              });
              html += `</tr>`;
            });
          }
        });

        html += `</tbody></table>
          <div class="footer-print">Documento gerado eletronicamente pelo Portal de Horários IFRO</div>
        </div>`;
      });

      html += `</body></html>`;
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    return (
      <div className="flex flex-col xl:flex-row gap-6 items-start animate-in zoom-in-95 duration-500 print:w-full print:max-w-none print:m-0 print:p-0 print:block">
        {/* Lado Principal: Grade */}
        <div className={`w-full space-y-6 print:w-full print:max-w-none`}>
            <div className="flex flex-col gap-4 w-full print:w-full">
              {/* O CABEÇALHO GLOBAL DO PROFESSOR */}
              <div
                className={`text-white px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl shadow-md no-print ${scheduleMode === "padrao" ? (isDarkMode ? "bg-blue-950" : "bg-blue-900") : scheduleMode === "previa" ? (isDarkMode ? "bg-violet-950" : "bg-violet-900") : isDarkMode ? "bg-indigo-950" : "bg-indigo-900"}`}
              >
                <div className="flex flex-col gap-1.5 flex-1">
                  <h2 className="font-black text-sm md:text-base uppercase tracking-widest flex items-center gap-2">
                    <UserCircle size={20} className="opacity-80" />
                    {scheduleMode === "padrao" && (
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[9px]">
                        PADRÃO
                      </span>
                    )}
                    {scheduleMode === "previa" && (
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[9px]">
                        PRÉVIA
                      </span>
                    )}
                    Horário do Professor:{" "}
                    {resolveTeacherName(selectedTeacher, globalTeachers)}
                  </h2>
                  {scheduleMode !== "padrao" && (
                    <span className="inline-block text-[9px] font-black bg-white/20 px-3 py-1 rounded-full w-fit tracking-widest uppercase shadow-sm mt-1">
                      {dynamicWeeksList.find((w) => w.value === selectedWeek)
                        ?.label || selectedWeek}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3 mt-2 sm:mt-0">
                  
                  {/* TOGGLE: HORÁRIOS LIVRES (UX REFINADA) */}
                  {appMode === 'professor' && scheduleMode !== 'consolidado' && scheduleMode !== 'oficial' && (
                    <label className="flex items-center gap-2.5 cursor-pointer group bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl transition-all ring-1 ring-white/5 no-print">
                        <div className={`w-9 h-5 rounded-full relative transition-all duration-300 ${showEmptySlots ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/20'}`}>
                          <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm ${showEmptySlots ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/90 group-hover:text-white transition-colors">Horários Livres</span>
                        <input type="checkbox" checked={showEmptySlots} onChange={e => typeof setShowEmptySlots === 'function' && setShowEmptySlots(e.target.checked)} className="peer sr-only" />
                    </label>
                  )}
                  {appMode === 'professor' && setShowOnlyMyClasses && (
                    <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors text-white text-[9px] uppercase font-black tracking-widest shadow-sm ring-1 ring-white/10 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showOnlyMyClasses}
                        onChange={(e) => setShowOnlyMyClasses(e.target.checked)}
                        className="accent-indigo-500 w-3 h-3"
                      />
                      Apenas Minhas
                    </label>
                  )}

                  {appMode === 'professor' && (
                    <button
                      onClick={handlePrintClick}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/25 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print ring-1 ring-white/10"
                    >
                      <Printer size={14} /> Imprimir Horário
                    </button>
                  )}
                </div>
              </div>

              {profItems.length === 0 ? (
                <div className="p-12 text-center opacity-50 font-black tracking-widest uppercase text-sm">
                  Este professor não possui aulas alocadas nesta semana.
                </div>
              ) : (
                <>
                  {/* ABAS DOS ITENS (CURSOS OU TURMAS) */}
                  {profItems.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-2 no-print animate-in fade-in slide-in-from-top-2">
                      {["Todos", ...profItems].map((item) => (
                        <button
                          key={item}
                          onClick={() => setActiveTab(item)}
                          className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${activeTab === item ? (scheduleMode === "padrao" ? "bg-blue-600 text-white ring-2 ring-blue-500/50 scale-[1.02] z-10" : scheduleMode === "previa" ? "bg-violet-600 text-white ring-2 ring-violet-500/50 scale-[1.02] z-10" : "bg-indigo-600 text-white ring-2 ring-indigo-500/50 scale-[1.02] z-10") : isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700" : "bg-white text-slate-500 border border-slate-200 hover:text-slate-800"}`}
                        >
                          {item === "Todos" ? (appMode === 'aluno' ? "Todas as Turmas" : "Todos os Cursos") : item}
                        </button>
                      ))}
                    </div>
                  )}

                  {(() => {
                const itemsToRender =
                  activeTab === "Todos"
                    ? profItems
                    : [activeTab || profItems[0]];

                return itemsToRender.map((item) => {
                  const records = appMode === 'aluno'
                    ? profRecords.filter((r) => r.className === item)
                    : profRecords.filter((r) => r.course === item);
                  
                  const headerLabel = appMode === 'aluno' ? `TURMA: ${item}` : `CURSO: ${item}`;
                  
                  const courseClasses = [
                    ...new Set(records.map((r) => r.className)),
                  ].sort();
                  const courseDays = showEmptySlots ? safeDays.filter(d => d !== 'Sunday' && d !== 'Saturday') : safeDays.filter((day) =>
                    records.some((r) => r.day === day),
                  );

                  return (
                    <div
                      key={`prof-item-${item}`}
                      className={`rounded-2xl shadow-sm border overflow-hidden mb-6 animate-in fade-in zoom-in-95 duration-300 print:mb-0 print:border-none print:shadow-none print:w-full print:p-0 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                    >
                      <div className="hidden print:block font-black text-[14px] uppercase border-b-[3px] border-black pb-2 tracking-widest mt-4 mb-4 text-black">
                        PROFESSOR:{" "}
                        {resolveTeacherName(selectedTeacher, globalTeachers)}{" "}
                        <span className="float-right font-medium text-[10px] bg-black text-white px-2 py-1 rounded-sm">
                          {scheduleMode === "padrao"
                            ? "HORÁRIO PADRÃO"
                            : `HORÁRIO ${scheduleMode.toUpperCase()} - ${(weekLabel || selectedWeek).replace("SEM ", "SEMANA ")}`}
                        </span>
                      </div>
                      
                      {/* Sub-Header para modo professor quando agrupa por curso */}
                      {appMode !== 'aluno' && (
                        <div className={`px-6 py-3 border-b font-black text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                           {headerLabel}
                        </div>
                      )}
                      <div className="hidden md:block overflow-x-auto print:overflow-visible">
                        <table className="w-full min-w-[600px] border-collapse relative text-xs print:w-full print:min-w-0 print:max-w-none print:table-fixed print:border-collapse">
                          <thead>
                            <tr
                              className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"}`}
                            >
                              <th
                                className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-300"}`}
                              >
                                Dia
                              </th>
                              <th
                                className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-300"}`}
                              >
                                Horários
                              </th>
                              {courseClasses.map((cls) => (
                                <th
                                  key={`head-${cls}`}
                                  className={`py-4 px-2 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? "border-slate-700/50" : "border-slate-300/50"} align-middle`}
                                >
                                  <div className={`px-3 py-2 rounded-xl border-b-[4px] font-black text-[11px] uppercase tracking-tighter shadow-md transition-all ${isDarkMode ? "bg-slate-800/80 border-indigo-500/30 text-indigo-400 shadow-indigo-900/10" : "bg-white border-indigo-100 text-indigo-700 shadow-indigo-50/50"}`}>
                                    {cls}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody
                            className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                          >
                            {courseDays.map((day, dayIndex) => {
                              const activeTimes = showEmptySlots ? safeTimes : safeTimes.filter((timeObj) =>
                                records.some(
                                  (r) =>
                                    r.day === day &&
                                    r.time === (timeObj.timeStr || timeObj),
                                ),
                              );

                              if (activeTimes.length === 0) {
                                return (
                                  <React.Fragment
                                    key={`prof-day-block-${day}-empty`}
                                  >
                                    <tr className="group transition-colors">
                                      <td
                                        className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? "bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                      >
                                        <div className="flex items-center justify-center h-full w-full min-h-[120px] p-2">
                                          <span
                                            className="text-[9px] font-black uppercase tracking-widest text-slate-500"
                                            style={{
                                              writingMode: "vertical-rl",
                                              transform: "rotate(180deg)",
                                            }}
                                          >
                                            {getFormattedDayLabel(day)}
                                          </span>
                                        </div>
                                      </td>
                                      <td
                                        colSpan={courseClasses.length + 1}
                                        className={`py-4 text-center font-bold text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-500 bg-slate-800/20" : "text-slate-400 bg-slate-50/50"}`}
                                      >
                                        NÃO LETIVO
                                      </td>
                                    </tr>
                                    {dayIndex < courseDays.length - 1 && (
                                      <tr
                                        className={`border-y-[4px] print:hidden ${isDarkMode ? "bg-slate-700/40 border-slate-700" : "bg-slate-300/40 border-slate-300"}`}
                                      >
                                        <td
                                          colSpan={courseClasses.length + 2}
                                          className="h-0 p-0"
                                        ></td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              }

                              return (
                                <React.Fragment key={`prof-day-block-${day}`}>
                                  {activeTimes.map((timeObj, index) => {
                                    const timeStr = timeObj.timeStr || timeObj;
                                    const isFirstRowOfDay = index === 0;
                                    const hasLunch = activeTimes.some(
                                      (t) =>
                                        (t.timeStr || t) === "11:10 - 12:00",
                                    );
                                    const isLunch = timeStr === "11:10 - 12:00";

                                    return (
                                      <React.Fragment
                                        key={`prof-${day}-${timeStr}`}
                                      >
                                        <tr className="group transition-colors">
                                          {isFirstRowOfDay && (
                                            <td
                                              rowSpan={
                                                activeTimes.length +
                                                (hasLunch ? 1 : 0)
                                              }
                                              className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? "bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                            >
                                              <div className="flex items-center justify-center h-full w-full min-h-[120px]">
                                                <span
                                                  className="text-[9px] font-black uppercase tracking-widest text-slate-500"
                                                  style={{
                                                    writingMode: "vertical-rl",
                                                    transform: "rotate(180deg)",
                                                  }}
                                                >
                                                  {getFormattedDayLabel(day)}
                                                </span>
                                              </div>
                                            </td>
                                          )}
                                          <td
                                            className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? "bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                          >
                                            {timeStr}
                                          </td>
                                          {courseClasses.map((cls) => {
                                            const recordsNesteSlot =
                                              records.filter(
                                                (r) =>
                                                  r.day === day &&
                                                  r.time === timeStr &&
                                                  r.className === cls,
                                              );
                                              const globalRecordsNesteSlot = mappedSchedules.filter(
                                                (r) =>
                                                  r.day === day &&
                                                  r.time === timeStr &&
                                                  r.className === cls &&
                                                  r.teacher &&
                                                  !/A Definir|sem professor|Pendente|-/i.test(r.teacher)
                                              );
                                              const isOccupiedByOther = globalRecordsNesteSlot.length > 0;

                                              return (
                                                <td
                                                  key={`prof-${cls}-${timeStr}`}
                                                  className={`p-1 border align-top relative ${isDarkMode ? "border-slate-700 group-hover:bg-slate-700/30" : "border-slate-200 group-hover:bg-slate-50/50"}`}
                                                >
                                                  <div className="flex flex-col gap-1 w-full h-full min-h-[76px]">
                                                    {recordsNesteSlot.length ===
                                                    0 ? (
                                                      isOccupiedByOther && showEmptySlots && appMode === 'professor' ? (
                                                          <div className={`flex items-center justify-center h-full min-h-[76px] rounded-xl transition-all select-none ${isDarkMode ? "bg-slate-800/20 text-slate-500 opacity-60" : "bg-slate-100/50 text-slate-400 opacity-60"}`}>
                                                              <span className="text-[9px] font-black uppercase tracking-widest text-center px-1">(Ocupado)</span>
                                                          </div>
                                                      ) : (
                                                          <div
                                                            onClick={() => {
                                                               if (isGridInert) return;
                                                               if (showEmptySlots && appMode === 'professor' && typeof onEmptySlotClick === 'function') {
                                                                  onEmptySlotClick({ day, time: timeStr, className: cls, course });
                                                               }
                                                            }}
                                                            className={`flex items-center justify-center h-full min-h-[76px] rounded-xl border-[2px] border-dashed transition-all select-none ${showEmptySlots && appMode === 'professor' && !isGridInert ? (isDarkMode ? "border-slate-700 hover:border-indigo-500 hover:bg-indigo-900/20 text-slate-600 hover:text-indigo-400 cursor-pointer" : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 cursor-pointer shadow-sm") : (isDarkMode ? "opacity-20 border-transparent text-slate-500" : "opacity-10 border-transparent text-slate-500")}`}
                                                          >
                                                            {showEmptySlots && appMode === 'professor' && !isGridInert ? (
                                                              <span className="text-[9px] font-black uppercase tracking-widest">+ Lançar</span>
                                                            ) : "-"}
                                                          </div>
                                                      )
                                                    ) : (
                                                    recordsNesteSlot.map(
                                                      (r, idx) => {
                                                        const isVaga =
                                                          isTeacherPending(
                                                            r.teacher,
                                                          );
                                                        const hasClash =
                                                          recordsNesteSlot.length >
                                                          1;
                                                        const isLocked =
                                                          isVaga &&
                                                          checkPendingSwapRequest &&
                                                          checkPendingSwapRequest(r);
                                                        const hasPendingSwap = checkPendingSwapRequest && checkPendingSwapRequest(r);
                                                        const isActive = r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacher));
                                                        const isVagaReal = appMode !== 'aluno' && (!r.teacherId || r.teacherId === 'A Definir' || r.teacherId === '-' || /sem professor/i.test(r.teacher) || r.subject === 'AULA VAGA');
                                                        const isExtraPending = r.isPending === true && hasPendingSwap;
                                                        const finalInert = isGridInert || isExtraPending;
                                                        
                                                        let cardStyle = "print-clean-card p-4 rounded-[1.8rem] border shadow-sm flex flex-col justify-center min-h-[82px] transition-all relative ";
                                                         if (isExtraPending) {
                                                            cardStyle += isDarkMode ? `bg-slate-800 border-dashed border-slate-500 text-slate-400 ${finalInert ? 'cursor-default opacity-80' : ''}` : `bg-slate-100 border-dashed border-slate-400 text-slate-500 ${finalInert ? 'cursor-default opacity-80' : ''}`;
                                                         } else if (isVagaReal) {
                                                            // 🟠 AULA VAGA — laranja vibrante + borda pulsante
                                                            cardStyle += `vacant-slot-card ${isDarkMode ? 'bg-orange-500/20 border-orange-500/80 text-orange-200' : 'bg-orange-100 border-orange-400 text-orange-900 shadow-orange-200'} animate-pulse ${finalInert ? 'cursor-default' : 'cursor-pointer hover:scale-[1.03] hover:shadow-xl hover:border-orange-500'}`;
                                                         } else if (hasPendingSwap) {
                                                            cardStyle += isDarkMode ? `bg-amber-500/10 border-amber-500/50 ${finalInert ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'} text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]` : `bg-amber-50 border-amber-200 text-amber-900 ${finalInert ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'} shadow-xl shadow-amber-100`;
                                                         } else if (isActive) {
                                                            // 🔵 MINHAS AULAS — azul-índigo com anel nítido
                                                            cardStyle += `${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100 placeholder-indigo-400/20' : 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-xl shadow-indigo-100'} ring-2 ring-indigo-500/20 ${finalInert ? 'cursor-default z-10' : 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl z-10'}`;
                                                         } else {
                                                            // 👥 COLEGA DE TURMA — glassmorphism sutil, não muito opaco
                                                            const colorHashClasses = getColorHash(r.subject, isDarkMode).split(' ');
                                                            const bgClass = colorHashClasses.find(c => c.startsWith('bg-')) || (isDarkMode ? 'bg-slate-700/40' : 'bg-slate-100/80');
                                                            const borderClass = colorHashClasses.find(c => c.startsWith('border-')) || (isDarkMode ? 'border-slate-600/50' : 'border-slate-300/80');
                                                            cardStyle += `${bgClass} ${borderClass} backdrop-blur-sm ${finalInert ? 'cursor-default opacity-60' : 'hover:opacity-100 hover:shadow-lg cursor-pointer opacity-60'}`;
                                                         }

                                                        return (
                                                          <div
                                                            key={r.id ? `prof-rec-${r.id}-${idx}` : `prof-rec-idx-${idx}`}
                                                            className={cardStyle}
                                                            onClick={() => {
                                                              if (finalInert) return;
                                                              if (appMode === "professor") {
                                                                if (hasPendingSwap) {
                                                                   alert("Esta aula já possui uma permuta em andamento. Ela ficará bloqueada até sua recusa ou homologação.");
                                                                   return;
                                                                }
                                                                
                                                                if (!isActive && !isVagaReal && typeof onReverseSwapClick === 'function') {
                                                                  onReverseSwapClick(r);
                                                                  return;
                                                                }
                                                                
                                                                if (isActive || isVagaReal) {
                                                                  if (userRole !== "admin" && userRole !== "gestao") {
                                                                    if (!myClasses.has(r.className)) {
                                                                       alert("Você só pode solicitar trocas ou assumir vagas em turmas onde você já leciona ao menos uma disciplina.");
                                                                       return;
                                                                    }
                                                                  }

                                                                  if (isVagaReal) {
                                                                    if (isLocked) {
                                                                      alert("Esta vaga já está sendo analisada pela direção.");
                                                                      return;
                                                                    }
                                                                    if (typeof setVacantRequestModal === "function") {
                                                                      setVacantRequestModal(r);
                                                                    }
                                                                  } else if (isActive && typeof setExchangeTarget === "function") {
                                                                    setExchangeTarget({
                                                                      targetClass: r.className,
                                                                      targetCourse: r.course,
                                                                      originalRecord: r,
                                                                    });
                                                                  }
                                                                }
                                                              }
                                                            }}
                                                          >
                                                            {isVagaReal && (
                                                                <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                                   <span className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-br-[8px] bg-rose-600 border-r border-b border-rose-700 block animate-pulse shadow-sm shadow-rose-900/30">{isLocked ? "EM ANÁLISE" : "AULA VAGA"}</span>
                                                                </div>
                                                            )}
                                                            {!isVagaReal && hasPendingSwap && (
                                                                <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                                   <span className="text-[5px] font-black uppercase tracking-widest text-amber-900 px-1.5 py-[3px] rounded-bl-[8px] bg-amber-400 border-l border-b border-amber-500 block animate-pulse shadow-[0_2px_4px_rgba(251,191,36,0.3)]">SOLICITADO</span>
                                                                </div>
                                                            )}
                                                            {r.isPermuted && !isVagaReal && (
                                                                <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                                   <span title="Aula permutada por Acordo" className="text-[6px] font-black uppercase tracking-wide text-[#FFFBEB] px-1.5 py-0.5 rounded-br-[8px] bg-amber-600 border-r border-b border-amber-700 block shadow-sm shadow-amber-900/30">PERMUTADA</span>
                                                                </div>
                                                            )}
                                                            {r.isSubstituted && !r.isPermuted && !isVagaReal && (
                                                                <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                                   <span title="Assumida no lugar de uma Vaga" className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-br-[8px] bg-indigo-600 border-r border-b border-indigo-700 block shadow-sm shadow-indigo-900/30">Substituição</span>
                                                                </div>
                                                            )}
                                                            {r.classType && r.classType !== 'Regular' && !isVagaReal && (
                                                                <div className="absolute bottom-0 right-0 z-10 pointer-events-none print:hidden">
                                                                   <span className={`text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-tl-[8px] ${isExtraPending ? 'bg-slate-500 border-slate-600' : 'bg-emerald-600 border-emerald-700'} border-l border-t block shadow-sm shadow-emerald-900/30`}>{isExtraPending ? 'ANÁLISE DAPE' : r.classType}</span>
                                                                </div>
                                                            )}
                                                            <React.Fragment>
                                                               <p className={"subject font-black text-xs sm:text-[13px] tracking-tighter leading-snug text-center mt-1 uppercase " + (isVagaReal ? "text-orange-700 dark:text-orange-300" : !isActive ? "text-slate-500 dark:text-slate-400" : "")}>{r.subject || "Pendente"}</p>
                                                               <span className={"details text-[9px] font-black tracking-widest px-4 py-1.5 rounded-full mt-2 w-fit uppercase mx-auto shadow-sm border transition-all " + (isVagaReal ? (isDarkMode ? 'bg-orange-950 text-orange-400 border-orange-800' : 'bg-orange-50 text-orange-700 border-orange-200') : isActive ? (isDarkMode ? 'bg-indigo-950 text-indigo-400 border-indigo-700' : 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-200') : (isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200'))}>
                                                                 {isVagaReal 
                                                                   ? '⚠ Vaga' 
                                                                   : (isActive ? `${r.className || 'S/Turma'} ${r.room ? ' · ' + r.room : ''}` : resolveTeacherName(r.teacherId, globalTeachers))}
                                                               </span>
                                                             </React.Fragment>
                                                          </div>
                                                        );
                                                      },
                                                    )
                                                  )}
                                                </div>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                        {isLunch && (
                                          <tr
                                            className={`print-interval print:break-inside-avoid print:bg-slate-200 print:text-black print:overflow-hidden text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? "bg-slate-800/60 text-slate-500 border-slate-700" : "bg-slate-100/60 text-slate-400 border-slate-300"}`}
                                          >
                                            <td
                                              colSpan={courseClasses.length + 1}
                                              className="py-2 text-center shadow-inner"
                                            >
                                              Intervalo / Almoço
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                  {/* Separador entre os dias na matriz */}
                                  {dayIndex < courseDays.length - 1 && (
                                    <tr
                                      className={`border-y-[4px] print:hidden ${isDarkMode ? "bg-slate-700/40 border-slate-700" : "bg-slate-300/40 border-slate-300"}`}
                                    >
                                      <td
                                        colSpan={courseClasses.length + 2}
                                        className="py-1 shadow-inner"
                                      ></td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked View (Professor Full Week) */}
                      <div className="md:hidden no-print p-4 space-y-4">
                        {courseDays.map((day) => {
                          const dayRecords = records.filter(
                            (r) => r.day === day,
                          );
                          if (dayRecords.length === 0 && !showEmptySlots) return null;

                          const dailyShifts = showEmptySlots ? new Set(safeTimes.map(t => t.shift).filter(Boolean)) : new Set(
                            records
                              .map(
                                (r) =>
                                  safeTimes.find((t) => (t.timeStr || t) === r.time)
                                    ?.shift,
                              )
                              .filter(Boolean),
                          );
                          const activeTimes = safeTimes.filter((timeObj) =>
                            dailyShifts.has(timeObj.shift),
                          );

                          return (
                            <div
                              key={`mob-prof-${item}-${day}`}
                              className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in ${isDarkMode ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-white"}`}
                            >
                              <div
                                className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? "bg-indigo-950/50 text-indigo-400" : "bg-indigo-50 text-indigo-700"}`}
                              >
                                {getFormattedDayLabel(day)}
                              </div>
                              <div
                                className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                              >
                                {activeTimes.map((timeObj, idx) => {
                                  const time = timeObj.timeStr || timeObj;
                                  const records = dayRecords.filter(
                                    (r) => r.time === time,
                                  );
                                  const isLunch = time === "11:10 - 12:00";

                                  const timeRow = (
                                    <div
                                      key={`mob-prof-${item}-${day}-${time}-row`}
                                      className={`flex items-start gap-3 p-3 transition-colors ${isDarkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}
                                    >
                                      <div className="w-16 shrink-0 text-center">
                                        <span
                                          className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-500"}`}
                                        >
                                          {time}
                                        </span>
                                      </div>
                                      <div className="flex-1 space-y-2">
                                        {records.length > 0 ? records.map((r, rIdx) => {
                                          const isPending = isTeacherPending(
                                            r.teacher,
                                          );
                                          return (
                                            <div
                                              key={`mob-rec-${r.id || 'new'}-${idx}-${rIdx}`}
                                              className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? "bg-red-900/30 border-red-800/50 text-red-300" : "bg-red-50 border-red-200 text-red-900") : getColorHash(r.className, isDarkMode)}`}
                                            >
                                              <div className="flex items-center gap-1.5 flex-1 w-full">
                                                <span
                                                  className={`text-[8px] font-black uppercase rounded px-1 shrink-0 ${isDarkMode ? "bg-white/20" : "bg-black/10"}`}
                                                >
                                                  {r.className}
                                                </span>
                                                <span className="font-bold text-[10px] leading-tight truncate">
                                                  {r.subject} {r.classType && r.classType !== 'Regular' && `(${r.classType})`}
                                                </span>
                                              </div>
                                              {r.classType && r.classType !== 'Regular' && (
                                                <span className="text-[8px] font-black uppercase tracking-widest pl-1 mt-0.5 text-emerald-600 dark:text-emerald-400 block">{r.classType}</span>
                                              )}
                                              {r.room && (
                                                <span
                                                  className={`text-[8px] font-black uppercase tracking-widest pl-1 mt-1 opacity-80 block`}
                                                >
                                                  SALA: {r.room}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        }) : (
                                          <div 
                                             onClick={() => {
                                               // Aqui o mobile precisaria de qual classe? Se não tem classe específica nesse contexto mobile, vamos usar a primeira do courseClasses
                                               if (showEmptySlots && appMode === 'professor' && typeof onEmptySlotClick === 'function' && courseClasses.length > 0) {
                                                  onEmptySlotClick({ day, time, className: courseClasses[0], course: item });
                                               }
                                             }}
                                             className={`w-full py-2.5 rounded-lg border-[2px] border-dashed text-center flex items-center justify-center transition-all ${showEmptySlots && appMode === 'professor' ? (isDarkMode ? "border-slate-700 bg-slate-800/30 text-indigo-400" : "border-slate-300 bg-slate-50 text-indigo-600 hover:bg-slate-100 cursor-pointer") : (isDarkMode ? "opacity-20 border-transparent text-slate-500" : "opacity-10 border-transparent text-slate-500")}`}
                                          >
                                            {showEmptySlots && appMode === 'professor' && !isGridInert ? <span className="text-[9px] font-black uppercase tracking-widest">+ Lançar Aula</span> : "-"}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );

                                  return (
                                    <React.Fragment
                                      key={`mob-prof-${item}-${day}-${time}-frag`}
                                    >
                                      {timeRow}
                                      {isLunch && (
                                        <div
                                          className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? "bg-slate-800/40 text-slate-500 border-slate-700" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                                        >
                                          Intervalo
                                        </div>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
                  })()}
                </>
              )}
            </div>
        </div>

        {/* Widget flutuante movido globalmente para PortalView.jsx para acompanhar fluxo em todas as abas */}
      </div>
    );
  },
);
