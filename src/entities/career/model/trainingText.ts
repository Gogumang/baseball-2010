import type { BatterAbility } from '@/entities/batting/model/batter'
import type { TrainingBlockReason, TrainingOutcome } from '@/entities/career/model/training'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** StrMODE 글 — 알림 창이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
const modeText = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

/** StrMODE[24] "사기" · [83] " 상승하였습니다" · [84] " 하락하였습니다" (색 마크업 포함) */
const MORALE_NAME = 24
const RISE_TEXT = 83
const FALL_TEXT = 84

/**
 * 원본 StrMODE[83] · [84] 는 **앞에 빈칸 하나**가 붙은 글이다(" !c00CC00상승…"). 생성기(`clean_strings`)가 앞뒤 빈칸을 깎아
 * `ORIGINAL_MODE_TEXT` 에는 빈칸이 없으므로 여기서 되붙인다.
 */
export const modeTextWithLeadingSpace = (index: number): string => ` ${ORIGINAL_MODE_TEXT[index] ?? ''}`

/** StrMODE[86] "[%s] %d/%d회 훈련" · [87] " 훈련 완료!…" · [88] "구질 훈련 완료!…" · [89] "해당 구질 %d/%d회 훈련" */
const SESSIONS_TEXT = 86
const LEARNED_TEXT = 87
const PITCH_LEARNED_TEXT = 88
const PITCH_SESSIONS_TEXT = 89

/**
 * 필살타법 · 마구 훈련 첫 줄 — 0x17f5c 18116~18192: 다 배웠으면 `strcat(이름)` · `strcat(StrMODE[87])`,
 * 아니면 `sprintf(StrMODE[86], 이름, 횟수, 필요 횟수)` (0x18170~0x18188). 이름은 StrCOMMON[0x18 + n](타자) · [0x1e + n](투수)
 */
export function specialTrainingHeadTextOf(name: string, isLevelUp: boolean, sessions: number, required: number): string {
  if (isLevelUp) return `${name}${modeTextWithLeadingSpace(LEARNED_TEXT)}` // [87] 도 앞에 빈칸이 있다
  return (ORIGINAL_MODE_TEXT[SESSIONS_TEXT] ?? '').replace('%s', name).replace('%d', String(sessions)).replace('%d', String(required))
}

/** 구질 훈련 첫 줄 — StrMODE[88] 또는 sprintf(StrMODE[89], 횟수, 필요 횟수) (0x18474~0x1858c) */
export function pitchTrainingHeadTextOf(isLearned: boolean, sessions: number, required: number): string {
  if (isLearned) return ORIGINAL_MODE_TEXT[PITCH_LEARNED_TEXT] ?? ''
  return (ORIGINAL_MODE_TEXT[PITCH_SESSIONS_TEXT] ?? '').replace('%d', String(sessions)).replace('%d', String(required))
}

/**
 * 훈련 사기 줄 — 0x17f5c 18196~1825e: `"!N"` · StrMODE[24] "사기" · " " · `0xbc73d(|감소|)` · (스킬·아이템 보정이 있으면
 * "(" ± 보정 ")") · StrMODE[84] " 하락하였습니다". [84] 는 부호와 상관없이 붙는다(1825a `movs r1,#0x54`).
 * ⚠️ 괄호 보정 칸([sp+0x28] · [sp+0xf8])은 웹 결과가 감소 합계만 들고 있어 옮기지 않았다.
 */
export function trainingMoraleLossTextOf(moraleLoss: number): string {
  return `${ORIGINAL_MODE_TEXT[MORALE_NAME] ?? ''} ${Math.abs(moraleLoss)}${modeTextWithLeadingSpace(FALL_TEXT)}`
}

/**
 * 휴식 결과 창 글 — 0x18e3c 18e7c~18eb4: `strcpy(StrMODE[24])` · `strcat(" ")`(0xcc338) · `0xbc73d(|수치|)` ·
 * `strcat(수치 >= 0 ? StrMODE[83] : [84])`. 모드 갈래가 없어 타자편 · 투수편이 같다.
 */
export function restResultTextOf(moraleGain: number): string {
  const verb = modeTextWithLeadingSpace(moraleGain >= 0 ? RISE_TEXT : FALL_TEXT)
  return `${ORIGINAL_MODE_TEXT[MORALE_NAME] ?? ''} ${Math.abs(moraleGain)}${verb}`
}

const ABILITY_NAMES: Readonly<Record<keyof BatterAbility, string>> = { hit: '히트', power: '파워', defense: '수비', run: '주루' }

/**
 * 훈련 결과 알림. 원본 결과 표시 위치·모양은 못 찾았다 (layout-re 2차).
 * 능력치 문구는 GP 아이템과 같은 조각(StrMODE[35+k] + 수치 + [83])으로 둔다 (추정).
 *
 * **한 줄에 다 넣지 않고 줄로 나눈다.** 상세정보 창의 메시지 칸은 170×70 이고 줄 간격이 16 이라
 * 네 줄까지 들어가는데, 예전처럼 " · " 로 이어 붙이면 한 줄이 칸을 넘어 잘려 나갔다 (0x8a18a 는 넘친 글을 자른다).
 */
export function trainingOutcomeLinesOf(outcome: TrainingOutcome, typeName = ''): string[] {
  const lines: string[] = []
  const progress = outcome.specialSwing
  if (progress === null) {
    const entries = Object.entries(outcome.gains) as [keyof BatterAbility, number][]
    for (const [key, value] of entries) lines.push(`${ABILITY_NAMES[key]} +${value} 상승하였습니다`)
    // 타입 보너스 줄 — "!cFFFFFF[!cFFFF00"(0xcc0f0) + 타입 이름(0x1400080[타입] 타격형 · 장타형) + "!cFFFFFF]"(0xcc104)
    // + " " + StrMODE[194] "타입 보너스 +1" + "!N" (0x17f5c 18750~18778 · 187e0)
    if (outcome.typeBonus > 0) lines.push(`!cFFFFFF[!cFFFF00${typeName}!cFFFFFF] ${ORIGINAL_MODE_TEXT[194] ?? ''}`)
  } else {
    // 기술 이름 StrCOMMON[0x18 + n] + StrMODE[87] (0x18124~0x1813e) · 아니면 StrMODE[86] (0x18170) — 원문 표 그대로
    lines.push(specialTrainingHeadTextOf(progress.name, progress.isLevelUp, progress.sessions, progress.required))
    lines.push(trainingMoraleLossTextOf(outcome.moraleLoss))
    return lines
  }
  // ⚠️ 능력치 칸(0~3) 결과 창의 사기 줄 — 0x17f5c 능력치 갈래의 글 버퍼에는 보너스 줄(타입 · 서브아이템 · 스킬)만 보이고
  //    "사기 -n" 줄은 찾지 못했다(r216 감사). 상세 창 행이 사기 변화를 따로 보인다 — 웹 글을 그대로 둔다
  lines.push(`사기 -${outcome.moraleLoss}`)
  return lines
}

export function trainingBlockTextOf(reason: TrainingBlockReason, menuName: string): string {
  switch (reason) {
    case '사기부족':
      // StrMODE[193] — 키 0x12d48 12d90 `0xa3a25 == 0` → 12da2 `movs r1,#0xc1`
      return modeText(193)
    case '능력치최대':
      // StrMODE[192] — %s 는 능력치 이름 StrMODE[0x23 + 칸](타자 · 12e7c) — 메뉴 이름이 그 글과 같다 (12ef2~12f10 sprintf)
      return modeText(192).replace('%s', menuName)
    case '훈련완료':
      // StrMODE[63] "!C이미 훈련 완료된 스킬입니다" — 최고 레벨이면 필살타법 창 0x17828 이 칸마다(i < 배운 수) 이 글로 막는다
      // (R7 4절 · `specialSwingSlotBlockOf`). 원본에 "훈련을 모두 마쳤습니다" 같은 다른 글은 없다
      return modeText(63)
  }
}
