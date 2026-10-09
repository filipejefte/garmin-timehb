/**
 * Time Híbrido → Garmin · leitura do PDF do plano no navegador
 * ============================================================
 * Port do pdf_para_planilha.py (pdfplumber) para pdf.js. Tudo roda no
 * navegador — o PDF não sai da sua máquina.
 *
 *   PDF → linhas de texto por página → páginas de CORRIDA (blocos
 *   "INTERVALADO 4:2" / "CONTÍNUO 20 MIN" / "PROVA") e de MUSCULAÇÃO
 *   ("TREINO A" + "BLOCO 01 - BI-SET" + "4X 15 SUPINO…") → as mesmas linhas
 *   das abas Corrida e Musculação da planilha.
 *
 * Diferença do Python: em vez de páginas fixas (10, 17, 24…), cada página de
 * corrida abre uma semana e as páginas de musculação seguintes entram nela —
 * assim funciona também com PDFs com outra quantidade de páginas de abertura.
 *
 * A leitura é heurística: depois de abrir, confira os treinos na página.
 */
(function (raiz) {
  'use strict';

  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  function carregarPdfJs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PDFJS;
      s.onload = () => {
        if (!raiz.pdfjsLib) { erro(new Error('pdf.js não carregou')); return; }
        raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        ok(raiz.pdfjsLib);
      };
      s.onerror = () => erro(new Error('não consegui baixar o leitor de PDF (sem internet?)'));
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------------
  // Texto: itens do pdf.js → linhas (como o extract_text do pdfplumber)
  // ---------------------------------------------------------------------
  const TOL_Y = 3;     // mesma tolerância vertical do pdfplumber
  const TOL_X = 2.5;   // distância a partir da qual entra um espaço entre trechos

  function linhasDaPagina(itens) {
    const its = itens
      .filter((i) => i.str && i.str.trim() !== '')
      .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos = [];
    for (const it of its) {
      const g = grupos.length ? grupos[grupos.length - 1] : null;
      if (g && Math.abs(g.y - it.y) <= TOL_Y) g.itens.push(it);
      else grupos.push({ y: it.y, itens: [it] });
    }
    return grupos.map((g) => {
      g.itens.sort((a, b) => a.x - b.x);
      let txt = '', fim = null;
      for (const it of g.itens) {
        if (fim !== null && it.x - fim > TOL_X && !/\s$/.test(txt) && !/^\s/.test(it.s)) txt += ' ';
        txt += it.s;
        fim = it.x + it.w;
      }
      return txt.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
  }

  async function extrairPaginas(buf, aoProgresso) {
    const pdfjs = await carregarPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n);
      const tc = await pg.getTextContent();
      paginas.push({ n, linhas: linhasDaPagina(tc.items) });
      if (aoProgresso) aoProgresso(n, doc.numPages);
    }
    return paginas;
  }

  // ---------------------------------------------------------------------
  // Corrida — parse_running_page
  // ---------------------------------------------------------------------
  function diaDe(s) {
    const m = s.match(/([2-6])\s*ª/);
    if (m) return m[1] + 'ª';
    if (/S[ÁA]B/.test(s)) return 'Sáb';
    if (/DOM/.test(s)) return 'Dom';
    return null;
  }

  const ints = (s) => (s.match(/\d+/g) || []).map(Number);

  // Unidades da linha de durações: "MIN SEG SEG MIN", "MIN KM MIN"… ("3KM" grudado não conta)
  const RE_UNIDADE = /\b(MIN|SEG|KM)\b/g;
  const emMin = (v, u) => (u === 'SEG' ? +(v / 60).toFixed(4) : v);

  function parseCorrida(textoPagina) {
    // a legenda de zonas no rodapé ("FREQUÊNCIA CARDÍACA Z3 70%…") não é treino
    const corte = textoPagina.search(/FREQU[ÊE]NCIA\s+CARD[ÍI]ACA/);
    const texto = corte >= 0 ? textoPagina.slice(0, corte) : textoPagina;
    // os cabeçalhos consomem a duração do contínuo, para o "20 MIN" não poluir o corpo
    const re = /(INTERVALADO\s+\d+\s*:\s*\d+|CONT[IÍ]NUO\s+\d+\s*MIN|PROVA)/g;
    const heads = [...texto.matchAll(re)];
    const out = {};
    heads.forEach((h, i) => {
      const fimH = h.index + h[0].length;
      const fim = i + 1 < heads.length ? heads[i + 1].index : texto.length;
      const corpo = texto.slice(fimH, fim).split(/\s+/).filter(Boolean).join(' ');
      const dia = diaDe(corpo);
      if (!dia) return;
      const tipo = h[1];
      const counts = corpo.match(/(\d+)\s*x\s+(\d+)\s*x\s+(\d+)\s*x/);
      const zonas = [...corpo.matchAll(/Z\s*(\d)/g)].map((m) => Number(m[1]));
      const limpo = corpo.replace(/\d+\s*x/g, ' ').replace(/Z\s*\d/g, ' ').replace(/[2-6]\s*ª/g, ' ');

      // 1) PDF atual: números alinhados com a linha de unidades (MIN / SEG / KM)
      const unidades = [...limpo.matchAll(RE_UNIDADE)];
      let v = null;
      if (unidades.length) {
        const nums = ints(limpo.slice(0, unidades[0].index));
        const n = unidades.length;
        if (nums.length >= n) v = nums.slice(-n).map((x, j) => ({ x, u: unidades[j][1] }));
      }
      const zEsf = zonas.length >= 2 ? zonas[1] : null;
      if (tipo.startsWith('INTERVALADO') && counts && v && v.length === 4 && v[0].u !== 'KM') {
        out[dia] = {
          tipo: 'intervalado', aquecimento_min: emMin(v[0].x, v[0].u), reps: Number(counts[2]),
          esforco_min: emMin(v[1].x, v[1].u), esforco_zona: zEsf || 3,
          recuperacao_min: emMin(v[2].x, v[2].u), recuperacao_zona: zonas.length >= 3 ? zonas[2] : 1,
          desaquecimento_min: emMin(v[3].x, v[3].u), distancia_km: null,
        };
        return;
      }
      if (tipo.startsWith('CONT') && v && v.length === 3 && v.every((y) => y.u !== 'KM')) {
        out[dia] = {
          tipo: 'contínuo', aquecimento_min: emMin(v[0].x, v[0].u), reps: null,
          esforco_min: emMin(v[1].x, v[1].u), esforco_zona: zEsf || 3,
          recuperacao_min: null, recuperacao_zona: null, desaquecimento_min: emMin(v[2].x, v[2].u), distancia_km: null,
        };
        return;
      }
      if (tipo.startsWith('PROVA') && v && v.length === 3 && v[1].u === 'KM') {
        out[dia] = {
          tipo: 'prova', aquecimento_min: emMin(v[0].x, v[0].u), reps: null,
          esforco_min: null, esforco_zona: zEsf || 4, recuperacao_min: null, recuperacao_zona: null,
          desaquecimento_min: emMin(v[2].x, v[2].u), distancia_km: v[1].x,
        };
        return;
      }

      // 2) formato antigo (o do pdf_para_planilha.py): só minutos — os últimos k
      //    números antes do 1º "MIN", k = quantidade de MIN
      const k = (limpo.match(/MIN/g) || []).length;
      const fm = limpo.indexOf('MIN');
      const nums = ints(fm >= 0 ? limpo.slice(0, fm) : limpo);
      const mins = k && nums.length >= k ? nums.slice(-k) : nums;
      const kms = [...corpo.matchAll(/(\d+)\s*KM/g)].map((m) => Number(m[1]));
      if (tipo.startsWith('INTERVALADO') && counts && mins.length >= 4) {
        out[dia] = {
          tipo: 'intervalado', aquecimento_min: mins[0], reps: Number(counts[2]),
          esforco_min: mins[1], esforco_zona: zEsf || 3,
          recuperacao_min: mins[2], recuperacao_zona: zonas.length >= 3 ? zonas[2] : 1,
          desaquecimento_min: mins[3], distancia_km: null,
        };
      } else if (tipo.startsWith('CONT') && mins.length >= 3) {
        out[dia] = {
          tipo: 'contínuo', aquecimento_min: mins[0], reps: null,
          esforco_min: mins[1], esforco_zona: zEsf || 3,
          recuperacao_min: null, recuperacao_zona: null, desaquecimento_min: mins[2], distancia_km: null,
        };
      } else if (tipo.startsWith('PROVA') && kms.length) {
        out[dia] = {
          tipo: 'prova', aquecimento_min: mins.length ? mins[0] : 5, reps: null,
          esforco_min: null, esforco_zona: 4, recuperacao_min: null, recuperacao_zona: null,
          desaquecimento_min: mins.length ? mins[mins.length - 1] : 5, distancia_km: kms[0],
        };
      }
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // Musculação — parse_strength_page
  // ---------------------------------------------------------------------
  const normTec = (t) => t.replace(/\s*-\s*/g, '-').replace(/\bB\s+I-SET\b/g, 'BI-SET').trim();

  function parseMusculacao(linhas) {
    let treino = null, grupo = null;
    for (let i = 0; i < linhas.length; i++) {
      const m = linhas[i].match(/^TREINO\s+([A-E])\b/);
      if (m) { treino = m[1]; grupo = linhas[i + 1] || ''; break; }
    }
    if (!treino) return null;
    const exs = [];
    let bloco = null, tec = null;
    for (const l of linhas) {
      const mb = l.match(/^BLOCO\s+0?(\d+)\s*-\s*(.+)/);
      if (mb) { bloco = Number(mb[1]); tec = normTec(mb[2]); continue; }
      const me = l.match(/^(\d+)\s*X\s*(.+)$/i);
      if (me) {
        const series = Number(me[1]);
        // o PDF às vezes traz a letra O no lugar do zero: "4 X 1O BÍCEPS"
        const resto = me[2].replace(/(\d)O(?=[\s)]|$)/g, '$10');
        let repsBase = null;
        for (let pedaco of resto.split(/\s\+\s/)) {   // separa bi-set / super-set
          pedaco = pedaco.trim();
          let reps, nome, notas = null;
          // "( BULGARO 12 CADA PERNA )"
          const mp = pedaco.match(/^\(\s*(.+?)\s+(\d+)\s+CADA\s+(PERNA|LADO|BRA[ÇC]O)\s*\)$/);
          const mr = pedaco.match(/^([\d\s\-/()]*\d[\d\s\-/()]*)\s*([A-ZÀ-Ú].*)$/);
          if (mp) { nome = mp[1].trim(); reps = mp[2]; notas = 'cada ' + mp[3].toLowerCase(); if (repsBase === null) repsBase = reps; }
          else if (mr) { reps = mr[1].trim(); nome = mr[2].trim(); if (repsBase === null) repsBase = reps; }
          else { reps = repsBase || ''; nome = pedaco; }          // 2º exercício sem reps: herda
          exs.push({ bloco, tecnica: tec, exercicio: nome, series, reps, notas });
        }
      } else if (tec && tec.includes('AQUECIMENTO') && !exs.some((e) => e.bloco === bloco)) {
        exs.push({ bloco, tecnica: tec, exercicio: l, series: null, reps: null });
      }
    }
    return { treino, grupo, exercicios: exs };
  }

  // ---------------------------------------------------------------------
  // Plano completo
  // ---------------------------------------------------------------------
  function etapaDa(semana, total) {
    const t = Math.max(total, 3);
    const terco = Math.ceil(t / 3);
    if (total === 12) return semana <= 4 ? 'Base' : semana <= 8 ? 'Consolidação' : 'Alvo';
    return semana <= terco ? 'Base' : semana <= 2 * terco ? 'Consolidação' : 'Alvo';
  }

  const ORDEM_DIA = { '2ª': 0, '3ª': 1, '4ª': 2, '5ª': 3, '6ª': 4, 'Sáb': 5, 'Dom': 6 };

  /**
   * @param paginas [{n, linhas:[texto]}]
   * @returns {corrida:[linhas da aba Corrida], musculacao:[linhas da aba Musculação], semanas, avisos}
   */
  function lerPlano(paginas) {
    const semanas = [];         // [{numero, dias:{}, treinos:[]}]
    const avisos = [];
    let atual = null, plano = '';
    for (const p of paginas) {
      const texto = p.linhas.join('\n');
      const dias = parseCorrida(texto);
      const nDias = Object.keys(dias).length;
      if (nDias >= 2 || (nDias >= 1 && /PROVA/.test(texto))) {
        const mSem = texto.match(/SEMANA\s*0?(\d{1,2})\b/);
        const numero = mSem ? Number(mSem[1]) : (atual ? atual.numero + 1 : 1);
        // etapa e nível vêm do cabeçalho da página ("BASE INICIANTE - NÍVEL 1")
        const lEtapa = p.linhas.find((l) => /^(BASE|CONSOLIDA[ÇC][ÃA]O|ALVO)\b/.test(l));
        const etapa = lEtapa ? lEtapa.match(/^(BASE|CONSOLIDA[ÇC][ÃA]O|ALVO)/)[1].replace(/CONSOLIDA[ÇC][ÃA]O/, 'CONSOLIDAÇÃO') : null;
        if (!plano) {
          const lNivel = p.linhas.find((l) => /N[ÍI]VEL\s*\d/.test(l));
          const nivel = lNivel && lNivel.match(/((?:INICIANTE|INTERMEDI[ÁA]RIO|AVAN[ÇC]ADO)\s*-?\s*)?N[ÍI]VEL\s*\d+/);
          const dist = p.linhas.find((l) => /^\d+(?:[.,]\d+)?\s*KM$/.test(l));
          plano = [dist, nivel && nivel[0]].filter(Boolean).join(' · ');
        }
        atual = { numero, pagina: p.n, dias, treinos: [], etapa };
        semanas.push(atual);
        continue;
      }
      const m = parseMusculacao(p.linhas);
      if (m && atual) atual.treinos.push(m);
      else if (m && !atual) avisos.push(`Página ${p.n}: treino ${m.treino} antes da 1ª semana de corrida — ignorado.`);
    }

    // números de semana repetidos (ex.: "SEMANA" ausente em algumas páginas) → sequência simples
    const nums = semanas.map((s) => s.numero);
    if (new Set(nums).size !== nums.length) semanas.forEach((s, i) => (s.numero = i + 1));
    const total = semanas.length;

    const corrida = [], musculacao = [];
    for (const s of semanas) {
      const etapa = s.etapa ? s.etapa[0] + s.etapa.slice(1).toLowerCase() : etapaDa(s.numero, total);
      const dias = Object.keys(s.dias).sort((a, b) => ORDEM_DIA[a] - ORDEM_DIA[b]);
      for (const d of dias) corrida.push({ semana: s.numero, etapa, dia: d, ...s.dias[d], notas: null });
      const letras = new Set();
      for (const t of s.treinos) {
        if (letras.has(t.treino)) { avisos.push(`Semana ${s.numero}: treino ${t.treino} aparece duas vezes — fiquei com o primeiro.`); continue; }
        letras.add(t.treino);
        if (!t.exercicios.length) avisos.push(`Semana ${s.numero}, treino ${t.treino}: nenhum exercício reconhecido.`);
        for (const e of t.exercicios) {
          musculacao.push({
            semana: s.numero, treino: t.treino, grupo: t.grupo, bloco: e.bloco, tecnica: e.tecnica,
            exercicio: e.exercicio, series: e.series, reps: e.reps, descanso_seg: e.series ? 60 : null, notas: e.notas || null,
          });
        }
      }
      if (!s.treinos.length) avisos.push(`Semana ${s.numero}: não achei páginas de musculação.`);
    }
    if (!semanas.length) avisos.push('Não achei nenhuma página de corrida no PDF (blocos "INTERVALADO", "CONTÍNUO" ou "PROVA").');
    return { corrida, musculacao, semanas: total, avisos, plano };
  }

  const LEIA_ME = [
    ['Time Híbrido — planilha de treinos (fonte da verdade)'],
    [null],
    ['Gerada a partir do PDF pela interface web. Confira os valores antes de publicar'],
    ['(a leitura do PDF é heurística).'],
    [null],
    ['Aba CORRIDA — cada linha é um treino:'],
    ["  'tipo': intervalado (reps/esforço/recuperação) · contínuo (só esforço) · prova (distância)."],
    ["  'notas' aparece na descrição do treino no relógio."],
    [null],
    ['Aba MUSCULAÇÃO — cada linha é um exercício:'],
    ["  bi-set/super-set aparecem como linhas seguidas com o mesmo 'bloco'."],
    ["  'descanso_seg' vem com padrão 60s (o PDF não especifica) — ajuste à vontade."],
    [null],
    ['Aba DE-PARA — mapeia cada exercício para o catálogo do Garmin:'],
    ['  par (garmin_category / garmin_exercise) é o identificador do Garmin.'],
    ["  'confianca': alta/média/baixa. Revise as BAIXA (máquinas sem equivalente exato)."],
    [null],
    ['Zonas de FC (defina no Garmin por % da FCmáx):'],
    ['  Z1 50–59% · Z2 60–69% · Z3 70–79% · Z4 80–89% · Z5 90–95%'],
  ];

  const API = { carregarPdfJs, extrairPaginas, linhasDaPagina, parseCorrida, parseMusculacao, lerPlano, LEIA_ME };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.THPdf = API;
})(typeof window !== 'undefined' ? window : globalThis);
