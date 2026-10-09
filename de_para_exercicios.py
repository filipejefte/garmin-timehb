#!/usr/bin/env python3
"""
De-para: exercícios (português, do PDF) → catálogo do Garmin (CATEGORY, EXERCISE).
O identificador do Garmin é o par textual (CATEGORY_KEY, EXERCISE_KEY).

Confiança:
  alta  = correspondência direta e inequívoca
  média = correspondência boa, mas com alguma escolha (variação/pegada)
  baixa = o Garmin não tem o exercício exato (máquina BR); é o mais próximo — REVISAR

Edite à vontade: mude a category/exercise de qualquer linha para outro par do
catálogo. A aba "De-para" da planilha reflete este mapa.
"""

# nome_em_portugues (maiúsculas, como sai do PDF) -> (CATEGORY, EXERCISE, confiança)
MAPA = {
    # ---- PEITO ----
    "SUPINO INCLINADO C/ HALTERES": ("BENCH_PRESS", "INCLINE_DUMBBELL_BENCH_PRESS", "alta"),
    "SUPINO INCL C/ HALTERES": ("BENCH_PRESS", "INCLINE_DUMBBELL_BENCH_PRESS", "alta"),
    "SUPINO RETO C/ HALTERES": ("BENCH_PRESS", "DUMBBELL_BENCH_PRESS", "alta"),
    "CRUCÍFIXO INCL": ("FLYE", "INCLINE_DUMBBELL_FLYE", "alta"),
    "CRUCÍFIXO RETO": ("FLYE", "DUMBBELL_FLYE", "alta"),
    "CRUCIFIXO INVERTIDO": ("FLYE", "INCLINE_REVERSE_FLYE", "média"),
    "PECKDECK": ("FLYE", "CABLE_CROSSOVER", "baixa"),
    "VOADOR POLIDA ALTA": ("FLYE", "CABLE_CROSSOVER", "baixa"),
    "FALHA FLEXÃO C/ PONTO ZERO": ("PUSH_UP", "PUSH_UP", "média"),
    "FLEXÃO": ("PUSH_UP", "PUSH_UP", "alta"),
    "FLEXÃO FECHADA": ("PUSH_UP", "CLOSE_HANDS_PUSH_UP", "alta"),
    # ---- OMBRO ----
    "DESENVOLVIMENTO C/ HALTERES": ("SHOULDER_PRESS", "DUMBBELL_SHOULDER_PRESS", "alta"),
    "ELEVAÇÃO FRONTAL": ("LATERAL_RAISE", "FRONT_RAISE", "alta"),
    "ELEVAÇÃO LATERAL": ("LATERAL_RAISE", "DUMBBELL_LATERAL_RAISE", "alta"),
    "ELEVAÇÃO LATERAL COM ANILHAS (DROPSET)": ("LATERAL_RAISE", "PLATE_RAISES", "média"),
    "REMADA ALTA": ("SHRUG", "DUMBBELL_UPRIGHT_ROW", "alta"),
    "POSTERIOR DE OMBROS NA POLIA": ("FLYE", "SINGLE_ARM_STANDING_CABLE_REVERSE_FLYE", "média"),
    # ---- TRÍCEPS ----
    "TRÍCEPS TESTA C/ HALTERES": ("TRICEPS_EXTENSION", "DUMBBELL_LYING_TRICEPS_EXTENSION", "alta"),
    "TRÍCEPS C/ BARRA": ("TRICEPS_EXTENSION", "TRICEPS_PRESSDOWN", "média"),
    "TRÍCEPS BARRA": ("TRICEPS_EXTENSION", "TRICEPS_PRESSDOWN", "média"),
    "TRÍCEPS FRANCÊS": ("TRICEPS_EXTENSION", "OVERHEAD_DUMBBELL_TRICEPS_EXTENSION", "alta"),
    "TRÍCEPS CORDA": ("TRICEPS_EXTENSION", "ROPE_PRESSDOWN", "alta"),
    "TRÍCEPS C/ CORDA": ("TRICEPS_EXTENSION", "ROPE_PRESSDOWN", "alta"),
    "TRICEPS C/ CORDA": ("TRICEPS_EXTENSION", "ROPE_PRESSDOWN", "alta"),
    "TRÍCEPS COICE": ("TRICEPS_EXTENSION", "DUMBBELL_KICKBACK", "alta"),
    "TRÍCEPS COICE C/ HALTERES": ("TRICEPS_EXTENSION", "DUMBBELL_KICKBACK", "alta"),
    "TRÍCEPS MERGULHO": ("TRICEPS_EXTENSION", "BENCH_DIP", "média"),
    # ---- BÍCEPS ----
    "BÍCEPS C/ BARRA W": ("CURL", "STANDING_EZ_BAR_BICEPS_CURL", "alta"),
    "BÍCEPS C/ CORDA": ("CURL", "CABLE_HAMMER_CURL", "média"),
    "BICEPS C/ CORDA": ("CURL", "CABLE_HAMMER_CURL", "média"),
    "BÍCEPS CONCENTRADO": ("CURL", "ONE_ARM_CONCENTRATION_CURL", "alta"),
    "BÍCEPS MARTELO C/ HALTERES": ("CURL", "DUMBBELL_HAMMER_CURL", "alta"),
    "BÍCEPS ROCA INVERSA": ("CURL", "REVERSE_EZ_BAR_CURL", "média"),
    "BÍCEPS ROSCA INVERSA": ("CURL", "REVERSE_EZ_BAR_CURL", "alta"),
    "BÍCEPS ROSCA ARNOLD": ("CURL", "TWISTING_STANDING_DUMBBELL_BICEPS_CURL", "baixa"),
    "ROSCA ARNOLD": ("CURL", "TWISTING_STANDING_DUMBBELL_BICEPS_CURL", "baixa"),
    # ---- COSTAS ----
    "PULLDOWN": ("PULL_UP", "LAT_PULLDOWN", "alta"),
    "PUXADA ALTA": ("PULL_UP", "LAT_PULLDOWN", "alta"),
    "REMADA CURVADA C/ BARRA": ("ROW", "BENT_OVER_ROW_WITH_BARBELL", "alta"),
    "REMADA BAIXA": ("ROW", "SEATED_CABLE_ROW", "alta"),
    "REMADA C/ HALTERES": ("ROW", "DUMBBELL_ROW", "alta"),
    "REMADA CAVALINHO": ("ROW", "T_BAR_ROW", "alta"),
    "REMADA SUPINADA": ("ROW", "REVERSE_GRIP_BARBELL_ROW", "alta"),
    "SERROTE C/ HALTERES": ("ROW", "DUMBBELL_ROW", "alta"),
    # ---- PERNAS ----
    "TERRA DEADLIFT": ("DEADLIFT", "BARBELL_DEADLIFT", "alta"),
    "STIFF": ("DEADLIFT", "STRAIGHT_LEG_DEADLIFT", "alta"),
    "AGACHAMENTO LIVRE": ("SQUAT", "BARBELL_BACK_SQUAT", "alta"),
    "AGACHAMENTO C/ PESO DO CORPO": ("SQUAT", "AIR_SQUAT", "alta"),
    "AGACHAMENTO SUMÔ": ("SQUAT", "SUMO_SQUAT", "alta"),
    "LEG PRESS 45": ("SQUAT", "LEG_PRESS", "alta"),
    "CADEIRA EXTENSORA": ("BANDED_EXERCISES", "LEG_EXTENSION", "baixa"),
    "CADEIRA FLEXORA": ("LEG_CURL", "LEG_CURL", "alta"),
    "MESA FLEXORA": ("LEG_CURL", "LEG_CURL", "alta"),
    "CADEIRA ABDUTORA": ("HIP_STABILITY", "STANDING_HIP_ABDUCTION", "baixa"),
    "CADEIRA CHINESA ATÉ A FALHA": ("LEG_CURL", "LEG_CURL", "baixa"),
    "AFUNDO NO SMITH": ("LUNGE", "BARBELL_LUNGE", "média"),
    "PASSADA": ("LUNGE", "WALKING_LUNGE", "alta"),
    "BÚLGARO C/ HALTERES": ("LUNGE", "DUMBBELL_BULGARIAN_SPLIT_SQUAT", "alta"),
    # ---- CORE / ABDÔMEN ----
    "ABDOMINAL": ("CRUNCH", "CRUNCH", "alta"),
    "ABDOMINAL CRUNCH NA POLIA": ("CRUNCH", "CABLE_CRUNCH", "alta"),
    "ELEVAÇÃO DE PERNAS": ("LEG_RAISE", "LYING_STRAIGHT_LEG_RAISE", "alta"),
    "CANIVETE": ("SIT_UP", "V_UP", "alta"),
    "ROLINHO": ("CORE", "KNEELING_AB_WHEEL", "alta"),
    "MIN PRANCHA": ("PLANK", "PLANK", "alta"),
}


def label(exercise_key: str) -> str:
    """Nome legível a partir da chave (ex.: INCLINE_DUMBBELL_BENCH_PRESS -> Incline Dumbbell Bench Press)."""
    return exercise_key.replace("_", " ").title()


def lookup(nome_pt: str):
    """Devolve (category, exercise, confiança) ou None se não mapeado."""
    return MAPA.get(nome_pt.strip().upper())
