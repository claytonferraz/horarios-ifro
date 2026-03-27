import React, { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  CheckCircle,
  Layers,
  Printer,
  Clock,
  ChevronDown,
  ListTodo,
} from "lucide-react";
import { ScheduleNotifications } from "../../ui/admin/ScheduleNotifications";
import { SearchableSelect } from "../../ui/SearchableSelect";

export const CourseGrid = React.memo(
  ({
    mappedSchedules,
    isDarkMode,
    scheduleMode,
    userRole,
    globalTeachers,
    activeCourseClasses,
    safeDays,
    safeTimes,
    intervals,
    dynamicWeeksList,
    selectedWeek,
    checkPendingSwapRequest,
    weekLabel,
    draggingRecord,
    checkConflict,
    setEditorModal,
    handlePrint,
    getColorHash,
    resolveTeacherName,
    isTeacherPending,
    onDragStart,
    onDragEnd,
    profClassesMemo,
    subjectHoursMeta,
    activeData,
    getFormattedDayLabel,
    appMode,
    showOnlyMyClasses,
    setShowOnlyMyClasses,
    padraoFilterTeacher,
    setPadraoFilterTeacher,
    siape,
    onReverseSwapClick,
  }) => {
    const [mobileSelectedClasses, setMobileSelectedClasses] = useState({});
    const [activeCourseTab, setActiveCourseTab] = useState("Todos");
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    
    // Nesta aba do Dashboard, o CourseGrid funciona apenas como um visualizador de consulta.
    // Edições e gestões de grade devem ser feitas através do painel MasterGrid (Administração).
    const isGridInert = true; 

    const activeTeacherFilter = showOnlyMyClasses ? siape : (padraoFilterTeacher && padraoFilterTeacher !== "Todos" ? padraoFilterTeacher : null);

    const availableCourses = useMemo(() => {
      let filteredSchedules = mappedSchedules;
      
      // Se houver filtro de professor, as abas de curso devem mostrar apenas 
      // os cursos onde esse professor (ou aulas vagas) estão presentes.
      if (activeTeacherFilter) {
        filteredSchedules = mappedSchedules.filter(r => {
           const isMatch = r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter));
           const isVacant = isTeacherPending(r.teacherId || r.teacher);
           return isMatch || isVacant;
        });
      }

      return [...new Set(filteredSchedules.map((r) => r.course))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }, [mappedSchedules, activeTeacherFilter]);

    useEffect(() => {
      if (
        availableCourses.length > 0 &&
        (!activeCourseTab ||
          (activeCourseTab !== "Todos" &&
            !availableCourses.includes(activeCourseTab)))
      ) {
        setActiveCourseTab("Todos");
      }
    }, [availableCourses, activeCourseTab]);

    return (
      <React.Fragment>
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={`flex flex-col lg:flex-row gap-6 w-full ${appMode === 'professor' ? 'max-w-full' : 'max-w-7xl'} mx-auto px-2 sm:px-6 mt-6 transition-all duration-500 print:w-full print:max-w-none print:m-0 print:p-0 print:block`}>
          <div className="flex-1 space-y-6 print:w-full print:max-w-none">
            {(() => {
              if (availableCourses.length === 0) {
                return (
                  <div
                    className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                  >
                    <CheckCircle
                      size={40}
                      className="mx-auto text-emerald-400 mb-3"
                    />
                    <h3
                      className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                    >
                      Nenhuma Aula
                    </h3>
                    <p
                      className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Não há horários cadastrados para exibir nesta aba.
                    </p>
                  </div>
                );
              }

              const coursesToRender =
                activeCourseTab === "Todos"
                  ? availableCourses
                  : [activeCourseTab || availableCourses[0]];

              return (
                <div className="flex flex-col gap-4 w-full">
                  {/* O CABEÇALHO GLOBAL DA GRADE DE CURSO */}
                  <div
                    className={`text-white px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl shadow-md no-print ${scheduleMode === "padrao" ? (isDarkMode ? "bg-blue-950" : "bg-blue-900") : scheduleMode === "previa" ? (isDarkMode ? "bg-violet-950" : "bg-violet-900") : isDarkMode ? "bg-rose-950" : "bg-rose-900"}`}
                  >
                    <div className="flex flex-col gap-1.5 flex-1">
                      <h2 className="font-black text-sm md:text-base uppercase tracking-widest flex items-center gap-2">
                        <Layers size={20} className="opacity-80" />
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
                        Horário dos Cursos
                      </h2>
                      {scheduleMode !== "padrao" && (
                        <span className="inline-block text-[9px] font-black bg-white/20 px-3 py-1 rounded-full w-fit tracking-widest uppercase shadow-sm mt-1">
                          {dynamicWeeksList.find(
                            (w) => w.value === selectedWeek,
                          )?.label || selectedWeek}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3 mt-2 sm:mt-0 w-full sm:w-auto">
                      {setPadraoFilterTeacher && (
                          <div className="w-full sm:w-56 text-black">
                            <SearchableSelect
                              isDarkMode={false}
                              options={[
                                { value: "Todos", label: "Filtrar por Professor" },
                                ...(globalTeachers || []).map((t) => ({
                                  value: String(t.siape || t.id),
                                  label:
                                    t.nome_exibicao ||
                                    t.nome_completo ||
                                    t.name ||
                                    "Sem Nome",
                                })),
                              ]}
                              value={padraoFilterTeacher}
                              onChange={(val) => {
                                setPadraoFilterTeacher(val);
                                if (val !== "Todos" && setShowOnlyMyClasses) setShowOnlyMyClasses(false);
                              }}
                              colorClass="bg-white/90 border-transparent text-slate-800 shadow-sm text-[10px]"
                              placeholder="Buscar por colega..."
                            />
                          </div>
                        )}
                      {appMode === "professor" && setShowOnlyMyClasses && (
                        <label className="flex items-center gap-2 cursor-pointer bg-black/20 hover:bg-black/30 px-3 py-2 rounded-xl transition-colors text-white text-[10px] uppercase font-black tracking-widest shadow-sm ring-1 ring-white/10 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={showOnlyMyClasses}
                            onChange={(e) => {
                              setShowOnlyMyClasses(e.target.checked);
                              if (e.target.checked && setPadraoFilterTeacher) setPadraoFilterTeacher("Todos");
                            }}
                            className="accent-indigo-500 w-3.5 h-3.5"
                          />
                          Apenas Minhas
                        </label>
                      )}
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print ring-1 ring-white/10 whitespace-nowrap"
                      >
                        <Printer size={15} /> Imprimir Pauta
                      </button>
                    </div>
                  </div>

                  {/* ABAS DOS CURSOS */}
                  {availableCourses.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-2 no-print animate-in fade-in slide-in-from-top-2">
                      {["Todos", ...availableCourses].map((c) => (
                        <button
                          key={c}
                          onClick={() => setActiveCourseTab(c)}
                          className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${activeCourseTab === c ? (scheduleMode === "padrao" ? "bg-blue-600 text-white ring-2 ring-blue-500/50 scale-[1.02] z-10" : scheduleMode === "previa" ? "bg-violet-600 text-white ring-2 ring-violet-500/50 scale-[1.02] z-10" : "bg-teal-600 text-white ring-2 ring-teal-500/50 scale-[1.02] z-10") : isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700" : "bg-white text-slate-500 border border-slate-200 hover:text-slate-800"}`}
                        >
                          {c === "Todos" ? "Todos os Cursos" : c}
                        </button>
                      ))}
                    </div>
                  )}

                  {coursesToRender.map((course) => {
                    const courseClassesGlobais = mappedSchedules
                      .filter((r) => {
                         if (activeTeacherFilter) {
                             const isMatch = r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter));
                             const isVacant = isTeacherPending(r.teacherId || r.teacher);
                             if (!isMatch && !isVacant) return false;
                         }
                         if (course !== "Todas as Turmas do Professor" && r.course !== course) return false;
                         return true;
                      })
                      .map((r) => r.className);
                      
                    let courseClasses = [
                      ...new Set(courseClassesGlobais),
                    ].sort();
                    if (activeCourseClasses) {
                      courseClasses = courseClasses.filter((c) =>
                        activeCourseClasses.includes(c),
                      );
                    }
                    const courseRecords = mappedSchedules.filter((r) => {
                      // O registro deve pertencer ao curso atual desta grade
                      if (r.course !== course) return false;
                      // Se houver filtro de professor, mostrar apenas as dele (+ vagas)
                      if (activeTeacherFilter) {
                        const isMatch = r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter));
                        const isVacant = isTeacherPending(r.teacherId || r.teacher);
                        return isMatch || isVacant;
                      }
                      return true;
                    });

                    const courseGlobalShifts = new Set(
                       courseRecords.map((r) => {
                          const timeObj = safeTimes.find((t) => (t.timeStr || t) === r.time);
                          return timeObj ? timeObj.shift : null;
                       }).filter(Boolean)
                    );

                    const targetShifts = new Set();
                    if (courseGlobalShifts.size === 0) {
                       targetShifts.add("Matutino");
                       targetShifts.add("Vespertino");
                    } else if (courseGlobalShifts.has("Matutino") || courseGlobalShifts.has("Vespertino")) {
                       targetShifts.add("Matutino");
                       targetShifts.add("Vespertino");
                    } else {
                       targetShifts.add("Vespertino");
                       targetShifts.add("Noturno");
                    }

                    return (
                      <React.Fragment key={`grid-${course}`}>
                        {courseClasses.length === 0 ? (
                          <div
                            className={`rounded-2xl border p-12 text-center shadow-sm no-print animate-in zoom-in-95 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                          >
                            <CheckCircle
                              size={40}
                              className="mx-auto text-indigo-400 mb-3"
                            />
                            <h3
                              className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                            >
                              Nenhuma Turma Encontrada
                            </h3>
                            <p
                              className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                            >
                              Nenhuma turma atende aos critérios do filtro na
                              matriz{" "}
                              <strong className="text-indigo-400">
                                {course}
                              </strong>
                              .
                            </p>
                          </div>
                        ) : (
                          <div
                            key={course}
                            className={`print:break-inside-avoid print:break-after-page rounded-2xl shadow-sm print:shadow-none border print:border-none overflow-hidden print:overflow-visible mb-6 print:mb-0 print:w-full print:max-w-none print:p-0 animate-in fade-in zoom-in-95 duration-300 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                          >
                            <div className="hidden print:block font-black text-[14px] uppercase mb-2 border-b-[3px] border-black pb-2 tracking-widest mt-4 text-black">
                              {course}{" "}
                              <span className="float-right font-medium text-[10px] bg-black text-white px-2 py-1 rounded-sm">
                                {scheduleMode === "padrao"
                                  ? "HORÁRIO PADRÃO"
                                  : `HORÁRIO ${scheduleMode.toUpperCase()} - ${(weekLabel || selectedWeek).replace("SEM ", "SEMANA ")}`}
                              </span>
                            </div>
                            <div className="hidden md:block overflow-x-auto print:overflow-visible">
                              <table className="w-full min-w-[800px] border-collapse relative text-xs print:w-full print:min-w-0 print:max-w-none print:table-fixed print:border-collapse">
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
                                        key={cls}
                                        className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-800"}`}
                                      >
                                        {cls}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody
                                  className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                                >
                                  {safeDays.map((day, dayIndex) => {
                                    const dayRecords = courseRecords.filter(
                                      (r) => r.day === day,
                                    );
                                    const activeTimes = safeTimes.filter(
                                      (timeObj) => targetShifts.has(timeObj.shift)
                                    );
                                    const hasClassesToday =
                                      activeTimes.length > 0;

                                    if (
                                      !hasClassesToday ||
                                      activeTimes.length === 0
                                    ) {
                                      return (
                                        <React.Fragment
                                          key={`day-block-${day}-empty`}
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
                                          {dayIndex < safeDays.length - 1 && (
                                            <tr
                                              className={`border-y-[4px] print:hidden ${isDarkMode ? "bg-slate-700/40 border-slate-700" : "bg-slate-300/40 border-slate-300"}`}
                                            >
                                              <td
                                                colSpan={
                                                  courseClasses.length + 2
                                                }
                                                className="py-1 shadow-inner"
                                              ></td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    }

                                    let currentShift = "";
                                    let classPositionInShift = 0;
                                    const displayShiftsDay = new Set(
                                      activeTimes
                                        .map((i) => i.shift)
                                        .filter(Boolean),
                                    );
                                    const activeIntervals = (
                                      intervals || []
                                    ).filter((inv) =>
                                      displayShiftsDay.has(inv.shift),
                                    );
                                    const shiftCount = new Set(
                                      activeTimes.map((i) => i.shift),
                                    ).size;
                                    const spanSize =
                                      activeTimes.length +
                                      shiftCount +
                                      activeIntervals.length;

                                    return (
                                      <React.Fragment key={`day-block-${day}`}>
                                        {activeTimes.map((timeObj, index) => {
                                          const time = timeObj.timeStr;
                                          const shift = timeObj.shift;
                                          const isNewShift =
                                            shift !== currentShift;
                                          if (isNewShift) {
                                            currentShift = shift;
                                            classPositionInShift = 1;
                                          } else {
                                            classPositionInShift++;
                                          }
                                          const isFirstRowOfDay = index === 0;

                                          const intervalMatched =
                                            activeIntervals.find(
                                              (inv) =>
                                                inv.shift === shift &&
                                                Number(inv.position) ===
                                                  classPositionInShift,
                                            );

                                          return (
                                            <React.Fragment
                                              key={`${day}-${time}`}
                                            >
                                              {isNewShift && (
                                                <tr
                                                  className={`print-interval text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? "bg-slate-800/80 text-slate-400 border-slate-700" : "bg-slate-200/50 text-slate-500 border-slate-300"}`}
                                                >
                                                  {isFirstRowOfDay && (
                                                    <td
                                                      rowSpan={spanSize}
                                                      className={`sticky left-0 z-20 border-r-[3px] align-middle text-center bg-white ${isDarkMode ? "!bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "!bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                                    >
                                                      <div className="flex items-center justify-center h-full w-full min-h-[120px]">
                                                        <span
                                                          className="text-[9px] font-black uppercase tracking-widest text-slate-500"
                                                          style={{
                                                            writingMode:
                                                              "vertical-rl",
                                                            transform:
                                                              "rotate(180deg)",
                                                          }}
                                                        >
                                                          {getFormattedDayLabel(
                                                            day,
                                                          )}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  )}
                                                  <td
                                                    colSpan={
                                                      courseClasses.length + 1
                                                    }
                                                    className="py-1 text-center shadow-inner"
                                                  >
                                                    {shift}
                                                  </td>
                                                </tr>
                                              )}
                                              <tr className="group transition-colors">
                                                {!isNewShift &&
                                                  isFirstRowOfDay && (
                                                    <td
                                                      rowSpan={spanSize}
                                                      className={`sticky left-0 z-20 border-r-[3px] align-middle text-center bg-white ${isDarkMode ? "!bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "!bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                                    >
                                                      <div className="flex items-center justify-center h-full w-full min-h-[120px]">
                                                        <span
                                                          className="text-[9px] font-black uppercase tracking-widest text-slate-500"
                                                          style={{
                                                            writingMode:
                                                              "vertical-rl",
                                                            transform:
                                                              "rotate(180deg)",
                                                          }}
                                                        >
                                                          {getFormattedDayLabel(
                                                            day,
                                                          )}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  )}
                                                <td
                                                  className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? "bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]" : "bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}
                                                >
                                                  {time}
                                                </td>
                                                {courseClasses.map((cls) => {
                                                  const records =
                                                    courseRecords.filter(
                                                      (r) =>
                                                        r.className === cls &&
                                                        r.day === day &&
                                                        r.time === time,
                                                    );
                                                  return (
                                                    <td
                                                      key={`${cls}-${time}`}
                                                      className={`p-1 border-r-[3px] last:border-r-0 align-top min-w-[140px] transition-all ${isDarkMode ? "border-slate-700" : "border-slate-300"}`}
                                                    >
                                                      <Droppable
                                                        droppableId={`${day}|${time}|${cls}`}
                                                        isDropDisabled={appMode === 'professor' && userRole !== 'admin' && userRole !== 'gestao' && profClassesMemo && !profClassesMemo.has(String(cls))}
                                                      >
                                                        {(
                                                          provided,
                                                          snapshot,
                                                        ) => {
                                                          let conflictMsg =
                                                            null;
                                                          if (
                                                            draggingRecord &&
                                                            snapshot.isDraggingOver
                                                          ) {
                                                            conflictMsg =
                                                              checkConflict(
                                                                draggingRecord,
                                                                day,
                                                                time,
                                                                cls,
                                                              );
                                                          }
                                                          return (
                                                            <div
                                                              ref={
                                                                provided.innerRef
                                                              }
                                                              {...provided.droppableProps}
                                                              onClick={() => {
                                                                if (
                                                                  [
                                                                    "admin",
                                                                    "gestao",
                                                                    "professor"
                                                                  ].includes(
                                                                    userRole,
                                                                  ) && !["oficial", "consolidado"].includes(scheduleMode)
                                                                )
                                                                  setEditorModal(
                                                                    {
                                                                      cls,
                                                                      day,
                                                                      time,
                                                                      tObj: timeObj,
                                                                    },
                                                                  );
                                                              }}
                                                              className={`w-full h-full min-h-[50px] p-0.5 rounded-lg transition-colors ${["admin", "gestao", "professor"].includes(userRole) && !isGridInert ? "cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:z-30 relative" : ""} ${conflictMsg ? "bg-red-500/20 ring-2 ring-red-500 !bg-red-500/20" : snapshot.isDraggingOver ? (isDarkMode ? "bg-slate-700/50" : "bg-slate-100") : isDarkMode ? "group-hover:bg-slate-700/30 bg-slate-800/20" : "group-hover:bg-slate-50/50 bg-slate-50/20"}`}
                                                            >
                                                              {conflictMsg &&
                                                                snapshot.isDraggingOver && (
                                                                  <div className="absolute -top-6 left-0 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded z-50 whitespace-nowrap shadow-md">
                                                                    {
                                                                      conflictMsg
                                                                    }
                                                                  </div>
                                                                )}
                                                              {records.length >
                                                              0 ? (
                                                                records.map(
                                                                  (
                                                                    r,
                                                                    rIndex,
                                                                  ) => {
                                                                    const isPending =
                                                                       isTeacherPending(
                                                                         r.teacher,
                                                                       );
                                                                     const isVagaReal = isPending || r.subject === 'AULA VAGA' || r.teacherId === '0000001';
                                                                     const hasPendingSwap = typeof checkPendingSwapRequest === 'function' && checkPendingSwapRequest(r);
                                                                     const isActiveTeacherInCard = activeTeacherFilter ? (r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter))) : true;
                                                                     
                                                                     return (
                                                                       <Draggable
                                                                         key={String(
                                                                           r.id,
                                                                         )}
                                                                         draggableId={String(
                                                                           r.id,
                                                                         )}
                                                                         index={
                                                                           rIndex
                                                                         }
                                                                         isDragDisabled={true}
                                                                       >
                                                                         {(
                                                                           prov2,
                                                                           snap2,
                                                                         ) => (
                                                                           <div
                                                                             ref={prov2.innerRef}
                                                                             {...prov2.draggableProps}
                                                                             {...prov2.dragHandleProps}
                                                                             onClick={(e) => {
                                                                                if (isGridInert) return;
                                                                                if (appMode === "professor" && onReverseSwapClick) {
                                                                                    if (hasPendingSwap) {
                                                                                       e.stopPropagation();
                                                                                       alert("Esta aula já possui uma permuta em andamento.");
                                                                                       return;
                                                                                    }
                                                                                    e.stopPropagation();
                                                                                    onReverseSwapClick(r);
                                                                                }
                                                                             }}
                                                                              className={`print-clean-card p-3 print:p-1 rounded-[1.8rem] print:rounded-none border-b-[3px] print:border-b-[1px] print:border-slate-400 shadow-sm print:shadow-none flex flex-col justify-center min-h-[58px] print:min-h-0 transition-all mb-1 print:mb-0 last:mb-0 relative overflow-visible ${snap2.isDragging ? "shadow-xl scale-105 z-50 hover:scale-105" : (isGridInert ? "cursor-default" : "hover:scale-[1.02] cursor-pointer")} ${hasPendingSwap ? (isDarkMode ? "bg-amber-900/30 border-amber-800/50 hover:bg-amber-900/40 text-amber-200" : "bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-900") : isVagaReal ? (isDarkMode ? "bg-orange-500/20 border-orange-500/80 text-orange-200 animate-pulse-slow" : "bg-orange-100 border-orange-400 text-orange-900 shadow-orange-200 animate-pulse-slow") : getColorHash(r.subject, isDarkMode)} ${!isActiveTeacherInCard ? "opacity-50 saturate-50 hover:opacity-100 hover:saturate-100 transition-all" : ""}`}
                                                             >
                                                               {isVagaReal && (
                                                                  <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                                     <span className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-br-[8px] bg-rose-600 border-r border-b border-rose-700 block animate-pulse shadow-sm shadow-rose-900/30">AULA VAGA</span>
                                                                  </div>
                                                               )}
                                                               {hasPendingSwap && !isVagaReal && (
                                                                 <div className="absolute -top-1.5 -left-1 z-10 print:hidden shadow-sm pointer-events-none">
                                                                   <span
                                                                     title="Há uma solicitação de troca envolvendo esta aula"
                                                                     className="text-[5px] font-black uppercase tracking-widest text-amber-900 px-1.5 py-[2px] rounded border border-amber-400 bg-amber-400 block animate-pulse shadow-sm"
                                                                   >
                                                                     SOLICITADO
                                                                   </span>
                                                                 </div>
                                                               )}
                                                               {r.isPermuted && (
                                                                 <div className="absolute -top-1.5 -right-1 z-10 print:hidden shadow-sm pointer-events-none delay-100">
                                                                   <span
                                                                     title="Aula permutada por Acordo"
                                                                     className="text-[5px] font-black uppercase tracking-widest text-[#FFFBEB] px-1.5 py-[2px] rounded border border-amber-500 bg-amber-600 block shadow-sm shadow-amber-900/40"
                                                                   >
                                                                     PERMUTADA
                                                                   </span>
                                                                 </div>
                                                               )}
                                                               {r.isSubstituted && !r.isPermuted && !hasPendingSwap && (
                                                                 <div className="absolute -top-1.5 -right-1 z-10 print:hidden shadow-sm pointer-events-none">
                                                                   <span
                                                                     title="Aula assumida de Vaga via Troca"
                                                                     className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded border border-indigo-400 bg-indigo-600 block shadow-sm shadow-indigo-900/40"
                                                                   >
                                                                     Substituição
                                                                   </span>
                                                                 </div>
                                                               )}
                                                               {r.classType && r.classType !== 'Regular' && (
                                                                 <div className="absolute -top-1.5 -left-1 z-10 print:hidden shadow-sm pointer-events-none">
                                                                   <span className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded border border-emerald-400 bg-emerald-600 block shadow-sm shadow-emerald-900/40">
                                                                     {r.classType}
                                                                   </span>
                                                                 </div>
                                                               )}
                                                               <p
                                                                 className={`subject font-black text-[11px] print:text-[8.5px] tracking-tighter uppercase leading-tight print:leading-[1.1] mb-1 print:mb-0.5 text-center flex flex-col items-center gap-0.5 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                                                               >
                                                                 <span>{r.subject}</span>
                                                                 {r.isPermuted && !isPending && (
                                                                   <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-widest font-black ${isDarkMode ? "bg-amber-900/40 text-amber-400 border border-amber-800/50" : "bg-amber-100 text-amber-700 border border-amber-300"}`}>PERMUTA</span>
                                                                 )}
                                                                 {r.isSubstituted && !r.isPermuted && r.originalSubject && (
                                                                     <span className="block text-[8px] sm:text-[9px] opacity-80 mt-1 uppercase">
                                                                       Era: {r.originalSubject}
                                                                     </span>
                                                                 )}
                                                               </p>
                                                               <div className="flex justify-center">
                                                                  <span
                                                                    className={`text-[8.5px] font-black tracking-widest px-3 py-1 rounded-full border shadow-sm uppercase ${isVagaReal ? (isDarkMode ? "bg-orange-950 text-orange-400 border-orange-800" : "bg-orange-50 text-orange-700 border-orange-200") : !isActiveTeacherInCard ? (isDarkMode ? "bg-slate-900 text-slate-500 border-slate-700" : "bg-slate-100 text-slate-400 border-slate-200") : (isDarkMode ? "bg-indigo-950 text-indigo-400 border-indigo-700" : "bg-indigo-600 text-white border-indigo-400 shadow-indigo-100")}`}
                                                                  >
                                                                    {isVagaReal 
                                                                      ? '⚠ Vaga' 
                                                                      : resolveTeacherName(r.teacher, globalTeachers)}
                                                                    {r.room && ` | ${r.room}`}
                                                                  </span>
                                                               </div>
                                                             </div>
                                                                        )}
                                                                       </Draggable>
                                                                    );
                                                                  },
                                                                )
                                                              ) : (
                                                                <div
                                                                  className={`h-[46px] print:min-h-[22px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none pointer-events-none ${isDarkMode ? "opacity-20" : "opacity-5"}`}
                                                                >
                                                                  -
                                                                </div>
                                                              )}
                                                              {
                                                                provided.placeholder
                                                              }
                                                            </div>
                                                          );
                                                        }}
                                                      </Droppable>
                                                    </td>
                                                  );
                                                })}
                                              </tr>
                                              {intervalMatched && (
                                                <tr
                                                  className={`print-interval print:break-inside-avoid print:bg-slate-200 print:text-black print:overflow-hidden text-[9px] font-black uppercase tracking-widest ${isDarkMode ? "bg-amber-900/40 text-amber-500 border-amber-900/50" : "bg-amber-50 text-amber-700 border-amber-200"} border-y`}
                                                >
                                                  <td
                                                    className={`sticky left-[40px] z-10 py-2 px-3 text-center border-r-[3px] bg-transparent ${isDarkMode ? "border-amber-900/50" : "border-amber-200"}`}
                                                  >
                                                    <span className="opacity-80 font-bold block whitespace-nowrap">
                                                      {(() => {
                                                        let endStr =
                                                          timeObj.timeStr.split(
                                                            "-",
                                                          )[1];
                                                        if (!endStr) return "";
                                                        endStr = endStr.trim();
                                                        let [hh, mm] = endStr
                                                          .split(":")
                                                          .map(Number);
                                                        if (
                                                          isNaN(hh) ||
                                                          isNaN(mm)
                                                        )
                                                          return "";
                                                        let startText = endStr;
                                                        let endMins =
                                                          hh * 60 +
                                                          mm +
                                                          Number(
                                                            intervalMatched.duration,
                                                          );
                                                        let outHH = Math.floor(
                                                          endMins / 60,
                                                        )
                                                          .toString()
                                                          .padStart(2, "0");
                                                        let outMM = (
                                                          endMins % 60
                                                        )
                                                          .toString()
                                                          .padStart(2, "0");
                                                        return `${startText} - ${outHH}:${outMM}`;
                                                      })()}
                                                    </span>
                                                  </td>
                                                  <td
                                                    colSpan={
                                                      courseClasses.length
                                                    }
                                                    className="py-2 px-4 shadow-sm relative text-center"
                                                  >
                                                    <div className="flex items-center justify-center gap-2">
                                                      <Clock size={12} />{" "}
                                                      {intervalMatched.description ||
                                                        "Intervalo"}{" "}
                                                      (
                                                      {intervalMatched.duration}{" "}
                                                      min)
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                        {dayIndex < safeDays.length - 1 && (
                                          <tr
                                            className={`border-y-[4px] print:hidden ${isDarkMode ? "bg-slate-700/40 border-slate-700" : "bg-slate-300/40 border-slate-300"}`}
                                          >
                                            <td
                                              colSpan={
                                                activeCourseClasses.length + 2
                                              }
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

                            {/* Mobile Stacked View (Curso) */}
                            <div className="md:hidden no-print p-4 space-y-4">
                              {(() => {
                                const activeMobileCls =
                                  mobileSelectedClasses[course] ||
                                  courseClasses[0];
                                const clsRecordsAll = courseRecords.filter(
                                  (r) => r.className === activeMobileCls,
                                );

                                return (
                                  <div className="animate-in fade-in zoom-in-95">
                                    <div className="mb-4">
                                      <label
                                        className={`block text-[10px] font-black uppercase tracking-widest mb-2 pl-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                                      >
                                        Visualizar Turma
                                      </label>
                                      <div
                                        className={`flex items-center gap-3 border rounded-xl px-4 py-3 shadow-sm relative ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
                                      >
                                        <Layers
                                          className={
                                            isDarkMode
                                              ? "text-indigo-400"
                                              : "text-indigo-600"
                                          }
                                          size={18}
                                        />
                                        <select
                                          value={activeMobileCls}
                                          onChange={(e) =>
                                            setMobileSelectedClasses(
                                              (prev) => ({
                                                ...prev,
                                                [course]: e.target.value,
                                              }),
                                            )
                                          }
                                          className={`flex-1 bg-transparent font-bold text-sm outline-none appearance-none cursor-pointer ${isDarkMode ? "text-white" : "text-slate-800"}`}
                                        >
                                          {courseClasses.map((cls) => (
                                            <option
                                              key={`${course}-mob-opt-${cls}`}
                                              value={cls}
                                              className={
                                                isDarkMode
                                                  ? "bg-slate-800 text-white"
                                                  : "bg-white text-slate-900"
                                              }
                                            >
                                              {cls}
                                            </option>
                                          ))}
                                        </select>
                                        <ChevronDown
                                          size={16}
                                          className={`pointer-events-none opacity-50 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                                        />
                                      </div>
                                    </div>

                                    {clsRecordsAll.length === 0 ? (
                                      <div
                                        className={`p-8 rounded-xl border text-center font-bold text-xs uppercase tracking-widest shadow-sm ${isDarkMode ? "bg-slate-900 border-slate-700 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                                      >
                                        Nenhuma Atividade
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        {safeDays.map((day) => {
                                          const dayRecords =
                                            clsRecordsAll.filter(
                                              (r) => r.day === day,
                                            );
                                          if (dayRecords.length === 0)
                                            return null;

                                          const dayShifts = new Set(
                                            dayRecords
                                              .map(
                                                (r) =>
                                                  safeTimes.find(
                                                    (t) => t.timeStr === r.time,
                                                  )?.shift,
                                              )
                                              .filter(Boolean),
                                          );
                                          const displayShifts = new Set();
                                          if (dayShifts.has("Matutino"))
                                            displayShifts.add("Matutino");
                                          if (dayShifts.has("Vespertino"))
                                            displayShifts.add("Vespertino");
                                          if (dayShifts.has("Noturno"))
                                            displayShifts.add("Noturno");
                                          const activeTimes = safeTimes.filter(
                                            (t) => displayShifts.has(t.shift),
                                          );

                                          return (
                                            <div
                                              key={`mob-${course}-${activeMobileCls}-${day}`}
                                              className={`rounded-xl border overflow-hidden shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-white"}`}
                                            >
                                              <div
                                                className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
                                              >
                                                {getFormattedDayLabel(day)}
                                              </div>
                                              <div
                                                className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                                              >
                                                {activeTimes.map(
                                                  (timeObj, idx) => {
                                                    const time =
                                                      timeObj.timeStr ||
                                                      timeObj;
                                                    const records =
                                                      dayRecords.filter(
                                                        (r) => r.time === time,
                                                      );
                                                    const isLunch =
                                                      time === "11:10 - 12:00";

                                                    const timeRow = (
                                                      <div
                                                        key={`${course}-${activeMobileCls}-${day}-${time}-row`}
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
                                                          {records.length >
                                                          0 ? (
                                                            records.map((r) => {
                                                              const isPending =
                                                                isTeacherPending(
                                                                  r.teacher,
                                                                );
                                                              const isActiveTeacherInCard = activeTeacherFilter ? (r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter))) : true;
                                                              return (
                                                                <div
                                                                  key={`mob-rec-${r.id}`}
                                                                  className={`p-2.5 flex items-center justify-between gap-2 rounded-lg border shadow-sm ${isPending ? (isDarkMode ? "bg-red-900/30 border-red-800/50 text-red-300" : "bg-red-50 border-red-200 text-red-800") : getColorHash(r.subject, isDarkMode)} ${!isActiveTeacherInCard ? "opacity-50 saturate-50 hover:opacity-100 hover:saturate-100 cursor-pointer transition-all" : "cursor-pointer"}`}
                                                                  onClick={(e) => {
                                                                     if (appMode === "professor" && onReverseSwapClick) {
                                                                         if (hasPendingSwap) {
                                                                            e.stopPropagation();
                                                                            alert("Esta aula já possui uma permuta em andamento.");
                                                                            return;
                                                                         }
                                                                         e.stopPropagation();
                                                                         onReverseSwapClick(r);
                                                                     }
                                                                  }}
                                                                >
                                                                  <div className="flex items-center gap-1.5 flex-1 max-w-[calc(100%-60px)]">
                                                                    <span className="font-bold text-[10px] leading-tight break-words pr-1">
                                                                      {
                                                                        r.subject
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                  <span
                                                                    className={`text-[8px] font-bold uppercase tracking-wide shrink-0 bg-white/10 px-1 rounded ${isPending ? (isDarkMode ? "text-red-400" : "text-red-600") : "opacity-80"}`}
                                                                  >
                                                                    {isPending
                                                                      ? "SEM PROF."
                                                                      : resolveTeacherName(
                                                                          r.teacher,
                                                                          globalTeachers,
                                                                        ).split(
                                                                          " ",
                                                                        )[0]}
                                                                  </span>
                                                                </div>
                                                              );
                                                            })
                                                          ) : (
                                                            <div
                                                              className={`font-black tracking-widest text-[9px] opacity-20 uppercase mt-1`}
                                                            >
                                                              Sem Aulas
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );

                                                    return (
                                                      <React.Fragment
                                                        key={`${course}-${activeMobileCls}-${day}-${time}-frag`}
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
                                                  },
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Sidebar de Elementos Nao Alocados e Notificacoes (OCULTA NO MODO CONSULTA) */}
          {false && (
              <div className="w-full lg:w-72 shrink-0 space-y-4 sticky top-20 flex flex-col items-end no-print">
                <div
                  className={`w-full rounded-2xl border shadow-sm p-4 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                >
                  <h3
                    className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                  >
                    <ListTodo size={16} /> Staging Area / Pendentes
                  </h3>
                  <Droppable droppableId="unallocated">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 min-h-[300px] p-2 rounded-xl transition-colors ${snapshot.isDraggingOver ? (isDarkMode ? "bg-slate-700/50" : "bg-slate-50") : "bg-transparent"}`}
                      >
                        {mappedSchedules
                          .filter(
                            (r) =>
                              !r.day || r.day === "A Definir" || r.day === "-",
                          )
                          .map((r, index) => (
                            <Draggable
                              key={String(r.id)}
                              draggableId={String(r.id)}
                              index={index}
                            >
                              {(prov2, snap2) => (
                                <div
                                  ref={prov2.innerRef}
                                  {...prov2.draggableProps}
                                  {...prov2.dragHandleProps}
                                  className={`p-4 rounded-xl border shadow-sm transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing ${snap2.isDragging ? "shadow-2xl scale-[1.04] z-50 ring-2 ring-indigo-500" : "hover:shadow-md"} ${getColorHash(r.subject, isDarkMode)}`}
                                >
                                  <p
                                    className={`font-black text-xs leading-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}
                                  >
                                    {r.subject}
                                  </p>
                                  <p
                                    className={`text-[10px] font-bold mt-1.5 opacity-80 uppercase tracking-widest ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                                  >
                                    {r.className} <br />
                                    <span className="mt-1 block opacity-80">
                                      {resolveTeacherName(
                                        r.teacher,
                                        globalTeachers,
                                      )}
                                    </span>
                                  </p>
                                  {r.room && (
                                    <span
                                      className={`inline-block mt-3 bg-black/10 text-center px-2 py-1 rounded text-[8px] font-black uppercase tracking-[0.2em]`}
                                    >
                                      {r.room}
                                    </span>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        {mappedSchedules.filter(
                          (r) =>
                            !r.day || r.day === "A Definir" || r.day === "-",
                        ).length === 0 && (
                          <div
                            className={`h-full flex flex-col items-center justify-center opacity-30 text-center py-10 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                          >
                            <ListTodo size={32} className="mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              Nenhum bloco
                              <br />
                              estacionado
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            )}
        </div>
      </DragDropContext>

      {/* HUB GLOBAL DE NOTIFICAÇÕES (OCULTO NO MODO CONSULTA) */}
      {false && (
        <div className="fixed bottom-6 right-6 z-[99] flex flex-col-reverse items-end gap-3 print:hidden">
           {!isNotificationsOpen ? (
              <div className="group relative flex items-center justify-end">
                <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                  Ver Alertas da Grade
                </div>
                <button onClick={() => setIsNotificationsOpen(true)} className="relative p-4 rounded-full bg-amber-500 text-white shadow-xl hover:scale-110 hover:bg-amber-400 transition-all flex items-center justify-center">
                  ⚠️
                </button>
              </div>
           ) : (
              <div className={`fixed bottom-6 right-6 z-[100] w-96 max-w-[90vw] animate-in slide-in-from-bottom-10`}>
                 <div className={`rounded-2xl shadow-2xl flex flex-col max-h-[70vh] border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                      <h3 className="font-black uppercase tracking-widest text-sm text-amber-500">Alertas da Grade</h3>
                      <button onClick={() => setIsNotificationsOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold p-2 transition-colors">X</button>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar p-0">
                      <ScheduleNotifications
                        recordsForWeek={activeData}
                        subjectHoursMeta={subjectHoursMeta}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                 </div>
              </div>
           )}
        </div>
      )}

    </React.Fragment>
    );
  },
);
