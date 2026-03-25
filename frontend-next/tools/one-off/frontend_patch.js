  const dynamicWeeksList = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules) || !academicWeeks) return [];
    
    let baseSchedules = [];
    if (scheduleMode === 'consolidado' || scheduleMode === 'atual') {
       baseSchedules = schedules.filter(s => s.type === 'oficial' && String(s.academic_year) === String(selectedConfigYear));
    } else if (scheduleMode === 'previa') {
       baseSchedules = schedules.filter(s => s.type === 'previa' && String(s.academic_year) === String(selectedConfigYear));
    } else if (scheduleMode === 'padrao') {
       // Padrão doesn't use scheduled week records natively, but we generate the dropdown of future weeks
       baseSchedules = academicWeeks; // mock so we get all weeks initially
    } else {
       baseSchedules = schedules.filter(s => s.type === scheduleMode && String(s.academic_year) === String(selectedConfigYear));
    }

    let uniqueWeekIds = [];
    if (scheduleMode === 'padrao') {
       uniqueWeekIds = [...new Set(academicWeeks.map(w => String(w.id)))];
    } else {
       uniqueWeekIds = [...new Set(baseSchedules.map(s => String(s.week_id)))].filter(Boolean);
    }

    const now = new Date();
    now.setHours(0,0,0,0);
    const sortedWeeks = [...academicWeeks].sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
    
    uniqueWeekIds = uniqueWeekIds.filter(id => {
       const w = academicWeeks.find(week => String(week.id) === String(id));
       if (!w) return false;
       const s = new Date(w.start_date + 'T00:00:00');
       const e = new Date(w.end_date + 'T23:59:59');
       
       const isPast = e < now;
       const isCurrent = now >= s && now <= e;
       const isFuture = s > now;
       
       if (scheduleMode === 'consolidado') return isPast;
       if (scheduleMode === 'atual') return isCurrent;
       if (scheduleMode === 'previa') return isFuture;
       if (scheduleMode === 'padrao') return isFuture || isCurrent;
       return true;
    });

    if (appMode === 'aluno' && scheduleMode === 'previa') {
        const refDate = new Date(now);
        if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
        else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
        refDate.setHours(0,0,0,0);
        
        const currWeekIndex = sortedWeeks.findIndex(w => {
            const s = new Date(w.start_date + 'T00:00:00'); 
            const e = new Date(w.end_date + 'T23:59:59');
            return refDate >= s && refDate <= e;
        });
        
        let nextWeekId = null;
        if (currWeekIndex !== -1 && currWeekIndex + 1 < sortedWeeks.length) {
            nextWeekId = String(sortedWeeks[currWeekIndex + 1].id);
        } else {
            const fallback = sortedWeeks.find(w => new Date(w.start_date + 'T00:00:00') > refDate);
            if (fallback) nextWeekId = String(fallback.id);
        }
        
        if (nextWeekId) {
            uniqueWeekIds = uniqueWeekIds.filter(id => id === nextWeekId);
        } else {
            uniqueWeekIds = [];
        }
    }
    
    return uniqueWeekIds.map(id => {
       const weekObj = academicWeeks.find(w => String(w.id) === String(id));
       let labelStr = id;
       if (weekObj) {
          const fmt = (iso) => {
             if (!iso) return '';
             const parts = iso.split('-');
             if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
             return iso;
          };
          const start = fmt(weekObj.start_date);
          const end = fmt(weekObj.end_date);
          labelStr = start && end ? `${weekObj.name} (${start} a ${end})` : (weekObj.name || id);
       }
       return {
          value: id,
          label: labelStr
       };
    }).sort((a,b) => {
       if (scheduleMode === 'consolidado') return b.label.localeCompare(a.label); // descending for past
       return a.label.localeCompare(b.label); // ascending for standard/future
    });
  }, [schedules, scheduleMode, selectedConfigYear, academicWeeks, appMode]);
