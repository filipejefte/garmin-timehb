/**
 * Time Híbrido → Garmin · script de envio (roda na aba do Garmin Connect)
 * ======================================================================
 * A UI não fala direto com o Garmin (outro domínio). Ela gera um script que
 * você cola no Console da aba https://connect.garmin.com/app/calendar já
 * logada. O script usa a SUA sessão do navegador — sem senha, sem login,
 * sem o bloqueio 429 do fluxo de login.
 *
 * Caminho validado em 12/08/2026:
 *   /gc-api/<serviço> (mesma origem) + cookies + header `connect-csrf-token`.
 *   O token CSRF só existe na memória do app: o script intercepta o fetch e
 *   espera o app fazer uma chamada (troque o mês ou clique em "Ano").
 *
 * Endpoints:
 *   GET    /workout-service/workouts?start=0&limit=999&myWorkoutsOnly=true
 *   POST   /workout-service/workout                 (cria → workoutId)
 *   DELETE /workout-service/workout/{workoutId}     (apaga treino + datas)
 *   POST   /workout-service/schedule/{workoutId}    {date:"AAAA-MM-DD"}
 *   DELETE /workout-service/schedule/{calendarId}   (tira só a data)
 *   GET    /calendar-service/year/AAAA/month/M      (M é 0-based; dedupe por id)
 *
 * `thEnviar` é serializada com Function.prototype.toString() dentro do script
 * gerado — por isso NÃO pode usar nada de fora dela.
 */
(function (raiz) {
  'use strict';

  async function thEnviar(DADOS_B64, OPC) {
    const PAUSA_MS = 250;
    const CHAVE_CK = '__thEnvio_' + OPC.id;
    const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
    const hoje = new Date().toISOString().slice(0, 10);
    const br = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');

    if (!/(^|\.)connect\.garmin\.com$/.test(location.hostname)) {
      console.error('❌ Cole este script no Console da aba https://connect.garmin.com/app/calendar (logado).');
      return;
    }

    // ------------------------------------------------------------------
    // Painel de progresso no canto da página
    // ------------------------------------------------------------------
    const velho = document.getElementById('th-painel');
    if (velho) velho.remove();
    const el = (tag, estilo, texto) => {
      const e = document.createElement(tag);
      Object.assign(e.style, estilo || {});
      if (texto !== undefined) e.textContent = texto;
      return e;
    };
    const painel = el('div', {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647', width: '340px',
      background: '#042705', color: '#F4F8F3', borderRadius: '12px', padding: '14px 16px',
      font: '13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif', boxShadow: '0 12px 32px rgba(0,0,0,.35)',
    });
    painel.id = 'th-painel';
    const topo = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' });
    topo.appendChild(el('strong', { letterSpacing: '.04em', color: '#3CFF00' }, 'TIME HÍBRIDO → GARMIN' + (OPC.simular ? ' · SIMULAÇÃO' : '')));
    const fechar = el('button', { background: 'none', border: '0', color: '#F4F8F3', fontSize: '18px', cursor: 'pointer', lineHeight: '1' }, '×');
    fechar.onclick = () => painel.remove();
    topo.appendChild(fechar);
    const linhaStatus = el('div', { fontWeight: '600', minHeight: '20px' });
    const trilho = el('div', { height: '6px', background: 'rgba(255,255,255,.15)', borderRadius: '3px', margin: '8px 0', overflow: 'hidden' });
    const barra = el('div', { height: '100%', width: '0%', background: '#3CFF00', transition: 'width .2s' });
    trilho.appendChild(barra);
    const detalhe = el('div', { opacity: '.85', fontSize: '12px', whiteSpace: 'pre-line' });
    painel.append(topo, linhaStatus, trilho, detalhe);
    document.body.appendChild(painel);
    const status = (msg, cor) => { linhaStatus.textContent = msg; linhaStatus.style.color = cor || '#F4F8F3'; };
    // pergunta no próprio painel (sem alert/confirm, que travam a página)
    const perguntar = (sim, nao) => new Promise((resolve) => {
      const caixa = el('div', { display: 'flex', gap: '8px', marginTop: '10px' });
      const botao = (txt, fundo, cor, valor) => {
        const b = el('button', { flex: '1', padding: '8px 10px', borderRadius: '8px', border: '0', cursor: 'pointer', fontWeight: '700', background: fundo, color: cor }, txt);
        b.onclick = () => { caixa.remove(); resolve(valor); };
        return b;
      };
      caixa.append(botao(sim, '#3CFF00', '#042705', true), botao(nao, 'rgba(255,255,255,.12)', '#F4F8F3', false));
      painel.appendChild(caixa);
    });
    const progresso = (feito, total) => { barra.style.width = (total ? Math.round((100 * feito) / total) : 0) + '%'; };

    // ------------------------------------------------------------------
    // Dados (gzip + base64, gerados pela UI)
    // ------------------------------------------------------------------
    let ITENS;
    try {
      const bytes = Uint8Array.from(atob(DADOS_B64), (c) => c.charCodeAt(0));
      const txt = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      ITENS = JSON.parse(txt);
    } catch (e) {
      status('Script corrompido — gere de novo na UI.', '#FF8A80');
      console.error('❌ Não consegui ler os dados embutidos:', e);
      return;
    }
    if (ITENS.length !== OPC.total) { status('Script incompleto — gere de novo na UI.', '#FF8A80'); return; }

    // ------------------------------------------------------------------
    // Token CSRF — interceptar o fetch/XHR do próprio app
    // ------------------------------------------------------------------
    function instalarGancho() {
      if (!window.fetch.__th) {
        const original = window.fetch;
        const gancho = function (entrada, init) {
          try {
            if (!(init && init.__th)) {
              const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
              if (String(url).includes('gc-api')) {
                const h = (init && init.headers) || (entrada && entrada.headers);
                let tok = null;
                if (h && typeof h.get === 'function') tok = h.get('connect-csrf-token');
                else if (Array.isArray(h)) { const p = h.find((x) => String(x[0]).toLowerCase() === 'connect-csrf-token'); tok = p && p[1]; }
                else if (h) tok = h['connect-csrf-token'] || h['Connect-Csrf-Token'];
                if (tok) { window.__thCsrf = tok; window.__thCsrfEm = Date.now(); }
              }
            }
          } catch (e) { /* nunca atrapalhar o app */ }
          return original.apply(this, arguments);
        };
        gancho.__th = true;
        window.fetch = gancho;
      }
      const X = XMLHttpRequest.prototype;
      if (!X.__thGancho) {
        const set = X.setRequestHeader;
        X.setRequestHeader = function (n, v) {
          try { if (String(n).toLowerCase() === 'connect-csrf-token' && v) { window.__thCsrf = v; window.__thCsrfEm = Date.now(); } } catch (e) { /* idem */ }
          return set.apply(this, arguments);
        };
        X.__thGancho = true;
      }
    }

    async function capturarCsrf(motivo) {
      instalarGancho();
      const desde = Date.now();
      if (!motivo && !window.__thCsrf) {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) { window.__thCsrf = meta.content; window.__thCsrfEm = desde; return; }
      }
      if (!motivo && window.__thCsrf) return;
      status('👉 Clique na seta ‹ › do mês (ou em "Ano") no calendário', '#E6FF0A');
      detalhe.textContent = (motivo ? motivo + '\n' : '') + 'O script precisa que o app faça uma chamada para pegar o token da sua sessão.';
      console.log('⏳ ' + (motivo || '') + ' Clique na seta ‹ › do mês (ou em "Ano") no calendário.');
      for (let i = 0; i < 600; i++) {               // até 5 min
        if (window.__thCsrf && (window.__thCsrfEm || 0) >= desde) { console.log('🔑 Token capturado.'); return; }
        if (i % 10 === 0) instalarGancho();          // o app às vezes troca o window.fetch
        await dorme(500);
      }
      const e = new Error('Não peguei o token da sessão (ninguém clicou no calendário).');
      e.sessao = true;
      throw e;
    }

    async function api(metodo, caminho, corpo, tentativa) {
      if (!window.__thCsrf) await capturarCsrf();
      const r = await fetch(location.origin + '/gc-api' + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'connect-csrf-token': window.__thCsrf },
        credentials: 'include',
        body: corpo ? JSON.stringify(corpo) : undefined,
        __th: true,
      });
      if ((r.status === 401 || r.status === 403) && !tentativa) {
        window.__thCsrf = null;
        await capturarCsrf('A sessão pediu um token novo.');
        return api(metodo, caminho, corpo, 1);
      }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        const e = new Error(`${metodo} ${caminho} → HTTP ${r.status} ${t.slice(0, 160)}`);
        e.status = r.status;
        if (r.status === 401 || r.status === 403) e.sessao = true;
        throw e;
      }
      if (r.status === 204) return null;
      return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text();
    }

    async function lerConta() {
      const lista = await api('GET', '/workout-service/workouts?start=0&limit=999&myWorkoutsOnly=true');
      const porNome = new Map();
      (Array.isArray(lista) ? lista : []).forEach((w) => {
        if (!porNome.has(w.workoutName)) porNome.set(w.workoutName, []);
        porNome.get(w.workoutName).push(w.workoutId);
      });
      const anos = new Set([Number(hoje.slice(0, 4))]);
      ITENS.forEach((it) => it.data && anos.add(Number(it.data.slice(0, 4))));
      const agenda = new Map(); const vistos = new Set();
      for (const ano of [...anos].sort()) {
        for (let mes = 0; mes < 12; mes++) {          // 0-based na API
          try {
            const cal = await api('GET', `/calendar-service/year/${ano}/month/${mes}`);
            (cal.calendarItems || []).forEach((c) => {
              // a API devolve semanas vizinhas: o mesmo item vem em 2 meses
              if (c.itemType === 'workout' && c.title && c.date && !vistos.has(c.id)) {
                vistos.add(c.id);
                if (!agenda.has(c.title)) agenda.set(c.title, []);
                agenda.get(c.title).push({ id: c.id, data: c.date });
              }
            });
          } catch (e) { if (e.sessao) throw e; console.warn('calendário', ano, mes + 1, e.message); }
          await dorme(60);
        }
      }
      return { porNome, agenda };
    }

    // ------------------------------------------------------------------
    // Plano de ações (o mesmo para simulação e envio)
    // ------------------------------------------------------------------
    const ck = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_CK) || 'null'); } catch (e) { return null; } })() || { feitos: [], andamento: null };
    const feitos = new Set(ck.feitos);
    const salvarCk = () => { try { localStorage.setItem(CHAVE_CK, JSON.stringify({ feitos: [...feitos], andamento: ck.andamento })); } catch (e) { /* sem espaço */ } };

    // "Impressão digital" do treino: o que aparece no relógio. Serve para (1) não
    // substituir à toa um treino editado que já foi enviado igualzinho e (2) não
    // reaproveitar um treino de OUTRO plano que tem o mesmo nome (ex.: um PDF novo).
    function assinatura(w) {
      const n = (v) => (v === undefined || v === null || v === '' ? null : v);
      const t = (v) => (n(v) === null ? null : String(v).replace(/\s+/g, ' ').trim() || null);
      const passo = (s) => {
        const cond = s.endCondition && s.endCondition.conditionTypeKey;
        return [
          s.type, s.stepType && s.stepType.stepTypeKey, cond,
          cond === 'lap.button' || n(s.endConditionValue) === null ? null : Number(s.endConditionValue),
          s.type === 'RepeatGroupDTO' ? null : ((s.targetType && s.targetType.workoutTargetTypeKey) || 'no.target'),
          n(s.zoneNumber), n(s.category), n(s.exerciseName), t(s.description), n(s.numberOfIterations),
          (s.workoutSteps || []).map(passo),
        ];
      };
      return JSON.stringify([t(w.workoutName), t(w.description), w.sportType && w.sportType.sportTypeKey,
        (w.workoutSegments || []).map((sg) => (sg.workoutSteps || []).map(passo))]);
    }

    async function planejar(conta) {
      const plano = [];
      for (const it of ITENS) plano.push(await planejarItem(conta, it));
      return plano;
    }

    async function planejarItem(conta, it) {
      const nomes = [...new Set([it.nome, ...(it.antigos || [])])];
      const ids = nomes.flatMap((n) => conta.porNome.get(n) || []);
      const datas = nomes.flatMap((n) => conta.agenda.get(n) || []);
      const existentes = [...new Set(datas.map((d) => d.data))].sort();
      const p = { it, apagar: [], criar: false, reusar: null, desagendar: [], agendar: [], treino: '', cal: '' };
      const lista = (ds) => ds.map(br).join(', ');

      // Item que estava no meio do caminho quando a execução anterior parou:
      // termina exatamente o que tinha sido planejado (datas guardadas no checkpoint).
      if (ck.andamento && ck.andamento.k === it.k && !feitos.has(it.k)) {
        const alvo = ck.andamento.datas || [];
        if (ids.length) { p.reusar = ids[0]; p.treino = 'retomada'; }
        else { p.criar = true; p.treino = 'retomada (criar)'; }
        p.agendar = alvo.filter((d) => !existentes.includes(d));
        p.cal = p.agendar.length ? `agendar ${lista(p.agendar)}` : '—';
        return p;
      }

      let substituir = ids.length > 0 && (it.editado || OPC.existente === 'substituir');
      let igual = null;                          // null = não deu para comparar
      if (ids.length && OPC.existente !== 'substituir') {
        // compara com o que está no Garmin: editado já enviado? treino de outro plano com o mesmo nome?
        try {
          const atual = await api('GET', `/workout-service/workout/${ids[0]}`);
          if (atual) igual = assinatura(atual) === assinatura(it.payload);
        } catch (e) { if (e.sessao) throw e; /* na dúvida, segue a regra sem comparar */ }
        if (igual && ids.length === 1) substituir = false;
        if (igual === false && !it.editado) {
          // mesmo nome, conteúdo diferente e você não editou: provavelmente é de outro plano. Não mexe.
          p.conflito = true;
          p.treino = 'CONFLITO: mesmo nome, outro conteúdo';
          p.cal = 'não mexe';
          return p;
        }
      }
      if (substituir) { p.apagar = ids; p.criar = true; p.treino = it.editado ? 'substituir (editado)' : 'substituir'; }
      else if (ids.length) { p.reusar = ids[0]; p.treino = igual ? 'já está igual' : 'já existe'; }
      else { p.criar = true; p.treino = 'criar'; }

      if (OPC.agendar === 'mover') {
        // fica só na data do plano
        if (!it.data) { p.agendar = substituir ? existentes : []; p.cal = 'sem data no plano'; }
        else if (substituir) {
          p.agendar = [it.data];
          p.cal = existentes.length && existentes.join() !== it.data ? `mover ${lista(existentes)} → ${br(it.data)}` : `agendar ${br(it.data)}`;
        } else {
          const outras = ids.length ? datas.filter((d) => d.data !== it.data) : [];
          p.desagendar = outras.map((d) => d.id);
          if (!existentes.includes(it.data)) p.agendar = [it.data];
          p.cal = outras.length ? `mover ${lista(outras.map((d) => d.data))} → ${br(it.data)}` : p.agendar.length ? `agendar ${br(it.data)}` : `já em ${br(it.data)}`;
        }
      } else if (OPC.agendar === 'manter') {
        // o que já está no calendário fica onde está (respeita o que você moveu à mão)
        if (substituir) { p.agendar = existentes.length ? existentes : (it.data ? [it.data] : []); p.cal = existentes.length ? `mantém ${lista(existentes)}` : `agendar ${br(it.data)}`; }
        else if (existentes.length) p.cal = `mantém ${lista(existentes)}`;
        else if (it.data) { p.agendar = [it.data]; p.cal = `agendar ${br(it.data)}`; }
      } else {
        // 'nao': só repõe as datas que o substituir apagaria junto com o treino
        if (substituir) p.agendar = existentes;
        p.cal = existentes.length ? `mantém ${lista(existentes)}` : '—';
      }
      return p;
    }

    // ------------------------------------------------------------------
    // Execução
    // ------------------------------------------------------------------
    const res = { criados: 0, substituidos: 0, reaproveitados: 0, agendados: 0, desagendados: 0, retomados: 0, conflitos: 0, erros: 0 };
    const AVISO_CONFLITO = 'têm o mesmo nome de treinos que já estão no seu Garmin, mas com outro conteúdo (outro plano?). Não mexi neles. Para enviar o plano novo sem misturar, use um prefixo nos nomes (campo "Prefixo" na página) — ou marque "Substituir".';
    try {
      status('Lendo seus treinos e o calendário no Garmin…');
      const conta = await lerConta();
      status('Comparando com o que você selecionou…');
      const plano = await planejar(conta);
      const nTreinos = conta.porNome.size;
      console.log(`Na conta: ${nTreinos} nomes de treino · ${[...conta.agenda.values()].reduce((s, v) => s + v.length, 0)} agendamentos lidos`);
      console.table(plano.map((p) => ({ data: p.it.data, nome: p.it.nome, treino: feitos.has(p.it.k) ? 'feito (retomada)' : p.treino, calendário: p.cal })));

      const conflitos = plano.filter((p) => p.conflito);
      if (conflitos.length) console.warn(`⚠️ ${conflitos.length} treino(s) ${AVISO_CONFLITO}`, conflitos.map((p) => p.it.nome));

      if (OPC.simular) {
        const c = (f) => plano.filter(f).length;
        status(conflitos.length ? `Simulação pronta — ${conflitos.length} conflito(s) de nome` : 'Simulação pronta — nada foi gravado.', conflitos.length ? '#E6FF0A' : '#3CFF00');
        progresso(1, 1);
        detalhe.textContent =
          (conflitos.length ? `⚠️ ${conflitos.length} ${AVISO_CONFLITO}\n\n` : '') +
          `${c((p) => p.criar && !p.apagar.length)} a criar · ${c((p) => p.apagar.length > 0)} a substituir · ${c((p) => !p.criar && !p.conflito)} já existem\n` +
          `${plano.reduce((s, p) => s + p.agendar.length, 0)} datas a agendar · ${plano.reduce((s, p) => s + p.desagendar.length, 0)} a remover\n` +
          'Detalhes na tabela do Console. Para gravar, gere o script sem "Só simular".';
        return { simulacao: true, plano: plano.map((p) => ({ data: p.it.data, nome: p.it.nome, treino: p.treino, calendario: p.cal })) };
      }

      if (conflitos.length && conflitos.length < plano.length - feitos.size) {
        // antes de gravar qualquer coisa: pode ser um plano novo com os mesmos nomes do antigo
        status(`⚠️ ${conflitos.length} conflito(s) de nome — nada foi gravado ainda`, '#E6FF0A');
        detalhe.textContent = `${conflitos.length} ${AVISO_CONFLITO}\n\nContinuar envia só os outros ${plano.length - conflitos.length}.`;
        if (!(await perguntar('Continuar sem eles', 'Cancelar'))) {
          status('Cancelado — nada foi gravado.', '#E6FF0A');
          return { cancelado: true, conflitos: conflitos.length };
        }
      } else if (conflitos.length) {
        status(`⚠️ Todos os ${conflitos.length} treinos têm conflito de nome — nada a fazer`, '#E6FF0A');
        detalhe.textContent = `${conflitos.length} ${AVISO_CONFLITO}`;
        return { conflitos: conflitos.length };
      }

      if (feitos.size) console.log(`↩️  Retomando: ${feitos.size} item(ns) já feitos numa execução anterior.`);
      let n = 0, errosSeguidos = 0;
      for (const p of plano) {
        n++; progresso(n - 1, plano.length);
        const it = p.it;
        if (feitos.has(it.k)) { res.retomados++; continue; }
        if (p.conflito) { res.conflitos++; console.warn(`⚠️ ${it.nome}: mesmo nome de um treino com outro conteúdo — não mexi`); continue; }
        status(`${n}/${plano.length} · ${it.nome}`);
        try {
          ck.andamento = { k: it.k, datas: p.agendar }; salvarCk();
          let id = p.reusar;
          for (const velhoId of p.apagar) { await api('DELETE', `/workout-service/workout/${velhoId}`); await dorme(PAUSA_MS); }
          if (p.criar) {
            const r = await api('POST', '/workout-service/workout', it.payload);
            id = r && r.workoutId;
            if (!id) throw new Error('o Garmin não devolveu o workoutId');
            p.apagar.length ? res.substituidos++ : res.criados++;
            console.log(`${p.apagar.length ? '🔁' : '✅'} ${it.nome} (id ${id})`);
            await dorme(PAUSA_MS);
          } else { res.reaproveitados++; console.log(`♻️  ${it.nome}`); }
          for (const sid of p.desagendar) { await api('DELETE', `/workout-service/schedule/${sid}`); res.desagendados++; await dorme(PAUSA_MS); }
          for (const d of p.agendar) { await api('POST', `/workout-service/schedule/${id}`, { date: d }); res.agendados++; console.log(`   📅 ${d}`); await dorme(PAUSA_MS); }
          feitos.add(it.k); ck.andamento = null; salvarCk();
          errosSeguidos = 0;
        } catch (e) {
          if (e.sessao) throw e;
          res.erros++; errosSeguidos++;
          console.error(`❌ ${it.nome}: ${e.message}`);
          if (errosSeguidos >= 5) throw new Error('5 erros seguidos — parei para você conferir. Veja o Console.');
        }
        detalhe.textContent = `criados ${res.criados} · substituídos ${res.substituidos} · já existiam ${res.reaproveitados}\nagendados ${res.agendados} · removidos ${res.desagendados} · erros ${res.erros}`;
      }
      progresso(1, 1);

      // ---------------- conferência ----------------
      status('Conferindo no Garmin…');
      const depois = await lerConta();
      const faltando = ITENS.filter((it) => !depois.porNome.has(it.nome)).map((it) => it.nome);
      const duplicados = ITENS.filter((it) => (depois.porNome.get(it.nome) || []).length > 1).map((it) => it.nome);
      const emConflito = new Set(conflitos.map((p) => p.it.k));
      const semData = OPC.agendar === 'nao' ? [] : ITENS.filter((it) => it.data && !emConflito.has(it.k) && !(depois.agenda.get(it.nome) || []).length).map((it) => it.nome);
      if (faltando.length) console.warn('⚠️ Não encontrei no Garmin:', faltando);
      if (duplicados.length) console.warn('⚠️ Nome repetido no Garmin (apague a cópia):', duplicados);
      if (semData.length) console.warn('⚠️ Sem data no calendário:', semData);

      const ok = !res.erros && !faltando.length && !duplicados.length && !semData.length && !res.conflitos;
      if (!res.erros) { try { localStorage.removeItem(CHAVE_CK); } catch (e) { /* ok */ } }
      status(ok ? '✅ Pronto! Confira o calendário.' : '⚠️ Terminou com pendências — veja o Console.', ok ? '#3CFF00' : '#E6FF0A');
      detalhe.textContent =
        (res.conflitos ? `⚠️ ${res.conflitos} ${AVISO_CONFLITO}\n\n` : '') +
        `criados ${res.criados} · substituídos ${res.substituidos} · já existiam ${res.reaproveitados}\n` +
        `agendados ${res.agendados} · removidos ${res.desagendados} · erros ${res.erros}` +
        (faltando.length ? `\nfaltando ${faltando.length}` : '') + (duplicados.length ? `\nduplicados ${duplicados.length}` : '') +
        (semData.length ? `\nsem data ${semData.length}` : '') +
        (res.erros ? '\nCole o script de novo para tentar só o que falhou.' : '');
      console.log('===== resultado', res);
      return res;
    } catch (e) {
      status(e.sessao ? 'Sessão expirou — recarregue a página (F5)' : 'Parei: ' + e.message, '#FF8A80');
      detalhe.textContent = e.sessao
        ? 'Entre na conta se pedir, abra o calendário e cole o script de novo: ele continua de onde parou.'
        : 'Cole o script de novo para continuar de onde parou.';
      console.error('❌', e.message);
      return res;
    }
  }

  // ----------------------------------------------------------------------
  // Geração do script (lado da UI)
  // ----------------------------------------------------------------------
  async function gzipBase64(texto) {
    const fluxo = new Blob([new TextEncoder().encode(texto)]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(fluxo).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function hash(s) {
    let v = 0;
    for (let i = 0; i < s.length; i++) v = (v * 31 + s.charCodeAt(i)) >>> 0;
    return v.toString(36);
  }

  const ROTULO_AGENDA = { manter: 'manter as datas que já estão no Garmin', mover: 'colocar na data do plano', nao: 'não mexer no calendário' };

  /**
   * @param itens  [{k, nome, antigos:[], data, editado, payload}]
   * @param opc    {agendar:'manter'|'mover'|'nao', existente:'pular'|'substituir', simular:bool}
   */
  async function gerarScript(itens, opc) {
    const b64 = await gzipBase64(JSON.stringify(itens));
    const opcoes = { agendar: opc.agendar, existente: opc.existente, simular: !!opc.simular, total: itens.length, id: hash(b64 + opc.agendar + opc.existente) };
    const agora = new Date();
    const lista = itens.map((it) => `//   ${it.data || '(sem data)'}  ${it.nome}${it.editado ? '  [editado]' : ''}`).join('\n');
    const cabecalho = [
      '// =====================================================================',
      `// TIME HÍBRIDO → GARMIN · ${itens.length} treino(s)${opcoes.simular ? ' · SÓ SIMULAÇÃO (não grava nada)' : ''}`,
      `// Gerado em ${agora.toLocaleString('pt-BR')} pela UI do projeto.`,
      '//',
      '// COMO USAR',
      '//   1. Abra https://connect.garmin.com/app/calendar (logado).',
      '//   2. F12 → aba Console → cole tudo → Enter.',
      '//      (Se o navegador bloquear a colagem, digite  allow pasting  e Enter.)',
      '//   3. Clique na seta ‹ › do mês (ou em "Ano") quando o painel pedir.',
      '//',
      `// Calendário: ${ROTULO_AGENDA[opcoes.agendar]}`,
      `// Treino que já existe no Garmin: ${opcoes.existente === 'substituir' ? 'substituir' : 'pular'} (editados são sempre substituídos)`,
      '// Pode colar de novo com segurança: o que já foi feito é pulado.',
      '//',
      lista,
      '// =====================================================================',
    ].join('\n');
    const codigo = `${cabecalho}\n(${thEnviar.toString()})(\n  ${JSON.stringify(b64)},\n  ${JSON.stringify(opcoes)}\n);\n`;
    return { codigo, bytes: codigo.length, opcoes };
  }

  const API = { thEnviar, gerarScript, gzipBase64, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.THUploader = API;
})(typeof window !== 'undefined' ? window : globalThis);
