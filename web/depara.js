/**
 * De-para padrão: exercício do PDF (português) → catálogo do Garmin.
 * Base: de_para_exercicios.py + os exercícios do PDF "3KM · Iniciante Nível 1".
 * Usado quando a página lê um PDF (a planilha traz o próprio De-para).
 * Todos os pares conferidos contra data/garmin_exercises.json. Confiança: alta / média / baixa (revisar).
 */
(function (raiz) {
  'use strict';
  const DEPARA_PADRAO = [
    {
      "exercicio_pt": "ABDOMINAL",
      "garmin_category": "CRUNCH",
      "garmin_exercise": "CRUNCH",
      "garmin_label": "Crunch",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ABDOMINAL CRUNCH NA POLIA",
      "garmin_category": "CRUNCH",
      "garmin_exercise": "CABLE_CRUNCH",
      "garmin_label": "Cable Crunch",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "AFUNDO NO SMITH",
      "garmin_category": "LUNGE",
      "garmin_exercise": "BARBELL_LUNGE",
      "garmin_label": "Barbell Lunge",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "AGACHAMENTO C/ PESO DO CORPO",
      "garmin_category": "SQUAT",
      "garmin_exercise": "AIR_SQUAT",
      "garmin_label": "Air Squat",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "AGACHAMENTO LIVRE",
      "garmin_category": "SQUAT",
      "garmin_exercise": "BARBELL_BACK_SQUAT",
      "garmin_label": "Barbell Back Squat",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "AGACHAMENTO SUMÔ",
      "garmin_category": "SQUAT",
      "garmin_exercise": "SUMO_SQUAT",
      "garmin_label": "Sumo Squat",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "BICEPS C/ CORDA",
      "garmin_category": "CURL",
      "garmin_exercise": "CABLE_HAMMER_CURL",
      "garmin_label": "Cable Hammer Curl",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "BULGARO",
      "garmin_category": "LUNGE",
      "garmin_exercise": "DUMBBELL_BULGARIAN_SPLIT_SQUAT",
      "garmin_label": "Dumbbell Bulgarian Split Squat",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "BÍCEPS BANCO SCOTT",
      "garmin_category": "CURL",
      "garmin_exercise": "EZ_BAR_PREACHER_CURL",
      "garmin_label": "Ez Bar Preacher Curl",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "BÍCEPS BARRA RETA",
      "garmin_category": "CURL",
      "garmin_exercise": "BARBELL_BICEPS_CURL",
      "garmin_label": "Barbell Biceps Curl",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "BÍCEPS C/ BARRA W",
      "garmin_category": "CURL",
      "garmin_exercise": "STANDING_EZ_BAR_BICEPS_CURL",
      "garmin_label": "Standing Ez Bar Biceps Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS C/ CORDA",
      "garmin_category": "CURL",
      "garmin_exercise": "CABLE_HAMMER_CURL",
      "garmin_label": "Cable Hammer Curl",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS CONCENTRADO",
      "garmin_category": "CURL",
      "garmin_exercise": "ONE_ARM_CONCENTRATION_CURL",
      "garmin_label": "One Arm Concentration Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS CORDA",
      "garmin_category": "CURL",
      "garmin_exercise": "CABLE_HAMMER_CURL",
      "garmin_label": "Cable Hammer Curl",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "BÍCEPS MARTELO C/ HALTERES",
      "garmin_category": "CURL",
      "garmin_exercise": "DUMBBELL_HAMMER_CURL",
      "garmin_label": "Dumbbell Hammer Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS ROCA INVERSA",
      "garmin_category": "CURL",
      "garmin_exercise": "REVERSE_EZ_BAR_CURL",
      "garmin_label": "Reverse Ez Bar Curl",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS ROSCA ARNOLD",
      "garmin_category": "CURL",
      "garmin_exercise": "TWISTING_STANDING_DUMBBELL_BICEPS_CURL",
      "garmin_label": "Twisting Standing Dumbbell Biceps Curl",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "BÍCEPS ROSCA INVERSA",
      "garmin_category": "CURL",
      "garmin_exercise": "REVERSE_EZ_BAR_CURL",
      "garmin_label": "Reverse Ez Bar Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "BÚLGARO C/ HALTERES",
      "garmin_category": "LUNGE",
      "garmin_exercise": "DUMBBELL_BULGARIAN_SPLIT_SQUAT",
      "garmin_label": "Dumbbell Bulgarian Split Squat",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "CADEIRA ABDUTORA",
      "garmin_category": "HIP_STABILITY",
      "garmin_exercise": "STANDING_HIP_ABDUCTION",
      "garmin_label": "Standing Hip Abduction",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "CADEIRA CHINESA",
      "garmin_category": "LEG_CURL",
      "garmin_exercise": "LEG_CURL",
      "garmin_label": "Leg Curl",
      "confianca": "baixa",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "CADEIRA CHINESA ATÉ A FALHA",
      "garmin_category": "LEG_CURL",
      "garmin_exercise": "LEG_CURL",
      "garmin_label": "Leg Curl",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "CADEIRA EXTENSORA",
      "garmin_category": "BANDED_EXERCISES",
      "garmin_exercise": "LEG_EXTENSION",
      "garmin_label": "Leg Extension",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "CADEIRA FLEXORA",
      "garmin_category": "LEG_CURL",
      "garmin_exercise": "LEG_CURL",
      "garmin_label": "Leg Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "CANIVETE",
      "garmin_category": "SIT_UP",
      "garmin_exercise": "V_UP",
      "garmin_label": "V Up",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "COICE C/ HALTERES",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "DUMBBELL_KICKBACK",
      "garmin_label": "Dumbbell Kickback",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "CRUCIFIXO INVERSO",
      "garmin_category": "FLYE",
      "garmin_exercise": "INCLINE_REVERSE_FLYE",
      "garmin_label": "Incline Reverse Flye",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "CRUCIFIXO INVERTIDO",
      "garmin_category": "FLYE",
      "garmin_exercise": "INCLINE_REVERSE_FLYE",
      "garmin_label": "Incline Reverse Flye",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "CRUCÍFIXO INCL",
      "garmin_category": "FLYE",
      "garmin_exercise": "INCLINE_DUMBBELL_FLYE",
      "garmin_label": "Incline Dumbbell Flye",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "CRUCÍFIXO RETO",
      "garmin_category": "FLYE",
      "garmin_exercise": "DUMBBELL_FLYE",
      "garmin_label": "Dumbbell Flye",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "DESENVOLVIMENTO",
      "garmin_category": "SHOULDER_PRESS",
      "garmin_exercise": "DUMBBELL_SHOULDER_PRESS",
      "garmin_label": "Dumbbell Shoulder Press",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "DESENVOLVIMENTO C/ HALTERES",
      "garmin_category": "SHOULDER_PRESS",
      "garmin_exercise": "DUMBBELL_SHOULDER_PRESS",
      "garmin_label": "Dumbbell Shoulder Press",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ELEVAÇÃO DE PERNAS",
      "garmin_category": "LEG_RAISE",
      "garmin_exercise": "LYING_STRAIGHT_LEG_RAISE",
      "garmin_label": "Lying Straight Leg Raise",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ELEVAÇÃO FRONTAL",
      "garmin_category": "LATERAL_RAISE",
      "garmin_exercise": "FRONT_RAISE",
      "garmin_label": "Front Raise",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ELEVAÇÃO FRONTAL COM HALTER (DROPSET)",
      "garmin_category": "LATERAL_RAISE",
      "garmin_exercise": "FRONT_RAISE",
      "garmin_label": "Front Raise",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "ELEVAÇÃO LATERAL",
      "garmin_category": "LATERAL_RAISE",
      "garmin_exercise": "DUMBBELL_LATERAL_RAISE",
      "garmin_label": "Dumbbell Lateral Raise",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ELEVAÇÃO LATERAL COM ANILHAS (DROPSET)",
      "garmin_category": "LATERAL_RAISE",
      "garmin_exercise": "PLATE_RAISES",
      "garmin_label": "Plate Raises",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "ENCOLHIMENTO",
      "garmin_category": "SHRUG",
      "garmin_exercise": "DUMBBELL_SHRUG",
      "garmin_label": "Dumbbell Shrug",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "ENCOLHIMENTO C/ HALTERES",
      "garmin_category": "SHRUG",
      "garmin_exercise": "DUMBBELL_SHRUG",
      "garmin_label": "Dumbbell Shrug",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "FALHA FLEXÃO C/ PONTO ZERO",
      "garmin_category": "PUSH_UP",
      "garmin_exercise": "PUSH_UP",
      "garmin_label": "Push Up",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "FLEXÃO",
      "garmin_category": "PUSH_UP",
      "garmin_exercise": "PUSH_UP",
      "garmin_label": "Push Up",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "FLEXÃO DIAMANTE",
      "garmin_category": "PUSH_UP",
      "garmin_exercise": "DIAMOND_PUSH_UP",
      "garmin_label": "Diamond Push Up",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "FLEXÃO FECHADA",
      "garmin_category": "PUSH_UP",
      "garmin_exercise": "CLOSE_HANDS_PUSH_UP",
      "garmin_label": "Close Hands Push Up",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "LEG PRESS 45",
      "garmin_category": "SQUAT",
      "garmin_exercise": "LEG_PRESS",
      "garmin_label": "Leg Press",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "MESA FLEXORA",
      "garmin_category": "LEG_CURL",
      "garmin_exercise": "LEG_CURL",
      "garmin_label": "Leg Curl",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "MIN PRANCHA",
      "garmin_category": "PLANK",
      "garmin_exercise": "PLANK",
      "garmin_label": "Plank",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "PANTURRILHA EM PÉ",
      "garmin_category": "CALF_RAISE",
      "garmin_exercise": "STANDING_CALF_RAISE",
      "garmin_label": "Standing Calf Raise",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "PASSADA",
      "garmin_category": "LUNGE",
      "garmin_exercise": "WALKING_LUNGE",
      "garmin_label": "Walking Lunge",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "PECK DECK",
      "garmin_category": "FLYE",
      "garmin_exercise": "CABLE_CROSSOVER",
      "garmin_label": "Cable Crossover",
      "confianca": "baixa",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "PECKDECK",
      "garmin_category": "FLYE",
      "garmin_exercise": "CABLE_CROSSOVER",
      "garmin_label": "Cable Crossover",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "POSTERIOR DE OMBROS NA POLIA",
      "garmin_category": "FLYE",
      "garmin_exercise": "SINGLE_ARM_STANDING_CABLE_REVERSE_FLYE",
      "garmin_label": "Single Arm Standing Cable Reverse Flye",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "PULLDOWN",
      "garmin_category": "PULL_UP",
      "garmin_exercise": "LAT_PULLDOWN",
      "garmin_label": "Lat Pulldown",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "PUXADA ALTA",
      "garmin_category": "PULL_UP",
      "garmin_exercise": "LAT_PULLDOWN",
      "garmin_label": "Lat Pulldown",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA ALTA",
      "garmin_category": "SHRUG",
      "garmin_exercise": "DUMBBELL_UPRIGHT_ROW",
      "garmin_label": "Dumbbell Upright Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA BAIXA",
      "garmin_category": "ROW",
      "garmin_exercise": "SEATED_CABLE_ROW",
      "garmin_label": "Seated Cable Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA C/ HALTERES",
      "garmin_category": "ROW",
      "garmin_exercise": "DUMBBELL_ROW",
      "garmin_label": "Dumbbell Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA CAVALINHO",
      "garmin_category": "ROW",
      "garmin_exercise": "T_BAR_ROW",
      "garmin_label": "T Bar Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA CURVADA C/ BARRA",
      "garmin_category": "ROW",
      "garmin_exercise": "BENT_OVER_ROW_WITH_BARBELL",
      "garmin_label": "Bent Over Row With Barbell",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "REMADA SUPINADA",
      "garmin_category": "ROW",
      "garmin_exercise": "REVERSE_GRIP_BARBELL_ROW",
      "garmin_label": "Reverse Grip Barbell Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ROLINHO",
      "garmin_category": "CORE",
      "garmin_exercise": "KNEELING_AB_WHEEL",
      "garmin_label": "Kneeling Ab Wheel",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "ROSCA ARNOLD",
      "garmin_category": "CURL",
      "garmin_exercise": "TWISTING_STANDING_DUMBBELL_BICEPS_CURL",
      "garmin_label": "Twisting Standing Dumbbell Biceps Curl",
      "confianca": "baixa",
      "obs": null
    },
    {
      "exercicio_pt": "ROSCA BÍCEPS",
      "garmin_category": "CURL",
      "garmin_exercise": "STANDING_DUMBBELL_BICEPS_CURL",
      "garmin_label": "Standing Dumbbell Biceps Curl",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "SERROTE C/ HALTERES",
      "garmin_category": "ROW",
      "garmin_exercise": "DUMBBELL_ROW",
      "garmin_label": "Dumbbell Row",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "STIFF",
      "garmin_category": "DEADLIFT",
      "garmin_exercise": "STRAIGHT_LEG_DEADLIFT",
      "garmin_label": "Straight Leg Deadlift",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "STIFF C/ BARRA OU HALTERES",
      "garmin_category": "DEADLIFT",
      "garmin_exercise": "STRAIGHT_LEG_DEADLIFT",
      "garmin_label": "Straight Leg Deadlift",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "SUPINO INCL C/ HALTERES",
      "garmin_category": "BENCH_PRESS",
      "garmin_exercise": "INCLINE_DUMBBELL_BENCH_PRESS",
      "garmin_label": "Incline Dumbbell Bench Press",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "SUPINO INCLINADO",
      "garmin_category": "BENCH_PRESS",
      "garmin_exercise": "INCLINE_BARBELL_BENCH_PRESS",
      "garmin_label": "Incline Barbell Bench Press",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "SUPINO INCLINADO C/ HALTERES",
      "garmin_category": "BENCH_PRESS",
      "garmin_exercise": "INCLINE_DUMBBELL_BENCH_PRESS",
      "garmin_label": "Incline Dumbbell Bench Press",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "SUPINO RETO C/ HALTERES",
      "garmin_category": "BENCH_PRESS",
      "garmin_exercise": "DUMBBELL_BENCH_PRESS",
      "garmin_label": "Dumbbell Bench Press",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TERRA DEADLIFT",
      "garmin_category": "DEADLIFT",
      "garmin_exercise": "BARBELL_DEADLIFT",
      "garmin_label": "Barbell Deadlift",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRICEPS C/ CORDA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "ROPE_PRESSDOWN",
      "garmin_label": "Rope Pressdown",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS BARRA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "TRICEPS_PRESSDOWN",
      "garmin_label": "Triceps Pressdown",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS C/ BARRA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "TRICEPS_PRESSDOWN",
      "garmin_label": "Triceps Pressdown",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS C/ BARRA RETA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "TRICEPS_PRESSDOWN",
      "garmin_label": "Triceps Pressdown",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "TRÍCEPS C/ CORDA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "ROPE_PRESSDOWN",
      "garmin_label": "Rope Pressdown",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS COICE",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "DUMBBELL_KICKBACK",
      "garmin_label": "Dumbbell Kickback",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS COICE C/ HALTERES",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "DUMBBELL_KICKBACK",
      "garmin_label": "Dumbbell Kickback",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS CORDA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "ROPE_PRESSDOWN",
      "garmin_label": "Rope Pressdown",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS FRANCES C/ HALTERES",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "OVERHEAD_DUMBBELL_TRICEPS_EXTENSION",
      "garmin_label": "Overhead Dumbbell Triceps Extension",
      "confianca": "alta",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "TRÍCEPS FRANCÊS",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "OVERHEAD_DUMBBELL_TRICEPS_EXTENSION",
      "garmin_label": "Overhead Dumbbell Triceps Extension",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS MERGULHO",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "BENCH_DIP",
      "garmin_label": "Bench Dip",
      "confianca": "média",
      "obs": null
    },
    {
      "exercicio_pt": "TRÍCEPS TESTA",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "LYING_EZ_BAR_TRICEPS_EXTENSION",
      "garmin_label": "Lying Ez Bar Triceps Extension",
      "confianca": "média",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "TRÍCEPS TESTA C/ HALTERES",
      "garmin_category": "TRICEPS_EXTENSION",
      "garmin_exercise": "DUMBBELL_LYING_TRICEPS_EXTENSION",
      "garmin_label": "Dumbbell Lying Triceps Extension",
      "confianca": "alta",
      "obs": null
    },
    {
      "exercicio_pt": "VOADOR POLI ALTA",
      "garmin_category": "FLYE",
      "garmin_exercise": "CABLE_CROSSOVER",
      "garmin_label": "Cable Crossover",
      "confianca": "baixa",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "VOADOR POLIA ALTA",
      "garmin_category": "FLYE",
      "garmin_exercise": "CABLE_CROSSOVER",
      "garmin_label": "Cable Crossover",
      "confianca": "baixa",
      "obs": "PDF 3KM Nível 1"
    },
    {
      "exercicio_pt": "VOADOR POLIDA ALTA",
      "garmin_category": "FLYE",
      "garmin_exercise": "CABLE_CROSSOVER",
      "garmin_label": "Cable Crossover",
      "confianca": "baixa",
      "obs": null
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = DEPARA_PADRAO;
  else raiz.TH_DEPARA_PADRAO = DEPARA_PADRAO;
})(typeof window !== 'undefined' ? window : globalThis);
