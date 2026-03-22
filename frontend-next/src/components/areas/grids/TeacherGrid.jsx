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
    isSlotLocked,
    setVacantRequestModal,
    setExchangeTarget,
    getColorHash,
    getFormattedDayLabel,
    recordsForWeek,
    activeDays,
    classTimes,
  }) => {
    const baseProfRecords = mappedSchedules.filter(
      (r) =>
        r.teacherId &&
        String(r.teacherId).split(",").includes(String(selectedTeacher)),
    );
    const profClasses = new Set(baseProfRecords.map((r) => r.className));
    let profRecords = [...baseProfRecords];

    if (showVacantInMyClasses) {
      const vagas = mappedSchedules.filter(
        (r) => isTeacherPending(r.teacher) && profClasses.has(r.className),
      );
      profRecords = [...profRecords, ...vagas];
    }

    const profCourses = [...new Set(profRecords.map((r) => r.course))].sort(
      (a, b) => String(a).localeCompare(String(b)),
    );
    const [activeCourseTab, setActiveCourseTab] = useState("Todos");

    useEffect(() => {
      if (
        profCourses.length > 0 &&
        (!activeCourseTab ||
          (activeCourseTab !== "Todos" &&
            !profCourses.includes(activeCourseTab)))
      ) {
        setActiveCourseTab("Todos");
      }
    }, [profCourses, activeCourseTab]);

    return (
      <div className="flex flex-col xl:flex-row gap-6 items-start animate-in zoom-in-95 duration-500">
        {/* Lado Principal: Grade */}
        <div className={`w-full space-y-6`}>
          {profCourses.length === 0 ? (
            <div
              className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
            >
              <UserCircle
                size={40}
                className={`mx-auto mb-3 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`}
              />
              <h3
                className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
              >
                Sem Aulas
              </h3>
              <p
                className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
              >
                O professor não possui aulas na semana selecionada.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
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
                  {appMode === "professor" && viewMode === "professor" && (
                    <label className="flex items-center gap-2 cursor-pointer bg-black/20 hover:bg-black/30 px-3 py-2 rounded-xl transition-colors text-white text-[10px] uppercase font-black tracking-widest shadow-sm ring-1 ring-white/10">
                      <input
                        type="checkbox"
                        checked={showVacantInMyClasses}
                        onChange={(e) =>
                          setShowVacantInMyClasses(e.target.checked)
                        }
                        className="accent-indigo-500 w-3.5 h-3.5"
                      />
                      Mostrar Vagas nas Minhas Turmas
                    </label>
                  )}
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print ring-1 ring-white/10"
                  >
                    <Printer size={15} /> Imprimir Horário
                  </button>
                </div>
              </div>

              {/* ABAS DOS CURSOS */}
              {profCourses.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-2 no-print animate-in fade-in slide-in-from-top-2">
                  {["Todos", ...profCourses].map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveCourseTab(c)}
                      className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${activeCourseTab === c ? (scheduleMode === "padrao" ? "bg-blue-600 text-white ring-2 ring-blue-500/50 scale-[1.02] z-10" : scheduleMode === "previa" ? "bg-violet-600 text-white ring-2 ring-violet-500/50 scale-[1.02] z-10" : "bg-indigo-600 text-white ring-2 ring-indigo-500/50 scale-[1.02] z-10") : isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700" : "bg-white text-slate-500 border border-slate-200 hover:text-slate-800"}`}
                    >
                      {c === "Todos" ? "Todos os Cursos" : c}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const coursesToRender =
                  activeCourseTab === "Todos"
                    ? profCourses
                    : [activeCourseTab || profCourses[0]];

                return coursesToRender.map((course) => {
                  const courseRecords = profRecords.filter(
                    (r) => r.course === course,
                  );
                  const courseClasses = [
                    ...new Set(courseRecords.map((r) => r.className)),
                  ].sort();
                  const courseDays = safeDays.filter((day) =>
                    courseRecords.some((r) => r.day === day),
                  );

                  return (
                    <div
                      key={`prof-course-${course}`}
                      className={`rounded-2xl shadow-sm border overflow-hidden mb-6 animate-in fade-in zoom-in-95 duration-300 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
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
                            {courseDays.map((day, dayIndex) => {
                              const activeTimes = safeTimes.filter((timeObj) =>
                                courseRecords.some(
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
                                              courseRecords.filter(
                                                (r) =>
                                                  r.day === day &&
                                                  r.time === timeStr &&
                                                  r.className === cls,
                                              );

                                            return (
                                              <td
                                                key={`prof-${cls}-${timeStr}`}
                                                className={`p-1 border align-top relative ${isDarkMode ? "border-slate-700 group-hover:bg-slate-700/30" : "border-slate-200 group-hover:bg-slate-50/50"}`}
                                              >
                                                <div className="flex flex-col gap-1 w-full h-full min-h-[76px]">
                                                  {recordsNesteSlot.length ===
                                                  0 ? (
                                                    <div
                                                      className={`flex items-center justify-center h-full font-black text-[9px] tracking-widest uppercase select-none flex-1 ${isDarkMode ? "opacity-20" : "opacity-5"}`}
                                                    >
                                                      -
                                                    </div>
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
                                                          isSlotLocked &&
                                                          isSlotLocked(r);
                                                        return (
                                                          <div
                                                            key={
                                                              r.id
                                                                ? `prof-rec-${r.id}-${idx}`
                                                                : `prof-rec-idx-${idx}`
                                                            }
                                                            onClick={() => {
                                                              if (appMode === "professor") {
                                                                // Bloqueio de Segurança: Professor comum só pode solicitar troca/vaga se ele leciona na turma clicada.
                                                                if (userRole !== "admin" && userRole !== "gestao") {
                                                                  if (!profClasses.has(r.className)) {
                                                                     alert("Você só pode solicitar trocas ou assumir vagas em turmas onde você já leciona ao menos uma disciplina.");
                                                                     return;
                                                                  }
                                                                }

                                                                if (isVaga) {
                                                                  if (isLocked) {
                                                                    alert("Esta vaga já está sendo analisada pela direção.");
                                                                    return;
                                                                  }
                                                                  if (typeof setVacantRequestModal === "function") {
                                                                    setVacantRequestModal(r);
                                                                  }
                                                                } else if (typeof setExchangeTarget === "function") {
                                                                  setExchangeTarget({
                                                                    targetClass: r.className,
                                                                    targetCourse: r.course,
                                                                    originalRecord: r,
                                                                  });
                                                                }
                                                              }
                                                            }}
                                                            className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[76px] transition-all relative ${isLocked ? (isDarkMode ? "bg-slate-800/80 border-slate-700 opacity-60 cursor-not-allowed" : "bg-slate-200 border-slate-300 opacity-60 cursor-not-allowed") : isVaga ? (isDarkMode ? "bg-red-900/30 border-red-800/50 hover:scale-[1.02] cursor-pointer" : "bg-red-50 border-red-300 hover:scale-[1.02] cursor-pointer") : `${getColorHash(r.className, isDarkMode)} hover:scale-[1.02] cursor-pointer`} ${hasClash && isVaga && !isLocked ? " ring-2 ring-amber-500 animate-pulse" : ""}`}
                                                          >
                                                            {isVaga ? (
                                                              <React.Fragment>
                                                                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-max z-10">
                                                                  <span
                                                                    className={`text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-sm ${isLocked ? "bg-slate-500" : isDarkMode ? "bg-red-600 shadow-red-900" : "bg-red-600 shadow-red-200"}`}
                                                                  >
                                                                    {isLocked
                                                                      ? "EM ANÁLISE"
                                                                      : "AULA VAGA"}
                                                                  </span>
                                                                </div>
                                                                <p
                                                                  className={`subject font-black text-xs leading-snug text-center mt-1 ${isLocked ? "text-slate-400" : isDarkMode ? "text-red-100" : "text-red-950"}`}
                                                                >
                                                                  {r.subject ||
                                                                    "Pendente"}
                                                                </p>
                                                                <span
                                                                  className={`details text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded mt-1.5 w-fit uppercase mx-auto ${isLocked ? "bg-slate-700/50 text-slate-300" : isDarkMode ? "bg-red-900/80 text-red-100" : "bg-red-200 text-red-950"}`}
                                                                >
                                                                  {r.className}{" "}
                                                                  {r.room
                                                                    ? "- " +
                                                                      r.room
                                                                    : ""}
                                                                </span>
                                                              </React.Fragment>
                                                            ) : (
                                                              <React.Fragment>
                                                                <p className="subject font-black text-xs sm:text-sm leading-snug text-center drop-shadow-sm">
                                                                  {r.subject}{" "}
                                                                  {r.isSubstituted &&
                                                                    r.originalSubject && (
                                                                      <span className="block text-[8px] sm:text-[9px] opacity-80 mt-1 uppercase">
                                                                        Era:{" "}
                                                                        {
                                                                          r.originalSubject
                                                                        }
                                                                      </span>
                                                                    )}
                                                                </p>
                                                                <span
                                                                  className={`details text-[10px] sm:text-xs font-black tracking-widest px-2 py-1 rounded mt-1.5 w-fit uppercase mx-auto shadow-sm ${isDarkMode ? "bg-white/25 text-white" : "bg-black/10 text-slate-900"}`}
                                                                >
                                                                  {r.className}{" "}
                                                                  {r.room
                                                                    ? "- " +
                                                                      r.room
                                                                    : ""}
                                                                </span>
                                                                {r.isSubstituted && (
                                                                  <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                                    <span
                                                                      title="Assumida no lugar de uma Vaga"
                                                                      className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-bl-[8px] bg-indigo-600 border-l border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30"
                                                                    >
                                                                      Substituição
                                                                    </span>
                                                                  </div>
                                                                )}
                                                              </React.Fragment>
                                                            )}
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
                          const dayRecords = courseRecords.filter(
                            (r) => r.day === day,
                          );
                          if (dayRecords.length === 0) return null;

                          const dailyShifts = new Set(
                            courseRecords
                              .map(
                                (r) =>
                                  safeTimes.find((t) => t.timeStr === r.time)
                                    ?.shift,
                              )
                              .filter(Boolean),
                          );
                          const activeTimes = safeTimes.filter((timeObj) =>
                            dailyShifts.has(timeObj.shift),
                          );

                          return (
                            <div
                              key={`mob-prof-${course}-${day}`}
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
                                      key={`mob-prof-${course}-${day}-${time}-row`}
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
                                        {records.map((r) => {
                                          const isPending = isTeacherPending(
                                            r.teacher,
                                          );
                                          return (
                                            <div
                                              key={`mob-rec-${r.id}-${idx}`}
                                              className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? "bg-red-900/30 border-red-800/50 text-red-300" : "bg-red-50 border-red-200 text-red-900") : getColorHash(r.className, isDarkMode)}`}
                                            >
                                              <div className="flex items-center gap-1.5 flex-1 w-full">
                                                <span
                                                  className={`text-[8px] font-black uppercase rounded px-1 shrink-0 ${isDarkMode ? "bg-white/20" : "bg-black/10"}`}
                                                >
                                                  {r.className}
                                                </span>
                                                <span className="font-bold text-[10px] leading-tight truncate">
                                                  {r.subject}
                                                </span>
                                              </div>
                                              {r.room && (
                                                <span
                                                  className={`text-[8px] font-black uppercase tracking-widest pl-1 mt-1 opacity-80 block`}
                                                >
                                                  SALA: {r.room}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );

                                  return (
                                    <React.Fragment
                                      key={`mob-prof-${course}-${day}-${time}-frag`}
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
            </div>
          )}
        </div>

        {/* Widget flutuante movido globalmente para PortalView.jsx para acompanhar fluxo em todas as abas */}
      </div>
    );
  },
);
