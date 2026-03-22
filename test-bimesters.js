const bimesters = [
    { "id": "1", "name": "1º Bimestre", "startDate": "2026-02-04", "endDate": "2026-04-17" },
    { "id": "2", "name": "2º Bimestre", "startDate": "2026-04-22", "endDate": "2026-07-02" },
    { "id": "3", "name": "3º Bimestre", "startDate": "2026-07-22", "endDate": "2026-09-28" },
    { "id": "4", "name": "4º Bimestre", "startDate": "2026-09-29", "endDate": "2026-12-15" }
];
const academicWeeks = [
  { "id": 12, "name": "Semana 12", "start_date": "2026-04-20", "end_date": "2026-04-24", "school_days": 5 },
  { "id": 13, "name": "Semana 13", "start_date": "2026-04-27", "end_date": "2026-04-30", "school_days": 4 }
];

bimesters.forEach(b => {
    let diasLetivos = 0;
    const bStart = new Date(b.startDate + 'T00:00:00');
    const bEnd = new Date(b.endDate + 'T23:59:59');
    academicWeeks.forEach(w => {
        const wStart = new Date(w.start_date + 'T12:00:00');
        const wEnd = new Date(w.end_date + 'T12:00:00');
        if (wStart <= bEnd && wEnd >= bStart) {
            if (wStart >= bStart && wEnd <= bEnd) {
                diasLetivos += (w.school_days || 0);
            } else {
                const overlapStart = new Date(Math.max(wStart.getTime(), bStart.getTime()));
                const overlapEnd = new Date(Math.min(wEnd.getTime(), bEnd.getTime()));
                let overlapDays = 0;
                for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                    if (d.getDay() !== 0) overlapDays++; // Exclude Sunday
                }
                diasLetivos += Math.min(overlapDays, (w.school_days || 0));
            }
        }
    });
    console.log(b.name, "Dias लेटivos:", diasLetivos);
});
