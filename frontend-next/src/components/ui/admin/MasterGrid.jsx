import React, { useState, useEffect } from 'react';
import { 
  Calendar
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { MAP_DAYS } from '@/lib/dates';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';

export function MasterGrid({
  appMode, isDarkMode, viewMode, setViewMode, scheduleMode, setScheduleMode, userRole, siape,
  selectedCourse, setSelectedCourse, selectedClass, setSelectedClass, selectedTeacher, setSelectedTeacher,
  totalFilterYear, setTotalFilterYear, totalFilterTeacher, setTotalFilterTeacher, totalFilterClass, setTotalFilterClass, totalFilterSubject, setTotalFilterSubject,
  courses, classesList, globalTeachersList, availableYearsForTotal, availableTeachersForTotal, availableClassesForTotal, availableSubjectsForTotal,
  alunoStats, diarioStats, finalFilteredTotalData, bimestresData, recordsForWeek,
  activeData, handlePrint, getColorHash, isTeacherPending,
  selectedDay, setSelectedDay, selectedWeek, setSelectedWeek, activeWeeksList,
  getCellRecords, activeCourseClasses, profStats, activeDays, classTimes, rawData, loadAdminMetadata,
  subjectHoursMeta
}) {
  const { globalTeachers, refreshData, intervals } = useData();
  const [editorModal, setEditorModal] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [draggingRecord, setDraggingRecord] = useState(null);

  useEffect(() => {
    if ((appMode === 'admin' || userRole === 'gestao') && scheduleMode === 'previa' && selectedWeek) {
      apiClient.fetchRequests().then(reqs => {
        if (reqs) setPendingRequests(reqs.filter(r => r.status === 'pendente' && r.week_id === selectedWeek));
      }).catch(e => console.error("Error fetching requests for previa alerts", e));
    }
  }, [scheduleMode, selectedWeek, appMode, userRole]);

  const onDragStart = (start) => {
    const record = activeData.find(r => r.id === start.draggableId);
    setDraggingRecord(record || null);
  };

  const onDragEnd = async (result) => {
    setDraggingRecord(null);
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const recordId = draggableId;
    const record = activeData.find(r => r.id === recordId);
    if (!record) return;

    let dDay, dTime, dCls;
    if (destination.droppableId === 'unallocated') {
      dDay = 'A Definir'; dTime = 'A Definir'; dCls = record.className;
    } else {
      [dDay, dTime, dCls] = destination.droppableId.split('|');
    }

    try {
      const updatedRecord = { ...record, day: dDay, time: dTime, className: dCls };
      record.day = dDay; record.time = dTime; record.className = dCls; // Optimistic
      await apiClient.updateScheduleRecord(selectedWeek, updatedRecord);
      if (typeof refreshData === 'function') await refreshData();
    } catch (e) {
      alert("Erro ao mover aula: " + e.message);
      if (typeof refreshData === 'function') await refreshData();
    }
  };

  const safeDays = [...(activeDays || ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'])].sort((a,b) => MAP_DAYS.indexOf(a) - MAP_DAYS.indexOf(b));
  const shiftOrder = { 'Matutino': 1, 'Vespertino': 2, 'Noturno': 3 };
  const safeTimes = [...(classTimes || [])].sort((a, b) => {
    const orderA = shiftOrder[a?.shift] || 99;
    const orderB = shiftOrder[b?.shift] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.timeStr.localeCompare(b.timeStr);
  });

  return (
    <div className={`space-y-4 animate-in fade-in duration-700 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
      <div className={`p-4 rounded-xl shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h2 className="font-black text-lg flex items-center gap-2 mb-4">
          <Calendar size={20} /> Master Grid - Gestão de Horários e Drag & Drop
        </h2>
        
        {/* Drag and Drop Container Básico */}
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className={isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}>
                  <th className="p-3 border text-left">Horário</th>
                  {safeDays.map(day => (
                    <th key={day} className="p-3 border text-center">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safeTimes.map(timeObj => (
                  <tr key={timeObj.timeStr}>
                    <td className="p-3 border font-bold text-center w-24 whitespace-nowrap">{timeObj.timeStr}</td>
                    {safeDays.map(day => (
                      <td key={`${day}-${timeObj.timeStr}`} className="p-2 border align-top">
                        <Droppable droppableId={`${day}|${timeObj.timeStr}|TurmaModelo`}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`min-h-[80px] p-2 rounded-lg transition-colors ${
                                snapshot.isDraggingOver ? (isDarkMode ? 'bg-slate-700' : 'bg-slate-50') : 'bg-transparent'
                              }`}
                            >
                              {activeData
                                .filter(r => r.day === day && r.time === timeObj.timeStr)
                                .map((r, index) => (
                                  <Draggable key={r.id} draggableId={r.id} index={index}>
                                    {(prov2, snap2) => (
                                      <div
                                        ref={prov2.innerRef}
                                        {...prov2.draggableProps}
                                        {...prov2.dragHandleProps}
                                        className={`p-2 mb-2 rounded border shadow-sm text-xs ${
                                          snap2.isDragging ? 'shadow-xl scale-105 z-50' : ''
                                        } ${isDarkMode ? 'bg-indigo-900 border-indigo-700' : 'bg-indigo-100 border-indigo-300'}`}
                                      >
                                        <div className="font-bold">{r.subject}</div>
                                        <div>{r.teacher}</div>
                                        <div className="text-[9px] mt-1">{r.className}</div>
                                      </div>
                                    )}
                                  </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
