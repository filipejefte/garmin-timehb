/**
 * Time Híbrido → Garmin · montagem dos treinos (planilha → JSON do Garmin)
 * =======================================================================
 * Mesmas regras do projeto Python, para a UI mostrar exatamente o que sobe:
 *
 *   CORRIDA     → formato do th_upload_console.js (validado no Garmin em
 *                 12/08/2026): aquecimento/desaquecimento sem alvo, esforço e
 *                 recuperação por zona de FC, intervalado como grupo de
 *                 repetição. Lê aquecimento/desaquecimento/notas da planilha.
 *   MUSCULAÇÃO  → port linha a linha do montar_musculacao.py (bi-set com
 *                 descanso no botão Lap, "6 / 12" dentro da mesma série,
 *                 pirâmide com a sequência na descrição, aquecimento fixo).
 *
 * Nomes (decisão de 12/08/2026 — o dedupe no Garmin é feito pelo nome):
 *   corrida     "S01 · Intervalado 1:1"
 *   musculação  "S01 A · Peito/Ombro/Tríceps"
 *
 * Roda no navegador (window.THBuilder) e no Node (require) para os testes.
 */
(function (raiz) {
  'use strict';

  // ---------------------------------------------------------------------
  // Calendário
  // ---------------------------------------------------------------------
  /** Dia da semana (0 = segunda … 6 = domingo) de cada rótulo da planilha. */
  const DIA_SEMANA = {
    '2ª': 0, 'Seg': 0, '3ª': 1, 'Ter': 1, '4ª': 2, 'Qua': 2,
    '5ª': 3, 'Qui': 3, '6ª': 4, 'Sex': 4, 'Sáb': 5, 'Sab': 5, 'Dom': 6,
  };
  const ROTULOS_DIA = ['2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'];
  const NOME_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const TREINOS = ['A', 'B', 'C', 'D', 'E'];
  /** Padrão do projeto: A=Sáb, B=Dom, C=Seg, D=Ter, E=Qua (troca B↔C de 12/08). */
  const DIAS_MUSC_PADRAO = { A: 5, B: 6, C: 0, D: 1, E: 2 };

  function addDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }

  /** Igual ao _weekday_offsets do Python: quando a sequência de dias recua
   *  (Sáb → Seg) entende que virou a semana — Sáb,Dom,Seg,Ter,Qua → 5,6,7,8,9. */
  function offsetsMusc(mapa) {
    const out = {};
    let semana = 0, ant = -1;
    for (const t of TREINOS) {
      if (mapa[t] === undefined || mapa[t] === null || mapa[t] === '') continue;
      const wd = Number(mapa[t]);
      if (wd <= ant) semana += 1;
      out[t] = semana * 7 + wd;
      ant = wd;
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  const num = (v, padrao) => (vazio(v) || isNaN(Number(v)) ? padrao : Number(v));
  const txt = (v) => (vazio(v) ? '' : String(v).trim());
  /** Formato "g" do Python: 1.0 → "1", 2.5 → "2.5". */
  const g = (n) => String(+Number(n).toFixed(4));
  const pad2 = (n) => String(n).padStart(2, '0');
  const mm = (s) => (s % 60 === 0 ? s / 60 + ' min' : s + 's');

  // =====================================================================
  // CORRIDA
  // =====================================================================
  const SPORT_RUN = { sportTypeId: 1, sportTypeKey: 'running' };
  const ST = { warmup: [1, 'warmup'], cooldown: [2, 'cooldown'], interval: [3, 'interval'], recovery: [4, 'recovery'], repeat: [6, 'repeat'] };
  const sT = (n) => ({ stepTypeId: ST[n][0], stepTypeKey: ST[n][1] });
  const fT = (s) => ({ endCondition: { conditionTypeId: 2, conditionTypeKey: 'time' }, endConditionValue: s });
  const fD = (m) => ({ endCondition: { conditionTypeId: 3, conditionTypeKey: 'distance' }, endConditionValue: m });
  const SEM_ALVO = { targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' } };
  const zona = (z) => ({ targetType: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' }, zoneNumber: z });
  const passo = (o, t, f, a) => ({ type: 'ExecutableStepDTO', stepId: null, stepOrder: o, stepType: sT(t), ...f, ...a });

  function tipoCorrida(r) {
    const t = txt(r.tipo).toLowerCase();
    if (t.startsWith('interval')) return 'intervalado';
    if (t.startsWith('cont')) return 'continuo';
    if (t.startsWith('prova')) return 'prova';
    return '';
  }

  function labelCorrida(r) {
    const t = tipoCorrida(r);
    if (t === 'intervalado') return `Intervalado ${g(num(r.esforco_min, 0))}:${g(num(r.recuperacao_min, 0))}`;
    if (t === 'continuo') return `Contínuo ${g(num(r.esforco_min, 0))} min`;
    if (t === 'prova') return `Prova ${g(num(r.distancia_km, 5))} km`;
    return `? ${txt(r.tipo)}`;
  }

  const nomeCorrida = (r) => `S${pad2(num(r.semana, 0))} · ${labelCorrida(r)}`;

  function validarCorrida(r) {
    const av = [];
    const t = tipoCorrida(r);
    if (!t) av.push(`tipo "${txt(r.tipo)}" desconhecido (use intervalado / contínuo / prova)`);
    if (DIA_SEMANA[txt(r.dia)] === undefined) av.push(`dia "${txt(r.dia)}" desconhecido`);
    if (t === 'intervalado') {
      if (!(num(r.reps, 0) > 0)) av.push('intervalado sem repetições');
      if (!(num(r.esforco_min, 0) > 0)) av.push('intervalado sem tempo de esforço');
      if (!(num(r.recuperacao_min, 0) > 0)) av.push('intervalado sem tempo de recuperação');
    }
    if (t === 'continuo' && !(num(r.esforco_min, 0) > 0)) av.push('contínuo sem tempo de esforço');
    if (t === 'prova' && !(num(r.distancia_km, 0) > 0)) av.push('prova sem distância');
    return av;
  }

  function montarCorrida(r) {
    const t = tipoCorrida(r);
    const aq = Math.round(num(r.aquecimento_min, 5) * 60);
    const des = Math.round(num(r.desaquecimento_min, 5) * 60);
    const ez = num(r.esforco_zona, t === 'prova' ? 4 : 3);
    const rz = num(r.recuperacao_zona, 1);
    let o = 0; const p = []; let corpo = ''; let dur = aq + des;

    if (aq > 0) p.push(passo(++o, 'warmup', fT(aq), SEM_ALVO));
    if (t === 'intervalado') {
      const reps = num(r.reps, 1), w = Math.round(num(r.esforco_min, 0) * 60), rc = Math.round(num(r.recuperacao_min, 0) * 60);
      const grp = { type: 'RepeatGroupDTO', stepId: null, stepOrder: ++o, stepType: sT('repeat'), numberOfIterations: reps, smartRepeat: false, workoutSteps: [] };
      grp.workoutSteps.push(passo(++o, 'interval', fT(w), zona(ez)));
      grp.workoutSteps.push(passo(++o, 'recovery', fT(rc), zona(rz)));
      p.push(grp);
      corpo = `${reps}x (${mm(w)} Z${ez} / ${mm(rc)} Z${rz})`;
      dur += reps * (w + rc);
    } else if (t === 'continuo') {
      const w = Math.round(num(r.esforco_min, 0) * 60);
      p.push(passo(++o, 'interval', fT(w), zona(ez)));
      corpo = `${mm(w)} contínuo Z${ez}`;
      dur += w;
    } else {
      const m = num(r.distancia_km, 5) * 1000;
      p.push(passo(++o, 'interval', fD(m), zona(ez)));
      corpo = `${g(m / 1000)} km Z${ez}`;
      dur += (m / 1000) * 360; // ~6:00/km só para estimar
    }
    if (des > 0) p.push(passo(++o, 'cooldown', fT(des), SEM_ALVO));

    const partes = [aq > 0 ? `Aquec. ${mm(aq)}` : '', corpo, des > 0 ? `Desaq. ${mm(des)}` : ''].filter(Boolean);
    let descricao = `Time Híbrido · Semana ${pad2(num(r.semana, 0))} · Etapa ${txt(r.etapa)}\n${partes.join(' + ')}`;
    if (txt(r.notas)) descricao += `\nNota: ${txt(r.notas)}`;

    return {
      payload: {
        workoutName: nomeCorrida(r),
        description: descricao,
        sportType: SPORT_RUN,
        workoutSegments: [{ segmentOrder: 1, sportType: SPORT_RUN, workoutSteps: p }],
      },
      resumo: corpo,
      duracaoMin: Math.round(dur / 60),
    };
  }

  // =====================================================================
  // MUSCULAÇÃO — port do montar_musculacao.py
  // =====================================================================
  const SPORT_STR = { sportTypeId: 5, sportTypeKey: 'strength_training', displayOrder: 5 };
  const GRUPO_CURTO = {
    'PEITO, OMBRO E TRÍCEPS': 'Peito/Ombro/Tríceps',
    'MEMBROS INFERIORES': 'Inferiores',
    'COSTAS E BÍCEPS': 'Costas/Bíceps',
    'OMBROS E ABDOMINAL': 'Ombro/Abdômen',
    'BÍCEPS E TRÍCEPS': 'Bíceps/Tríceps',
  };
  const tituloPy = (s) => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const grupoCurto = (grupo) => GRUPO_CURTO[txt(grupo).toUpperCase()] || tituloPy(txt(grupo));
  const nomeMusc = (semana, treino, grupo) => `S${pad2(semana)} ${treino} · ${grupoCurto(grupo)}`;

  const repsLista = (reps) => {
    const n = String(vazio(reps) ? '' : reps).match(/\d+/g);
    return n ? n.map(Number) : [10];
  };
  /** Pirâmide vem com hífen "(15-12-10-8-6)"; "6 / 12" são dois passos na mesma série. */
  const ePiramide = (reps) => String(vazio(reps) ? '' : reps).includes('-');

  const COND_REPS = { conditionTypeId: 10, conditionTypeKey: 'reps', displayOrder: 10, displayable: true };
  const COND_TEMPO = { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 2, displayable: true };
  const COND_LAP = { conditionTypeId: 1, conditionTypeKey: 'lap.button', displayOrder: 1, displayable: true };
  const COND_ITER = { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7, displayable: false };
  const T_WARMUP = { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 };
  const T_INTERVAL = { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 };
  const T_REST = { stepTypeId: 5, stepTypeKey: 'rest', displayOrder: 5 };
  const T_REPEAT = { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 };

  const passoExercicio = (ordem, cat, ex, reps, nota, aquec) => ({
    type: 'ExecutableStepDTO', stepOrder: ordem, stepType: aquec ? T_WARMUP : T_INTERVAL,
    endCondition: COND_REPS, endConditionValue: reps, category: cat, exerciseName: ex, description: nota,
  });
  const passoDescanso = (ordem, seg) => ({
    type: 'ExecutableStepDTO', stepOrder: ordem, stepType: T_REST, endCondition: COND_TEMPO, endConditionValue: seg,
  });
  /** Descanso aberto, encerrado no botão Lap (troca de aparelho no bi-set). */
  const passoDescansoLap = (ordem, nota) => ({
    type: 'ExecutableStepDTO', stepOrder: ordem, stepType: T_REST, endCondition: COND_LAP, endConditionValue: null,
    description: nota || 'Troca de aparelho - aperte Lap para seguir',
  });
  const grupoRepeticao = (ordem, n, filhos) => ({
    type: 'RepeatGroupDTO', stepOrder: ordem, stepType: T_REPEAT, numberOfIterations: n, smartRepeat: false,
    endCondition: COND_ITER, endConditionValue: n, workoutSteps: filhos,
  });

  /** Blocos fixos de aquecimento, copiados dos treinos que o Filipe montou à mão. */
  const AQUECIMENTO = {
    superiores: [
      ['t', 240, 'WARM_UP', 'STRETCH_SHOULDER', 1],
      ['r', 15, 'SHOULDER_STABILITY', 'CABLE_EXTERNAL_ROTATION', 2],
      ['r', 15, 'SHOULDER_STABILITY', 'CABLE_INTERNAL_ROTATION', 2],
    ],
    inferiores: [
      ['t', 20, 'SQUAT', 'STAGGERED_SQUAT', 1],
      ['t', 60, 'WARM_UP', 'STRETCH_LUNGING_HIP_FLEXOR', 1],
      ['t', 40, 'HIP_STABILITY', 'LYING_ABDUCTION_STRETCH', 1],
      ['t', 30, 'WARM_UP', 'STRETCH_HIP_FLEXOR_AND_QUAD', 1],
      ['r', 20, 'SQUAT', 'SQUAT', 1],
    ],
  };
  const ROTULO_AQUEC = {
    superiores: 'Aquecimento/mobilidade · superiores',
    inferiores: 'Flexibilidade e mobilidade · inferiores',
  };
  const tipoAquecimento = (grupo) => (txt(grupo).toUpperCase().includes('INFERIOR') ? 'inferiores' : 'superiores');

  function montarAquecimento(ordem, tipo) {
    const nota = ROTULO_AQUEC[tipo];
    const passos = [];
    for (const [modo, valor, cat, ex, series] of AQUECIMENTO[tipo]) {
      const p = (o) => ({
        type: 'ExecutableStepDTO', stepOrder: o, stepType: T_WARMUP,
        endCondition: modo === 't' ? COND_TEMPO : COND_REPS, endConditionValue: valor,
        category: cat, exerciseName: ex, description: nota,
      });
      if (series > 1) { const go = ordem++; passos.push(grupoRepeticao(go, series, [p(ordem++)])); }
      else passos.push(p(ordem++));
    }
    return [passos, ordem];
  }

  /** Todo bloco vira grupo de séries (nada de passo solto) — ver docstring do Python. */
  function montarBloco(ordem, tecnica, exs) {
    const tec = txt(tecnica);
    const aq = tec.toUpperCase().startsWith('AQUEC');
    const multi = exs.length > 1;
    const e0 = exs[0];
    const r0 = e0.repsLista;
    const piramide = !multi && r0.length > 1 && ePiramide(e0.repsBruto);
    const duplo = !multi && r0.length > 1 && !piramide;

    if (piramide) {
      const seq = r0.join('-');
      const nota = `${e0.nomePt} · ${tec} ${seq} (baixe a rep a cada série)`;
      const filhos = [passoExercicio(ordem + 1, e0.cat, e0.ex, r0[0], nota, aq), passoDescanso(ordem + 2, e0.descanso)];
      return [[grupoRepeticao(ordem, r0.length, filhos)], ordem + 3];
    }
    if (duplo) {
      const series = e0.series || 1;
      const filhos = []; let o = ordem + 1;
      r0.forEach((r, i) => {
        filhos.push(passoExercicio(o++, e0.cat, e0.ex, r, `${e0.nomePt} · ${tec} (${i + 1}/${r0.length})`, aq));
        if (i < r0.length - 1) filhos.push(passoDescansoLap(o++, 'Troque a carga - aperte Lap para seguir'));
      });
      filhos.push(passoDescanso(o++, e0.descanso));
      return [[grupoRepeticao(ordem, series, filhos)], o];
    }
    const series = e0.series || 1;
    const go = ordem++;
    const filhos = [];
    exs.forEach((e, j) => {
      const marca = multi ? `${tec} (${j + 1}/${exs.length})` : tec;
      filhos.push(passoExercicio(ordem++, e.cat, e.ex, e.repsLista[0], `${e.nomePt} · ${marca}`, aq));
      if (multi && j < exs.length - 1) filhos.push(passoDescansoLap(ordem++));
    });
    filhos.push(passoDescanso(ordem++, e0.descanso));
    return [[grupoRepeticao(go, series, filhos)], ordem];
  }

  /** Agrupa as linhas da aba Musculação em treinos (semana × letra). */
  function agruparMusculacao(linhas, depara) {
    const dias = new Map();
    for (const row of linhas) {
      if (vazio(row.semana) || vazio(row.treino)) continue;
      const sem = Number(row.semana), tr = txt(row.treino).toUpperCase();
      const chave = `m|${sem}|${tr}`;
      if (!dias.has(chave)) dias.set(chave, { semana: sem, treino: tr, grupo: txt(row.grupo), blocos: new Map(), aquecimento: null, avisos: [], linhas: [] });
      const d = dias.get(chave);
      d.linhas.push(row);
      const nomePt = txt(row.exercicio);
      if (!num(row.series, 0)) {                       // linha de aquecimento (sem séries)
        if (d.aquecimento === null) d.aquecimento = nomePt || 'AQUECIMENTO';
        continue;
      }
      const m = depara[nomePt.toUpperCase()];
      if (!m || !m.cat || !m.ex) { d.avisos.push(`"${nomePt}" sem par no De-para — fica de fora`); continue; }
      const bloco = vazio(row.bloco) ? '·' : String(row.bloco);
      if (!d.blocos.has(bloco)) d.blocos.set(bloco, { tecnica: row.tecnica, exs: [] });
      d.blocos.get(bloco).exs.push({
        cat: m.cat, ex: m.ex, repsLista: repsLista(row.reps), repsBruto: row.reps,
        series: parseInt(row.series, 10), descanso: parseInt(num(row.descanso_seg, 0) || 60, 10), nomePt,
      });
    }
    return dias;
  }

  function montarMusculacao(d) {
    let passos = [], ordem = 1;
    if (d.aquecimento) { const [b, o] = montarAquecimento(ordem, tipoAquecimento(d.grupo)); passos = passos.concat(b); ordem = o; }
    for (const [, b] of d.blocos) { const [bl, o] = montarBloco(ordem, b.tecnica, b.exs); passos = passos.concat(bl); ordem = o; }
    const nome = nomeMusc(d.semana, d.treino, d.grupo);
    return {
      payload: {
        workoutName: nome,
        description: `Time Híbrido · Musculação · Semana ${pad2(d.semana)} · Treino ${d.treino} · ${d.grupo}`,
        sportType: SPORT_STR,
        workoutSegments: [{ segmentOrder: 1, sportType: SPORT_STR, workoutSteps: passos }],
      },
      resumo: `${d.blocos.size} blocos · ${[...d.blocos.values()].reduce((s, b) => s + b.exs.length, 0)} exercícios`,
    };
  }

  // =====================================================================
  // Plano completo
  // =====================================================================
  /**
   * @param plano  {corrida:[linhas], musculacao:[linhas], depara:{PT:{cat,ex}}}
   * @param config {inicio:'AAAA-MM-DD' (segunda da semana 1), diasMusc:{A..E: 0-6}}
   * @returns lista de treinos {chave,tipo,semana,etapa,dia,treino,data,nome,resumo,payload,avisos}
   */
  function montarPlano(plano, config) {
    const inicio = config.inicio;
    const offM = offsetsMusc(config.diasMusc || DIAS_MUSC_PADRAO);
    const out = [];
    const etapaDaSemana = {};

    (plano.corrida || []).forEach((r, i) => {
      if (vazio(r.semana)) return;
      const semana = Number(r.semana);
      if (txt(r.etapa)) etapaDaSemana[semana] = txt(r.etapa);
      const avisos = validarCorrida(r);
      const wd = DIA_SEMANA[txt(r.dia)];
      const data = inicio && wd !== undefined ? addDias(inicio, (semana - 1) * 7 + wd) : null;
      let m = { payload: null, resumo: '', duracaoMin: 0 };
      if (!avisos.length) m = montarCorrida(r);
      out.push({
        chave: `c|${r._id !== undefined ? r._id : semana + '|' + txt(r.dia)}`, tipo: 'corrida', indice: i, semana, etapa: txt(r.etapa), dia: txt(r.dia),
        data, nome: nomeCorrida(r), resumo: m.resumo, duracaoMin: m.duracaoMin, payload: m.payload, avisos,
      });
    });

    for (const [chave, d] of agruparMusculacao(plano.musculacao || [], plano.depara || {})) {
      const off = offM[d.treino];
      const data = inicio && off !== undefined ? addDias(inicio, (d.semana - 1) * 7 + off) : null;
      const m = montarMusculacao(d);
      const avisos = d.avisos.slice();
      if (off === undefined) avisos.push(`treino ${d.treino} sem dia definido`);
      if (!d.blocos.size) avisos.push('nenhum exercício válido');
      out.push({
        chave, tipo: 'musculacao', semana: d.semana, treino: d.treino, grupo: d.grupo,
        etapa: etapaDaSemana[d.semana] || '', data, nome: m.payload.workoutName,
        resumo: m.resumo, payload: d.blocos.size ? m.payload : null, avisos,
      });
    }
    out.forEach((t) => { if (t.tipo === 'musculacao' && !t.etapa) t.etapa = etapaDaSemana[t.semana] || ''; });

    // nomes repetidos quebram o dedupe (o Garmin é consultado pelo nome)
    const cont = {};
    out.forEach((t) => (cont[t.nome] = (cont[t.nome] || 0) + 1));
    out.forEach((t) => {
      t.repetido = cont[t.nome] > 1;
      if (t.repetido) t.avisos.push(`nome repetido no plano ("${t.nome}") — o Garmin identifica o treino pelo nome; mude um deles`);
      t.bloqueado = !t.payload || t.repetido;
    });

    out.sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || (a.tipo === 'corrida' ? -1 : 1));
    return out;
  }

  /** Linhas "legíveis" da estrutura de um treino, como o relógio mostra. */
  function estrutura(payload) {
    if (!payload) return [];
    const linhas = [];
    const nomeEx = (s) => (s.exerciseName ? s.exerciseName.replace(/_/g, ' ').toLowerCase() : '');
    const fim = (s) => {
      const k = s.endCondition && s.endCondition.conditionTypeKey;
      if (k === 'time') return mm(s.endConditionValue);
      if (k === 'distance') return `${g(s.endConditionValue / 1000)} km`;
      if (k === 'reps') return `${s.endConditionValue} reps`;
      if (k === 'lap.button') return 'até Lap';
      return '';
    };
    const alvo = (s) => (s.zoneNumber ? ` · Z${s.zoneNumber}` : '');
    const rot = { warmup: 'Aquecimento', cooldown: 'Desaquecimento', interval: '', recovery: 'Recuperação', rest: 'Descanso' };
    const linha = (s) => {
      const k = s.stepType.stepTypeKey;
      const ex = nomeEx(s);
      const base = ex ? `${ex} · ${fim(s)}` : `${rot[k] || 'Corrida'} ${fim(s)}${alvo(s)}`;
      return { tipo: k, texto: base.trim(), nota: s.description && ex ? s.description : '' };
    };
    for (const s of payload.workoutSegments[0].workoutSteps) {
      if (s.type === 'RepeatGroupDTO') linhas.push({ tipo: 'repeat', series: s.numberOfIterations, filhos: s.workoutSteps.map(linha) });
      else linhas.push(linha(s));
    }
    return linhas;
  }

  const API = {
    DIA_SEMANA, ROTULOS_DIA, NOME_DIA, TREINOS, DIAS_MUSC_PADRAO, GRUPO_CURTO, AQUECIMENTO, ROTULO_AQUEC,
    addDias, offsetsMusc, montarPlano, estrutura, nomeCorrida, labelCorrida, tipoCorrida, grupoCurto, nomeMusc,
    tipoAquecimento, repsLista, ePiramide,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.THBuilder = API;
})(typeof window !== 'undefined' ? window : globalThis);
