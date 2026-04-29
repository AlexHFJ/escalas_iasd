// ============================================================
// PREENCHIMENTO AUTOMÁTICO
// Distribui os membros igualmente entre as datas
// ============================================================

import { getFieldsForDate } from './ministryConfig';

/**
 * Distribui membros de forma rotativa e igualitária
 * entre todas as datas e campos do tipo 'member'
 */
export function autoFillSchedule(dates, ministryId, members, existingData = {}) {
  if (!members || members.length === 0) return existingData;

  const result = { ...existingData };

  // Agrupa datas por campo para distribuição independente
  const fieldDates = {}; // { fieldId: [dates where this field appears] }

  for (const date of dates) {
    const fields = getFieldsForDate(ministryId, date.dayOfWeek);
    for (const field of fields) {
      if (field.type === 'member') {
        if (!fieldDates[field.id]) fieldDates[field.id] = [];
        fieldDates[field.id].push(date);
      }
    }
  }

  // Para cada campo, distribui os membros em round-robin
  for (const [fieldId, fieldDateList] of Object.entries(fieldDates)) {
    let idx = 0;
    for (const date of fieldDateList) {
      // Só preenche se o campo estiver vazio
      const current = result[date.id]?.[fieldId];
      if (!current) {
        result[date.id] = { ...(result[date.id] || {}) };
        result[date.id][fieldId] = members[idx % members.length];
      }
      idx++;
    }
  }

  return result;
}

/**
 * Versão que SUBSTITUI tudo (ignora dados existentes)
 */
export function autoFillScheduleForce(dates, ministryId, members) {
  return autoFillSchedule(dates, ministryId, members, {});
}
