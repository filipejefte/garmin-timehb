#!/usr/bin/env python3
"""
PDF do Time Híbrido → planilha editável de corrida
==================================================
Lê um PDF do Time Híbrido, extrai o plano de CORRIDA das 12 semanas e gera a
planilha (time_hibrido_corrida.xlsx) que o garmin_time_hibrido.py consome com
--sheet. É o "motor" do fluxo: subir o PDF → revisar na planilha → publicar.

Uso (PowerShell):
    py pdf_para_planilha.py "planilha-treinos.pdf"
    py pdf_para_planilha.py "planilha-treinos.pdf" saida.xlsx

Depois, revise a planilha e publique:
    py garmin_time_hibrido.py --sheet saida.xlsx --start 2026-07-06 --apply

Observação: a extração de PDF é heurística (offline). Sempre confira a planilha
antes de publicar — é fácil ajustar qualquer linha ali.
"""
from __future__ import annotations

import re
import sys

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

import garmin_time_hibrido as th

try:
    import de_para_exercicios as _dp
except Exception:
    _dp = None

# ---------------------------------------------------------------------------
# Parser do PDF (páginas de corrida)
# ---------------------------------------------------------------------------
def _day(s: str):
    m = re.search(r"([35])\s*ª", s)
    if m:
        return m.group(1) + "ª"
    if re.search(r"S[ÁA]B", s):
        return "Sáb"
    if re.search(r"DOM", s):
        return "Dom"
    return None


def parse_running_page(text: str) -> dict:
    # Cabeçalhos consomem também a duração do contínuo, pra o "20 MIN" não
    # poluir as durações do corpo do bloco.
    heads = list(re.finditer(
        r"(INTERVALADO\s+\d+\s*:\s*\d+|CONT[IÍ]NUO\s+\d+\s*MIN|PROVA)", text))
    out: dict = {}
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = " ".join(text[h.end():end].split())
        dia = _day(body)
        if not dia:
            continue
        counts = re.search(r"(\d+)\s*x\s+(\d+)\s*x\s+(\d+)\s*x", body)
        zonas = [int(z) for z in re.findall(r"Z\s*(\d)", body)]
        # Durações = os últimos k números antes do 1º "MIN" (k = qtde de MIN),
        # depois de remover contagens (14x) e zonas (Z 1). Robusto ao layout.
        clean = re.sub(r"Z\s*\d", " ", re.sub(r"\d+\s*x", " ", body))
        k = len(re.findall(r"MIN", clean))
        fm = clean.find("MIN")
        nums = [int(x) for x in re.findall(r"\d+", clean[:fm] if fm >= 0 else clean)]
        mins = nums[-k:] if k and len(nums) >= k else nums
        kms = [int(x) for x in re.findall(r"(\d+)\s*KM", body)]
        htype = h.group(1)

        if htype.startswith("INTERVALADO") and counts and len(mins) >= 4:
            reps = int(counts.group(2))
            wu_m, work_m, rec_m, cd_m = mins[0], mins[1], mins[2], mins[3]
            wz = zonas[1] if len(zonas) >= 2 else 3
            rz = zonas[2] if len(zonas) >= 3 else 1
            steps = th.intervalado(reps, work_m, rec_m, work_zone=wz, rec_zone=rz,
                                   wu_min=wu_m, cd_min=cd_m)
            out[dia] = (f"Intervalado {work_m}:{rec_m}", steps)
        elif htype.startswith("CONT") and len(mins) >= 3:
            wu_m, work_m, cd_m = mins[0], mins[1], mins[2]
            wz = zonas[1] if len(zonas) >= 2 else 3
            steps = th.continuo(work_m, run_zone=wz, wu_min=wu_m, cd_min=cd_m)
            out[dia] = (f"Contínuo {work_m} min", steps)
        elif htype.startswith("PROVA") and kms:
            wu_m = mins[0] if mins else 5
            cd_m = mins[-1] if mins else 5
            steps = [th.wu(wu_m), th.work_km(kms[0], 4), th.cd(cd_m)]
            out[dia] = (f"Prova {kms[0]} km", steps)
    return out


def parse_pdf_running(pdf: str) -> list:
    """Devolve o mesmo formato do PROGRAMA: [(semana, etapa, {dia: (rótulo, passos)})]."""
    program = []
    with pdfplumber.open(pdf) as doc:
        for w in range(1, 13):
            page = 10 + 7 * (w - 1)           # páginas de corrida: 10, 17, ..., 87
            text = doc.pages[page - 1].extract_text(layout=True) or ""
            days = parse_running_page(text)
            stage = "Base" if w <= 4 else ("Consolidação" if w <= 8 else "Alvo")
            program.append((w, stage, days))
    return program


# ---------------------------------------------------------------------------
# Parser do PDF (páginas de musculação)
# ---------------------------------------------------------------------------
def _norm_tec(t: str) -> str:
    t = re.sub(r"\s*-\s*", "-", t)              # "DROP - SET" -> "DROP-SET"
    t = re.sub(r"\bB\s+I-SET\b", "BI-SET", t)   # "B I-SET" -> "BI-SET"
    return t.strip()


def parse_strength_page(text: str):
    lines = [" ".join(l.split()) for l in text.splitlines() if l.strip()]
    treino = grupo = None
    for i, l in enumerate(lines):
        if re.match(r"TREINO\s+[A-E]\b", l):
            treino = l.split()[-1]
            if i + 1 < len(lines):
                grupo = lines[i + 1]
            break
    if not treino:
        return None
    exercicios, bloco, tec = [], None, None
    for l in lines:
        mb = re.match(r"BLOCO\s+0?(\d+)\s*-\s*(.+)", l)
        if mb:
            bloco, tec = int(mb.group(1)), _norm_tec(mb.group(2))
            continue
        me = re.match(r"^(\d+)\s*X\s*(.+)$", l, re.I)
        if me:
            series, resto = int(me.group(1)), me.group(2)
            base_reps = None
            for chunk in re.split(r"\s\+\s", resto):     # separa bi-set/super-set
                chunk = chunk.strip()
                mr = re.match(r"^([\d\s\-/()]*\d[\d\s\-/()]*)\s*([A-ZÀ-Ú].*)$", chunk)
                if mr:
                    reps, nome = mr.group(1).strip(), mr.group(2).strip()
                    if base_reps is None:
                        base_reps = reps
                else:                        # 2º exercício sem reps próprias: herda
                    reps, nome = (base_reps or ""), chunk
                exercicios.append((bloco, tec, nome, series, reps))
        elif tec and "AQUECIMENTO" in tec and not any(e[0] == bloco for e in exercicios):
            exercicios.append((bloco, tec, l, None, None))
    return {"treino": treino, "grupo": grupo, "exercicios": exercicios}


def parse_pdf_strength(pdf: str) -> list:
    """Devolve [(semana, treino, grupo, [(bloco, tecnica, exercicio, series, reps)])]."""
    rows = []
    with pdfplumber.open(pdf) as doc:
        for w in range(1, 13):
            base = 10 + 7 * (w - 1)
            for i in range(1, 6):                  # 5 páginas de força por semana
                page = base + i
                if page - 1 < len(doc.pages):
                    d = parse_strength_page(doc.pages[page - 1].extract_text() or "")
                    if d:
                        rows.append((w, d["treino"], d["grupo"], d["exercicios"]))
    return rows


# ---------------------------------------------------------------------------
# Escrita da planilha editável
# ---------------------------------------------------------------------------
HEADERS = [
    "semana", "etapa", "dia", "tipo",
    "aquecimento_min", "reps", "esforco_min", "esforco_zona",
    "recuperacao_min", "recuperacao_zona", "desaquecimento_min",
    "distancia_km", "notas",
]


def _flatten(steps: list) -> dict:
    wu, mid, cd = steps[0], steps[1], steps[-1]
    row = {
        "aquecimento_min": int(wu["sec"] // 60),
        "desaquecimento_min": int(cd["sec"] // 60),
        "reps": None, "esforco_min": None, "esforco_zona": None,
        "recuperacao_min": None, "recuperacao_zona": None, "distancia_km": None,
    }
    if mid["kind"] == "repeat":
        work, rec = mid["steps"]
        row.update(tipo="intervalado", reps=mid["reps"],
                   esforco_min=int(work["sec"] // 60), esforco_zona=work["zone"],
                   recuperacao_min=int(rec["sec"] // 60), recuperacao_zona=rec["zone"])
    elif "meters" in mid:
        row.update(tipo="prova", distancia_km=int(mid["meters"] // 1000),
                   esforco_zona=mid["zone"])
    else:
        row.update(tipo="contínuo", esforco_min=int(mid["sec"] // 60),
                   esforco_zona=mid["zone"])
    return row


STRENGTH_HEADERS = ["semana", "treino", "grupo", "bloco", "tecnica",
                    "exercicio", "series", "reps", "descanso_seg", "notas"]


def _add_strength_sheet(wb, strength_rows) -> int:
    ws = wb.create_sheet("Musculação")
    header_fill = PatternFill("solid", fgColor="5B3A29")
    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
    body_font = Font(name="Arial", size=11)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    treino_fills = {"A": "F3E9E2", "B": "EDE7F3", "C": "E6F0EC",
                    "D": "FBF0E1", "E": "E9EFF6"}

    ws.append(STRENGTH_HEADERS)
    for c in range(1, len(STRENGTH_HEADERS) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill, cell.font = header_fill, header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    n = 0
    for (semana, treino, grupo, exs) in strength_rows:
        for (bloco, tec, nome, series, reps) in exs:
            ws.append([semana, treino, grupo, bloco, tec, nome, series, reps,
                       60 if series else None, ""])
            i = ws.max_row
            fill = PatternFill("solid", fgColor=treino_fills.get(treino, "FFFFFF"))
            for c in range(1, len(STRENGTH_HEADERS) + 1):
                cell = ws.cell(row=i, column=c)
                cell.font, cell.border = body_font, border
                cell.alignment = Alignment(
                    horizontal="left" if c in (3, 6, 10) else "center", vertical="center")
                if c <= 2:
                    cell.fill = fill
            n += 1

    for i, w in enumerate([8, 8, 24, 7, 18, 40, 7, 12, 13, 30], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    total = ws.max_row
    dvt = DataValidation(type="list", formula1='"A,B,C,D,E"', allow_blank=True)
    ws.add_data_validation(dvt)
    dvt.add(f"B2:B{total}")
    return n


def _add_depara_sheet(wb) -> int:
    if _dp is None:
        return 0
    ws = wb.create_sheet("De-para")
    headers = ["exercicio_pt", "garmin_category", "garmin_exercise",
               "garmin_label", "confianca", "obs"]
    header_fill = PatternFill("solid", fgColor="2E5D34")
    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
    body_font = Font(name="Arial", size=11)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    conf_fill = {"alta": "E6F4EA", "média": "FEF7E0", "baixa": "FCE8E6"}

    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill, cell.font = header_fill, header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    for pt in sorted(_dp.MAPA):
        cat, ex, conf = _dp.MAPA[pt]
        ws.append([pt, cat, ex, _dp.label(ex), conf, ""])
        i = ws.max_row
        fill = PatternFill("solid", fgColor=conf_fill.get(conf, "FFFFFF"))
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=i, column=c)
            cell.font, cell.border = body_font, border
            cell.alignment = Alignment(
                horizontal="left" if c in (1, 3, 4, 6) else "center", vertical="center")
            ws.cell(row=i, column=5).fill = fill
    for i, w in enumerate([40, 20, 34, 30, 11, 30], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    n = ws.max_row
    dvc = DataValidation(type="list", formula1='"alta,média,baixa"', allow_blank=True)
    ws.add_data_validation(dvc)
    dvc.add(f"E2:E{n}")
    return len(_dp.MAPA)


def build_sheet(program: list, strength_rows: list, out_path: str) -> tuple:
    wb = Workbook()
    ws = wb.active
    ws.title = "Corrida"

    header_fill = PatternFill("solid", fgColor="1F4E5F")
    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
    body_font = Font(name="Arial", size=11)
    stage_fills = {"Base": "E8F1F5", "Consolidação": "FCEFE3", "Alvo": "EFE6F5"}
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws.append(HEADERS)
    for c in range(1, len(HEADERS) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill, cell.font = header_fill, header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    for week, stage, days in program:
        for dia, (_label, steps) in days.items():
            r = _flatten(steps)
            ws.append([
                week, stage, dia, r["tipo"], r["aquecimento_min"], r["reps"],
                r["esforco_min"], r["esforco_zona"], r["recuperacao_min"],
                r["recuperacao_zona"], r["desaquecimento_min"], r["distancia_km"], "",
            ])
            i = ws.max_row
            fill = PatternFill("solid", fgColor=stage_fills.get(stage, "FFFFFF"))
            for c in range(1, len(HEADERS) + 1):
                cell = ws.cell(row=i, column=c)
                cell.font, cell.border = body_font, border
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if c <= 4:
                    cell.fill = fill
            ws.cell(row=i, column=13).alignment = Alignment(horizontal="left")

    for i, w in enumerate([8, 14, 6, 12, 15, 7, 12, 13, 16, 17, 18, 13, 40], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"

    n = ws.max_row
    def dv(col, options):
        d = DataValidation(type="list", formula1=f'"{options}"', allow_blank=True)
        ws.add_data_validation(d)
        d.add(f"{col}2:{col}{n}")
    dv("B", "Base,Consolidação,Alvo")
    dv("C", "3ª,5ª,Sáb,Dom")
    dv("D", "intervalado,contínuo,prova")
    dv("H", "1,2,3,4,5")
    dv("J", "1,2,3,4,5")

    n_musc = _add_strength_sheet(wb, strength_rows)
    n_dp = _add_depara_sheet(wb)

    doc = wb.create_sheet("Leia-me")
    doc.column_dimensions["A"].width = 100
    linhas = [
        ("Time Híbrido — planilha de treinos (fonte da verdade)", True),
        ("", False),
        ("Gerada a partir do PDF. Confira os valores antes de publicar", False),
        ("(a leitura do PDF é heurística).", False),
        ("", False),
        ("Aba CORRIDA — cada linha é um treino:", True),
        ("  'tipo': intervalado (reps/esforço/recuperação) · contínuo (só esforço) · prova (distância).", False),
        ("  'notas' aparece na descrição do treino no relógio.", False),
        ("", False),
        ("Aba MUSCULAÇÃO — cada linha é um exercício:", True),
        ("  bi-set/super-set aparecem como linhas seguidas com o mesmo 'bloco'.", False),
        ("  'descanso_seg' vem com padrão 60s (o PDF não especifica) — ajuste à vontade.", False),
        ("  Exercícios se repetem por etapa; só as reps mudam a cada semana.", False),
        ("  (A publicação da musculação no Garmin ainda está em construção.)", False),
        ("", False),
        ("Aba DE-PARA — mapeia cada exercício para o catálogo do Garmin:", True),
        ("  par (garmin_category / garmin_exercise) é o identificador do Garmin.", False),
        ("  'confianca': alta/média/baixa. Revise as BAIXA (máquinas sem equivalente exato).", False),
        ("  Para trocar, use outro par válido do catálogo do Garmin.", False),
        ("", False),
        ("Zonas de FC (defina no Garmin por % da FCmáx):", True),
        ("  Z1 50–59% · Z2 60–69% · Z3 70–79% · Z4 80–89% · Z5 90–95%", False),
    ]
    for i, (txt, bold) in enumerate(linhas, start=1):
        doc.cell(row=i, column=1, value=txt).font = Font(
            name="Arial", bold=bold, size=(13 if bold and i == 1 else 11))

    wb.save(out_path)
    return n - 1, n_musc


# ---------------------------------------------------------------------------
def main() -> None:
    if len(sys.argv) < 2:
        sys.exit('uso: py pdf_para_planilha.py "planilha-treinos.pdf" [saida.xlsx]')
    pdf = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "data/time_hibrido.xlsx"
    program = parse_pdf_running(pdf)
    if sum(len(days) for _, _, days in program) == 0:
        sys.exit("Não encontrei treinos de corrida no PDF. O layout pode ser diferente "
                 "do esperado — me mande o PDF que eu ajusto o parser.")
    strength = parse_pdf_strength(pdf)
    n_corr, n_musc = build_sheet(program, strength, out)
    dp_txt = f" + de-para de exercícios" if _dp else ""
    print(f"✓ {n_corr} treinos de corrida + {n_musc} exercícios de musculação{dp_txt} → {out}")
    print("Revise a planilha. Corrida já publica com:")
    print(f'  py garmin_time_hibrido.py --sheet "{out}" --start AAAA-MM-DD --apply')
    print("(A publicação da musculação está em construção — próxima fase.)")


if __name__ == "__main__":
    main()
