import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MINISTRY_LIST, getMinistry, COLOR_MAP, getFieldsForDate } from '../utils/ministryConfig';
import { generateScheduleDates, QUARTERS, BIMESTERS, MONTHS_PT, getCurrentQuarter, getCurrentYear } from '../utils/dateUtils';
import { generateSchedulePDF } from '../utils/pdfUtils';
import { ADVENTIST_LOGO_BASE64 } from '../utils/adventistLogo';

export default function PublicBoard() {
  const [config, setConfig] = useState(null);
  const [activeMinistry, setActiveMinistry] = useState('musica');
  const [selectedPeriodType, setSelectedPeriodType] = useState('quarter');
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [scheduleData, setScheduleData] = useState({});
  const [ministryConfig, setMinistryConfig] = useState({}); // observações + imagem
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [filterMonth, setFilterMonth] = useState('all');

  useEffect(() => {
    getDoc(doc(db, 'config', 'church')).then(snap => {
      if (snap.exists()) setConfig(snap.data());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Carrega config do ministério (observações + imagem)
  useEffect(() => {
    getDoc(doc(db, 'ministryConfig', activeMinistry)).then(snap => {
      if (snap.exists()) setMinistryConfig(snap.data());
      else setMinistryConfig({});
    }).catch(() => setMinistryConfig({}));
  }, [activeMinistry]);

  const allDates = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    const period = periods[selectedPeriod];
    if (!period) return [];
    return generateScheduleDates(period.months, selectedYear);
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  const ministryDates = useMemo(() => {
    const ministry = getMinistry(activeMinistry);
    if (!ministry) return [];
    return allDates.filter(d => ministry.showOnDays.includes(d.dayOfWeek));
  }, [allDates, activeMinistry]);

  const filteredDates = useMemo(() =>
    filterMonth === 'all' ? ministryDates : ministryDates.filter(d => d.month === parseInt(filterMonth)),
    [ministryDates, filterMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(ministryDates.map(d => d.month));
    return Array.from(months).sort();
  }, [ministryDates]);

  const periodLabel = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    return `${periods[selectedPeriod]?.label} de ${selectedYear}`;
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  useEffect(() => {
    const scheduleId = `${activeMinistry}_${selectedPeriodType}${selectedPeriod}_${selectedYear}`;
    const unsub = onSnapshot(doc(db, 'schedules', scheduleId), snap => {
      setScheduleData(snap.exists() ? snap.data().entries || {} : {});
    });
    return () => unsub();
  }, [activeMinistry, selectedPeriodType, selectedPeriod, selectedYear]);

  const ministry = getMinistry(activeMinistry);
  const colors = ministry ? COLOR_MAP[ministry.color] : COLOR_MAP.indigo;
  const years = [getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  async function handlePDF() {
    setGeneratingPDF(true);
    try {
      await generateSchedulePDF({
        churchName: config?.churchName || 'Igreja Adventista do Sétimo Dia',
        ministryLabel: ministry?.label || '',
        periodLabel,
        ministry,
        dates: filteredDates,
        scheduleData,
        ministryImage: ministryConfig?.image || null,
        observations: ministryConfig?.observations || '',
      });
    } catch (e) { alert('Erro ao gerar PDF: ' + e.message); }
    finally { setGeneratingPDF(false); }
  }

  // Colunas para o cabeçalho da tabela
  const allFields = ministry?.fieldsByDay ? ministry.fields : ministry?.fields || [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-navy-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Carregando escala...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-navy-700 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4">
          {/* Logo IASD — sempre visível */}
          <img src={ADVENTIST_LOGO_BASE64} alt="IASD" className="w-14 h-14 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight">
              {config?.churchName || 'Igreja Adventista do Sétimo Dia'}
            </h1>
            <p className="text-blue-200 text-sm mt-0.5">Mural de Escalas de Ministérios</p>
          </div>
          <a href="/login" className="text-blue-200 hover:text-white text-xs border border-blue-400/30 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors hidden sm:block shrink-0">
            Área do Diretor →
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 fade-in">
        {/* ── Filtros ── */}
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-700 mb-4 flex items-center gap-2">
            <span>🗓️</span> Selecionar Período
          </h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Período</label>
              <select className="select-field" value={selectedPeriodType}
                onChange={e => { setSelectedPeriodType(e.target.value); setSelectedPeriod(1); }}>
                <option value="quarter">Trimestre</option>
                <option value="bimester">Bimestre</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                {selectedPeriodType === 'quarter' ? 'Trimestre' : 'Bimestre'}
              </label>
              <select className="select-field" value={selectedPeriod} onChange={e => setSelectedPeriod(Number(e.target.value))}>
                {Object.entries(selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS).map(([k,v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[90px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Ano</label>
              <select className="select-field" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Mês</label>
              <select className="select-field" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="all">Todos</option>
                {availableMonths.map(m => <option key={m} value={m}>{MONTHS_PT[m]}</option>)}
              </select>
            </div>
            <button onClick={handlePDF} disabled={generatingPDF || filteredDates.length === 0} className="btn-gold flex items-center gap-2 whitespace-nowrap">
              {generatingPDF
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Gerando...</>
                : <><span>📄</span> Baixar PDF</>}
            </button>
          </div>
        </div>

        {/* ── Abas de Ministério ── */}
        <div className="flex flex-wrap gap-2">
          {MINISTRY_LIST.map(m => {
            const mc = COLOR_MAP[m.color];
            const active = activeMinistry === m.id;
            return (
              <button key={m.id} onClick={() => setActiveMinistry(m.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                  ${active ? `${mc.tab} shadow-md scale-105` : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <span>{m.icon}</span> {m.label}
              </button>
            );
          })}
        </div>

        {/* ── Observações (se houver) ── */}
        {ministryConfig?.observations && (
          <div className="card border-l-4 border-indigo-400 bg-indigo-50/50">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📌</span>
              <div>
                <h4 className="font-semibold text-navy-700 mb-1">Observações — {ministry?.label}</h4>
                <pre className="text-gray-600 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                  {ministryConfig.observations}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabela de Escala ── */}
        <div className="card overflow-hidden p-0">
          {/* Cabeçalho da tabela com imagem do ministério */}
          <div className={`${colors.header} text-white px-6 py-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {ministryConfig?.image ? (
                <img src={ministryConfig.image} alt={ministry?.label} className="w-10 h-10 object-contain rounded-lg bg-white/10 p-1" />
              ) : (
                <span className="text-2xl">{ministry?.icon}</span>
              )}
              <div>
                <h2 className="font-display text-xl font-bold">{ministry?.label}</h2>
                <p className="text-white/70 text-sm">{periodLabel}</p>
              </div>
            </div>
            <div className="text-white/70 text-sm">{filteredDates.length} datas</div>
          </div>

          {filteredDates.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-4xl mb-3">📅</p>
              <p className="font-semibold">Nenhuma data neste período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${colors.bg} border-b ${colors.border}`}>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap w-28">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-24">Dia</th>
                    {allFields.map(f => (
                      <th key={f.id} className="px-4 py-3 text-left font-semibold text-gray-600">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDates.map((d, idx) => {
                    const entry = scheduleData[d.id] || {};
                    const dayFields = getFieldsForDate(activeMinistry, d.dayOfWeek);
                    const dayFieldIds = new Set(dayFields.map(f => f.id));
                    return (
                      <tr key={d.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40 transition-colors`}>
                        <td className="px-4 py-3 font-semibold text-navy-700 whitespace-nowrap">
                          {d.label.split(', ')[1] || d.label}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
                            ${d.dayOfWeek === 6 ? 'bg-amber-100 text-amber-800' :
                              d.dayOfWeek === 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {d.dayName}
                          </span>
                        </td>
                        {allFields.map(f => (
                          <td key={f.id} className={`px-4 py-3 ${!dayFieldIds.has(f.id) ? 'bg-gray-50' : ''}`}>
                            {!dayFieldIds.has(f.id) ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : entry[f.id] ? (
                              <span className="font-medium text-gray-800">{entry[f.id]}</span>
                            ) : (
                              <span className="text-gray-300 italic text-xs">A definir</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="text-center text-gray-400 text-xs pb-8">
          {config?.churchName || 'Igreja Adventista'} • Sistema de Escalas
        </footer>
      </div>
    </div>
  );
}
