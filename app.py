#!/usr/bin/env python3
"""
Time Híbrido → Garmin — app local
=================================
Interface visual que roda no seu PC. Fluxo: subir o PDF → revisar as tabelas
(corrida, musculação, de-para) → escolher os dias da semana → publicar no Garmin.

Rodar (PowerShell):
    pip install -r requirements.txt
    streamlit run app.py

O navegador abre em http://localhost:8501 (fica só na sua máquina).
"""
from __future__ import annotations

import os
import tempfile
from datetime import date, timedelta

import pandas as pd
import streamlit as st

import garminconnect
import montar_musculacao as mm
import pdf_para_planilha as pp
import tema
from garmin_time_hibrido import build_all, get_client, load_program_from_sheet

DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]  # índice = 0..6
TREINOS = ["A", "B", "C", "D", "E"]
PADRAO_DIAS = {"A": 5, "B": 6, "C": 0, "D": 1, "E": 2}   # Sáb, Dom, Seg, Ter, Qua

TABS = ["Corrida", "Musculação", "De-para"]


# ===========================================================================
# Lógica (testável sem Streamlit)
# ===========================================================================
def pdf_para_dataframes(pdf_path: str) -> dict:
    """Gera a planilha a partir do PDF e devolve {aba: DataFrame}."""
    tmp = os.path.join(tempfile.gettempdir(), "th_app.xlsx")
    program = pp.parse_pdf_running(pdf_path)
    strength = pp.parse_pdf_strength(pdf_path)
    pp.build_sheet(program, strength, tmp)
    return {t: pd.read_excel(tmp, sheet_name=t) for t in TABS}


def dataframes_para_xlsx(dfs: dict) -> str:
    """Grava as abas (possivelmente editadas) num .xlsx temporário e devolve o caminho."""
    tmp = os.path.join(tempfile.gettempdir(), "th_app_edit.xlsx")
    with pd.ExcelWriter(tmp, engine="openpyxl") as xw:
        for t in TABS:
            if t in dfs:
                dfs[t].to_excel(xw, sheet_name=t, index=False)
    return tmp


def montar_corrida(xlsx: str, start_monday: date, from_week: int = 1) -> list:
    program = load_program_from_sheet(xlsx)
    return build_all(start_monday, from_week, program=program)


def montar_musculacao_app(xlsx: str, start_monday: date, weekday_map: dict) -> list:
    return mm.build_all_strength(xlsx, start_monday=start_monday, weekday_map=weekday_map)


def publicar(garmin, workouts: list, agendar: bool, log) -> tuple:
    """Cria (e agenda, se houver data) uma lista de treinos. `log` é uma função
    de callback para reportar progresso. Devolve (criados, pulados, falhas)."""
    existentes = set()
    try:
        for w in garmin.get_workouts(0, 999):
            existentes.add(w.get("workoutName"))
    except Exception as e:
        log(f"aviso: não listei treinos existentes ({e})")

    criados = pulados = falhas = 0
    import time
    for w in workouts:
        if w["name"] in existentes:
            pulados += 1
            continue
        try:
            res = garmin.upload_workout(w["payload"])
            wid = res.get("workoutId") if isinstance(res, dict) else None
            if not wid:
                raise RuntimeError(f"sem workoutId: {res!r}")
            criados += 1
            time.sleep(1.0)
            if agendar and w.get("date"):
                garmin.schedule_workout(wid, w["date"])
                log(f"✓ {w['date']} · {w['name']}")
                time.sleep(1.0)
            else:
                log(f"✓ {w['name']}")
        except Exception as e:
            falhas += 1
            log(f"✗ {w['name']} → {e}")
            if any(k in str(e).lower() for k in ("429", "rate", "too many")):
                log("→ parando: limite de requisições (429). Tente mais tarde.")
                break
    return criados, pulados, falhas


# ===========================================================================
# Login (token-first + MFA via return_on_mfa)
# ===========================================================================
def _tokenstore() -> str:
    return os.getenv("GARMINTOKENS", os.path.expanduser("~/.garminconnect"))


def _persist_session(garmin) -> None:
    """Salva os tokens em disco para não repetir login/MFA na próxima vez.
    garminconnect 0.3.x usa garmin.client.dump; versões antigas (garth) usam
    garmin.garth.dump. Tenta as duas para funcionar em qualquer versão."""
    store = _tokenstore()
    os.makedirs(store, exist_ok=True)
    for obj_name in ("client", "garth"):
        obj = getattr(garmin, obj_name, None)
        dump = getattr(obj, "dump", None)
        if dump is None:
            continue
        try:
            dump(store)
            return
        except Exception:
            continue


def tentar_token_login():
    """Retoma sessão pelos tokens/cURL salvos (sem senha, sem SSO). None se não der."""
    try:
        return get_client()
    except SystemExit:
        return None
    except Exception:
        return None


def conectar_garmin_app():
    try:
        return get_client(), None
    except SystemExit as e:
        return None, str(e)
    except Exception as e:
        return None, str(e)


# ===========================================================================
# Interface Streamlit
# ===========================================================================
def _ss(key, default):
    if key not in st.session_state:
        st.session_state[key] = default
    return st.session_state[key]


def render():
    st.set_page_config(page_title="Time Híbrido → Garmin", page_icon="🐊", layout="wide")
    tema.aplicar_tema()
    tema.hero()
    slot_etapas = st.empty()

    _ss("dfs", None)
    _ss("garmin", None)
    _ss("mfa_state", None)
    _ss("garmin_error", None)
    _ss("publicado", False)
    using_curl_session = bool(os.getenv("GARMIN_CURL_FILE"))
    if using_curl_session and st.session_state.mfa_state is not None:
        st.session_state.mfa_state = None

    def pintar_etapas(concluidos):
        with slot_etapas.container():
            tema.etapas(concluidos)

    # ---- 1. Upload do PDF ----
    tema.secao("01", "Suba o PDF do seu plano",
               "O mesmo arquivo que você recebeu do Time Híbrido — corrida e musculação saem dele.")
    up = st.file_uploader("PDF do Time Híbrido", type=["pdf"])
    if up is not None and st.button("Ler o PDF", type="primary", key="btn_ler_pdf"):
        with st.spinner("Lendo o PDF..."):
            path = os.path.join(tempfile.gettempdir(), "th_upload.pdf")
            with open(path, "wb") as f:
                f.write(up.getbuffer())
            try:
                st.session_state.dfs = pdf_para_dataframes(path)
                st.success("PDF lido. Revise as tabelas abaixo.")
            except Exception as e:
                st.error(f"Não consegui ler o PDF: {e}")

    if st.session_state.dfs is None:
        tema.nota("Suba o PDF para começar. Nada sai do seu computador: a leitura do plano "
                  "é feita aqui na sua máquina, e só os treinos vão para o Garmin quando você mandar.")
        pintar_etapas(set())
        tema.rodape()
        return

    dfs = st.session_state.dfs

    # ---- 2. Revisão editável ----
    tema.secao("02", "Revise suas planilhas",
               "A leitura do PDF é automática — confira as linhas e edite direto na tabela se precisar.")
    aba = st.tabs(TABS)
    for i, t in enumerate(TABS):
        with aba[i]:
            if t == "De-para":
                tema.nota("Confira as linhas de confiança <b>baixa</b> — são máquinas brasileiras sem "
                          "equivalente exato no catálogo do Garmin. Os pares válidos estão em "
                          "<code>data/garmin_exercises.json</code>.")
            dfs[t] = st.data_editor(dfs[t], width="stretch", num_rows="dynamic",
                                    key=f"editor_{t}", height=320)
    st.session_state.dfs = dfs

    # ---- 3. Datas e dias ----
    tema.secao("03", "Datas e dias da semana",
               "A corrida já vem com os dias definidos no plano. A musculação você distribui como treina.")
    col1, col2 = st.columns([1, 1.35])
    with col1:
        with st.container(border=True, key="painel_corrida"):
            tema.titulo_painel("Corrida", "Quando começa o programa de 12 semanas")
            prox_seg = date.today() + timedelta(days=(7 - date.today().weekday()) % 7 or 7)
            start = st.date_input("Segunda-feira da semana 1", value=prox_seg)
            from_week = st.number_input("Começar da semana", min_value=1, max_value=12, value=1)
    with col2:
        with st.container(border=True, key="painel_musculacao"):
            tema.titulo_painel("Musculação", "O dia da semana de cada treino A–E")
            weekday_map = {}
            cols = st.columns(5)
            for j, tr in enumerate(TREINOS):
                with cols[j]:
                    # abreviado: cinco caixas lado a lado não cabem os nomes inteiros
                    idx = st.selectbox(f"Treino {tr}", DIAS, index=PADRAO_DIAS[tr],
                                       key=f"dia_{tr}", format_func=lambda d: d[:3])
                    weekday_map[tr] = DIAS.index(idx)

    data_ok = isinstance(start, date) and start.weekday() == 0
    if not data_ok:
        st.warning("A data escolhida não é uma segunda-feira; as semanas serão contadas a partir dela.")

    # ---- 4. Login ----
    tema.secao("04", "Conecte ao Garmin",
               "A sessão fica salva na sua máquina — você só passa pelo login uma vez.")
    c_sync, c_clear = st.columns([2, 1])
    with c_sync:
        sync = st.button("Sincronizar com Garmin", type="primary", width="stretch",
                         key="btn_sync")
    with c_clear:
        clear = st.button("Limpar conexão", width="stretch", key="btn_clear")

    if clear:
        st.session_state.garmin = None
        st.session_state.garmin_error = None
        st.session_state.mfa_state = None
        st.rerun()

    if sync:
        st.session_state.mfa_state = None
        with st.spinner("Sincronizando com Garmin..."):
            g, err = conectar_garmin_app()
        if g is not None:
            st.session_state.garmin = g
            st.session_state.garmin_error = None
            st.rerun()
        st.session_state.garmin_error = err or "Não foi possível conectar."

    if st.session_state.garmin is not None:
        nome = (getattr(st.session_state.garmin, "full_name", None)
                or getattr(st.session_state.garmin, "display_name", None)
                or "conta conectada")
        st.success(f"Conectado: {nome}")
    elif st.session_state.garmin_error:
        st.error(st.session_state.garmin_error)
    elif st.session_state.mfa_state is not None and not using_curl_session:
        st.info("Digite o código MFA enviado pela Garmin.")
        code = st.text_input("Código MFA", key="mfa_code")
        if st.button("Confirmar código", type="primary", key="btn_mfa"):
            try:
                g, state = st.session_state.mfa_state
                g.resume_login(state, code.strip())
                _persist_session(g)
                st.session_state.garmin = g
                st.session_state.mfa_state = None
                st.rerun()
            except Exception as e:
                st.error(f"Falhou: {e}")
    elif not using_curl_session:
        with st.form("login"):
            email = st.text_input("E-mail Garmin")
            senha = st.text_input("Senha", type="password")
            entrar = st.form_submit_button("Entrar", type="primary")
        if entrar:
            with st.spinner("Autenticando..."):
                try:
                    g = garminconnect.Garmin(email=email, password=senha, return_on_mfa=True)
                    status, state = g.login(_tokenstore())
                    if status == "needs_mfa":
                        st.session_state.mfa_state = (g, state)
                        st.rerun()
                    else:
                        _persist_session(g)
                        st.session_state.garmin = g
                        st.rerun()
                except garminconnect.GarminConnectTooManyRequestsError:
                    st.error("429 — limite de login (na conta, não no IP). Aguarde ~1h e tente de novo. "
                             "Cada tentativa renova o bloqueio.")
                except Exception as e:
                    st.error(f"Falhou: {e}")
    else:
        st.info("Use o botão acima para sincronizar com a sessão do navegador salva em garmin-curl.txt.")

    # ---- 5. Publicar ----
    tema.secao("05", "Publique no relógio",
               "Os treinos vão para o calendário do Garmin. Rodar de novo é seguro: o que já subiu é pulado.")
    conectado = st.session_state.garmin is not None
    if not conectado:
        tema.nota("Conecte ao Garmin no <b>passo 04</b> para liberar a publicação.")

    c1, c2 = st.columns(2)
    with c1:
        tema.faixa("Corrida 5 km", "12 semanas · zonas de FC", tema.COR_CORRIDA)
        tema.zonas_fc()
        if st.button("Publicar corrida", disabled=not conectado, width="stretch",
                     key="btn_pub_corrida"):
            xlsx = dataframes_para_xlsx(st.session_state.dfs)
            workouts = montar_corrida(xlsx, start, int(from_week))
            box = st.container()
            logs = []
            def log(m): logs.append(m); box.write(m)
            with st.spinner(f"Publicando {len(workouts)} treinos de corrida..."):
                cr, pu, fa = publicar(st.session_state.garmin, workouts, True, log)
            st.session_state.publicado = True
            st.success(f"Corrida: {cr} criados · {pu} já existiam · {fa} falharam")
    with c2:
        tema.faixa("Musculação", "Treinos A–E · 5x por semana", tema.COR_MUSCULACAO)
        tema.treinos_ae()
        if st.button("Publicar musculação", disabled=not conectado, width="stretch",
                     key="btn_pub_musculacao"):
            xlsx = dataframes_para_xlsx(st.session_state.dfs)
            workouts = montar_musculacao_app(xlsx, start, weekday_map)
            box = st.container()
            def log(m): box.write(m)
            with st.spinner(f"Publicando {len(workouts)} treinos de musculação..."):
                cr, pu, fa = publicar(st.session_state.garmin, workouts, True, log)
            st.session_state.publicado = True
            st.success(f"Musculação: {cr} criados · {pu} já existiam · {fa} falharam")

    tema.nota("Publique a <b>corrida</b> primeiro — é o caminho mais sólido. Depois a musculação. "
              "Os treinos aparecem em <b>Garmin Connect › Calendário</b> e em <b>Treinos</b>.")

    concluidos = {1, 2}
    if data_ok:
        concluidos.add(3)
    if conectado:
        concluidos.add(4)
    if st.session_state.publicado:
        concluidos.add(5)
    pintar_etapas(concluidos)
    tema.rodape()


if __name__ == "__main__":
    render()
