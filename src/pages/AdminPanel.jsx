import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MINISTRY_LIST, getMinistry, COLOR_MAP, getFieldsForDate } from '../utils/ministryConfig';
import { generateScheduleDates, generateWeeksForDiaconato, QUARTERS, BIMESTERS, MONTHS_PT, getCurrentQuarter, getCurrentYear } from '../utils/dateUtils';
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

// ── Configurações da Igreja ──────────────────────────────────
function ChurchSettings({ config, onSave }) {
  const [form, setForm] = useState({ churchName: config?.churchName || '' });
  const [saved, setSaved] = useState(false);
  async function handleSave() { await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  return (
    <div className="card fade-in max-w-lg">
      <h3 className="font-display text-xl font-bold text-navy-700 mb-6 flex items-center gap-2"><span>⛪</span> Configurações da Igreja</h3>
      <div className="space-y-5">
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
        </div>
        <button onClick={handleSave} className="btn-primary">{saved ? '✅ Salvo!' : '💾 Salvar'}</button>
      </div>
    </div>
  );
}

// ── Membros ──────────────────────────────────────────────────
function MembersManager({ ministryId, members, onSave }) {
  const [text, setText] = useState(members.join('\n'));
  const [saved, setSaved] = useState(false);
  const ministry = getMinistry(ministryId);
  async function handleSave() {
    const list = text.split('\n').map(s => s.trim()).filter(Boolean);
    await onSave(ministryId, list); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  return (
    <div className="card fade-in">
      <h3 className="font-display text-xl font-bold text-navy-700 mb-2 flex items-center gap-2"><span>👥</span> Membros — {ministry?.label}</h3>
      <p className="text-gray-500 text-sm mb-4">Liste os voluntários, um por linha.</p>
      <textarea className="input-field resize-none font-mono text-sm" rows={12} value={text}
        onChange={e => setText(e.target.value)} placeholder={"João da Silva\nMaria Oliveira"} />
      <div className="flex items-center gap-3 mt-3">
        <button onClick={handleSave} className="btn-primary">{saved ? '✅ Salvo!' : '💾 Salvar Lista'}</button>
        <span className="text-gray-400 text-sm">{text.split('\n').filter(l => l.trim()).length} membros</span>
      </div>
    </div>
  );
}

// ── Diretores ────────────────────────────────────────────────
function DirectorsManager() {
  const [directors, setDirectors] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newMinistry, setNewMinistry] = useState('musica');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap =>
      setDirectors(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, []);

  async function handleAdd() {
    if (!newEmail || !newPassword || !newName) { setMsg('⚠️ Preencha todos os campos.'); return; }
    setLoading(true); setMsg('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
      const data = { role: 'director', ministry: newMinistry, email: newEmail, name: newName };
      await setDoc(doc(db, 'users', cred.user.uid), data);
      setDirectors(prev => [...prev, { uid: cred.user.uid, ...data }]);
      setNewEmail(''); setNewPassword(''); setNewName('');
      setMsg('✅ Diretor criado!');
    } catch (e) {
      setMsg(e.code === 'auth/email-already-in-use' ? '⚠️ E-mail já cadastrado.' : 'Erro: ' + e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="card">
        <h3 className="font-display text-xl font-bold text-navy-700 mb-5 flex items-center gap-2"><span>➕</span> Adicionar Diretor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {[['Nome','text',newName,setNewName,'Nome do diretor'],['E-mail','email',newEmail,setNewEmail,'diretor@email.com'],['Senha','password',newPassword,setNewPassword,'Mínimo 6 caracteres']].map(([label,type,val,set,ph]) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
              <input type={type} className="input-field" value={val} onChange={e => set(e.target.value)} placeholder={ph} />
            </div>
          ))}
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
      <div className="card">
        <h3 className="font-display text-xl font-bold text-navy-700 mb-4 flex items-center gap-2"><span>👥</span> Diretores Cadastrados</h3>
        {directors.length === 0 ? <p className="text-gray-400 text-sm">Nenhum diretor ainda.</p> : (
          <div className="space-y-2">
            {directors.map(d => (
              <div key={d.uid} className={`flex items-center gap-3 p-3 rounded-xl border ${d.role==='admin'?'bg-amber-50 border-amber-200':'bg-gray-50 border-gray-200'}`}>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{d.name||d.email}</p>
                  <p className="text-xs text-gray-400">{d.email}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.role==='admin'?'bg-amber-100 text-amber-700':'bg-navy-100 text-navy-700'}`}>
                  {d.role==='admin'?'👑 Admin':'🎯 Diretor'}
                </span>
                {d.role!=='admin' && (
                  <>
                    <select className="select-field text-xs w-36" value={d.ministry||''} onChange={e => {
                      setDoc(doc(db,'users',d.uid),{ministry:e.target.value},{merge:true});
                      setDirectors(prev=>prev.map(x=>x.uid===d.uid?{...x,ministry:e.target.value}:x));
                    }}>
                      {MINISTRY_LIST.map(m=><option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                    </select>
                    <button onClick={async()=>{
                      if(!confirm('Remover acesso deste diretor?')) return;
                      try {
                        await deleteDoc(doc(db,'users',d.uid));
                        setDirectors(prev=>prev.filter(x=>x.uid!==d.uid));
                        setMsg('✅ Diretor removido com sucesso!');
                        setTimeout(()=>setMsg(''),3000);
                      } catch(e) {
                        console.error(e);
                        setMsg('⚠️ Erro ao remover: ' + e.message);
                      }
                    }}
                      className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg">🗑️</button>
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

// ── Editor Semanal do Diaconato ──────────────────────────────
function DiaconatoEditor({ members, config }) {
  const ministry = getMinistry('diaconato');
  const colors = COLOR_MAP.amber;
  const [selectedPeriodType, setSelectedPeriodType] = useState('quarter');
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [scheduleData, setScheduleData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [filterMonth, setFilterMonth] = useState('all');
  const [customCells, setCustomCells] = useState({});
  const [ministryImage, setMinistryImage] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [clearAllStep, setClearAllStep] = useState(0);

  const scheduleId = `diaconato_${selectedPeriodType}${selectedPeriod}_${selectedYear}`;

  const weeks = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    const period = periods[selectedPeriod];
    if (!period) return [];
    return generateWeeksForDiaconato(period.months, selectedYear);
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  const filteredWeeks = useMemo(() =>
    filterMonth === 'all' ? weeks : weeks.filter(w => w.month === parseInt(filterMonth)),
    [weeks, filterMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(weeks.map(w => w.month));
    return Array.from(months).sort();
  }, [weeks]);

  const periodLabel = useMemo(() => {
    const periods = selectedPeriodType === 'quarter' ? QUARTERS : BIMESTERS;
    return `${periods[selectedPeriod]?.label} de ${selectedYear}`;
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  useEffect(() => {
    const ref = doc(db, 'schedules', scheduleId);
    const unsub = onSnapshot(ref, snap => {
      setScheduleData(snap.exists() ? snap.data().entries || {} : {});
    });
    return () => unsub();
  }, [scheduleId]);

  useEffect(() => {
    getDoc(doc(db, 'ministryConfig', 'diaconato')).then(snap => {
      setMinistryImage(snap.exists() ? snap.data().image || '' : '');
    });
  }, []);

  function updateCell(weekId, fieldId, value) {
    if (value === '__custom__') {
      setCustomCells(prev => ({ ...prev, [`${weekId}_${fieldId}`]: true }));
      return;
    }
    setScheduleData(prev => ({ ...prev, [weekId]: { ...(prev[weekId] || {}), [fieldId]: value } }));
  }

  function clearWeek(weekId) {
    setScheduleData(prev => { const u = { ...prev }; delete u[weekId]; return u; });
  }

  function handleClearAll() {
    if (clearAllStep === 0) {
      setClearAllStep(1);
      setTimeout(() => setClearAllStep(0), 4000);
    } else if (clearAllStep === 1) {
      setScheduleData({});
      setClearAllStep(2);
      setTimeout(() => setClearAllStep(0), 2000);
    }
  }

  // Auto-preencher para semanas
  function handleAutoFill(force) {
    if (!members.length) return;
    const fields = ministry.fields.filter(f => f.type === 'member');
    const result = force ? {} : { ...scheduleData };
    const usageCount = new Array(members.length).fill(0);
    const usedOnWeek = {};

    if (!force) {
      for (const entry of Object.values(result)) {
        for (const val of Object.values(entry)) {
          const idx = members.indexOf(val);
          if (idx !== -1) usageCount[idx]++;
        }
      }
    }

    for (const week of weeks) {
      if (!usedOnWeek[week.id]) usedOnWeek[week.id] = new Set();
      const existing = result[week.id] || {};
      for (const val of Object.values(existing)) {
        const idx = members.indexOf(val);
        if (idx !== -1) usedOnWeek[week.id].add(idx);
      }

      for (const field of fields) {
        if (!force && result[week.id]?.[field.id]) continue;
        let candidates = members.map((_,i)=>i).filter(i=>!usedOnWeek[week.id].has(i));
        if (!candidates.length) candidates = members.map((_,i)=>i);
        const bestIdx = candidates.reduce((b,i)=>usageCount[i]<usageCount[b]?i:b, candidates[0]);
        result[week.id] = result[week.id] || {};
        result[week.id][field.id] = members[bestIdx];
        usageCount[bestIdx]++;
        usedOnWeek[week.id].add(bestIdx);
      }
    }

    setScheduleData(result);
    setShowAutoFill(false);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500*1024) { alert('Máximo 500KB'); return; }
    setUploadingImg(true);
    try { setMinistryImage(await fileToBase64(file)); }
    catch { alert('Erro ao carregar.'); }
    finally { setUploadingImg(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db,'schedules',scheduleId), {
        ministryId:'diaconato', periodType:selectedPeriodType,
        period:selectedPeriod, year:selectedYear,
        entries:scheduleData, updatedAt:new Date().toISOString(),
        isWeekly: true,
      }, { merge:true });
      await setDoc(doc(db,'ministryConfig','diaconato'), { image:ministryImage }, { merge:true });
      setSaved(true); setTimeout(()=>setSaved(false), 2000);
    } catch(e) { alert('Erro: '+e.message); }
    finally { setSaving(false); }
  }

  async function handlePDF() {
    setGeneratingPDF(true);
    try {
      // Converte semanas para formato compatível com o gerador de PDF
      const weekDates = filteredWeeks.map(w => ({
        ...w,
        dayOfWeek: -1,
        dayName: '',
        label: w.label,
        id: w.id,
      }));
      await generateSchedulePDF({
        churchName: config?.churchName || 'Igreja Adventista do Sétimo Dia',
        ministryLabel: 'Diaconato',
        periodLabel,
        ministry: { ...ministry, isWeekly: true },
        dates: weekDates,
        scheduleData,
        ministryImage,
        observations: '',
      });
    } catch(e) { alert('Erro ao gerar PDF: '+e.message); }
    finally { setGeneratingPDF(false); }
  }

  const years = [getCurrentYear()-1, getCurrentYear(), getCurrentYear()+1];

  return (
    <div className="space-y-5 fade-in">
      {/* Controles */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tipo</label>
            <select className="select-field" value={selectedPeriodType}
              onChange={e=>{ setSelectedPeriodType(e.target.value); setSelectedPeriod(1); }}>
              <option value="quarter">Trimestre</option>
              <option value="bimester">Bimestre</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              {selectedPeriodType==='quarter'?'Trimestre':'Bimestre'}
            </label>
            <select className="select-field" value={selectedPeriod} onChange={e=>setSelectedPeriod(Number(e.target.value))}>
              {Object.entries(selectedPeriodType==='quarter'?QUARTERS:BIMESTERS).map(([k,v])=>(
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ano</label>
            <select className="select-field" value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
              {years.map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Mês</label>
            <select className="select-field" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              <option value="all">Todos</option>
              {availableMonths.map(m=><option key={m} value={m}>{MONTHS_PT[m]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setShowAutoFill(true)} disabled={!members.length}
              className="btn-outline flex items-center gap-1.5 text-sm whitespace-nowrap">✨ Auto-preencher</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {saving?<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Salvando...</>:saved?'✅ Salvo!':'💾 Salvar'}
            </button>
            <button onClick={handlePDF} disabled={generatingPDF||!filteredWeeks.length}
              className="btn-gold flex items-center gap-2 whitespace-nowrap">
              {generatingPDF?'...':'📄 PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Imagem */}
      <div className="card">
        <h4 className="font-semibold text-navy-700 mb-4 flex items-center gap-2"><span>🖼️</span> Imagem do Diaconato</h4>
        <div className="flex items-start gap-3">
          {ministryImage
            ? <img src={ministryImage} alt="Imagem" className="w-16 h-16 object-contain border rounded-xl bg-gray-50 p-1"/>
            : <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-2xl">🔑</div>}
          <div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImg}/>
              <span className="btn-outline text-xs inline-flex items-center gap-1.5 cursor-pointer">
                {uploadingImg?'Carregando...':'📁 Selecionar Imagem'}
              </span>
            </label>
            <p className="text-gray-400 text-xs mt-1.5">PNG ou JPG • Máx. 500KB</p>
            {ministryImage && <button onClick={()=>setMinistryImage('')} className="text-red-400 text-xs mt-1 hover:text-red-600">Remover</button>}
          </div>
        </div>
      </div>

      {/* Tabela de Semanas */}
      <div className="card overflow-hidden p-0">
        <div className={`${colors.header} text-white px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <h3 className="font-display text-lg font-bold">Diaconato — Escala Semanal</h3>
              <p className="text-white/70 text-sm">{periodLabel} — {filteredWeeks.length} semanas</p>
            </div>
          </div>
          <button onClick={handleClearAll} disabled={clearAllStep===2||!filteredWeeks.length}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
              ${clearAllStep===0?'bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white':
                clearAllStep===1?'bg-red-500 text-white animate-pulse':'bg-green-500 text-white'}`}>
            {clearAllStep===0&&'🗑️ Limpar tudo'}
            {clearAllStep===1&&'⚠️ Confirmar?'}
            {clearAllStep===2&&'✅ Limpo!'}
          </button>
        </div>

        {filteredWeeks.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-semibold">Nenhuma semana neste período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${colors.bg} border-b ${colors.border}`}>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap w-40">Período</th>
                  {ministry.fields.map(f => (
                    <th key={f.id} className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[160px]">{f.label}</th>
                  ))}
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWeeks.map((week, idx) => {
                  const entry = scheduleData[week.id] || {};
                  const hasAny = Object.values(entry).some(v => v?.trim());
                  return (
                    <tr key={week.id} className={`${idx%2===0?'bg-white':'bg-gray-50/40'} hover:bg-amber-50/30 transition-colors group`}>
                      <td className="px-4 py-2.5 font-semibold text-amber-800 whitespace-nowrap text-xs">
                        {week.label}
                      </td>
                      {ministry.fields.map(f => {
                        const isCustom = customCells[`${week.id}_${f.id}`];
                        return (
                          <td key={f.id} className="px-3 py-2">
                            {isCustom ? (
                              <input type="text" autoFocus className="input-field text-xs py-1"
                                value={entry[f.id]||''} onChange={e=>updateCell(week.id,f.id,e.target.value)}
                                onBlur={()=>setCustomCells(prev=>{const n={...prev};delete n[`${week.id}_${f.id}`];return n;})}/>
                            ) : (
                              <ScheduleCell value={entry[f.id]} onChange={v=>updateCell(week.id,f.id,v)} field={f} members={members}/>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <button onClick={()=>clearWeek(week.id)} title="Limpar semana"
                          className={`w-6 h-6 rounded-full text-xs font-bold transition-all flex items-center justify-center mx-auto
                            ${hasAny?'bg-red-100 text-red-500 hover:bg-red-500 hover:text-white':'opacity-0 group-hover:opacity-30 bg-gray-100 text-gray-400 cursor-default'}`}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Auto-preencher */}
      {showAutoFill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="font-display text-xl font-bold text-navy-700 mb-2">✨ Preenchimento Automático</h3>
            <p className="text-gray-500 text-sm mb-6">
              Distribui os <strong>{members.length} membros</strong> igualmente entre as <strong>{weeks.length} semanas</strong>, sem repetir no mesmo período.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>handleAutoFill(false)} className="btn-primary flex-1">Preencher só vazios</button>
              <button onClick={()=>handleAutoFill(true)} className="btn-outline flex-1">Substituir tudo</button>
            </div>
            <button onClick={()=>setShowAutoFill(false)} className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editor de Escala (outros ministérios) ────────────────────
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
  const [clearAllStep, setClearAllStep] = useState(0);

  const ministry = getMinistry(ministryId);
  const colors = ministry ? COLOR_MAP[ministry.color] : COLOR_MAP.indigo;
  const scheduleId = `${ministryId}_${selectedPeriodType}${selectedPeriod}_${selectedYear}`;

  const dates = useMemo(() => {
    const periods = selectedPeriodType==='quarter'?QUARTERS:BIMESTERS;
    const period = periods[selectedPeriod];
    if (!period) return [];
    return generateScheduleDates(period.months, selectedYear)
      .filter(d => ministry?.showOnDays.includes(d.dayOfWeek));
  }, [selectedPeriodType, selectedPeriod, selectedYear, ministryId]);

  const filteredDates = useMemo(() =>
    filterMonth==='all' ? dates : dates.filter(d=>d.month===parseInt(filterMonth)),
    [dates, filterMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(dates.map(d=>d.month));
    return Array.from(months).sort();
  }, [dates]);

  const periodLabel = useMemo(() => {
    const periods = selectedPeriodType==='quarter'?QUARTERS:BIMESTERS;
    return `${periods[selectedPeriod]?.label} de ${selectedYear}`;
  }, [selectedPeriodType, selectedPeriod, selectedYear]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db,'schedules',scheduleId), snap => {
      setScheduleData(snap.exists() ? snap.data().entries||{} : {});
    });
    return () => unsub();
  }, [scheduleId]);

  useEffect(() => {
    getDoc(doc(db,'ministryConfig',ministryId)).then(snap => {
      if (snap.exists()) { setObservations(snap.data().observations||''); setMinistryImage(snap.data().image||''); }
      else { setObservations(''); setMinistryImage(''); }
    });
  }, [ministryId]);

  function updateCell(dateId, fieldId, value) {
    if (value==='__custom__') { setCustomCells(prev=>({...prev,[`${dateId}_${fieldId}`]:true})); return; }
    setScheduleData(prev=>({...prev,[dateId]:{...(prev[dateId]||{}),[fieldId]:value}}));
  }
  function updateCustom(dateId, fieldId, value) {
    setScheduleData(prev=>({...prev,[dateId]:{...(prev[dateId]||{}),[fieldId]:value}}));
  }
  function clearDate(dateId) {
    setScheduleData(prev=>{const u={...prev};delete u[dateId];return u;});
  }
  function handleClearAll() {
    if (clearAllStep===0) { setClearAllStep(1); setTimeout(()=>setClearAllStep(0),4000); }
    else if (clearAllStep===1) { setScheduleData({}); setClearAllStep(2); setTimeout(()=>setClearAllStep(0),2000); }
  }
  function handleAutoFill(force) {
    const filled = force
      ? autoFillScheduleForce(dates, ministryId, members)
      : autoFillSchedule(dates, ministryId, members, scheduleData);
    setScheduleData(filled);
    setShowAutoFillModal(false);
  }
  async function handleImageUpload(e) {
    const file=e.target.files[0]; if(!file) return;
    if(file.size>500*1024){alert('Máximo 500KB');return;}
    setUploadingImg(true);
    try{setMinistryImage(await fileToBase64(file));}catch{alert('Erro.');}finally{setUploadingImg(false);}
  }
  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db,'schedules',scheduleId),{
        ministryId,periodType:selectedPeriodType,period:selectedPeriod,
        year:selectedYear,entries:scheduleData,updatedAt:new Date().toISOString(),
      },{merge:true});
      await setDoc(doc(db,'ministryConfig',ministryId),{observations,image:ministryImage},{merge:true});
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e){alert('Erro: '+e.message);}
    finally{setSaving(false);}
  }
  async function handlePDF() {
    setGeneratingPDF(true);
    try {
      await generateSchedulePDF({
        churchName:config?.churchName||'Igreja Adventista do Sétimo Dia',
        ministryLabel:ministry?.label||'', periodLabel, ministry,
        dates:filteredDates, scheduleData, ministryImage, observations,
      });
    } catch(e){alert('Erro: '+e.message);}
    finally{setGeneratingPDF(false);}
  }

  const years = [getCurrentYear()-1, getCurrentYear(), getCurrentYear()+1];
  const allFields = ministry?.fieldsByDay ? ministry.fields : ministry?.fields||[];

  return (
    <div className="space-y-5 fade-in">
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tipo</label>
            <select className="select-field" value={selectedPeriodType} onChange={e=>{setSelectedPeriodType(e.target.value);setSelectedPeriod(1);}}>
              <option value="quarter">Trimestre</option><option value="bimester">Bimestre</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{selectedPeriodType==='quarter'?'Trimestre':'Bimestre'}</label>
            <select className="select-field" value={selectedPeriod} onChange={e=>setSelectedPeriod(Number(e.target.value))}>
              {Object.entries(selectedPeriodType==='quarter'?QUARTERS:BIMESTERS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ano</label>
            <select className="select-field" value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
              {years.map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Mês</label>
            <select className="select-field" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              <option value="all">Todos</option>
              {availableMonths.map(m=><option key={m} value={m}>{MONTHS_PT[m]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setShowAutoFillModal(true)} disabled={!members.length} className="btn-outline flex items-center gap-1.5 text-sm whitespace-nowrap">✨ Auto-preencher</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {saving?<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Salvando...</>:saved?'✅ Salvo!':'💾 Salvar'}
            </button>
            <button onClick={handlePDF} disabled={generatingPDF||!filteredDates.length} className="btn-gold flex items-center gap-2 whitespace-nowrap">
              {generatingPDF?'...':'📄 PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h4 className="font-semibold text-navy-700 mb-4 flex items-center gap-2"><span>🖼️</span> Imagem e Observações — {ministry?.label}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Imagem do ministério <span className="text-gray-400 font-normal text-xs">(aparece no PDF)</span></label>
            <div className="flex items-start gap-3">
              {ministryImage
                ? <img src={ministryImage} alt="Imagem" className="w-16 h-16 object-contain border rounded-xl bg-gray-50 p-1"/>
                : <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-2xl">{ministry?.icon}</div>}
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImg}/>
                  <span className="btn-outline text-xs inline-flex items-center gap-1.5 cursor-pointer">{uploadingImg?'Carregando...':'📁 Selecionar'}</span>
                </label>
                <p className="text-gray-400 text-xs mt-1.5">PNG ou JPG • Máx. 500KB</p>
                {ministryImage && <button onClick={()=>setMinistryImage('')} className="text-red-400 text-xs mt-1 hover:text-red-600">Remover</button>}
              </div>
            </div>
          </div>
          {ministry?.hasObservations && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Observações <span className="text-gray-400 font-normal text-xs">(visível no mural e PDF)</span></label>
              <textarea className="input-field resize-none text-sm" rows={4} value={observations}
                onChange={e=>setObservations(e.target.value)} placeholder={"Grupo 1 — Lídia, João\nGrupo 2 — Pedro, Ana"}/>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className={`${colors.header} text-white px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{ministry?.icon}</span>
            <div>
              <h3 className="font-display text-lg font-bold">{ministry?.label}</h3>
              <p className="text-white/70 text-sm">{periodLabel} — {filteredDates.length} datas</p>
            </div>
          </div>
          <button onClick={handleClearAll} disabled={clearAllStep===2||!filteredDates.length}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
              ${clearAllStep===0?'bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white':
                clearAllStep===1?'bg-red-500 text-white animate-pulse':'bg-green-500 text-white'}`}>
            {clearAllStep===0&&'🗑️ Limpar tudo'}{clearAllStep===1&&'⚠️ Confirmar?'}{clearAllStep===2&&'✅ Limpo!'}
          </button>
        </div>

        {filteredDates.length===0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📅</p><p className="font-semibold">Nenhuma data</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${colors.bg} border-b ${colors.border}`}>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Data</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Dia</th>
                  {allFields.map(f=><th key={f.id} className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[160px]">{f.label}</th>)}
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDates.map((d,idx)=>{
                  const entry=scheduleData[d.id]||{};
                  const dayFields=getFieldsForDate(ministryId,d.dayOfWeek);
                  const dayFieldIds=new Set(dayFields.map(f=>f.id));
                  const hasAny=Object.values(entry).some(v=>v?.trim());
                  return (
                    <tr key={d.id} className={`${idx%2===0?'bg-white':'bg-gray-50/40'} hover:bg-blue-50/30 transition-colors group`}>
                      <td className="px-3 py-2 font-semibold text-navy-700 whitespace-nowrap text-xs">{d.label.split(', ')[1]||d.label}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold
                          ${d.dayOfWeek===6?'bg-amber-100 text-amber-800':d.dayOfWeek===0?'bg-indigo-100 text-indigo-800':'bg-emerald-100 text-emerald-800'}`}>
                          {d.dayName}
                        </span>
                      </td>
                      {allFields.map(f=>{
                        const applicable=dayFieldIds.has(f.id);
                        if(!applicable) return <td key={f.id} className="px-3 py-2 bg-gray-50"><span className="text-gray-300 text-xs">—</span></td>;
                        const fieldDef=dayFields.find(df=>df.id===f.id);
                        const isCustom=customCells[`${d.id}_${f.id}`];
                        return (
                          <td key={f.id} className="px-3 py-2">
                            {isCustom
                              ? <input type="text" autoFocus className="input-field text-xs py-1" value={entry[f.id]||''}
                                  onChange={e=>updateCustom(d.id,f.id,e.target.value)}
                                  onBlur={()=>setCustomCells(prev=>{const n={...prev};delete n[`${d.id}_${f.id}`];return n;})}/>
                              : <ScheduleCell value={entry[f.id]} onChange={v=>updateCell(d.id,f.id,v)} field={fieldDef} members={members}/>}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <button onClick={()=>clearDate(d.id)} title="Limpar data"
                          className={`w-6 h-6 rounded-full text-xs font-bold transition-all flex items-center justify-center mx-auto
                            ${hasAny?'bg-red-100 text-red-500 hover:bg-red-500 hover:text-white':'opacity-0 group-hover:opacity-30 bg-gray-100 text-gray-400 cursor-default'}`}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAutoFillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="font-display text-xl font-bold text-navy-700 mb-2">✨ Preenchimento Automático</h3>
            <p className="text-gray-500 text-sm mb-6">
              Distribui os <strong>{members.length} membros</strong> igualmente entre as <strong>{dates.length} datas</strong>, sem repetir no mesmo dia.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>handleAutoFill(false)} className="btn-primary flex-1">Preencher só vazios</button>
              <button onClick={()=>handleAutoFill(true)} className="btn-outline flex-1">Substituir tudo</button>
            </div>
            <button onClick={()=>setShowAutoFillModal(false)} className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600">Cancelar</button>
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

  useEffect(() => {
    setActiveMinistry(allowedMinistry || 'musica');
  }, [allowedMinistry]);

  useEffect(() => {
    async function loadData() {
      try {
        const c = await getDoc(doc(db,'config','church'));
        if (c.exists()) setConfig(c.data());
        const m = await getDoc(doc(db,'config','members'));
        if (m.exists()) setMembersData(m.data());
      } catch(e){ console.warn(e); }
      finally { setLoading(false); }
    }
    loadData();
  }, []);

  async function saveConfig(form) { await setDoc(doc(db,'config','church'),form,{merge:true}); setConfig(form); }
  async function saveMembers(ministryId, list) {
    const updated = {...membersData,[ministryId]:list};
    await setDoc(doc(db,'config','members'),updated);
    setMembersData(updated);
  }
  async function handleLogout() { await logout(); navigate('/login'); }

  const visibleMinistries = isAdmin ? MINISTRY_LIST : MINISTRY_LIST.filter(m=>m.id===allowedMinistry);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-navy-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    </div>
  );

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-md text-center">
        <p className="text-4xl mb-4">⏳</p>
        <h2 className="font-display text-xl font-bold text-navy-700 mb-2">Acesso Pendente</h2>
        <p className="text-gray-500 text-sm mb-4">Seu acesso ainda não foi configurado pelo administrador.</p>
        <button onClick={handleLogout} className="btn-outline">Sair</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy-800 text-white shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ADVENTIST_LOGO_BASE64} alt="IASD" className="w-9 h-9 object-contain"/>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">{config?.churchName||'Igreja Adventista'}</h1>
              <p className="text-blue-300 text-xs">{isAdmin?'👑 Administrador':`🎯 Diretor de ${getMinistry(allowedMinistry)?.label||''}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" target="_blank" className="text-blue-300 hover:text-white text-xs hidden sm:block">Ver mural ↗</a>
            <span className="text-gray-400 text-xs hidden sm:block">{userRole?.name||user?.email}</span>
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg">Sair</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 border-t border-white/10">
          {[
            {id:'schedule',icon:'📋',label:'Escala'},
            {id:'members',icon:'👥',label:'Membros'},
            ...(isAdmin?[{id:'directors',icon:'🔐',label:'Diretores'},{id:'settings',icon:'⚙️',label:'Configurações'}]:[]),
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all
                ${activeTab===tab.id?'border-gold-400 text-white':'border-transparent text-blue-300 hover:text-white'}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab!=='settings'&&activeTab!=='directors'&&(
          <div className="flex flex-wrap gap-2 mb-6">
            {visibleMinistries.map(m=>{
              const mc=COLOR_MAP[m.color]; const active=activeMinistry===m.id;
              return (
                <button key={m.id} onClick={()=>setActiveMinistry(m.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                    ${active?`${mc.tab} shadow-md`:'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  <span>{m.icon}</span> {m.label}
                </button>
              );
            })}
          </div>
        )}

        {activeTab==='schedule' && activeMinistry && (
          activeMinistry==='diaconato'
            ? <DiaconatoEditor key="diaconato" members={membersData['diaconato']||[]} config={config}/>
            : <ScheduleEditor key={activeMinistry} ministryId={activeMinistry} members={membersData[activeMinistry]||[]} config={config}/>
        )}
        {activeTab==='members'    && activeMinistry && <MembersManager key={activeMinistry} ministryId={activeMinistry} members={membersData[activeMinistry]||[]} onSave={saveMembers}/>}
        {activeTab==='directors'  && isAdmin && <DirectorsManager/>}
        {activeTab==='settings'   && isAdmin && <ChurchSettings config={config} onSave={saveConfig}/>}
      </div>
    </div>
  );
}
