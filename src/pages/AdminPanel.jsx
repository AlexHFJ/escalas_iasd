import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MINISTRY_LIST, getMinistry, COLOR_MAP, getFieldsForDate } from '../utils/ministryConfig';
import { generateScheduleDates, QUARTERS, BIMESTERS, MONTHS_PT, getCurrentQuarter, getCurrentYear } from '../utils/dateUtils';
import { generateSchedulePDF, fileToBase64 } from '../utils/pdfUtils';
import { autoFillSchedule, autoFillScheduleForce } from '../utils/autoFill';
import { ADVENTIST_LOGO_BASE64 } from '../utils/adventistLogo';

// ── Célula editável ──────────────────────────────────────────
function ScheduleCell({ value, onChange, field, members }) {
  if (field.type === 'member' && members.length > 0) {
    return (
      <select className="select-field text-xs py-1" value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {members.map(m => <option key={m} value={m}>{m}</option>)}
        <option value="__custom__">✏️ Digitar...</option>
      </select>
    );
  }
  return (
    <input type="text" className="input-field text-xs py-1" value={value || ''}
      onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
  );
}

// ── Aba: Configurações da Igreja ─────────────────────────────
function ChurchSettings({ config, onSave }) {
  const [form, setForm] = useState({ churchName: config?.churchName || '' });
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card fade-in max-w-lg">
      <h3 className="font-display text-xl font-bold text-navy-700 mb-6 flex items-center gap-2">
        <span>⛪</span> Configurações da Igreja
      </h3>
      <div className="space-y-5">
        {/* Logo IASD sempre visível */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Logo da IASD</label>
          <div className="flex items-center gap-4 p-3 bg-navy-700 rounded-xl w-fit">
            <img src={ADVENTIST_LOGO_BASE64} alt="Logo IASD" className="w-14 h-14 object-contain" />
            <span className="text-white text-sm font-semibold">Logomarca Oficial<br/><span className="text-blue-300 text-xs font-normal">Exibida em todas as páginas e PDFs</span></span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome da Igreja</label>
          <input type="text" className="input-field" value={form.churchName}
            onChange={e => setForm(prev => ({ ...prev, churchName: e.target.value }))}
            placeholder="Ex: IASD Central de Paranavaí" />
          <p className="text-gray-400 text-xs mt-1">Aparecerá no cabeçalho do site e dos PDFs.</p>
        </div>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          {saved ? '✅ Salvo!' : '💾 Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Aba: Gestão de Membros ───────────────────────────────────
function MembersManager({ ministryId, members, onSave }) {
  const [text, setText] = useState(members.join('\n'));
  const [saved, setSaved] = useState(false);
  const ministry = getMinistry(ministryId);

  async function handleSave() {
    const list = text.split('\n').map(s => s.trim()).filter(Boolean);
    await onSave(ministryId, list);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card fade-in">
      <h3 className="font-display text-xl font-bold text-navy-700 mb-2 flex items-center gap-2">
        <span>👥</span> Membros — {ministry?.label}
      </h3>
      <p className="text-gray-500 text-sm mb-4">
        Liste os voluntários, um por linha. Eles aparecerão como opções na escala.
      </p>
      <textarea className="input-field resize-none font-mono text-sm" rows={12}
        value={text} onChange={e => setText(e.target.value)}
        placeholder={"João da Silva\nMaria Oliveira\nPedro Santos"} />
      <div className="flex items-center gap-3 mt-3">
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          {saved ? '✅ Salvo!' : '💾 Salvar Lista'}
        </button>
        <span className="text-gray-400 text-sm">
          {text.split('\n').filter(l => l.trim()).length} membros cadastrados
        </span>
      </div>
    </div>
  );
}

// ── Aba: Gestão de Diretores (só admin) ─────────────────────
function DirectorsManager() {
  const [directors, setDirectors] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newMinistry, setNewMinistry] = useState('musica');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'users'));
      setDirectors(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    }
    load();
  }, []);

  async function handleAdd() {
    if (!newEmail || !newPassword || !newName) {
      setMsg('⚠️ Preencha todos os campos.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
      const data = { role: 'director', ministry: newMinistry, email: newEmail, name: newName };
      await setDoc(doc(db, 'users', cred.user.uid), data);
      setDirectors(prev => [...prev, { uid: cred.user.uid, ...data }]);
      setNewEmail(''); setNewPassword(''); setNewName('');
      setMsg('✅ Diretor criado com sucesso!');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setMsg('⚠️ Este e-mail já está cadastrado.');
      else setMsg('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateMinistry(uid, ministry) {
    await setDoc(doc(db, 'users', uid), { ministry }, { merge: true });
    setDirectors(prev => prev.map(d => d.uid === uid ? { ...d, ministry } : d));
  }

  async function handleRemove(uid) {
    if (!confirm('Remover acesso deste diretor?')) return;
    await deleteDoc(doc(db, 'users', uid));
    setDirectors(prev => prev.filter(d => d.uid !== uid));
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Adicionar novo diretor */}
      <div className="card">
        <h3 className="font-display text-xl font-bold text-navy-700 mb-5 flex items-center gap-2">
          <span>➕</span> Adicionar Diretor
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nome</label>
            <input type="text" className="input-field" value={newName}
              onChange={e => setNewName(e.target.value)} placeholder="Nome do diretor" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">E-mail</label>
            <input type="email" className="input-field" value={newEmail}
              onChange={e => setNewEmail(e.target.value)} placeholder="diretor@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Senha inicial</label>
            <input type="password" className="input-field" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ministério</label>
            <select className="select-field" value={newMinistry} onChange={e => setNewMinistry(e.target.value)}>
              {MINISTRY_LIST.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button onClick={handleAdd} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Criando...</> : '➕ Criar Diretor'}
          </button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      </div>

      {/* Lista de diretores */}
      <div className="card">
        <h3 className="font-display text-xl font-bold text-navy-700 mb-4 flex items-center gap-2">
          <span>👥</span> Diretores Cadastrados
        </h3>
        {directors.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum diretor cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {directors.map(d => (
              <div key={d.uid} className={`flex items-center gap-3 p-3 rounded-xl border ${d.role === 'admin' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-800">{d.name || d.email}</p>
                  <p className="text-xs text-gray-400">{d.email}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-navy-100 text-navy-700'}`}>
                  {d.role === 'admin' ? '👑 Admin' : '🎯 Diretor'}
                </span>
                {d.role !== 'admin' && (
                  <>
                    <select className="select-field text-xs w-36" value={d.ministry || ''} onChange={e => handleUpdateMinistry(d.uid, e.target.value)}>
                      {MINISTRY_LIST.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                    </select>
                    <button onClick={() => handleRemove(d.uid)} className="text-red-400 hover:text-red-600 text-sm p-1 hover:bg-red-50 rounded-lg transition-colors" title="Remover">
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba: Editor de Escala ────────────────────────────────────
function ScheduleEditor({ ministryId, members, config }) {
  const [selectedPeriodType, setSelectedPeriodType] = useState('quarter');
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [scheduleData, setScheduleData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [filterMonth, setFilterMonth] = useState('all');
  const [customCells, setCustomCells] = useState({});
  const [observations, setObservations] = useState('');
  const [ministryImage, setMinistryImage] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);

  const ministry = getMinistry(ministryId);
  const colors = ministry ? COLOR_MAP[ministry.color] : COLOR_MAP.indigo;
  const scheduleId = `${ministryId}_${selectedPeriodType}${selectedPeriod}_${selectedYear}`;

  const dates = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    const period = periods[selectedPeriod];
    if (!period) return [];
    return generateScheduleDates(period.months, selectedYear)
      .filter(d => ministry?.showOnDays.includes(d.dayOfWeek));
  }, [selectedPeriodType, selectedPeriod, selectedYear, ministryId]);

  const filteredDates = useMemo(() =>
    filterMonth === 'all' ? dates : dates.filter(d => d.month === parseInt(filterMonth)),
    [dates, filterMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(dates.map(d => d.month));
    return Array.from(months).sort();
  }, [dates]);

  const periodLabel = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    return `${periods[selectedPeriod]?.label} de ${selectedYear}`;
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  // Carrega escala + config do ministério
  useEffect(() => {
    const ref = doc(db, 'schedules', scheduleId);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setScheduleData(snap.data().entries || {});
      } else {
        setScheduleData({});
      }
    });
    return () => unsub();
  }, [scheduleId]);

  useEffect(() => {
    async function loadMinistryConfig() {
      const ref = doc(db, 'ministryConfig', ministryId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setObservations(snap.data().observations || '');
        setMinistryImage(snap.data().image || '');
      } else {
        setObservations('');
        setMinistryImage('');
      }
    }
    loadMinistryConfig();
  }, [ministryId]);

  function updateCell(dateId, fieldId, value) {
    if (value === '__custom__') {
      setCustomCells(prev => ({ ...prev, [`${dateId}_${fieldId}`]: true }));
      return;
    }
    setScheduleData(prev => ({ ...prev, [dateId]: { ...(prev[dateId] || {}), [fieldId]: value } }));
  }

  function updateCustom(dateId, fieldId, value) {
    setScheduleData(prev => ({ ...prev, [dateId]: { ...(prev[dateId] || {}), [fieldId]: value } }));
  }

  function handleAutoFill(force = false) {
    const filled = force
      ? autoFillScheduleForce(dates, ministryId, members)
      : autoFillSchedule(dates, ministryId, members, scheduleData);
    setScheduleData(filled);
    setShowAutoFillModal(false);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Imagem muito grande. Máximo 500KB.'); return; }
    setUploadingImg(true);
    try {
      const base64 = await fileToBase64(file);
      setMinistryImage(base64);
    } catch { alert('Erro ao carregar imagem.'); }
    finally { setUploadingImg(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'schedules', scheduleId), {
        ministryId, periodType: selectedPeriodType,
        period: selectedPeriod, year: selectedYear,
        entries: scheduleData, updatedAt: new Date().toISOString(),
      }, { merge: true });
      // Salva config do ministério (imagem + observações)
      await setDoc(doc(db, 'ministryConfig', ministryId), {
        observations, image: ministryImage,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
    finally { setSaving(false); }
  }

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
        ministryImage,
        observations,
      });
    } catch (e) { alert('Erro ao gerar PDF: ' + e.message); }
    finally { setGeneratingPDF(false); }
  }

  const years = [getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  // Determina colunas únicas para cabeçalho da tabela
  const allFields = ministry?.fieldsByDay
    ? ministry.fields  // MUSIC_ALL_FIELDS
    : ministry?.fields || [];

  return (
    <div className="space-y-5 fade-in">
      {/* Controles */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tipo</label>
            <select className="select-field" value={selectedPeriodType}
              onChange={e => { setSelectedPeriodType(e.target.value); setSelectedPeriod(1); }}>
              <option value="quarter">Trimestre</option>
              <option value="bimester">Bimestre</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              {selectedPeriodType === 'quarter' ? 'Trimestre' : 'Bimestre'}
            </label>
            <select className="select-field" value={selectedPeriod} onChange={e => setSelectedPeriod(Number(e.target.value))}>
              {Object.entries(selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS).map(([k,v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ano</label>
            <select className="select-field" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Mês</label>
            <select className="select-field" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="all">Todos</option>
              {availableMonths.map(m => <option key={m} value={m}>{MONTHS_PT[m]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowAutoFillModal(true)} disabled={members.length === 0}
              title={members.length === 0 ? 'Cadastre membros primeiro' : 'Preencher automaticamente'}
              className="btn-outline flex items-center gap-1.5 text-sm whitespace-nowrap">
              ✨ Auto-preencher
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {saving ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Salvando...</> :
                saved ? '✅ Salvo!' : '💾 Salvar'}
            </button>
            <button onClick={handlePDF} disabled={generatingPDF || filteredDates.length === 0}
              className="btn-gold flex items-center gap-2 whitespace-nowrap">
              {generatingPDF ? '...' : '📄 PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Imagem e Observações do Ministério */}
      <div className="card">
        <h4 className="font-semibold text-navy-700 mb-4 flex items-center gap-2">
          <span>🖼️</span> Imagem e Observações do Ministério de {ministry?.label}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Upload de imagem */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Imagem do seu ministério <span className="text-gray-400 font-normal text-xs">(aparece no PDF)</span>
            </label>
            <div className="flex items-start gap-3">
              {ministryImage ? (
                <img src={ministryImage} alt="Imagem" className="w-16 h-16 object-contain border rounded-xl bg-gray-50 p-1" />
              ) : (
                <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-2xl">
                  {ministry?.icon}
                </div>
              )}
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImg} />
                  <span className="btn-outline text-xs inline-flex items-center gap-1.5 cursor-pointer">
                    {uploadingImg ? 'Carregando...' : '📁 Selecionar Imagem'}
                  </span>
                </label>
                <p className="text-gray-400 text-xs mt-1.5">PNG ou JPG • Máx. 500KB</p>
                {ministryImage && (
                  <button onClick={() => setMinistryImage('')} className="text-red-400 text-xs mt-1 hover:text-red-600">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Observações */}
          {ministry?.hasObservations && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observações <span className="text-gray-400 font-normal text-xs">(visível no mural público e no PDF)</span>
              </label>
              <textarea
                className="input-field resize-none text-sm"
                rows={4}
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder={"Grupo 1 — Lídia, João e Maria\nGrupo 2 — Pedro, Ana e Carlos\nGrupo 3 — ..."}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Edição */}
      <div className="card overflow-hidden p-0">
        <div className={`${colors.header} text-white px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{ministry?.icon}</span>
            <div>
              <h3 className="font-display text-lg font-bold">{ministry?.label}</h3>
              <p className="text-white/70 text-sm">{periodLabel} — {filteredDates.length} datas</p>
            </div>
          </div>
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
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap w-24">Data</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Dia</th>
                  {allFields.map(f => (
                    <th key={f.id} className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[160px]">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDates.map((d, idx) => {
                  const entry = scheduleData[d.id] || {};
                  const dayFields = getFieldsForDate(ministryId, d.dayOfWeek);
                  const dayFieldIds = new Set(dayFields.map(f => f.id));
                  return (
                    <tr key={d.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30 transition-colors`}>
                      <td className="px-3 py-2 font-semibold text-navy-700 whitespace-nowrap text-xs">
                        {d.label.split(', ')[1] || d.label}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold
                          ${d.dayOfWeek === 6 ? 'bg-amber-100 text-amber-800' :
                            d.dayOfWeek === 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {d.dayName}
                        </span>
                      </td>
                      {allFields.map(f => {
                        const applicable = dayFieldIds.has(f.id);
                        if (!applicable) {
                          return <td key={f.id} className="px-3 py-2 bg-gray-50">
                            <span className="text-gray-300 text-xs">—</span>
                          </td>;
                        }
                        const fieldDef = dayFields.find(df => df.id === f.id);
                        const isCustom = customCells[`${d.id}_${f.id}`];
                        return (
                          <td key={f.id} className="px-3 py-2">
                            {isCustom ? (
                              <input type="text" autoFocus className="input-field text-xs py-1"
                                value={entry[f.id] || ''}
                                onChange={e => updateCustom(d.id, f.id, e.target.value)}
                                onBlur={() => setCustomCells(prev => { const n={...prev}; delete n[`${d.id}_${f.id}`]; return n; })} />
                            ) : (
                              <ScheduleCell
                                value={entry[f.id]}
                                onChange={v => updateCell(d.id, f.id, v)}
                                field={fieldDef}
                                members={members}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Auto-preencher */}
      {showAutoFillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="font-display text-xl font-bold text-navy-700 mb-2">✨ Preenchimento Automático</h3>
            <p className="text-gray-500 text-sm mb-6">
              O sistema distribuirá os <strong>{members.length} membros</strong> cadastrados de forma
              igualitária e rotativa entre as <strong>{dates.length} datas</strong> do período.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleAutoFill(false)} className="btn-primary flex-1">
                Preencher só vazios
              </button>
              <button onClick={() => handleAutoFill(true)} className="btn-outline flex-1">
                Substituir tudo
              </button>
            </div>
            <button onClick={() => setShowAutoFillModal(false)}
              className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página Principal ─────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout, isAdmin, allowedMinistry, userRole, isPending } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule');
  const [activeMinistry, setActiveMinistry] = useState(null);
  const [config, setConfig] = useState(null);
  const [membersData, setMembersData] = useState({});
  const [loading, setLoading] = useState(true);

  // Define ministério padrão conforme o papel
  useEffect(() => {
    if (allowedMinistry) {
      setActiveMinistry(allowedMinistry);
    } else {
      setActiveMinistry('musica');
    }
  }, [allowedMinistry]);

  useEffect(() => {
    async function loadData() {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'church'));
        if (configSnap.exists()) setConfig(configSnap.data());
        const membersSnap = await getDoc(doc(db, 'config', 'members'));
        if (membersSnap.exists()) setMembersData(membersSnap.data());
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    }
    loadData();
  }, []);

  async function saveConfig(form) {
    await setDoc(doc(db, 'config', 'church'), form, { merge: true });
    setConfig(form);
  }

  async function saveMembers(ministryId, list) {
    const updated = { ...membersData, [ministryId]: list };
    await setDoc(doc(db, 'config', 'members'), updated);
    setMembersData(updated);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Ministérios visíveis conforme o papel
  const visibleMinistries = isAdmin
    ? MINISTRY_LIST
    : MINISTRY_LIST.filter(m => m.id === allowedMinistry);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-navy-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    </div>
  );

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-md text-center">
        <p className="text-4xl mb-4">⏳</p>
        <h2 className="font-display text-xl font-bold text-navy-700 mb-2">Acesso Pendente</h2>
        <p className="text-gray-500 text-sm mb-4">
          Seu acesso ainda não foi configurado pelo administrador. Entre em contato para liberar seu ministério.
        </p>
        <button onClick={handleLogout} className="btn-outline">Sair</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-800 text-white shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ADVENTIST_LOGO_BASE64} alt="IASD" className="w-9 h-9 object-contain" />
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">
                {config?.churchName || 'Igreja Adventista'}
              </h1>
              <p className="text-blue-300 text-xs">
                {isAdmin ? '👑 Administrador' : `🎯 Diretor de ${getMinistry(allowedMinistry)?.label || ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" target="_blank" className="text-blue-300 hover:text-white text-xs hidden sm:block">Ver mural ↗</a>
            <span className="text-gray-400 text-xs hidden sm:block">{userRole?.name || user?.email}</span>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">Sair</button>
          </div>
        </div>
        {/* Abas */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 border-t border-white/10">
          {[
            { id: 'schedule', icon: '📋', label: 'Escala' },
            { id: 'members',  icon: '👥', label: 'Membros' },
            ...(isAdmin ? [
              { id: 'directors', icon: '🔐', label: 'Diretores' },
              { id: 'settings',  icon: '⚙️',  label: 'Configurações' },
            ] : []),
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all
                ${activeTab === tab.id ? 'border-gold-400 text-white' : 'border-transparent text-blue-300 hover:text-white'}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Seletor de Ministério */}
        {activeTab !== 'settings' && activeTab !== 'directors' && (
          <div className="flex flex-wrap gap-2 mb-6">
            {visibleMinistries.map(m => {
              const mc = COLOR_MAP[m.color];
              const active = activeMinistry === m.id;
              return (
                <button key={m.id} onClick={() => setActiveMinistry(m.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                    ${active ? `${mc.tab} shadow-md` : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  <span>{m.icon}</span> {m.label}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'schedule' && activeMinistry && (
          <ScheduleEditor key={activeMinistry} ministryId={activeMinistry}
            members={membersData[activeMinistry] || []} config={config} />
        )}
        {activeTab === 'members' && activeMinistry && (
          <MembersManager key={activeMinistry} ministryId={activeMinistry}
            members={membersData[activeMinistry] || []} onSave={saveMembers} />
        )}
        {activeTab === 'directors' && isAdmin && <DirectorsManager />}
        {activeTab === 'settings' && isAdmin && <ChurchSettings config={config} onSave={saveConfig} />}
      </div>
    </div>
  );
}
