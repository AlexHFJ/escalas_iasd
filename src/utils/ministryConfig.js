// ============================================================
// CONFIGURAÇÃO DOS MINISTÉRIOS
// ============================================================

// Música: apenas Sábado e Domingo
// Sábado (6): Grupo de Louvor + Música Especial/Culto + Escola Sabatina
// Domingo (0): Grupo de Louvor + Música Especial/Culto

export const MUSIC_FIELDS_BY_DAY = {
  0: [ // Domingo
    { id: 'grupo_louvor', label: 'Grupo de Louvor',         type: 'member', placeholder: 'Selecione o grupo...' },
    { id: 'musica_culto', label: 'Música Especial / Culto', type: 'text',   placeholder: 'Nome ou grupo...' },
  ],
  6: [ // Sábado
    { id: 'grupo_louvor',    label: 'Grupo de Louvor',         type: 'member', placeholder: 'Selecione o grupo...' },
    { id: 'musica_culto',    label: 'Música Especial / Culto', type: 'text',   placeholder: 'Nome ou grupo...' },
    { id: 'escola_sabatina', label: 'Escola Sabatina',         type: 'member', placeholder: 'Selecione o cantor...' },
  ],
};

export const MUSIC_ALL_FIELDS = [
  { id: 'grupo_louvor',    label: 'Grupo de Louvor' },
  { id: 'musica_culto',    label: 'Música Especial / Culto' },
  { id: 'escola_sabatina', label: 'Escola Sabatina' },
];

// Recepção: campos variam por dia
// Sábado (6): 2 recepcionistas
// Domingo (0) e Quarta (3): 1 recepcionista

export const RECEPCAO_FIELDS_BY_DAY = {
  0: [ // Domingo
    { id: 'recepcao_1', label: 'Recepcionista', type: 'member', placeholder: 'Selecione...' },
  ],
  3: [ // Quarta
    { id: 'recepcao_1', label: 'Recepcionista', type: 'member', placeholder: 'Selecione...' },
  ],
  6: [ // Sábado
    { id: 'recepcao_1', label: 'Recepcionista 1', type: 'member', placeholder: 'Selecione...' },
    { id: 'recepcao_2', label: 'Recepcionista 2', type: 'member', placeholder: 'Selecione...' },
  ],
};

export const RECEPCAO_ALL_FIELDS = [
  { id: 'recepcao_1', label: 'Recepcionista 1' },
  { id: 'recepcao_2', label: 'Recepcionista 2' },
];

export const MINISTRIES = {
  musica: {
    id: 'musica',
    label: 'Música',
    icon: '🎵',
    color: 'indigo',
    fields: MUSIC_ALL_FIELDS,
    fieldsByDay: MUSIC_FIELDS_BY_DAY,
    showOnDays: [0, 6], // ← apenas Sábado e Domingo
    hasObservations: true,
  },
  diaconato: {
    id: 'diaconato',
    label: 'Diaconato',
    icon: '🔑',
    color: 'amber',
    fields: [
      { id: 'responsavel_chave', label: 'Responsável pela Chave', type: 'member', placeholder: 'Selecione o responsável...' },
      { id: 'apoio_1',           label: 'Apoio / Oferta 1',       type: 'member', placeholder: 'Selecione o apoio...' },
      { id: 'apoio_2',           label: 'Apoio / Oferta 2',       type: 'member', placeholder: 'Selecione o apoio...' },
    ],
    showOnDays: [0, 3, 6],
    hasObservations: false,
  },
  sonoplastia: {
    id: 'sonoplastia',
    label: 'Sonoplastia',
    icon: '🎚️',
    color: 'emerald',
    fields: [
      { id: 'pc_projecao', label: 'PC / Projeção', type: 'member', placeholder: 'Selecione o operador...' },
      { id: 'mesa_som',    label: 'Mesa de Som',   type: 'member', placeholder: 'Selecione o operador...' },
    ],
    showOnDays: [0, 3, 6],
    hasObservations: false,
  },
  recepcao: {
    id: 'recepcao',
    label: 'Recepção',
    icon: '🤝',
    color: 'rose',
    fields: RECEPCAO_ALL_FIELDS,
    fieldsByDay: RECEPCAO_FIELDS_BY_DAY,
    showOnDays: [0, 3, 6], // ← Domingo, Quarta e Sábado
    hasObservations: false,
  },
};

export const MINISTRY_LIST = Object.values(MINISTRIES);

export function getMinistry(id) {
  return MINISTRIES[id];
}

export function getFieldsForDate(ministryId, dayOfWeek) {
  const ministry = MINISTRIES[ministryId];
  if (!ministry) return [];
  if (ministry.fieldsByDay) {
    return ministry.fieldsByDay[dayOfWeek] || [];
  }
  return ministry.fields;
}

export const COLOR_MAP = {
  indigo: {
    bg: 'bg-indigo-50', border: 'border-indigo-200',
    header: 'bg-indigo-700', badge: 'bg-indigo-100 text-indigo-800',
    tab: 'bg-indigo-700 text-white', accent: '#4338ca',
  },
  amber: {
    bg: 'bg-amber-50', border: 'border-amber-200',
    header: 'bg-amber-700', badge: 'bg-amber-100 text-amber-800',
    tab: 'bg-amber-600 text-white', accent: '#b45309',
  },
  emerald: {
    bg: 'bg-emerald-50', border: 'border-emerald-200',
    header: 'bg-emerald-700', badge: 'bg-emerald-100 text-emerald-800',
    tab: 'bg-emerald-700 text-white', accent: '#047857',
  },
  rose: {
    bg: 'bg-rose-50', border: 'border-rose-200',
    header: 'bg-rose-700', badge: 'bg-rose-100 text-rose-800',
    tab: 'bg-rose-700 text-white', accent: '#be123c',
  },
};
