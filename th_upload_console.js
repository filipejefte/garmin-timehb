/**
 * TIME HÍBRIDO → GARMIN CONNECT — Upload das corridas das 12 semanas
 * (VERSÃO VALIDADA — executada com sucesso em 12/08/2026)
 * ------------------------------------------------------------------
 * COMO USAR:
 *   1. Abra https://connect.garmin.com/app/calendar (logado).
 *   2. F12 → aba "Console" → cole este arquivo inteiro → Enter.
 *   3. Se pedir, clique na seta de trocar o MÊS do calendário (‹ ou ›):
 *      isso faz o app disparar uma chamada e o script captura o token CSRF.
 *
 * NOMENCLATURA: "S01 · Intervalado 1:1" — semana + label derivado da planilha
 *   (o "1:1" é esforço:recuperação em minutos, igual ao label do
 *   garmin_time_hibrido.py). Um treino por linha da planilha = 35 treinos,
 *   todos com nome único. Descrição traz semana, etapa e a estrutura completa.
 *
 * AUTENTICAÇÃO (aprendizado importante):
 *   - O app web NÃO guarda token do Garmin em localStorage/IndexedDB.
 *   - As chamadas vão para /gc-api/<serviço> (same-origin) autenticadas por
 *     COOKIES + header `connect-csrf-token` (GUID que só existe em memória).
 *   - Bearer em /workout-service (sem gc-api) → 401.
 *     POST /modern/di-oauth/exchange → 404.
 *
 * DEDUPE: treino com mesmo nome não é recriado; data já agendada com o mesmo
 * treino não é reagendada. Pode rodar de novo com segurança.
 *
 * LIMPEZA (se precisar refazer do zero) — rode antes, trocando o prefixo:
 *   const ws = await __thApi('GET','/workout-service/workouts?start=0&limit=999&myWorkoutsOnly=true');
 *   for (const w of ws.filter(x => /^S\d\d · /.test(x.workoutName)))
 *     await __thApi('DELETE', `/workout-service/workout/${w.workoutId}`);
 *   // apagar o treino já remove os agendamentos dele do calendário.
 */
(async () => {
  const PAUSA_MS = 200;
  const SEG_SEMANA_1 = '2026-08-17';           // segunda-feira da semana 1
  const DAY_OFFSET = { '3ª': 1, '5ª': 3, 'Sáb': 5, 'Dom': 6 };

  // Uma entrada por linha da aba "Corrida" da planilha.
  // dia/semana geram nome + data; os demais campos geram os passos.
  const PLANO = [
    { s: 1,  d: '3ª',  tipo: 'int', reps: 14, work: 60,  zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 1,  d: '5ª',  tipo: 'int', reps: 10, work: 120, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 1,  d: 'Sáb', tipo: 'int', reps: 7,  work: 180, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 2,  d: '3ª',  tipo: 'int', reps: 15, work: 60,  zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 2,  d: '5ª',  tipo: 'int', reps: 11, work: 120, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 2,  d: 'Sáb', tipo: 'int', reps: 8,  work: 180, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 3,  d: '3ª',  tipo: 'int', reps: 16, work: 60,  zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 3,  d: '5ª',  tipo: 'int', reps: 12, work: 120, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 3,  d: 'Sáb', tipo: 'int', reps: 9,  work: 180, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 4,  d: '3ª',  tipo: 'int', reps: 14, work: 60,  zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 4,  d: '5ª',  tipo: 'int', reps: 10, work: 120, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 4,  d: 'Sáb', tipo: 'int', reps: 7,  work: 180, zw: 3, rec: 60,  zr: 1, etapa: 'Base' },
    { s: 5,  d: '3ª',  tipo: 'int', reps: 5,  work: 240, zw: 3, rec: 120, zr: 1, etapa: 'Consolidação' },
    { s: 5,  d: '5ª',  tipo: 'int', reps: 6,  work: 240, zw: 3, rec: 60,  zr: 1, etapa: 'Consolidação' },
    { s: 5,  d: 'Sáb', tipo: 'cont', work: 1200, zw: 3, etapa: 'Consolidação' },
    { s: 6,  d: '3ª',  tipo: 'int', reps: 6,  work: 240, zw: 3, rec: 120, zr: 1, etapa: 'Consolidação' },
    { s: 6,  d: '5ª',  tipo: 'int', reps: 7,  work: 240, zw: 3, rec: 60,  zr: 1, etapa: 'Consolidação' },
    { s: 6,  d: 'Sáb', tipo: 'cont', work: 1320, zw: 3, etapa: 'Consolidação' },
    { s: 7,  d: '3ª',  tipo: 'int', reps: 7,  work: 240, zw: 3, rec: 120, zr: 1, etapa: 'Consolidação' },
    { s: 7,  d: '5ª',  tipo: 'int', reps: 8,  work: 240, zw: 3, rec: 60,  zr: 1, etapa: 'Consolidação' },
    { s: 7,  d: 'Sáb', tipo: 'cont', work: 1440, zw: 3, etapa: 'Consolidação' },
    { s: 8,  d: '3ª',  tipo: 'int', reps: 5,  work: 240, zw: 3, rec: 120, zr: 1, etapa: 'Consolidação' },
    { s: 8,  d: '5ª',  tipo: 'int', reps: 6,  work: 240, zw: 3, rec: 60,  zr: 1, etapa: 'Consolidação' },
    { s: 8,  d: 'Sáb', tipo: 'cont', work: 1200, zw: 3, etapa: 'Consolidação' },
    { s: 9,  d: '3ª',  tipo: 'int', reps: 6,  work: 300, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 9,  d: '5ª',  tipo: 'int', reps: 6,  work: 360, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 9,  d: 'Sáb', tipo: 'cont', work: 1320, zw: 3, etapa: 'Alvo' },
    { s: 10, d: '3ª',  tipo: 'int', reps: 7,  work: 300, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 10, d: '5ª',  tipo: 'int', reps: 7,  work: 360, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 10, d: 'Sáb', tipo: 'cont', work: 1440, zw: 3, etapa: 'Alvo' },
    { s: 11, d: '3ª',  tipo: 'int', reps: 8,  work: 300, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 11, d: '5ª',  tipo: 'int', reps: 8,  work: 360, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 11, d: 'Sáb', tipo: 'cont', work: 1560, zw: 3, etapa: 'Alvo' },
    { s: 12, d: '3ª',  tipo: 'int', reps: 6,  work: 300, zw: 3, rec: 60,  zr: 1, etapa: 'Alvo' },
    { s: 12, d: 'Dom', tipo: 'prova', distM: 5000, zw: 4, etapa: 'Alvo' },
  ];

  const AQ = 300, DES = 300;                    // aquecimento / desaquecimento (s)
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = (n) => String(+n.toFixed(2)).replace(/\.00$/, '');
  const mm = (s) => (s % 60 === 0 ? s / 60 + ' min' : s + 's');

  function label(t) {
    if (t.tipo === 'int')  return `Intervalado ${g(t.work / 60)}:${g(t.rec / 60)}`;
    if (t.tipo === 'cont') return `Contínuo ${g(t.work / 60)} min`;
    return `Prova ${g(t.distM / 1000)} km`;
  }
  const nomeDe = (t) => `S${String(t.s).padStart(2, '0')} · ${label(t)}`;
  function dataDe(t) {
    const base = new Date(SEG_SEMANA_1 + 'T12:00:00');
    base.setDate(base.getDate() + (t.s - 1) * 7 + DAY_OFFSET[t.d]);
    return base.toISOString().slice(0, 10);
  }

  // ---- captura do CSRF ----
  if (!window.__thCsrf) {
    const of = window.fetch;
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : input.url;
        if (url && url.includes('gc-api')) {
          const h = (init && init.headers) || {};
          const tok = h['connect-csrf-token'] || (h.get && h.get('connect-csrf-token'));
          if (tok) window.__thCsrf = tok;
        }
      } catch (e) {}
      return of.apply(this, arguments);
    };
  }
  if (!window.__thCsrf) {
    console.log('⏳ Aguardando token… clique na seta de trocar o MÊS do calendário (‹ ou ›).');
    for (let i = 0; i < 120 && !window.__thCsrf; i++) await dorme(1000);
    if (!window.__thCsrf) { console.error('❌ CSRF não capturado. Recarregue e tente de novo.'); return; }
  }
  const HEADERS = { 'Content-Type': 'application/json', 'connect-csrf-token': window.__thCsrf };
  console.log('🔑 CSRF capturado.');

  window.__thApi = async function (metodo, caminho, corpo) {
    const r = await fetch('https://connect.garmin.com/gc-api' + caminho, { method: metodo, headers: HEADERS, credentials: 'include', body: corpo ? JSON.stringify(corpo) : undefined });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`${metodo} ${caminho} HTTP ${r.status} ${t.slice(0, 120)}`); }
    const ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  };
  const api = window.__thApi;

  // ---- montagem do payload ----
  const SPORT = { sportTypeId: 1, sportTypeKey: 'running' };
  const ST = { warmup: [1, 'warmup'], cooldown: [2, 'cooldown'], interval: [3, 'interval'], recovery: [4, 'recovery'], repeat: [6, 'repeat'] };
  const sT = (n) => ({ stepTypeId: ST[n][0], stepTypeKey: ST[n][1] });
  const fT = (s) => ({ endCondition: { conditionTypeId: 2, conditionTypeKey: 'time' }, endConditionValue: s });
  const fD = (m) => ({ endCondition: { conditionTypeId: 3, conditionTypeKey: 'distance' }, endConditionValue: m });
  const semAlvo = { targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' } };
  const zona = (z) => ({ targetType: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' }, zoneNumber: z });
  const pe = (o, t, f, a) => ({ type: 'ExecutableStepDTO', stepId: null, stepOrder: o, stepType: sT(t), ...f, ...a });

  function payload(t) {
    let o = 0; const p = []; let corpo;
    p.push(pe(++o, 'warmup', fT(AQ), semAlvo));
    if (t.tipo === 'int') {
      const grp = { type: 'RepeatGroupDTO', stepId: null, stepOrder: ++o, stepType: sT('repeat'), numberOfIterations: t.reps, smartRepeat: false, workoutSteps: [] };
      grp.workoutSteps.push(pe(++o, 'interval', fT(t.work), zona(t.zw)));
      grp.workoutSteps.push(pe(++o, 'recovery', fT(t.rec), zona(t.zr)));
      p.push(grp);
      corpo = `${t.reps}x (${mm(t.work)} Z${t.zw} / ${mm(t.rec)} Z${t.zr})`;
    } else if (t.tipo === 'cont') {
      p.push(pe(++o, 'interval', fT(t.work), zona(t.zw)));
      corpo = `${mm(t.work)} contínuo Z${t.zw}`;
    } else {
      p.push(pe(++o, 'interval', fD(t.distM), zona(t.zw)));
      corpo = `${g(t.distM / 1000)} km Z${t.zw}`;
    }
    p.push(pe(++o, 'cooldown', fT(DES), semAlvo));
    return {
      workoutName: nomeDe(t),
      description: `Time Híbrido · Semana ${String(t.s).padStart(2, '0')} · Etapa ${t.etapa}\nAquec. ${mm(AQ)} + ${corpo} + Desaq. ${mm(DES)}`,
      sportType: SPORT,
      workoutSegments: [{ segmentOrder: 1, sportType: SPORT, workoutSteps: p }],
    };
  }

  // ---- dedupe ----
  const existentes = await api('GET', '/workout-service/workouts?start=0&limit=999&myWorkoutsOnly=true');
  const porNome = {};
  (Array.isArray(existentes) ? existentes : []).forEach((w) => { porNome[w.workoutName] = w.workoutId; });

  const agendados = new Set(); const vistos = new Set();
  for (const mes of [7, 8, 9, 10]) { // 0-based: ago–nov 2026
    try {
      const cal = await api('GET', `/calendar-service/year/2026/month/${mes}`);
      (cal.calendarItems || []).forEach((it) => {
        // a API de mês devolve semanas vizinhas: o mesmo item aparece em 2 meses
        if (it.itemType === 'workout' && it.title && it.date && !vistos.has(it.id)) {
          vistos.add(it.id); agendados.add(it.title + '|' + it.date);
        }
      });
    } catch (e) { console.warn('aviso calendário mês', mes + 1, ':', e.message); }
    await dorme(PAUSA_MS);
  }
  console.log(`Na conta: ${Object.keys(porNome).length} treinos · ${agendados.size} agendamentos no período`);

  // ---- execução ----
  let criados = 0, reaproveitados = 0, novos = 0, pulados = 0, erros = 0;
  for (const t of PLANO) {
    const nome = nomeDe(t), data = dataDe(t);
    try {
      let id = porNome[nome];
      if (id) { reaproveitados++; console.log(`♻️  ${nome}`); }
      else {
        id = (await api('POST', '/workout-service/workout', payload(t))).workoutId;
        porNome[nome] = id; criados++;
        console.log(`✅ ${nome} (id ${id})`);
        await dorme(PAUSA_MS);
      }
      if (agendados.has(nome + '|' + data)) { pulados++; console.log(`   ⏭️  ${data}`); }
      else { await api('POST', `/workout-service/schedule/${id}`, { date: data }); novos++; console.log(`   📅 ${data}`); await dorme(PAUSA_MS); }
    } catch (e) { erros++; console.error(`❌ ${nome}: ${e.message}`); }
  }
  console.log(`\n===== criados ${criados} · reaproveitados ${reaproveitados} · agendados ${novos} · pulados ${pulados} · erros ${erros}`);
  console.log('Confira: https://connect.garmin.com/app/calendar');
})();
