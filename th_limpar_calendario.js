/**
 * TIME HÍBRIDO — limpar AGENDAMENTOS do calendário do Garmin
 * ==========================================================
 * Remove os treinos do CALENDÁRIO, mantendo todos eles na biblioteca
 * ("Meus treinos"). É o oposto de apagar o treino: aqui só a data cai.
 *
 * COMO USAR
 *   1. Abra https://connect.garmin.com/app/calendar já logado.
 *   2. F12 -> Console -> cole este arquivo inteiro -> Enter.
 *   3. Ele roda em modo PRÉVIA: lista o que apagaria e não apaga nada.
 *   4. Conferiu? Rode de novo com:   __thLimpar({ apagar: true })
 *
 * OPÇÕES
 *   escopo : 'plano'   (padrão) só os do plano  -> /^S\d\d( [A-E])? · /
 *            'corrida'                          -> /^S\d\d · /
 *            'musculacao'                       -> /^S\d\d [A-E] · /
 *            'tudo'    TODOS os treinos agendados, inclusive os antigos
 *   anos   : [2026]    anos a varrer
 *   apagar : false     true executa de verdade
 *
 * SEGURANÇA
 *   - Antes de apagar, imprime e guarda em localStorage['__thBackupCal']
 *     o mapa {nome: [datas]}, para você poder reagendar depois.
 *   - Nunca apaga treinos da biblioteca, só o vínculo com a data.
 */
(async () => {
  // ---------- captura do token CSRF ----------
  if (!window.__thCsrf) {
    const of = window.fetch;
    window.fetch = function (i, init) {
      try {
        const u = typeof i === 'string' ? i : (i && i.url);
        if (u && u.includes('gc-api')) {
          const h = (init && init.headers) || (i && i.headers) || {};
          const t = h.get ? h.get('connect-csrf-token') : h['connect-csrf-token'];
          if (t) window.__thCsrf = t;
        }
      } catch (e) {}
      return of.apply(this, arguments);
    };
  }
  if (!window.__thCsrf) {
    console.log('⏳ Precisa capturar o token: clique em "Ano" (canto sup. direito) ou troque o mês.');
    for (let i = 0; i < 120 && !window.__thCsrf; i++) await new Promise(r => setTimeout(r, 1000));
    if (!window.__thCsrf) { console.error('❌ Token não capturado. Recarregue e tente de novo.'); return; }
  }
  const H = { 'Content-Type': 'application/json', 'connect-csrf-token': window.__thCsrf };
  const api = async (m, c) => {
    const r = await fetch('https://connect.garmin.com/gc-api' + c, { method: m, headers: H, credentials: 'include' });
    if (!r.ok) throw new Error(`${m} ${c} HTTP ${r.status}`);
    return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text();
  };

  const FILTROS = {
    plano:      /^S\d\d( [A-E])? · /,
    corrida:    /^S\d\d · /,
    musculacao: /^S\d\d [A-E] · /,
    tudo:       /./,
  };

  window.__thLimpar = async function (opts = {}) {
    const { escopo = 'plano', anos = [2026], apagar = false } = opts;
    const re = FILTROS[escopo];
    if (!re) { console.error('escopo inválido. Use:', Object.keys(FILTROS).join(' | ')); return; }

    // ---------- levantar os agendamentos ----------
    const vistos = new Set(); const itens = [];
    for (const ano of anos) {
      for (let mes = 0; mes < 12; mes++) {           // mês é 0-based na API
        try {
          const cal = await api('GET', `/calendar-service/year/${ano}/month/${mes}`);
          // a API devolve semanas vizinhas: o mesmo item aparece em 2 meses -> dedupe por id
          (cal.calendarItems || []).forEach(it => {
            if (it.itemType === 'workout' && !vistos.has(it.id)) {
              vistos.add(it.id);
              itens.push({ id: it.id, data: it.date, nome: it.title || '' });
            }
          });
        } catch (e) { console.warn('mês', ano, mes + 1, e.message); }
        await new Promise(r => setTimeout(r, 80));
      }
    }
    const alvo = itens.filter(i => re.test(i.nome)).sort((a, b) => a.data.localeCompare(b.data));
    const fica = itens.filter(i => !re.test(i.nome)).sort((a, b) => a.data.localeCompare(b.data));

    // ---------- backup ----------
    const backup = {};
    alvo.forEach(i => (backup[i.nome] = backup[i.nome] || []).push(i.data));
    localStorage.setItem('__thBackupCal', JSON.stringify(backup));

    console.log(`\n=== escopo "${escopo}" · anos ${anos.join(', ')} ===`);
    console.log(`A APAGAR: ${alvo.length} agendamentos`);
    alvo.forEach(i => console.log(`   ${i.data}  ${i.nome}`));
    console.log(`\nFICAM NO CALENDÁRIO: ${fica.length}`);
    fica.forEach(i => console.log(`   ${i.data}  ${i.nome}`));
    console.log('\n💾 backup salvo em localStorage["__thBackupCal"] (nome -> datas)');

    if (!apagar) {
      console.log('\n🔍 PRÉVIA — nada foi apagado.');
      console.log('   Para executar:  __thLimpar({ escopo: "' + escopo + '", apagar: true })');
      return { previa: true, apagaria: alvo.length, ficam: fica.length, backup };
    }

    // ---------- apagar só o agendamento ----------
    let ok = 0, erro = 0;
    for (const i of alvo) {
      try { await api('DELETE', `/workout-service/schedule/${i.id}`); ok++; console.log(`apagado ${i.data} ${i.nome}`); }
      catch (e) { erro++; console.error(`FALHA ${i.data} ${i.nome}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 120));
    }
    console.log(`\n===== apagados ${ok}/${alvo.length} · erros ${erro} =====`);
    console.log('Os treinos continuam em "Meus treinos" — só saíram das datas.');
    return { apagados: ok, erros: erro, backup };
  };

  console.log('✅ pronto. Rodando a PRÉVIA do escopo "plano"…');
  return await window.__thLimpar();
})();
