// ============================================================
// PREENCHIMENTO AUTOMÁTICO — Algoritmo igualitário
// Garante que o mesmo membro não aparece duas vezes
// na mesma data, e distribui de forma equilibrada
// ============================================================

import { getFieldsForDate } from './ministryConfig';

export function autoFillScheduleForce(dates, ministryId, members) {
  if (!members || members.length === 0) return {};

  const result = {};

  // Monta todos os slots na ordem progressiva das datas
  // Cada slot = { dateId, fieldId }
  const slots = [];
  for (const date of dates) {
    const fields = getFieldsForDate(ministryId, date.dayOfWeek)
      .filter(f => f.type === 'member');
    for (const field of fields) {
      slots.push({ dateId: date.id, fieldId: field.id });
    }
  }

  // Contagem de uso de cada membro
  const usageCount = new Array(members.length).fill(0);
  // Índices de membros já usados em cada data
  const usedOnDate = {};

  for (const slot of slots) {
    if (!usedOnDate[slot.dateId]) usedOnDate[slot.dateId] = new Set();

    // Candidatos: membros que ainda NÃO foram usados nesta data
    let candidates = members
      .map((_, i) => i)
      .filter(i => !usedOnDate[slot.dateId].has(i));

    // Se não houver candidatos livres (mais campos que membros),
    // permite repetição mas ainda escolhe o menos usado
    if (candidates.length === 0) {
      candidates = members.map((_, i) => i);
    }

    // Escolhe o candidato com menor contagem de uso
    const bestIdx = candidates.reduce((best, i) =>
      usageCount[i] < usageCount[best] ? i : best,
      candidates[0]
    );

    result[slot.dateId] = result[slot.dateId] || {};
    result[slot.dateId][slot.fieldId] = members[bestIdx];
    usageCount[bestIdx]++;
    usedOnDate[slot.dateId].add(bestIdx);
  }

  return result;
}

// Preenche apenas campos vazios, mantendo os já preenchidos
export function autoFillSchedule(dates, ministryId, members, existingData = {}) {
  if (!members || members.length === 0) return existingData;

  // Descobre slots ainda vazios
  const emptyDates = dates.map(date => {
    const fields = getFieldsForDate(ministryId, date.dayOfWeek)
      .filter(f => f.type === 'member');
    const emptyFields = fields.filter(f => !existingData[date.id]?.[f.id]);
    return { ...date, emptyFields };
  }).filter(d => d.emptyFields.length > 0);

  if (emptyDates.length === 0) return existingData;

  const result = { ...existingData };
  const usageCount = new Array(members.length).fill(0);

  // Conta uso atual dos membros já escalados
  for (const dateEntry of Object.values(existingData)) {
    for (const val of Object.values(dateEntry)) {
      const idx = members.indexOf(val);
      if (idx !== -1) usageCount[idx]++;
    }
  }

  const usedOnDate = {};

  for (const date of emptyDates) {
    if (!usedOnDate[date.id]) usedOnDate[date.id] = new Set();

    // Marca membros já usados nesta data
    const existing = existingData[date.id] || {};
    for (const val of Object.values(existing)) {
      const idx = members.indexOf(val);
      if (idx !== -1) usedOnDate[date.id].add(idx);
    }

    for (const field of date.emptyFields) {
      let candidates = members
        .map((_, i) => i)
        .filter(i => !usedOnDate[date.id].has(i));

      if (candidates.length === 0) candidates = members.map((_, i) => i);

      const bestIdx = candidates.reduce((best, i) =>
        usageCount[i] < usageCount[best] ? i : best,
        candidates[0]
      );

      result[date.id] = result[date.id] || {};
      result[date.id][field.id] = members[bestIdx];
      usageCount[bestIdx]++;
      usedOnDate[date.id].add(bestIdx);
    }
  }

  return result;
}
