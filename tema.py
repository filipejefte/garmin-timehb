#!/usr/bin/env python3
"""
Identidade visual do Time Híbrido para o app
============================================
Cores, tipografia e componentes extraídos do PDF do plano (`time-hibrido-*.pdf`):

- verde-escuro nos títulos condensados em caixa alta (Bebas Neue);
- marca-texto verde-neon sobre a palavra-chave, como na capa;
- setas de etapa (Base / Consolidação / Alvo) — aqui viram os passos do app;
- **corrida é verde, musculação é azul** — o PDF usa essa codificação nas setas
  de etapa e nas faixas de cabeçalho de cada treino;
- caixa de nota em creme com a assinatura "Time Híbrido";
- marca d'água do jacaré ao fundo das páginas.
"""
from __future__ import annotations

import base64
import functools
import os

import streamlit as st

AQUI = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(AQUI, "assets", "logo_time_hibrido.png")

# ---------------------------------------------------------------------------
# Paleta — amostrada do PDF (não inventar tons novos)
# ---------------------------------------------------------------------------
VERDE_ESCURO = "#042705"   # títulos Bebas, pílulas
VERDE_MARCA = "#165745"    # texto de corpo
VERDE_VIVO = "#00BF63"     # botão/CTA (o verde dos "vídeo explicativo")
VERDE_NEON = "#3CFF00"     # marca-texto da capa
LIMA = "#E6FF0A"           # destaque neon
CREME = "#FDF9B4"          # caixa de nota
ARDOSIA = "#394C60"

CORRIDA = ["#67E387", "#62CC7E", "#51A868"]      # setas de etapa da corrida
MUSCULACAO = ["#00A5F8", "#0084C7", "#02608F"]   # setas de etapa da musculação

COR_CORRIDA = "#2FA85C"
COR_MUSCULACAO = MUSCULACAO[0]

PASSOS = [
    ("01", "PDF"),
    ("02", "REVISAR"),
    ("03", "DATAS"),
    ("04", "GARMIN"),
    ("05", "PUBLICAR"),
]


@functools.lru_cache(maxsize=2)
def _logo_b64() -> str:
    if not os.path.exists(LOGO):
        return ""
    with open(LOGO, "rb") as f:
        return base64.b64encode(f.read()).decode()


def _css() -> str:
    logo = _logo_b64()
    marca_dagua = (
        f'background-image:url("data:image/png;base64,{logo}");' if logo else ""
    )
    return f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');

:root {{
  --th-verde-escuro: {VERDE_ESCURO};
  --th-verde-marca: {VERDE_MARCA};
  --th-verde-vivo: {VERDE_VIVO};
  --th-verde-neon: {VERDE_NEON};
  --th-creme: {CREME};
  --th-corrida: {COR_CORRIDA};
  --th-musculacao: {COR_MUSCULACAO};
  --th-titulo: 'Bebas Neue', 'Arial Narrow', Impact, sans-serif;
  --th-ui: 'Montserrat', 'Open Sans', 'Segoe UI', sans-serif;
}}

/* ---- canvas: página branca com o jacaré em marca d'água, como no PDF ---- */
.stApp {{ background: #FFFFFF; }}
.stApp::before {{
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  {marca_dagua}
  background-repeat: no-repeat;
  background-position: center 24%;
  background-size: min(64vw, 700px) auto;
  opacity: .022;
}}
[data-testid="stAppViewContainer"], [data-testid="stMain"] {{ position: relative; z-index: 1; }}
[data-testid="stHeader"] {{ background: transparent; }}
[data-testid="stAppDeployButton"] {{ display: none; }}
.block-container {{ padding-top: 2.2rem; max-width: 1180px; margin: 0 auto; }}

/* Tipografia: sem seletor universal — ele quebraria a fonte dos ícones
   (Material Symbols), que apareceriam como texto ("upload", "visibility"). */
html, body, .stApp, [data-testid="stAppViewContainer"] {{ font-family: var(--th-ui); }}
[data-testid="stMarkdownContainer"] :where(p, li, strong, em, small, code),
.stButton button, .stFormSubmitButton button, .stDownloadButton button,
label, [data-baseweb="input"] input, [data-baseweb="select"], [data-baseweb="select"] div,
[data-testid="stFileUploaderDropzone"] div, [data-testid="stAlert"] p {{
  font-family: var(--th-ui);
}}
[data-testid="stMarkdownContainer"] p,
[data-testid="stMarkdownContainer"] li {{ color: var(--th-verde-marca); }}

/* ---- hero ---- */
.th-hero {{ text-align: center; padding: .5rem 0 1.6rem; }}
.th-hero img {{ width: 232px; margin: 0 auto .9rem; display: block; }}
/* !important: o Streamlit estiliza h1/h2/h3 do markdown com a fonte do tema base */
.th-hero h1 {{
  font-family: var(--th-titulo) !important; font-size: clamp(52px, 7vw, 96px) !important;
  font-weight: 400 !important; line-height: .92; color: var(--th-verde-escuro);
  margin: 0; padding: 0; letter-spacing: .5px;
}}
.th-marca {{
  background: linear-gradient(var(--th-verde-neon), var(--th-verde-neon));
  background-size: 100% 66%; background-position: 0 62%; background-repeat: no-repeat;
  padding: 0 .14em;
}}
.th-hero .sub {{
  font-family: var(--th-ui); font-weight: 700; font-size: 12.5px; letter-spacing: 2.4px;
  text-transform: uppercase; color: var(--th-verde-marca); margin-top: 1rem; opacity: .85;
}}

/* ---- setas de etapa (o motivo Base/Consolidação/Alvo do PDF) ---- */
.th-etapas {{ display: flex; gap: 10px; margin: .4rem 0 2.4rem; }}
.th-etapa {{
  flex: 1; position: relative; padding: 14px 12px 14px 30px; color: #fff;
  background: #D9E4DC;
  clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 24px 50%);
}}
.th-etapa:first-child {{ clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%); padding-left: 20px; }}
.th-etapa .n {{ display: block; font-family: var(--th-ui); font-weight: 700; font-size: 11px; letter-spacing: 1.4px; opacity: .95; }}
.th-etapa .t {{ display: block; font-family: var(--th-titulo); font-size: 27px; line-height: 1; letter-spacing: .6px; }}
.th-etapa.off {{ background: #E7EEE8; color: #9DB0A2; }}

/* ---- cabeçalho de seção: pílula escura + título condensado ---- */
.th-pill {{
  display: inline-block; background: var(--th-verde-escuro); color: #fff;
  font-family: var(--th-ui); font-weight: 700; font-size: 11.5px; letter-spacing: 2px;
  padding: 7px 20px; border-radius: 999px; text-transform: uppercase;
}}
.th-secao {{ margin: 2.6rem 0 1.2rem; }}
.th-secao h2 {{
  font-family: var(--th-titulo) !important; font-size: 42px !important; font-weight: 400 !important;
  line-height: 1; letter-spacing: .5px; color: var(--th-verde-escuro);
  margin: .55rem 0 0 !important; padding: 0 !important;
}}
.th-secao .desc {{ color: var(--th-verde-marca); font-size: 14px; margin-top: .45rem; }}

/* ---- faixa colorida (cabeçalho de treino do PDF) ---- */
.th-faixa {{
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  background: var(--c); color: #fff; border-radius: 14px; padding: 13px 22px; margin-bottom: 1rem;
}}
.th-faixa .esq {{ font-family: var(--th-titulo); font-size: 30px; line-height: 1; letter-spacing: .6px; }}
.th-faixa .dir {{ font-family: var(--th-ui); font-weight: 700; font-size: 11px; letter-spacing: 1.6px; text-align: right; text-transform: uppercase; opacity: .95; }}

/* ---- caixa de nota creme ---- */
.th-nota {{
  background: var(--th-creme); border-radius: 6px; padding: 16px 22px 10px;
  box-shadow: 0 1px 6px rgba(0,0,0,.07); margin: .6rem 0 1rem;
}}
.th-nota p {{ color: #11171D !important; margin: 0; font-size: 14.5px; line-height: 1.5; }}
.th-nota .assin {{ font-family: var(--th-ui); font-weight: 600; font-size: 10px; color: #9a9569; margin-top: 10px; letter-spacing: .4px; }}

/* ---- zonas de FC ---- */
.th-zonas {{ display: flex; gap: 6px; margin: .2rem 0 .6rem; }}
.th-zona {{
  flex: 1; text-align: center; border-radius: 8px; padding: 7px 4px; color: #fff;
  font-family: var(--th-ui); font-weight: 700; font-size: 11px; letter-spacing: .5px;
}}
.th-zona small {{ display: block; font-weight: 600; font-size: 9.5px; opacity: .9; }}

/* ---- botões: pílula, caixa alta ---- */
.stButton > button, .stFormSubmitButton > button, .stDownloadButton > button {{
  border-radius: 999px; font-family: var(--th-ui); font-weight: 800; letter-spacing: 1.1px;
  text-transform: uppercase; font-size: 12.5px; padding: .62rem 1.4rem; border-width: 2px;
  transition: transform .06s ease, box-shadow .16s ease, background .16s ease;
}}
.stButton > button:hover, .stFormSubmitButton > button:hover {{ transform: translateY(-1px); }}
.stButton > button[kind="primary"], .stFormSubmitButton > button[kind="primary"] {{
  background: var(--th-verde-vivo); border-color: var(--th-verde-vivo); color: #fff;
  box-shadow: 0 4px 14px rgba(0,191,99,.28);
}}
.stButton > button[kind="primary"]:hover {{ background: #00A957; border-color: #00A957; color: #fff; }}
.stButton > button[kind="secondary"], .stFormSubmitButton > button[kind="secondary"] {{
  background: #fff; border-color: var(--th-verde-escuro); color: var(--th-verde-escuro);
}}
.stButton > button[kind="secondary"]:hover {{
  background: var(--th-verde-escuro); color: #fff; border-color: var(--th-verde-escuro);
}}

/* corrida = verde · musculação = azul (mesma codificação do PDF) */
.st-key-btn_pub_corrida button {{
  background: var(--th-corrida) !important; border-color: var(--th-corrida) !important;
  color: #fff !important; box-shadow: 0 4px 14px rgba(47,168,92,.3);
}}
.st-key-btn_pub_musculacao button {{
  background: var(--th-musculacao) !important; border-color: var(--th-musculacao) !important;
  color: #fff !important; box-shadow: 0 4px 14px rgba(0,165,248,.3);
}}
.st-key-btn_pub_corrida button:disabled, .st-key-btn_pub_musculacao button:disabled {{
  opacity: .38; box-shadow: none;
}}

/* ---- abas (Streamlit 1.5x: React Aria, não BaseWeb) ---- */
.stTabs [role="tablist"] {{ gap: 6px; border-bottom: 2px solid #E7EEE8; }}
.stTabs [data-testid="stTab"] {{ padding: 10px 18px; }}
.stTabs [data-testid="stTab"] p {{
  font-family: var(--th-ui) !important; font-weight: 700 !important; font-size: 12px !important;
  letter-spacing: 1.3px !important; text-transform: uppercase !important; color: #8FA396 !important;
}}
.stTabs [data-testid="stTab"][aria-selected="true"] p {{ color: var(--th-verde-escuro) !important; }}
.stTabs .react-aria-SelectionIndicator {{ background: var(--th-verde-vivo) !important; height: 3px; }}

/* ---- uploader ---- */
[data-testid="stFileUploaderDropzone"] {{
  background: #F6FAF5; border: 2px dashed #BBD6BE; border-radius: 16px;
}}
[data-testid="stFileUploaderDropzone"]:hover {{ border-color: var(--th-verde-vivo); background: #F1F9F0; }}

/* ---- campos ---- */
[data-baseweb="input"], [data-baseweb="select"] > div, .stDateInput [data-baseweb="input"] {{ border-radius: 10px; }}
[data-testid="stForm"] {{ border: 1px solid #E3EBE4; border-radius: 16px; padding: 1.2rem 1.4rem; }}
[data-testid="stDataFrame"] {{ border-radius: 12px; overflow: hidden; border: 1px solid #E3EBE4; }}

/* ---- avisos ---- */
[data-testid="stAlert"] {{ border-radius: 12px; }}
.th-nota code {{ background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }}

/* ---- painéis: st.container(border=True, key=...) → classe .st-key-<key> ---- */
/* mesma altura nos dois painéis: a coluna já estica, mas os wrappers
   intermediários (stVerticalBlock > stLayoutWrapper) não herdam a altura */
[data-testid="stColumn"]:has(.st-key-painel_corrida) > [data-testid="stVerticalBlock"],
[data-testid="stColumn"]:has(.st-key-painel_musculacao) > [data-testid="stVerticalBlock"],
[data-testid="stColumn"]:has(.st-key-painel_corrida) > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"],
[data-testid="stColumn"]:has(.st-key-painel_musculacao) > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"] {{
  height: 100%;
}}
.st-key-painel_corrida, .st-key-painel_musculacao {{
  border-radius: 14px !important; border-color: #E3EBE4 !important;
  padding: 1.1rem 1.2rem .6rem !important; height: 100%;
}}
.st-key-painel_corrida {{ border-top: 4px solid var(--th-corrida) !important; }}
.st-key-painel_musculacao {{ border-top: 4px solid var(--th-musculacao) !important; }}
.th-painel-tit {{
  font-family: var(--th-titulo); font-size: 27px; line-height: 1; letter-spacing: .5px;
  color: var(--th-verde-escuro);
}}
.th-painel-sub {{ font-size: 12px; color: #7E9285; margin: .2rem 0 .6rem; }}

/* ---- rodapé ---- */
.th-rodape {{
  text-align: center; margin: 3rem 0 1rem; padding-top: 1.4rem; border-top: 1px solid #E7EEE8;
  font-family: var(--th-ui); font-weight: 700; font-size: 10.5px; letter-spacing: 2.6px;
  text-transform: uppercase; color: #A8B9AC;
}}
</style>
"""


def aplicar_tema() -> None:
    st.markdown(_css(), unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------
def hero() -> None:
    logo = _logo_b64()
    img = f'<img src="data:image/png;base64,{logo}" alt="Time Híbrido">' if logo else ""
    st.markdown(
        f"""
<div class="th-hero">
  {img}
  <h1>SUA PLANILHA<br><span class="th-marca">NO SEU GARMIN</span></h1>
  <div class="sub">Do PDF ao relógio · 12 semanas · corrida + musculação</div>
</div>
""",
        unsafe_allow_html=True,
    )


def etapas(concluidos: set[int]) -> None:
    """Setas de etapa do PDF reaproveitadas como progresso dos 5 passos."""
    cores = [CORRIDA[0], CORRIDA[1], CORRIDA[2], MUSCULACAO[1], VERDE_ESCURO]
    itens = []
    for i, (n, nome) in enumerate(PASSOS):
        ok = i + 1 in concluidos
        estilo = f'style="background:{cores[i]}"' if ok else ""
        itens.append(
            f'<div class="th-etapa {"" if ok else "off"}" {estilo}>'
            f'<span class="n">PASSO {n}</span><span class="t">{nome}</span></div>'
        )
    st.markdown(f'<div class="th-etapas">{"".join(itens)}</div>', unsafe_allow_html=True)


def secao(passo: str, titulo: str, desc: str = "") -> None:
    desc_html = f'<div class="desc">{desc}</div>' if desc else ""
    st.markdown(
        f'<div class="th-secao"><span class="th-pill">Passo {passo}</span>'
        f"<h2>{titulo}</h2>{desc_html}</div>",
        unsafe_allow_html=True,
    )


def faixa(titulo: str, direita: str, cor: str) -> None:
    st.markdown(
        f'<div class="th-faixa" style="--c:{cor}"><div class="esq">{titulo}</div>'
        f'<div class="dir">{direita}</div></div>',
        unsafe_allow_html=True,
    )


def nota(texto: str) -> None:
    st.markdown(
        f'<div class="th-nota"><p>{texto}</p><div class="assin">Time Híbrido</div></div>',
        unsafe_allow_html=True,
    )


def titulo_painel(titulo: str, sub: str) -> None:
    """Cabeçalho de um st.container(border=True) — o container é quem desenha a moldura."""
    st.markdown(
        f'<div class="th-painel-tit">{titulo}</div><div class="th-painel-sub">{sub}</div>',
        unsafe_allow_html=True,
    )


ZONAS = [
    ("Z1", "50–59%", "#8ED6A4"),
    ("Z2", "60–69%", "#67E387"),
    ("Z3", "70–79%", "#2FA85C"),
    ("Z4", "80–89%", "#0084C7"),
    ("Z5", "90–95%", "#02608F"),
]

TREINOS_CHIP = [
    ("A", "#7FCBF9"),
    ("B", "#4FBAF9"),
    ("C", "#00A5F8"),
    ("D", "#0084C7"),
    ("E", "#02608F"),
]


def _chips(itens) -> None:
    st.markdown(
        f'<div class="th-zonas">{"".join(itens)}</div>',
        unsafe_allow_html=True,
    )


def zonas_fc() -> None:
    """Legenda das zonas de FC — a mesma escala que o PDF usa no controle de intensidade."""
    _chips([
        f'<div class="th-zona" style="background:{c}">{z}<small>{p}</small></div>'
        for z, p, c in ZONAS
    ])


def treinos_ae() -> None:
    _chips([
        f'<div class="th-zona" style="background:{c}">{t}<small>treino</small></div>'
        for t, c in TREINOS_CHIP
    ])


def rodape() -> None:
    st.markdown(
        '<div class="th-rodape">O seu Time Híbrido · roda só no seu computador</div>',
        unsafe_allow_html=True,
    )
