// ============================================================
// UTILITÁRIOS DE DATA
// ============================================================

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const DAYS_PT      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAYS_FULL_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const QUARTERS = {
  1: { label: '1º Trimestre', months: [0, 1, 2] },
  2: { label: '2º Trimestre', months: [3, 4, 5] },
  3: { label: '3º Trimestre', months: [6, 7, 8] },
  4: { label: '4º Trimestre', months: [9, 10, 11] },
};

export const BIMESTERS = {
  1: { label: '1º Bimestre', months: [0, 1] },
  2: { label: '2º Bimestre', months: [2, 3] },
  3: { label: '3º Bimestre', months: [4, 5] },
  4: { label: '4º Bimestre', months: [6, 7] },
  5: { label: '5º Bimestre', months: [8, 9] },
  6: { label: '6º Bimestre', months: [10, 11] },
};

// ── Gera datas individuais (Qua, Sáb, Dom) ─────────────────
export function generateScheduleDates(months, year) {
  const TARGET_DAYS = [0, 3, 6];
  const dates = [];

  for (const month of months) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dow = date.getDay();
      if (TARGET_DAYS.includes(dow)) {
        dates.push({
          date,
          dayOfWeek: dow,
          dayName: DAYS_FULL_PT[dow],
          label: `${DAYS_PT[dow]}, ${String(day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}`,
          sortKey: date.getTime(),
          monthName: MONTHS_PT[month],
          month, year, day,
          id: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        });
      }
    }
  }

  return dates.sort((a, b) => a.sortKey - b.sortKey);
}

// ── Gera semanas para o Diaconato ──────────────────────────
// Cada semana vai de Domingo a Sábado.
// Retorna array de objetos: { id, label, startDate, endDate }
export function generateWeeksForDiaconato(months, year) {
  // Pega o primeiro e último dia do período
  const firstMonth = Math.min(...months);
  const lastMonth  = Math.max(...months);
  const periodStart = new Date(year, firstMonth, 1);
  const periodEnd   = new Date(year, lastMonth + 1, 0); // último dia do último mês

  // Recua até o domingo anterior ao início do período
  const cursor = new Date(periodStart);
  cursor.setDate(cursor.getDate() - cursor.getDay()); // vai para domingo

  const weeks = [];

  while (cursor <= periodEnd) {
    const weekStart = new Date(cursor);                          // Domingo
    const weekEnd   = new Date(cursor); weekEnd.setDate(cursor.getDate() + 6); // Sábado

    // Só inclui semanas que têm interseção real com o período
    if (weekEnd >= periodStart && weekStart <= periodEnd) {
      const fmt = (d) =>
        `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;

      weeks.push({
        id: `week_${year}_${String(weekStart.getMonth()+1).padStart(2,'0')}_${String(weekStart.getDate()).padStart(2,'0')}`,
        label: `${fmt(weekStart)} ao ${fmt(weekEnd)}`,
        startDate: new Date(weekStart),
        endDate:   new Date(weekEnd),
        month: weekStart.getMonth(),
        year,
      });
    }

    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

export function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}
