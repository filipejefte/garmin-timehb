#!/usr/bin/env python3
"""
Montador de treinos de MUSCULAÇÃO para o Garmin.
Lê as abas 'Musculação' e 'De-para' da planilha e monta um treino de força do
Garmin por dia (Semana × Treino A–E).

Regras:
- Cada exercício vira um passo com o par (category, exerciseName) do Garmin.
- Séries iguais (ex.: 4×15) viram um grupo de repetição ×4 [exercício, descanso].
- Pirâmide (ex.: 15-12-10-8-6) vira um passo por valor de rep, cada um + descanso.
- Bi-set / super-set: exercícios em sequência dentro do grupo, descanso só ao final.
- O NOME ORIGINAL do PDF + a TÉCNICA vão na descrição de cada exercício (notas),
  preservando o que o catálogo do Garmin não representa.

IDs do Garmin (confirmados na biblioteca garminconnect):
  sportType strength_training = 5 · stepType interval=3 / rest=5 / repeat=6
  endCondition reps=10 / time=2 / iterations=7
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from openpyxl import load_workbook

# Treino -> dia da semana (0=segunda ... 6=domingo).
# Padrão: musculação de sábado a quarta (A=Sáb, B=Dom, C=Seg, D=Ter, E=Qua).
TREINOS = ["A", "B", "C", "D", "E"]
DEFAULT_WEEKDAY_MAP = {"A": 5, "B": 6, "C": 0, "D": 1, "E": 2}


def _weekday_offsets(weekday_map: dict) -> dict:
    """Converte {treino: dia_da_semana(0-6)} em offsets de dias a partir da
    segunda-feira da semana. Quando a sequência de dias recua (ex.: Sáb→Seg),
    entende que virou a semana: Sáb,Dom,Seg,Ter,Qua → 5,6,7,8,9."""
    offsets, week, prev = {}, 0, -1
    for t in TREINOS:
        wd = weekday_map.get(t)
        if wd is None:
            continue
        wd = int(wd)
        if wd <= prev:
            week += 1
        offsets[t] = week * 7 + wd
        prev = wd
    return offsets

SPORT = {"sportTypeId": 5, "sportTypeKey": "strength_training", "displayOrder": 5}
GRUPO_CURTO = {
    "PEITO, OMBRO E TRÍCEPS": "Peito/Ombro/Tríceps",
    "MEMBROS INFERIORES": "Inferiores",
    "COSTAS E BÍCEPS": "Costas/Bíceps",
    "OMBROS E ABDOMINAL": "Ombro/Abdômen",
    "BÍCEPS E TRÍCEPS": "Bíceps/Tríceps",
}


# ---------------------------------------------------------------------------
# Leitura da planilha
# ---------------------------------------------------------------------------
def _read_rows(ws):
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip().lower() if h is not None else "" for h in rows[0]]
    idx = {h: i for i, h in enumerate(header)}
    out = []
    for r in rows[1:]:
        if all(c is None or c == "" for c in r):
            continue
        out.append({h: (r[i] if i < len(r) else None) for h, i in idx.items()})
    return out


def load_from_sheet(path: str):
    wb = load_workbook(path, data_only=True)
    musc = _read_rows(wb["Musculação"])
    depara = {}
    if "De-para" in wb.sheetnames:
        for d in _read_rows(wb["De-para"]):
            pt = str(d.get("exercicio_pt", "") or "").strip().upper()
            if pt:
                depara[pt] = (d.get("garmin_category"), d.get("garmin_exercise"))
    return musc, depara


# ---------------------------------------------------------------------------
# Construção do JSON
# ---------------------------------------------------------------------------
def _reps_list(reps) -> list:
    nums = re.findall(r"\d+", str(reps if reps is not None else ""))
    return [int(n) for n in nums] or [10]


def _e_piramide(reps_raw) -> bool:
    """Distingue pirâmide de série com dois pesos.

    Na planilha a pirâmide vem entre parênteses e com hífen - "(15-12-10-8-6)".
    Já "6 / 12" (6 pesadas + 12 leves) são dois passos DENTRO da mesma série.
    Sem essa distinção, "6 / 12" virava pirâmide e as 4 séries se perdiam.
    """
    return "-" in str(reps_raw if reps_raw is not None else "")


def _exercise_step(order, category, exercise, reps, nota, aquecimento=False):
    # Exercícios cuja técnica é AQUECIMENTO viram passo warmup (id 1), como o
    # Filipe fazia à mão; os demais são interval (id 3).
    st = ({"stepTypeId": 1, "stepTypeKey": "warmup", "displayOrder": 1} if aquecimento
          else {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3})
    return {
        "type": "ExecutableStepDTO",
        "stepOrder": order,
        "stepType": st,
        "endCondition": {"conditionTypeId": 10, "conditionTypeKey": "reps",
                         "displayOrder": 10, "displayable": True},
        "endConditionValue": float(reps),
        "category": category,
        "exerciseName": exercise,
        "description": nota,
    }


def _rest_step(order, secs):
    return {
        "type": "ExecutableStepDTO",
        "stepOrder": order,
        "stepType": {"stepTypeId": 5, "stepTypeKey": "rest", "displayOrder": 5},
        "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time",
                         "displayOrder": 2, "displayable": True},
        "endConditionValue": float(secs),
    }


def _rest_lap_step(order, nota=None):
    """Descanso aberto: só termina quando se aperta o botão Lap.

    Usado entre os dois exercícios de um bi-set/super-set - tecnicamente não
    há descanso, mas é preciso trocar de aparelho, e um passo por tempo
    obrigaria a esperar. conditionTypeId 1 = lap.button (sem valor)."""
    return {
        "type": "ExecutableStepDTO",
        "stepOrder": order,
        "stepType": {"stepTypeId": 5, "stepTypeKey": "rest", "displayOrder": 5},
        "endCondition": {"conditionTypeId": 1, "conditionTypeKey": "lap.button",
                         "displayOrder": 1, "displayable": True},
        "endConditionValue": None,
        "description": nota or "Troca de aparelho - aperte Lap para seguir",
    }


def _repeat_group(order, iterations, child):
    return {
        "type": "RepeatGroupDTO",
        "stepOrder": order,
        "stepType": {"stepTypeId": 6, "stepTypeKey": "repeat", "displayOrder": 6},
        "numberOfIterations": int(iterations),
        "smartRepeat": False,
        "endCondition": {"conditionTypeId": 7, "conditionTypeKey": "iterations",
                         "displayOrder": 7, "displayable": False},
        "endConditionValue": float(iterations),
        "workoutSteps": child,
    }


# ---------------------------------------------------------------------------
# Aquecimento / mobilidade
# ---------------------------------------------------------------------------
# A planilha traz o aquecimento como uma linha sem séries ("AQUECIMENTO/
# MOBILIDADE PRÉ TREINO DE SUPERIORES" e "FLEXIBILIDADE E ..."), que sozinha
# não dá para montar. Os blocos abaixo reproduzem exatamente o que o Filipe
# montou à mão no Garmin (treinos "A - Peito + Ombro + Tríceps (5)" para
# superiores e "C - Membros Inferiores" para inferiores), lidos da conta dele
# em 12/08/2026. Todos os pares (category, exercise) conferidos contra
# data/garmin_exercises.json.
#   ('t', segundos, cat, ex, séries)  -> passo por tempo
#   ('r', reps,     cat, ex, séries)  -> passo por repetições
AQUECIMENTO = {
    "superiores": [
        ("t", 240, "WARM_UP", "STRETCH_SHOULDER", 1),
        ("r", 15, "SHOULDER_STABILITY", "CABLE_EXTERNAL_ROTATION", 2),
        ("r", 15, "SHOULDER_STABILITY", "CABLE_INTERNAL_ROTATION", 2),
    ],
    "inferiores": [
        ("t", 20, "SQUAT", "STAGGERED_SQUAT", 1),
        ("t", 60, "WARM_UP", "STRETCH_LUNGING_HIP_FLEXOR", 1),
        ("t", 40, "HIP_STABILITY", "LYING_ABDUCTION_STRETCH", 1),
        ("t", 30, "WARM_UP", "STRETCH_HIP_FLEXOR_AND_QUAD", 1),
        ("r", 20, "SQUAT", "SQUAT", 1),
    ],
}


def _warmup_step(order, modo, valor, category, exercise, nota):
    """Passo de aquecimento (stepType warmup=1), por tempo ou por repetições."""
    cond = ({"conditionTypeId": 2, "conditionTypeKey": "time",
             "displayOrder": 2, "displayable": True} if modo == "t" else
            {"conditionTypeId": 10, "conditionTypeKey": "reps",
             "displayOrder": 10, "displayable": True})
    return {
        "type": "ExecutableStepDTO",
        "stepOrder": order,
        "stepType": {"stepTypeId": 1, "stepTypeKey": "warmup", "displayOrder": 1},
        "endCondition": cond,
        "endConditionValue": float(valor),
        "category": category,
        "exerciseName": exercise,
        "description": nota,
    }


# O texto da planilha vem truncado do PDF ("FLEXIBILIDADE E"), então usamos um
# rótulo limpo na descrição de cada passo - é o que aparece no relógio.
ROTULO_AQUEC = {
    "superiores": "Aquecimento/mobilidade · superiores",
    "inferiores": "Flexibilidade e mobilidade · inferiores",
}


def _build_warmup(order, tipo, nota=None):
    """Monta o bloco de aquecimento; séries > 1 viram grupo de repetição."""
    nota = ROTULO_AQUEC[tipo]
    steps = []
    for (modo, valor, cat, ex, series) in AQUECIMENTO[tipo]:
        if series > 1:
            grp_order = order
            order += 1
            child = [_warmup_step(order, modo, valor, cat, ex, nota)]
            order += 1
            steps.append(_repeat_group(grp_order, series, child))
        else:
            steps.append(_warmup_step(order, modo, valor, cat, ex, nota))
            order += 1
    return steps, order


def _tipo_aquecimento(grupo: str) -> str:
    """'MEMBROS INFERIORES' -> inferiores; o resto é treino de superiores."""
    return "inferiores" if "INFERIOR" in (grupo or "").upper() else "superiores"


def _build_block(order, tecnica, exercises):
    """exercises: lista de dicts {category, exercise, reps_list, series, descanso, nome_pt}.

    TODO bloco vira um grupo de repetição (o "recurso de séries" do Garmin) -
    nada de passo solto. Três formatos de reps na planilha:

    - simples ("15")        -> N séries de 15 reps.
    - "6 / 12"              -> N séries com os dois passos dentro
                               (6 pesadas + 12 leves), separados por descanso.
    - "(15-12-10-8-6)"      -> pirâmide: uma série por valor. O Garmin só
                               repete passos idênticos, então usamos a 1ª rep
                               como referência e a sequência inteira vai na
                               descrição, que é o que aparece no relógio.
                               (Mesmo formato que o Filipe montou à mão.)
    """
    tec = (tecnica or "").strip()
    aq = tec.upper().startswith("AQUEC")          # bloco de aquecimento da planilha
    multi = len(exercises) > 1                    # bi-set / super-set
    ex0 = exercises[0]
    reps0 = ex0["reps_list"]
    piramide = (not multi) and len(reps0) > 1 and _e_piramide(ex0["reps_raw"])
    duplo = (not multi) and len(reps0) > 1 and not piramide   # ex.: "6 / 12"

    if piramide:
        # N séries = quantidade de valores; a sequência fica na descrição.
        seq = "-".join(str(r) for r in reps0)
        nota = f"{ex0['nome_pt']} · {tec} {seq} (baixe a rep a cada série)"
        child = [_exercise_step(order + 1, ex0["category"], ex0["exercise"], reps0[0], nota, aq),
                 _rest_step(order + 2, ex0["descanso"])]
        return [_repeat_group(order, len(reps0), child)], order + 3

    if duplo:
        # N séries, cada uma com os dois passos dentro (ex.: 6 pesadas + 12 leves).
        series = ex0["series"] or 1
        child, o = [], order + 1
        for i, r in enumerate(reps0, 1):
            nota = f"{ex0['nome_pt']} · {tec} ({i}/{len(reps0)})"
            child.append(_exercise_step(o, ex0["category"], ex0["exercise"], r, nota, aq)); o += 1
            if i < len(reps0):
                # mesmo exercício, muda só a carga
                child.append(_rest_lap_step(o, "Troque a carga - aperte Lap para seguir")); o += 1
        child.append(_rest_step(o, ex0["descanso"])); o += 1
        return [_repeat_group(order, series, child)], o

    # normal ou bi-set/super-set: grupo ×série [exercícios..., descanso]
    series = exercises[0]["series"] or 1
    group_order = order
    order += 1
    child = []
    for j, ex in enumerate(exercises, 1):
        r = ex["reps_list"][0]
        marca = tec if not multi else f"{tec} ({j}/{len(exercises)})"
        nota = f"{ex['nome_pt']} · {marca}"
        child.append(_exercise_step(order, ex["category"], ex["exercise"], r, nota, aq)); order += 1
        # Bi-set/super-set: entre um exercício e o outro não há descanso, mas é
        # preciso trocar de aparelho -> passo aberto, encerrado no botão Lap.
        if multi and j < len(exercises):
            child.append(_rest_lap_step(order)); order += 1
    child.append(_rest_step(order, exercises[0]["descanso"])); order += 1
    return [_repeat_group(group_order, series, child)], order


def build_day(week, treino, grupo, blocks, start_monday=None, weekday_map=None,
              aquecimento=None):
    steps, order = [], 1
    if aquecimento:
        blk, order = _build_warmup(order, _tipo_aquecimento(grupo), aquecimento)
        steps += blk
    for (bloco, tecnica, exercises) in blocks:
        blk, order = _build_block(order, tecnica, exercises)
        steps += blk
    grp = GRUPO_CURTO.get((grupo or "").strip().upper(), (grupo or "").title())
    # Nomenclatura (12/08/2026): "S01 A · Peito + Ombro + Tríceps".
    # Sem o prefixo TH-M; a letra do treino fica porque é o que identifica o
    # treino na planilha. Mesma regra da corrida ("S01 · Intervalado 1:1").
    name = f"S{week:02d} {treino} · {grp}"
    when = None
    if start_monday is not None:
        offsets = _weekday_offsets(weekday_map or DEFAULT_WEEKDAY_MAP)
        off = offsets.get(str(treino).strip().upper())
        if off is not None:
            monday = start_monday + timedelta(days=7 * (week - 1))
            when = (monday + timedelta(days=off)).isoformat()
    return {
        "week": week, "treino": treino,
        "name": name, "date": when,
        "payload": {
            "workoutName": name,
            "description": f"Time Híbrido · Musculação · Semana {week:02d} · "
                           f"Treino {treino} · {grupo}",
            "sportType": SPORT,
            "workoutSegments": [{"segmentOrder": 1, "sportType": SPORT,
                                 "workoutSteps": steps}],
        },
    }


def build_all_strength(path: str, start_monday=None, weekday_map=None) -> list:
    musc, depara = load_from_sheet(path)
    # agrupa por (semana, treino) preservando ordem, e dentro por bloco
    dias: dict = {}
    for row in musc:
        wk = int(row["semana"]); tr = str(row["treino"]).strip()
        grupo = str(row.get("grupo", "") or "")
        nome_pt = str(row.get("exercicio", "") or "").strip()
        if not row.get("series"):
            # Linha de aquecimento/mobilidade: não tem séries nem par no
            # de-para, então guardamos só o texto e montamos o bloco fixo
            # de AQUECIMENTO (ver _build_warmup) na hora de gerar o treino.
            dias.setdefault((wk, tr), {"grupo": grupo, "blocos": {}})
            dias[(wk, tr)].setdefault("aquecimento", nome_pt)
            continue
        cat_ex = depara.get(nome_pt.upper())
        if not cat_ex or not cat_ex[0] or not cat_ex[1]:
            continue                     # sem mapeamento válido -> ignora (revisar de-para)
        bloco = row.get("bloco")
        key = (wk, tr)
        dias.setdefault(key, {"grupo": grupo, "blocos": {}})
        b = dias[key]["blocos"].setdefault(bloco, {"tecnica": row.get("tecnica"), "ex": []})
        b["ex"].append({
            "category": cat_ex[0], "exercise": cat_ex[1],
            "reps_list": _reps_list(row.get("reps")),
            "reps_raw": row.get("reps"),
            "series": int(row["series"]),
            "descanso": int(row.get("descanso_seg") or 60),
            "nome_pt": nome_pt,
        })

    workouts = []
    for (wk, tr) in sorted(dias):
        d = dias[(wk, tr)]
        blocks = [(bloco, v["tecnica"], v["ex"]) for bloco, v in d["blocos"].items()]
        workouts.append(build_day(wk, tr, d["grupo"], blocks,
                                   start_monday=start_monday, weekday_map=weekday_map,
                                   aquecimento=d.get("aquecimento")))
    return workouts


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "data/time_hibrido.xlsx"
    ws = build_all_strength(path)
    print(f"{len(ws)} treinos de musculação montados a partir de {path}")
