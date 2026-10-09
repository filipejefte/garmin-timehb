/**
 * Time Híbrido → Garmin · UI
 * ==========================
 * Lê a planilha (data/time_hibrido.xlsx ou um .xlsx que você abrir), mostra
 * os treinos por semana, deixa editar e gera o script de envio para colar na
 * aba do Garmin Connect. Tudo roda no seu navegador: nada sai daqui, e as
 * edições ficam guardadas neste navegador até você baixar a planilha.
 */
(function () {
  'use strict';
  const B = window.THBuilder;
  const U = window.THUploader;

  // ---------------------------------------------------------------------
  // Configuração padrão — ajuste aqui se o plano for reancorado.
  // inicio: segunda-feira da semana 1 (a âncora atual do calendário).
  // ---------------------------------------------------------------------
  const PLANILHA_PROJETO = 'data/time_hibrido.xlsx';
  const CATALOGO = 'data/garmin_exercises.json';
  const CONFIG_PADRAO = { inicio: '2026-08-31', diasMusc: { ...B.DIAS_MUSC_PADRAO } };
  const CHAVE_LS = 'th-garmin-ui:v1';

  // ---------------------------------------------------------------------
  // Doação via Pix — o valor é livre (o QR não tem valor fixo).
  // ---------------------------------------------------------------------
  // QR estático sem valor (campo 54 ausente) — conferido: chave, recebedor e CRC.
  const PIX = {
    chave: '+5514996272582',        // vai para a área de transferência (celular com +55)
    exibir: '(14) 99627-2582',
    qr: 'assets/pix-qr.png',        // gerado a partir do código abaixo
    copiaECola: '00020126360014BR.GOV.BCB.PIX0114+55149962725825204000053039865802BR5923FILIPE JEFTE DE CAMARGO6007MARILIA62070503***6304468D',
    recebedor: 'Filipe Jefte de Camargo',
  };

  const COLUNAS = {
    corrida: ['semana', 'etapa', 'dia', 'tipo', 'aquecimento_min', 'reps', 'esforco_min', 'esforco_zona', 'recuperacao_min', 'recuperacao_zona', 'desaquecimento_min', 'distancia_km', 'notas'],
    musculacao: ['semana', 'treino', 'grupo', 'bloco', 'tecnica', 'exercicio', 'series', 'reps', 'descanso_seg', 'notas'],
    depara: ['exercicio_pt', 'garmin_category', 'garmin_exercise', 'garmin_label', 'confianca', 'obs'],
  };
  const TECNICAS = ['AQUECIMENTO', 'BI-SET', 'SUPER-SET', 'DROP-SET', 'PIRÂMIDE', 'META DE REPETIÇÃO', '6 PESADAS 12 LEVES'];
  const GRUPOS = Object.keys(B.GRUPO_CURTO);
  const ETAPAS = { base: 'Base', consolidacao: 'Consolidação', alvo: 'Alvo' };

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  let S = null;            // {fonte, base, atual, colunas, leiame, config}
  let D = { treinos: [], porChave: new Map(), base: new Map() };
  const UI = {
    filtro: 'tudo', esconderPassadas: false, sel: new Set(), aberto: null, catalogo: null,
    envio: { agendar: 'manter', existente: 'pular', simular: false }, script: null,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const hoje = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  function fmtData(iso, comDia = true) {
    if (!iso) return 'sem data';
    const [y, m, d] = iso.split('-').map(Number);
    const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return `${comDia ? B.NOME_DIA[wd] + ' ' : ''}${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  }

  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), ms);
  }

  // ---------------------------------------------------------------------
  // Planilha ⇄ estado
  // ---------------------------------------------------------------------
  function lerPlanilha(buf, nome) {
    const wb = XLSX.read(buf, { type: 'array' });
    const aba = (alvo) => wb.SheetNames.find((n) => semAcento(n) === alvo);
    const linhas = (n) => {
      if (!n) return { rows: [], cols: [] };
      const ws = wb.Sheets[n];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      if (!aoa.length) return { rows: [], cols: [] };
      const cols = aoa[0].map((h) => (h === null ? '' : String(h).trim().toLowerCase()));
      const rows = aoa.slice(1)
        .filter((r) => r.some((c) => !vazio(c)))
        .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] === undefined ? null : r[i]]).filter(([c]) => c)));
      return { rows, cols: cols.filter(Boolean) };
    };
    const cor = linhas(aba('corrida'));
    const mus = linhas(aba('musculacao'));
    const dp = linhas(aba('de-para'));
    if (!cor.rows.length && !mus.rows.length) throw new Error('não achei as abas "Corrida" e "Musculação" nessa planilha');
    cor.rows.forEach((r, i) => (r._id = 'c' + i));
    mus.rows.forEach((r, i) => (r._id = 'm' + i));
    const nLeia = aba('leia-me');
    const leiame = nLeia ? XLSX.utils.sheet_to_json(wb.Sheets[nLeia], { header: 1, defval: null }) : null;
    const dados = { corrida: cor.rows, musculacao: mus.rows, depara: dp.rows };
    const juntar = (a, b) => [...a, ...b.filter((c) => !a.includes(c))];
    return {
      fonte: nome, carregadoEm: new Date().toISOString(),
      base: dados, atual: clone(dados), leiame,
      colunas: { corrida: juntar(cor.cols, COLUNAS.corrida), musculacao: juntar(mus.cols, COLUNAS.musculacao), depara: juntar(dp.cols, COLUNAS.depara) },
      config: (S && S.config) || clone(CONFIG_PADRAO),
      configOriginal: null,
    };
  }

  function proximaSegunda() {
    const [y, m, d] = hoje.split('-').map(Number);
    const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return B.addDias(hoje, wd === 0 ? 0 : 7 - wd);
  }

  /** PDF do Time Híbrido → mesmo estado que a planilha (abas Corrida, Musculação, De-para). */
  async function lerPdf(buf, nome) {
    if (!window.THPdf) throw new Error('o leitor de PDF não carregou');
    const paginas = await THPdf.extrairPaginas(buf, (n, t) => {
      $('#relatorio').hidden = false;
      $('#relatorio').className = 'relatorio';
      $('#relatorio').innerHTML = `<span class="carregando"></span>Lendo o PDF… página ${n} de ${t}`;
    });
    const r = THPdf.lerPlano(paginas);
    if (!r.corrida.length && !r.musculacao.length) {
      throw new Error('não reconheci os treinos nesse PDF. Ele é o PDF do plano do Time Híbrido? (' + (r.avisos[0] || '') + ')');
    }
    r.corrida.forEach((x, i) => (x._id = 'c' + i));
    r.musculacao.forEach((x, i) => (x._id = 'm' + i));
    // De-para: o que já está aqui (inclui o que você escolheu na página) + o padrão do projeto
    const depara = clone((S && S.atual && S.atual.depara) || []);
    const tem = new Set(depara.map((d) => String(d.exercicio_pt || '').trim().toUpperCase()));
    for (const d of (window.TH_DEPARA_PADRAO || [])) if (!tem.has(d.exercicio_pt)) depara.push(clone(d));
    const dados = { corrida: r.corrida, musculacao: r.musculacao, depara };
    // plano novo: começa na próxima segunda (dá para mudar no campo do topo)
    const config = { ...clone((S && S.config) || CONFIG_PADRAO), inicio: proximaSegunda() };
    return {
      fonte: nome, carregadoEm: new Date().toISOString(),
      base: dados, atual: clone(dados), leiame: THPdf.LEIA_ME,
      colunas: clone(COLUNAS),
      config,
      configOriginal: null,
      relatorio: { tipo: 'pdf', nome, plano: r.plano, semanas: r.semanas, paginas: paginas.length, avisos: r.avisos, visivel: true },
    };
  }

  async function abrirArquivo(f) {
    const pdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    try {
      const buf = await f.arrayBuffer();
      iniciar(pdf ? await lerPdf(buf, f.name) : lerPlanilha(buf, f.name), { rolar: !pdf });
      if (pdf) window.scrollTo({ top: 0, behavior: 'smooth' });   // mostra o relatório da leitura
      toast(pdf ? `PDF "${f.name}" lido. Confira os treinos antes de enviar.` : `Planilha "${f.name}" carregada.`, 4000);
    } catch (err) {
      console.error(err);
      if (S) renderRelatorio(); else $('#relatorio').hidden = true;
      toast(`Não consegui ler ${pdf ? 'o PDF' : 'a planilha'}: ${err.message}`, 7000);
    }
  }

  function baixarPlanilha() {
    const wb = XLSX.utils.book_new();
    const sem = (rows, cols) => rows.map((r) => Object.fromEntries(cols.map((c) => [c, vazio(r[c]) ? null : r[c]])));
    const aba = (rows, cols, nome, larguras) => {
      const ws = XLSX.utils.json_to_sheet(sem(rows, cols), { header: cols });
      ws['!cols'] = cols.map((c) => ({ wch: larguras[c] || Math.max(10, c.length + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    aba(S.atual.corrida, S.colunas.corrida, 'Corrida', { notas: 30 });
    aba(S.atual.musculacao, S.colunas.musculacao, 'Musculação', { grupo: 24, tecnica: 20, exercicio: 44, notas: 30 });
    aba(S.atual.depara, S.colunas.depara, 'De-para', { exercicio_pt: 40, garmin_category: 22, garmin_exercise: 36, garmin_label: 36, obs: 30 });
    if (S.leiame) { const ws = XLSX.utils.aoa_to_sheet(S.leiame); ws['!cols'] = [{ wch: 100 }]; XLSX.utils.book_append_sheet(wb, ws, 'Leia-me'); }
    XLSX.writeFile(wb, 'time_hibrido.xlsx');
    toast('Planilha baixada. Substitua data/time_hibrido.xlsx por ela para guardar as edições no projeto.', 5000);
  }

  function salvar() {
    try { localStorage.setItem(CHAVE_LS, JSON.stringify(S)); }
    catch (e) { toast('Não consegui guardar as edições neste navegador — baixe a planilha para não perder.'); }
  }

  function carregarSalvo() {
    try { const s = JSON.parse(localStorage.getItem(CHAVE_LS) || 'null'); if (s && s.base && s.atual) return s; } catch (e) { /* ignora */ }
    return null;
  }

  async function carregarDoProjeto() {
    const r = await fetch(PLANILHA_PROJETO, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return lerPlanilha(await r.arrayBuffer(), PLANILHA_PROJETO);
  }

  // ---------------------------------------------------------------------
  // Treinos derivados
  // ---------------------------------------------------------------------
  const mapaDepara = (rows) => {
    const m = {};
    rows.forEach((d) => {
      const pt = String(d.exercicio_pt || '').trim().toUpperCase();
      if (!pt) return;
      m[pt] = { cat: d.garmin_category, ex: d.garmin_exercise };
      const solta = '~' + B.chaveSolta(pt);
      if (!m[solta]) m[solta] = m[pt];
    });
    return m;
  };
  const montar = (dados) => B.montarPlano({ corrida: dados.corrida, musculacao: dados.musculacao, depara: mapaDepara(dados.depara) }, S.config);

  function recalcularBase() {
    D.base = new Map(montar(S.base).map((t) => [t.chave, { json: JSON.stringify(t.payload), nome: t.nome, dia: t.dia }]));
  }

  function recalcular() {
    D.treinos = montar(S.atual);
    D.porChave = new Map(D.treinos.map((t) => [t.chave, t]));
    for (const t of D.treinos) {
      const b = D.base.get(t.chave);
      t.editado = !b || b.json !== JSON.stringify(t.payload);
      t.nomeAntigo = b && b.nome !== t.nome ? b.nome : null;
      t.diaMudou = !!(b && t.tipo === 'corrida' && b.dia !== t.dia);
    }
    for (const k of [...UI.sel]) if (!D.porChave.has(k)) UI.sel.delete(k);
  }

  function selecionar(preset) {
    const visivel = (t) => UI.filtro === 'tudo' || t.tipo === UI.filtro;
    const regra = {
      futuro: (t) => t.data && t.data >= hoje,
      todos: () => true,
      editados: (t) => t.editado,
      nenhum: () => false,
    }[preset];
    UI.sel = new Set(D.treinos.filter((t) => visivel(t) && regra(t)).map((t) => t.chave));
  }

  // ---------------------------------------------------------------------
  // Render: cabeçalho, configuração, semanas
  // ---------------------------------------------------------------------
  function renderFonte() {
    const nC = D.treinos.filter((t) => t.tipo === 'corrida').length;
    const nM = D.treinos.length - nC;
    const nE = D.treinos.filter((t) => t.editado).length;
    $('#fonte').innerHTML = `<b>${esc(S.fonte)}</b> · ${nC} corridas · ${nM} musculação` +
      (nE ? ` · <span class="tag-editado">${nE} editado${nE > 1 ? 's' : ''} aqui</span>` : '');
  }

  function renderRelatorio() {
    const box = $('#relatorio');
    const r = S && S.relatorio;
    if (!r || !r.visivel) { box.hidden = true; return; }
    const nC = D.treinos.filter((t) => t.tipo === 'corrida').length;
    const nM = D.treinos.length - nC;
    const semPar = new Set();
    D.treinos.forEach((t) => t.avisos.forEach((a) => { const m = a.match(/^"(.+)" sem par no De-para/); if (m) semPar.add(m[1]); }));
    const itens = [...r.avisos];
    if (!S.config.prefixo) itens.push('Se o seu Garmin já tem treinos de outro plano do Time Híbrido (S01 · …), escreva um prefixo em "Prefixo nos nomes" (ex.: 3K) antes de enviar, para os planos não se misturarem. O envio não mexe em treino de mesmo nome com outro conteúdo.');
    if (semPar.size) itens.push(`${semPar.size} exercício${semPar.size > 1 ? 's' : ''} sem par no catálogo do Garmin (${[...semPar].slice(0, 4).join(', ')}${semPar.size > 4 ? '…' : ''}): abra o treino com ⚠ e clique em "escolher".`);
    box.hidden = false;
    box.className = 'relatorio' + (itens.length ? ' alerta' : '');
    box.innerHTML = `
      <button class="btn-x" data-fechar-relatorio aria-label="Fechar aviso">×</button>
      <b>PDF lido${r.plano ? ` (${esc(r.plano)})` : ''}:</b> ${r.semanas} semanas · ${nC} corridas · ${nM} treinos de musculação (${r.paginas} páginas).
      A semana 1 começa na segunda <b>${fmtData(S.config.inicio, false)}</b> (mude no campo acima se for outra data).
      A leitura é automática — confira os treinos antes de enviar. <b>Baixar planilha</b> guarda tudo em .xlsx.
      ${itens.length ? `<ul>${itens.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
  }

  function renderConfig() {
    $('#config').hidden = false;
    $('#cfg-inicio').value = S.config.inicio || '';
    if (document.activeElement !== $('#cfg-prefixo')) $('#cfg-prefixo').value = S.config.prefixo || '';
    const [y, m, d] = (S.config.inicio || '').split('-').map(Number);
    const wd = S.config.inicio ? (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 : 0;
    $('#cfg-inicio-aviso').textContent = S.config.inicio && wd !== 0 ? `Atenção: ${fmtData(S.config.inicio)} não é segunda-feira.` : '';
    $('#cfg-dias').innerHTML = B.TREINOS.map((t) => `
      <label class="dia-musc"><b>${t}</b>
        <select data-treino="${t}" aria-label="Dia do treino ${t}">
          ${B.NOME_DIA.map((n, i) => `<option value="${i}" ${Number(S.config.diasMusc[t]) === i ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>`).join('');
    $$('#filtro button').forEach((b) => b.classList.toggle('ativo', b.dataset.f === UI.filtro));
    $('#cfg-passadas').checked = UI.esconderPassadas;
  }

  function etapaClasse(etapa) {
    const k = semAcento(etapa);
    return k.startsWith('cons') ? 'etapa-cons' : k.startsWith('alvo') ? 'etapa-alvo' : 'etapa-base';
  }

  function cartao(t) {
    const passado = t.data && t.data < hoje;
    const ehHoje = t.data === hoje;
    const sel = UI.sel.has(t.chave);
    const badges = [];
    if (ehHoje) badges.push('<span class="badge badge-hoje">hoje</span>');
    if (t.editado) badges.push('<span class="badge badge-editado">editado</span>');
    if (t.avisos.length) badges.push(`<span class="badge badge-aviso" title="${esc(t.avisos.join('\n'))}">⚠ ${t.avisos.length}</span>`);
    const tipo = t.tipo === 'corrida' ? 'Corrida' : `Musculação · ${esc(t.treino)}`;
    const meta = t.tipo === 'corrida' ? (t.duracaoMin ? `~${t.duracaoMin} min` : '') : esc(t.resumo);
    return `
      <article class="cartao ${t.tipo} ${passado ? 'passado' : ''} ${sel ? 'sel' : ''} ${t.bloqueado ? 'bloqueado' : ''}" data-chave="${esc(t.chave)}">
        <label class="cartao-check" title="Selecionar para enviar">
          <input type="checkbox" data-sel="${esc(t.chave)}" ${sel ? 'checked' : ''} ${t.bloqueado ? 'disabled' : ''}>
        </label>
        <button class="cartao-corpo" data-abrir="${esc(t.chave)}">
          <span class="cartao-data">${fmtData(t.data)} <span class="cartao-tipo">${tipo}</span></span>
          <span class="cartao-nome">${esc(t.nome)}</span>
          <span class="cartao-resumo">${t.tipo === 'corrida' ? esc(t.resumo) : ''}</span>
          <span class="cartao-meta">${meta}${badges.join('')}</span>
        </button>
      </article>`;
  }

  function renderSemanas() {
    const alvo = $('#semanas');
    const porSemana = new Map();
    for (const t of D.treinos) {
      if (UI.filtro !== 'tudo' && t.tipo !== UI.filtro) continue;
      if (!porSemana.has(t.semana)) porSemana.set(t.semana, []);
      porSemana.get(t.semana).push(t);
    }
    if (!porSemana.size) { alvo.innerHTML = '<div class="vazio"><p class="vazio-titulo">Nenhum treino nesse filtro.</p></div>'; return; }
    let html = '';
    for (const sem of [...porSemana.keys()].sort((a, b) => a - b)) {
      const ts = porSemana.get(sem);
      const datas = ts.map((t) => t.data).filter(Boolean).sort();
      const passou = datas.length && datas[datas.length - 1] < hoje;
      if (UI.esconderPassadas && passou) continue;
      const atual = datas.length && datas[0] <= hoje && hoje <= datas[datas.length - 1];
      const etapa = ts.find((t) => t.etapa)?.etapa || '';
      const selecionaveis = ts.filter((t) => !t.bloqueado);
      const nSel = selecionaveis.filter((t) => UI.sel.has(t.chave)).length;
      html += `
        <section class="semana ${passou ? 'semana-passada' : ''} ${atual ? 'semana-atual' : ''}" id="semana-${sem}">
          <header class="semana-topo">
            <h2>Semana ${String(sem).padStart(2, '0')}</h2>
            ${etapa ? `<span class="etapa ${etapaClasse(etapa)}">${esc(etapa)}</span>` : ''}
            ${atual ? '<span class="etapa etapa-agora">semana atual</span>' : ''}
            <span class="semana-datas">${datas.length ? `${fmtData(datas[0])} – ${fmtData(datas[datas.length - 1])}` : ''}</span>
            <label class="semana-sel">
              <input type="checkbox" data-semana="${sem}" ${nSel && nSel === selecionaveis.length ? 'checked' : ''} ${nSel && nSel < selecionaveis.length ? 'data-meio="1"' : ''}>
              selecionar semana
            </label>
          </header>
          <div class="cartoes">${ts.map(cartao).join('')}</div>
        </section>`;
    }
    alvo.innerHTML = html || '<div class="vazio"><p class="vazio-titulo">Todas as semanas desse filtro já passaram.</p></div>';
    $$('input[data-meio]', alvo).forEach((i) => (i.indeterminate = true));
  }

  // ---------------------------------------------------------------------
  // Painel de envio
  // ---------------------------------------------------------------------
  function selecionados() { return D.treinos.filter((t) => UI.sel.has(t.chave) && !t.bloqueado); }

  function renderEnvio() {
    $('#envio').hidden = false;
    const sel = selecionados();
    const nC = sel.filter((t) => t.tipo === 'corrida').length;
    const nE = sel.filter((t) => t.editado).length;
    $('#contagem').innerHTML = sel.length
      ? `<b>${sel.length}</b> treino${sel.length > 1 ? 's' : ''} selecionado${sel.length > 1 ? 's' : ''} <span>${nC} corrida · ${sel.length - nC} musculação${nE ? ` · ${nE} editado${nE > 1 ? 's' : ''}` : ''}</span>`
      : 'Nenhum treino selecionado. Marque os cartões ou use um atalho:';
    const comAviso = sel.filter((t) => t.avisos.length);
    const passados = sel.filter((t) => t.data && t.data < hoje);
    const avisos = [];
    const datasDe = (c) => JSON.stringify([c && c.inicio, c && c.diasMusc]);
    const configMudou = datasDe(S.config) !== datasDe(S.configOriginal);
    if (UI.envio.agendar === 'manter' && (configMudou || sel.some((t) => t.diaMudou))) {
      avisos.push('Você mudou datas aqui. Com "Manter as datas", o que já está no Garmin fica onde está — para mover, escolha "Colocar na data do plano".');
    }
    if (passados.length) avisos.push(`${passados.length} selecionado${passados.length > 1 ? 's são' : ' é'} de data que já passou.`);
    if (comAviso.length) avisos.push(`${comAviso.length} com aviso (exercício sem par no De-para fica de fora do treino).`);
    const bloq = D.treinos.filter((t) => t.bloqueado).length;
    if (bloq) avisos.push(`${bloq} treino${bloq > 1 ? 's' : ''} com problema não ${bloq > 1 ? 'podem' : 'pode'} ser enviado${bloq > 1 ? 's' : ''} — veja o ⚠ no cartão.`);
    $('#avisos-envio').textContent = avisos.join(' ');
    $('#btn-gerar').disabled = !sel.length;
    $('#btn-gerar').textContent = UI.envio.simular ? 'Gerar script de simulação' : 'Gerar script';
    $(`input[name="agendar"][value="${UI.envio.agendar}"]`).checked = true;
    $(`input[name="existente"][value="${UI.envio.existente}"]`).checked = true;
    $('#simular').checked = UI.envio.simular;
    renderScript();
  }

  function invalidarScript() { UI.script = null; renderScript(); }

  function renderScript() {
    const box = $('#script');
    if (!UI.script) { box.hidden = true; return; }
    box.hidden = false;
    const kb = Math.max(1, Math.round(UI.script.bytes / 1024));
    $('#script-info').textContent = `${UI.script.n} treino${UI.script.n > 1 ? 's' : ''} · ${kb} KB${UI.script.opcoes.simular ? ' · simulação' : ''}`;
  }

  async function gerar() {
    const sel = selecionados();
    if (!sel.length) return;
    const itens = sel.map((t) => ({
      k: t.chave, nome: t.nome, antigos: t.nomeAntigo ? [t.nomeAntigo] : [],
      data: t.data, editado: !!t.editado, payload: t.payload,
    }));
    try {
      const r = await U.gerarScript(itens, UI.envio);
      UI.script = { ...r, n: itens.length };
      renderScript();
      $('#script').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      console.error(e);
      toast('Não consegui gerar o script: ' + e.message, 5000);
    }
  }

  async function copiarTexto(texto, msg) {
    try { await navigator.clipboard.writeText(texto); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = texto; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    toast(msg);
  }

  async function copiarScript() {
    if (!UI.script) return;
    try { await navigator.clipboard.writeText(UI.script.codigo); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = UI.script.codigo; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    toast('Script copiado. Agora cole no Console da aba do Garmin.');
  }

  function baixarScript() {
    if (!UI.script) return;
    const blob = new Blob([UI.script.codigo], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `th_envio_${hoje}${UI.script.opcoes.simular ? '_simulacao' : ''}.js`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------------------------------------------------------------
  // Editor (gaveta)
  // ---------------------------------------------------------------------
  function abrir(chave) {
    const t = D.porChave.get(chave);
    if (!t) return;
    UI.aberto = chave;
    $('#gaveta').hidden = false;
    document.body.classList.add('sem-rolagem');
    renderGaveta(true);
  }

  function fechar() {
    UI.aberto = null;
    $('#gaveta').hidden = true;
    document.body.classList.remove('sem-rolagem');
  }

  function linhaCorrida(t) { return S.atual.corrida.find((r) => 'c|' + r._id === t.chave); }
  function linhasMusc(t) { return S.atual.musculacao.filter((r) => Number(r.semana) === t.semana && String(r.treino).trim().toUpperCase() === t.treino); }

  function renderGaveta(inteira) {
    const t = D.porChave.get(UI.aberto);
    if (!t) { fechar(); return; }
    $('#gaveta-sub').innerHTML = `${t.tipo === 'corrida' ? 'Corrida' : 'Musculação'} · ${fmtData(t.data)} · semana ${t.semana}${t.etapa ? ' · ' + esc(t.etapa) : ''}`;
    $('#gaveta-titulo').textContent = t.nome;
    $('#gaveta').querySelector('.gaveta-painel').className = `gaveta-painel ${t.tipo}`;
    if (inteira) $('#gaveta-corpo').innerHTML = t.tipo === 'corrida' ? formCorrida(t) : formMusc(t);
    renderPrevia(t);
  }

  function opcoes(lista, atual) {
    const vals = lista.includes(atual) || vazio(atual) ? lista : [atual, ...lista];
    return vals.map((v) => `<option value="${esc(v)}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  function formCorrida(t) {
    const r = linhaCorrida(t);
    const tipo = B.tipoCorrida(r) || 'intervalado';
    const zonas = (nome, v) => `<select data-campo="${nome}">${[1, 2, 3, 4, 5].map((z) => `<option value="${z}" ${Number(v) === z ? 'selected' : ''}>Z${z}</option>`).join('')}</select>`;
    const n = (campo, rot, passo = 1, sufixo = 'min') => `
      <label class="campo"><span>${rot}</span>
        <span class="com-sufixo"><input type="number" min="0" step="${passo}" data-campo="${campo}" value="${esc(r[campo])}"><i>${sufixo}</i></span>
      </label>`;
    return `
      <div class="form-grade">
        <label class="campo"><span>Dia</span><select data-campo="dia">${opcoes(B.ROTULOS_DIA, r.dia)}</select></label>
        <label class="campo"><span>Etapa</span><input data-campo="etapa" value="${esc(r.etapa)}" list="dl-etapas"></label>
        <div class="campo campo-largo"><span>Tipo</span>
          <div class="segmentado" data-campo-tipo>
            ${['intervalado', 'contínuo', 'prova'].map((k) => `<button type="button" data-tipo="${k}" class="${semAcento(k) === semAcento(tipo) ? 'ativo' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}
          </div>
        </div>
        ${n('aquecimento_min', 'Aquecimento')}
        ${tipo === 'intervalado' ? `
          <label class="campo"><span>Repetições</span><input type="number" min="1" step="1" data-campo="reps" value="${esc(r.reps)}"></label>
          ${n('esforco_min', 'Esforço', 0.5)}
          <label class="campo"><span>Zona do esforço</span>${zonas('esforco_zona', r.esforco_zona ?? 3)}</label>
          ${n('recuperacao_min', 'Recuperação', 0.5)}
          <label class="campo"><span>Zona da recuperação</span>${zonas('recuperacao_zona', r.recuperacao_zona ?? 1)}</label>` : ''}
        ${tipo === 'continuo' ? `
          ${n('esforco_min', 'Duração', 1)}
          <label class="campo"><span>Zona</span>${zonas('esforco_zona', r.esforco_zona ?? 3)}</label>` : ''}
        ${tipo === 'prova' ? `
          ${n('distancia_km', 'Distância', 0.5, 'km')}
          <label class="campo"><span>Zona</span>${zonas('esforco_zona', r.esforco_zona ?? 4)}</label>` : ''}
        ${n('desaquecimento_min', 'Desaquecimento')}
        <label class="campo campo-largo"><span>Notas <small>(vão na descrição, aparecem no relógio)</small></span>
          <textarea data-campo="notas" rows="2">${esc(r.notas)}</textarea></label>
      </div>
      <datalist id="dl-etapas">${Object.values(ETAPAS).map((e) => `<option value="${e}">`).join('')}</datalist>
      <div id="previa"></div>
      <div class="gaveta-rodape">
        <button class="btn btn-claro" data-restaurar>Restaurar original</button>
        <button class="btn btn-escuro" data-fechar>Pronto</button>
      </div>`;
  }

  function formMusc(t) {
    const rows = linhasMusc(t);
    const aq = rows.find((r) => vazio(r.series) || !Number(r.series));
    const grupo = rows[0] ? rows[0].grupo : '';
    const dp = mapaDepara(S.atual.depara);
    const linhas = rows.filter((r) => r !== aq);
    let ultimoBloco = null, faixa = false;
    const tr = linhas.map((r) => {
      if (String(r.bloco) !== ultimoBloco) { faixa = !faixa; ultimoBloco = String(r.bloco); }
      const up = String(r.exercicio || '').trim().toUpperCase();
      const m = dp[up] || dp['~' + B.chaveSolta(up)];
      const garmin = m && m.cat && m.ex
        ? `<button class="chip" data-mapa="${esc(r._id)}" title="Trocar o exercício do Garmin (vale para todos os treinos com esse nome)">${esc(m.ex.replace(/_/g, ' ').toLowerCase())}</button>`
        : `<button class="chip chip-aviso" data-mapa="${esc(r._id)}">⚠ escolher</button>`;
      return `
        <tr class="${faixa ? 'faixa' : ''}" data-id="${esc(r._id)}">
          <td><input type="number" min="1" step="1" data-mc="bloco" value="${esc(r.bloco)}" class="estreito" aria-label="Bloco"></td>
          <td><input data-mc="tecnica" value="${esc(r.tecnica)}" list="dl-tecnicas" aria-label="Técnica"></td>
          <td><input data-mc="exercicio" value="${esc(r.exercicio)}" list="dl-exercicios" class="largo" aria-label="Exercício"></td>
          <td class="td-garmin">${garmin}</td>
          <td><input type="number" min="1" step="1" data-mc="series" value="${esc(r.series)}" class="estreito" aria-label="Séries"></td>
          <td><input data-mc="reps" value="${esc(r.reps)}" class="medio" aria-label="Repetições"></td>
          <td><input type="number" min="0" step="5" data-mc="descanso_seg" value="${esc(r.descanso_seg)}" class="estreito" aria-label="Descanso em segundos"></td>
          <td class="td-acoes">
            <button data-mover="-1" data-id="${esc(r._id)}" title="Subir" aria-label="Subir">↑</button>
            <button data-mover="1" data-id="${esc(r._id)}" title="Descer" aria-label="Descer">↓</button>
            <button data-remover="${esc(r._id)}" title="Remover" aria-label="Remover">✕</button>
          </td>
        </tr>
        <tr class="tr-mapa" data-mapa-de="${esc(r._id)}" hidden><td colspan="8"></td></tr>`;
    }).join('');
    return `
      <div class="form-grade">
        <label class="campo campo-largo"><span>Grupo</span><select data-grupo>${opcoes(GRUPOS, grupo)}</select></label>
        <label class="campo campo-check campo-largo">
          <input type="checkbox" data-aquec ${aq ? 'checked' : ''}>
          <span>Aquecimento automático <small>(${B.ROTULO_AQUEC[B.tipoAquecimento(grupo)]} — o bloco fixo dos treinos montados à mão)</small></span>
        </label>
      </div>
      <p class="dica">Mesmo número de <b>bloco</b> = bi-set/super-set (troca de aparelho no botão Lap). Reps: <code>15</code> · <code>6 / 12</code> (dois pesos na mesma série) · <code>(15-12-10-8-6)</code> (pirâmide).</p>
      <div class="tabela-rolagem">
        <table class="tabela-musc">
          <thead><tr><th>Bloco</th><th>Técnica</th><th>Exercício</th><th>Garmin</th><th>Séries</th><th>Reps</th><th>Desc. (s)</th><th></th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
      <button class="btn btn-claro btn-add" data-adicionar>+ Exercício</button>
      <div id="previa"></div>
      <div class="gaveta-rodape">
        <button class="btn btn-claro" data-restaurar>Restaurar original</button>
        <button class="btn btn-escuro" data-fechar>Pronto</button>
      </div>`;
  }

  function renderPrevia(t) {
    const alvo = $('#previa');
    if (!alvo) return;
    const linhas = B.estrutura(t.payload);
    const passo = (l) => `<li class="p-${esc(l.tipo)}"><span>${esc(l.texto)}</span>${l.nota ? `<small>${esc(l.nota)}</small>` : ''}</li>`;
    const corpo = linhas.map((l) => (l.tipo === 'repeat'
      ? `<li class="p-repeat"><b>${l.series}×</b><ol>${l.filhos.map(passo).join('')}</ol></li>`
      : passo(l))).join('');
    const avisos = t.avisos.length ? `<ul class="avisos">${t.avisos.map((a) => `<li>⚠ ${esc(a)}</li>`).join('')}</ul>` : '';
    const b = D.base.get(t.chave);
    const novoDia = t.diaMudou ? `<p class="renome">O dia mudou de <b>${esc(b.dia)}</b> para <b>${esc(t.dia)}</b>. Para mover no Garmin, envie com "Colocar na data do plano".</p>` : '';
    const renome = t.nomeAntigo ? `<p class="renome">O nome mudou de <b>${esc(t.nomeAntigo)}</b> para <b>${esc(t.nome)}</b>. No envio, o treino antigo é substituído por este.</p>` : '';
    alvo.innerHTML = `
      <h3>Como fica no relógio ${t.editado ? '<span class="badge badge-editado">editado</span>' : ''}</h3>
      ${avisos}${renome}${novoDia}
      ${t.payload ? `<p class="descricao">${esc(t.payload.description).replace(/\n/g, '<br>')}</p><ol class="estrutura">${corpo}</ol>` : '<p class="nota">Corrija os avisos para montar o treino.</p>'}`;
  }

  // edição -> estado
  function aplicouEdicao(redesenharGaveta) {
    recalcular();
    salvar();
    invalidarScript();
    renderRelatorio();
    renderFonte();
    renderSemanas();
    renderEnvio();
    if (UI.aberto) {
      // a chave da corrida é estável (_id); a da musculação é semana+letra
      renderGaveta(redesenharGaveta);
    }
  }

  function numOuNulo(v) { return v === '' || v === null ? null : Number(v); }

  function editarCorrida(campo, valor) {
    const t = D.porChave.get(UI.aberto);
    const r = linhaCorrida(t);
    const numericos = ['aquecimento_min', 'reps', 'esforco_min', 'esforco_zona', 'recuperacao_min', 'recuperacao_zona', 'desaquecimento_min', 'distancia_km'];
    r[campo] = numericos.includes(campo) ? numOuNulo(valor) : valor;
    aplicouEdicao(false);
  }

  function trocarTipoCorrida(tipo) {
    const t = D.porChave.get(UI.aberto);
    const r = linhaCorrida(t);
    r.tipo = tipo;
    if (tipo === 'intervalado') {
      r.reps = r.reps || 6; r.esforco_min = r.esforco_min || 4; r.recuperacao_min = r.recuperacao_min || 1;
      r.esforco_zona = r.esforco_zona || 3; r.recuperacao_zona = r.recuperacao_zona || 1; r.distancia_km = null;
    } else if (tipo === 'contínuo') {
      r.esforco_min = r.esforco_min || 20; r.esforco_zona = r.esforco_zona || 3;
      r.reps = null; r.recuperacao_min = null; r.recuperacao_zona = null; r.distancia_km = null;
    } else {
      r.distancia_km = r.distancia_km || 5; r.esforco_zona = 4;
      r.reps = null; r.esforco_min = null; r.recuperacao_min = null; r.recuperacao_zona = null;
    }
    aplicouEdicao(true);
  }

  function editarMusc(id, campo, valor) {
    const r = S.atual.musculacao.find((x) => x._id === id);
    if (!r) return;
    r[campo] = ['bloco', 'series', 'descanso_seg'].includes(campo) ? numOuNulo(valor) : valor;
    // troca de exercício redesenha a tabela (o chip do Garmin muda); o resto só a prévia
    aplicouEdicao(campo === 'exercicio');
  }

  function novoId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function adicionarExercicio() {
    const t = D.porChave.get(UI.aberto);
    const rows = linhasMusc(t);
    const ult = rows[rows.length - 1];
    const blocoMax = Math.max(0, ...rows.map((r) => Number(r.bloco) || 0));
    const nova = {
      _id: novoId(), semana: t.semana, treino: t.treino, grupo: rows[0] ? rows[0].grupo : t.grupo, bloco: blocoMax + 1,
      tecnica: 'META DE REPETIÇÃO', exercicio: '', series: 4, reps: '12', descanso_seg: 60, notas: null,
    };
    const idx = ult ? S.atual.musculacao.indexOf(ult) + 1 : S.atual.musculacao.length;
    S.atual.musculacao.splice(idx, 0, nova);
    aplicouEdicao(true);
    const inp = $(`tr[data-id="${nova._id}"] input[data-mc="exercicio"]`);
    if (inp) inp.focus();
  }

  function moverExercicio(id, dir) {
    const t = D.porChave.get(UI.aberto);
    const rows = linhasMusc(t);
    const i = rows.findIndex((r) => r._id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const a = S.atual.musculacao.indexOf(rows[i]), b = S.atual.musculacao.indexOf(rows[j]);
    [S.atual.musculacao[a], S.atual.musculacao[b]] = [S.atual.musculacao[b], S.atual.musculacao[a]];
    aplicouEdicao(true);
  }

  function removerExercicio(id) {
    const t = D.porChave.get(UI.aberto);
    if (linhasMusc(t).length <= 1) { toast('O treino precisa de pelo menos um exercício.'); return; }
    S.atual.musculacao = S.atual.musculacao.filter((r) => r._id !== id);
    aplicouEdicao(true);
  }

  function trocarGrupo(grupo) {
    const t = D.porChave.get(UI.aberto);
    linhasMusc(t).forEach((r) => (r.grupo = grupo));
    aplicouEdicao(true);
  }

  function alternarAquecimento(ligar) {
    const t = D.porChave.get(UI.aberto);
    const rows = linhasMusc(t);
    const aq = rows.find((r) => vazio(r.series) || !Number(r.series));
    if (ligar && !aq) {
      const grupo = rows[0] ? rows[0].grupo : '';
      const nova = {
        _id: novoId(), semana: t.semana, treino: t.treino, grupo, bloco: 1, tecnica: 'AQUECIMENTO',
        exercicio: B.tipoAquecimento(grupo) === 'inferiores' ? 'FLEXIBILIDADE E MOBILIDADE PRÉ TREINO DE INFERIORES' : 'AQUECIMENTO/MOBILIDADE PRÉ TREINO DE SUPERIORES',
        series: null, reps: null, descanso_seg: null, notas: null,
      };
      S.atual.musculacao.splice(S.atual.musculacao.indexOf(rows[0]), 0, nova);
    } else if (!ligar && aq) {
      S.atual.musculacao = S.atual.musculacao.filter((r) => r !== aq);
    }
    aplicouEdicao(true);
  }

  function restaurar() {
    const t = D.porChave.get(UI.aberto);
    if (t.tipo === 'corrida') {
      const atual = linhaCorrida(t);
      const orig = S.base.corrida.find((r) => r._id === atual._id);
      if (orig) S.atual.corrida[S.atual.corrida.indexOf(atual)] = clone(orig);
    } else {
      const rows = linhasMusc(t);
      const orig = S.base.musculacao.filter((r) => Number(r.semana) === t.semana && String(r.treino).trim().toUpperCase() === t.treino);
      const pos = rows.length ? S.atual.musculacao.indexOf(rows[0]) : S.atual.musculacao.length;
      S.atual.musculacao = S.atual.musculacao.filter((r) => !rows.includes(r));
      S.atual.musculacao.splice(Math.min(pos, S.atual.musculacao.length), 0, ...clone(orig));
    }
    aplicouEdicao(true);
    toast('Treino restaurado como está na planilha.');
  }

  // --- De-para (catálogo do Garmin) ---
  async function garantirCatalogo() {
    if (UI.catalogo) return UI.catalogo;
    try {
      const r = await fetch(CATALOGO);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      UI.catalogo = await r.json();
      $('#dl-catalogo').innerHTML = UI.catalogo.map((e) => `<option value="${esc(e.category)} / ${esc(e.key)}">`).join('');
    } catch (e) {
      UI.catalogo = [];
    }
    return UI.catalogo;
  }

  async function abrirMapa(id) {
    const r = S.atual.musculacao.find((x) => x._id === id);
    const tr = $(`tr[data-mapa-de="${id}"]`);
    if (!r || !tr) return;
    if (!tr.hidden) { tr.hidden = true; return; }
    const nome = String(r.exercicio || '').trim();
    if (!nome) { toast('Escreva o nome do exercício primeiro.'); return; }
    const cat = await garantirCatalogo();
    const mapa = mapaDepara(S.atual.depara);
    const atual = mapa[nome.toUpperCase()] || mapa['~' + B.chaveSolta(nome)];
    tr.hidden = false;
    tr.firstElementChild.innerHTML = cat.length
      ? `<div class="mapa">
          <label>Exercício do Garmin para <b>${esc(nome)}</b>
            <input list="dl-catalogo" data-mapa-input="${esc(id)}" placeholder="digite em inglês: squat, curl, press…" value="${atual && atual.cat ? esc(atual.cat + ' / ' + atual.ex) : ''}">
          </label>
          <small>Vale para todos os treinos com esse exercício. Fica salvo na aba De-para.</small>
        </div>`
      : `<div class="mapa"><small>O catálogo de exercícios (${CATALOGO}) só abre quando a página está num servidor (GitHub Pages ou <code>py -m http.server</code>). Por enquanto, ajuste na aba De-para da planilha.</small></div>`;
    const inp = tr.querySelector('input');
    if (inp) inp.focus();
  }

  function definirMapa(id, valor) {
    const r = S.atual.musculacao.find((x) => x._id === id);
    const m = String(valor).split('/').map((s) => s.trim());
    if (!r || m.length !== 2) return;
    const [cat, ex] = m;
    if (UI.catalogo && UI.catalogo.length && !UI.catalogo.some((e) => e.category === cat && e.key === ex)) { toast('Esse exercício não está no catálogo do Garmin.'); return; }
    const pt = String(r.exercicio).trim().toUpperCase();
    let d = S.atual.depara.find((x) => String(x.exercicio_pt || '').trim().toUpperCase() === pt);
    if (!d) { d = { exercicio_pt: pt, obs: 'definido na UI' }; S.atual.depara.push(d); }
    d.garmin_category = cat;
    d.garmin_exercise = ex;
    d.garmin_label = ex.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    d.confianca = 'manual';
    preencherListas();
    aplicouEdicao(true);
    toast(`${pt} → ${d.garmin_label}`);
  }

  // ---------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------
  function ligarEventos() {
    $('#arquivo').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (D.treinos.some((t) => t.editado) && !confirm('Abrir outro arquivo descarta as edições feitas aqui. Continuar?')) return;
      abrirArquivo(f);
    });
    $('#relatorio').addEventListener('click', (e) => {
      if (!e.target.closest('[data-fechar-relatorio]')) return;
      if (S && S.relatorio) { S.relatorio.visivel = false; salvar(); }
      renderRelatorio();
    });

    // doação
    $('#pix-chave').textContent = PIX.exibir;
    const qr = $('#pix-qr');
    qr.addEventListener('error', () => { $('#pix-qr-box').hidden = true; });
    qr.src = PIX.qr;
    if (PIX.copiaECola) { $('#pix-cc').textContent = PIX.copiaECola; $('#pix-cc-box').hidden = false; }
    if (PIX.recebedor) { $('#pix-recebedor').textContent = `Recebedor: ${PIX.recebedor}`; $('#pix-recebedor').hidden = false; }
    $('#btn-apoiar').addEventListener('click', () => $('#doacao').showModal());
    $('#doacao').addEventListener('click', (e) => { if (e.target === $('#doacao')) $('#doacao').close(); }); // clique fora fecha
    $('#btn-copiar-chave').addEventListener('click', () => copiarTexto(PIX.chave, 'Chave Pix copiada. Obrigado pelo apoio!'));
    $('#btn-copiar-cc').addEventListener('click', () => copiarTexto(PIX.copiaECola, 'Código Pix copiado — cole no app do banco.'));
    $('#btn-baixar').addEventListener('click', baixarPlanilha);
    $('#btn-recarregar').addEventListener('click', async () => {
      $('.menu').open = false;
      if (D.treinos.some((t) => t.editado) && !confirm('Recarregar a planilha do projeto descarta as edições feitas aqui. Continuar?')) return;
      try { iniciar(await carregarDoProjeto()); toast('Planilha do projeto recarregada.'); }
      catch (err) { toast('Não consegui abrir ' + PLANILHA_PROJETO + ' (' + err.message + ').', 5000); }
    });
    $('#btn-descartar').addEventListener('click', () => {
      $('.menu').open = false;
      if (!confirm('Descartar todas as edições e voltar ao que está na planilha?')) return;
      S.atual = clone(S.base);
      aplicouEdicao(true);
      toast('Edições descartadas.');
    });

    $('#cfg-inicio').addEventListener('change', (e) => { S.config.inicio = e.target.value; salvar(); recalcular(); renderTudo(); });
    // o prefixo muda o nome de todos — a base acompanha, para isso não contar como edição
    $('#cfg-prefixo').addEventListener('input', (e) => {
      S.config.prefixo = e.target.value.trim().toUpperCase().replace(/[^\p{L}\p{N}\-_.]/gu, '');
      salvar(); recalcularBase(); recalcular(); invalidarScript(); renderTudo();
    });
    $('#cfg-dias').addEventListener('change', (e) => {
      const s = e.target.closest('select[data-treino]');
      if (!s) return;
      S.config.diasMusc[s.dataset.treino] = Number(s.value);
      salvar(); recalcular(); renderTudo();
    });
    $('#filtro').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      UI.filtro = b.dataset.f;
      renderConfig(); renderSemanas();
    });
    $('#cfg-passadas').addEventListener('change', (e) => { UI.esconderPassadas = e.target.checked; renderSemanas(); });

    $('#semanas').addEventListener('change', (e) => {
      const c = e.target.closest('input[data-sel]');
      if (c) {
        c.checked ? UI.sel.add(c.dataset.sel) : UI.sel.delete(c.dataset.sel);
        c.closest('.cartao').classList.toggle('sel', c.checked);
        invalidarScript(); renderSemanas(); renderEnvio();
        return;
      }
      const s = e.target.closest('input[data-semana]');
      if (s) {
        const sem = Number(s.dataset.semana);
        D.treinos.filter((t) => t.semana === sem && !t.bloqueado && (UI.filtro === 'tudo' || t.tipo === UI.filtro))
          .forEach((t) => (s.checked ? UI.sel.add(t.chave) : UI.sel.delete(t.chave)));
        invalidarScript(); renderSemanas(); renderEnvio();
      }
    });
    $('#semanas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-abrir]');
      if (b) abrir(b.dataset.abrir);
    });

    $('.presets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      selecionar(b.dataset.p);
      invalidarScript(); renderSemanas(); renderEnvio();
    });
    $('#envio').addEventListener('change', (e) => {
      if (e.target.name === 'agendar') UI.envio.agendar = e.target.value;
      else if (e.target.name === 'existente') UI.envio.existente = e.target.value;
      else if (e.target.id === 'simular') UI.envio.simular = e.target.checked;
      else return;
      invalidarScript(); renderEnvio();
    });
    $('#btn-gerar').addEventListener('click', gerar);
    $('#btn-copiar').addEventListener('click', copiarScript);
    $('#btn-baixar-js').addEventListener('click', baixarScript);

    // gaveta
    const g = $('#gaveta');
    g.addEventListener('click', (e) => {
      if (e.target.closest('[data-fechar]')) { fechar(); return; }
      const tipo = e.target.closest('[data-tipo]');
      if (tipo) { trocarTipoCorrida(tipo.dataset.tipo); return; }
      if (e.target.closest('[data-restaurar]')) { restaurar(); return; }
      if (e.target.closest('[data-adicionar]')) { adicionarExercicio(); return; }
      const mv = e.target.closest('[data-mover]');
      if (mv) { moverExercicio(mv.dataset.id, Number(mv.dataset.mover)); return; }
      const rm = e.target.closest('[data-remover]');
      if (rm) { removerExercicio(rm.dataset.remover); return; }
      const mp = e.target.closest('[data-mapa]');
      if (mp) { abrirMapa(mp.dataset.mapa); }
    });
    g.addEventListener('input', (e) => {
      const c = e.target.closest('[data-campo]');
      if (c && c.tagName !== 'SELECT') { editarCorrida(c.dataset.campo, c.value); return; }
      const m = e.target.closest('[data-mc]');
      if (m && m.dataset.mc !== 'exercicio') editarMusc(m.closest('tr').dataset.id, m.dataset.mc, m.value);
    });
    g.addEventListener('change', (e) => {
      const c = e.target.closest('select[data-campo]');
      if (c) { editarCorrida(c.dataset.campo, c.value); return; }
      const m = e.target.closest('input[data-mc="exercicio"]');
      if (m) { editarMusc(m.closest('tr').dataset.id, 'exercicio', m.value.trim().toUpperCase()); return; }
      const gr = e.target.closest('select[data-grupo]');
      if (gr) { trocarGrupo(gr.value); return; }
      const aq = e.target.closest('input[data-aquec]');
      if (aq) { alternarAquecimento(aq.checked); return; }
      const mi = e.target.closest('input[data-mapa-input]');
      if (mi) definirMapa(mi.dataset.mapaInput, mi.value);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI.aberto) fechar(); });
  }

  // ---------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------
  function preencherListas() {
    $('#dl-exercicios').innerHTML = [...new Set(S.atual.depara.map((d) => String(d.exercicio_pt || '').trim()).filter(Boolean))]
      .sort().map((n) => `<option value="${esc(n)}">`).join('');
    const tec = new Set([...TECNICAS, ...S.atual.musculacao.map((r) => String(r.tecnica || '').trim()).filter(Boolean)]);
    $('#dl-tecnicas').innerHTML = [...tec].map((n) => `<option value="${esc(n)}">`).join('');
  }

  function renderTudo() {
    renderRelatorio();
    renderFonte();
    renderConfig();
    renderSemanas();
    renderEnvio();
  }

  function iniciar(estado, opcoes = {}) {
    S = estado;
    S.config = { ...clone(CONFIG_PADRAO), ...(S.config || {}) };
    S.config.diasMusc = { ...CONFIG_PADRAO.diasMusc, ...(S.config.diasMusc || {}) };
    if (!S.configOriginal) S.configOriginal = clone(S.config);
    salvar();
    recalcularBase();
    recalcular();
    selecionar('futuro');
    preencherListas();
    invalidarScript();
    renderTudo();
    const atual = $('.semana-atual');
    if (atual && opcoes.rolar !== false) setTimeout(() => atual.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  function semPlanilha(motivo) {
    $('#semanas').innerHTML = `
      <div class="vazio">
        <p class="vazio-titulo">Abra o seu plano</p>
        <p>${esc(motivo)}</p>
        <label class="btn btn-escuro"><input type="file" accept=".pdf,.xlsx,.xlsm" hidden id="arquivo-vazio">Escolher o PDF do Time Híbrido ou a planilha</label>
        <p class="nota">O arquivo é lido aqui no seu navegador — nada é enviado para lugar nenhum.</p>
      </div>`;
    $('#arquivo-vazio').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) abrirArquivo(f);
    });
  }

  async function boot() {
    ligarEventos();
    if (typeof XLSX === 'undefined') { semPlanilha('A biblioteca de planilhas não carregou (sem internet?). Recarregue a página.'); return; }
    const salvo = carregarSalvo();
    if (salvo) { iniciar(salvo); return; }
    try { iniciar(await carregarDoProjeto()); }
    catch (e) {
      semPlanilha(location.protocol === 'file:'
        ? 'Aberta direto do disco, a página não consegue ler data/time_hibrido.xlsx sozinha. Escolha o PDF do plano ou a planilha abaixo (ou rode py -m http.server na pasta).'
        : `Não achei ${PLANILHA_PROJETO} no projeto.`);
    }
  }

  boot();
})();
