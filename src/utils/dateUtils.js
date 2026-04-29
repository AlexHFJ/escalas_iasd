// ============================================================
// UTILITÁRIOS DE DATA
// Gera automaticamente Quartas, Sábados e Domingos
// ============================================================

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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

/**
 * Gera todas as datas de Quarta (3), Sábado (6) e Domingo (0)
 * para os meses informados no ano informado.
 * Retorna array de objetos: { date, dayOfWeek, label }
 */
export function generateScheduleDates(months, year) {
  const TARGET_DAYS = [0, 3, 6]; // Domingo, Quarta, Sábado
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
          label: `${DAYS_PT[dow]}, ${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
          sortKey: date.getTime(),
          monthName: MONTHS_PT[month],
          month,
          year,
          day,
          id: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        });
      }
    }
  }

  return dates.sort((a, b) => a.sortKey - b.sortKey);
}

/**
 * Agrupa as datas por mês para facilitar a renderização
 */
export function groupDatesByMonth(dates) {
  const groups = {};
  for (const d of dates) {
    const key = `${d.year}-${d.month}`;
    if (!groups[key]) {
      groups[key] = {
        monthName: d.monthName,
        year: d.year,
        month: d.month,
        dates: [],
      };
    }
    groups[key].dates.push(d);
  }
  return Object.values(groups);
}

export function formatDateId(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentQuarter() {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}
