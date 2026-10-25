import type { BatterAbility } from '@/entities/batting/model/batter'
import type { TrainingBlockReason, TrainingOutcome } from '@/entities/career/model/training'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'

/** StrMODE 글 — 알림 창이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
const modeText = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

/** StrMODE[24] "사기" · [83] " 상승하였습니다" · [84] " 하락하였습니다" (색 마크업 포함) */
const MORALE_NAME = 24
const RISE_TEXT = 83
const FALL_TEXT = 84

/**
 * 원본 StrMODE[83] · [84] · [87] 는 **앞에 빈칸 하나**가 붙은 글이다(" !c00CC00상승…"). 생성 표(`ORIGINAL_MODE_TEXT`)가
 * 원문 앞뒤 빈칸을 그대로 두므로(r223 — 생성기 `clean_strings`) 이어 붙이기만 한다.
 */
const rawModeText = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''

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
  if (isLevelUp) return `${name}${rawModeText(LEARNED_TEXT)}` // [87] 도 앞에 빈칸이 있다
  return (ORIGINAL_MODE_TEXT[SESSIONS_TEXT] ?? '').replace('%s', name).replace('%d', String(sessions)).replace('%d', String(required))
}

/** 구질 훈련 첫 줄 — StrMODE[88] 또는 sprintf(StrMODE[89], 횟수, 필요 횟수) (0x18474~0x1858c) */
export function pitchTrainingHeadTextOf(isLearned: boolean, sessions: number, required: number): string {
  if (isLearned) return ORIGINAL_MODE_TEXT[PITCH_LEARNED_TEXT] ?? ''
  return (ORIGINAL_MODE_TEXT[PITCH_SESSIONS_TEXT] ?? '').replace('%d', String(sessions)).replace('%d', String(required))
}

/**
 * 훈련 보정 — 0x17f5c 가 [sp+0xf8](사기 보정, 0x17fa6 memset 으로 0 시작) 과 [sp+0x28]/[sp+0x18](보정 있음 표시)에 모은다:
 * 병아리(스킬 0 장착 0xa4bf9) 사기 −1 · 몹쓸몸(스킬 3) +2 · 자동안마기(기록 +0x5c) −1
 * (필살/마구 0x17ffc~0x18048 · 구질 0x18384~0x183d0 · 능력치 0x188cc~0x189b8).
 */
export interface TrainingModifiers {
  readonly rookie: boolean
  readonly weakBody: boolean
  readonly massage: boolean
}

export const NO_TRAINING_MODIFIERS: TrainingModifiers = { rookie: false, weakBody: false, massage: false }

/** [sp+0xf8] — 사기 감소에 더하는 보정 */
export function trainingMoraleAdjustmentOf(modifiers: TrainingModifiers): number {
  return (modifiers.rookie ? -1 : 0) + (modifiers.weakBody ? 2 : 0) - (modifiers.massage ? 1 : 0)
}

const hasModifier = (modifiers: TrainingModifiers) => modifiers.rookie || modifiers.weakBody || modifiers.massage

/**
 * 훈련 사기 줄 — 0x17f5c 18196~1825e (구질 184d8~1858c 같은 꼴): StrMODE[24] "사기" · " " · `0xbc73d(감소)` ·
 * 보정이 하나라도 있으면([sp+0x28]) "(" + (보정 > 0 ? "+" : "-") + |보정| + ")" (0xcc26c · 0xcc270 · 0xcc274 · 0xcf7c0) ·
 * StrMODE[84] " 하락하였습니다". 감소는 보정을 더한 값이고(r7), [84] 는 부호와 상관없이 붙는다(1825a `movs r1,#0x54`).
 * 보정이 서로 지워 0 이면 "(-0)" 이 찍힌다(원본 그대로 — `> 0` 만 "+").
 */
export function trainingMoraleLossTextOf(moraleLoss: number, modifiers: TrainingModifiers = NO_TRAINING_MODIFIERS): string {
  const adjustment = trainingMoraleAdjustmentOf(modifiers)
  const bracket = hasModifier(modifiers) ? `(${adjustment > 0 ? '+' : '-'}${Math.abs(adjustment)})` : ''
  return `${ORIGINAL_MODE_TEXT[MORALE_NAME] ?? ''} ${moraleLoss}${bracket}${rawModeText(FALL_TEXT)}`
}

/** 스킬 이름 StrCOMMON[0x37 + n] — 표 [0x1552cf8] 0x37 병아리 · 0x3a 몹쓸몸 */
const ROOKIE_NAME = ORIGINAL_SKILLS[0]?.name ?? ''
const WEAK_BODY_NAME = ORIGINAL_SKILLS[3]?.name ?? ''
/** 서브 아이템 이름 StrITEM[0x58 + k] (0x845d5 나리 갈래) — 4 자동안마기 */
const SUB_ITEM_NAME_BASE = 0x58
const MASSAGE_SLOT = 4
const subItemNameOf = (slot: number) => ORIGINAL_ITEMS[SUB_ITEM_NAME_BASE + slot] ?? ''
/** StrMODE[26] "스킬" · [195] "효과" · [194] "타입 보너스 +1" · [201] "능력치+1/사기감소-1" · [202] "능력치-2/사기감소+2" */
const SKILL_WORD = 26
const EFFECT_WORD = 195
const TYPE_BONUS_TEXT = 194
const ROOKIE_TEXT = 201
const WEAK_BODY_TEXT = 202
/** 0xcc110 "+2" · 0xcc114 "사기감소-1" — 서브 아이템 줄 꼬리 (모드 표가 아니라 바이너리 글) */
const SUB_ITEM_GAIN_TEXT = '+2'
const MASSAGE_TEXT = '사기감소-1'
const YELLOW = '!cFFFF00'
const bracketed = (name: string) => `!cFFFFFF[${YELLOW}${name}!cFFFFFF]`

/**
 * 필살타법 · 마구 · 구질 훈련 글의 사기 줄 **뒤** — 사기 줄 끝 "!N"(0x18270 · 0x185a2) 뒤에 보정마다
 * "!N" + "!cFFFF00"(0xcc27c) + 이름 + " " + … + StrMODE[195] "효과" (0x18274~0x18368 · 0x185a8~0x186c2, 직접 떴다):
 * ```
 * 병아리(장착 0)  "!N!cFFFF00" + StrCOMMON[0x37] + " " + StrMODE[26] + " " + StrMODE[195]
 * 몹쓸몸(장착 3)  "!N!cFFFF00" + StrCOMMON[0x3a] + " " + StrMODE[26] + " " + StrMODE[195]
 * 자동안마기      "!N!cFFFF00" + StrITEM[0x58 + 4] + " " + StrMODE[195]
 * ```
 * 사기 줄 끝 "!N" 이 늘 붙으므로 줄로 나누면 빈 줄 하나가 먼저 온다.
 */
export function specialTrainingTailLinesOf(modifiers: TrainingModifiers): string[] {
  const word = (index: number) => ORIGINAL_MODE_TEXT[index] ?? ''
  const lines = ['']
  if (modifiers.rookie) lines.push(`${YELLOW}${ROOKIE_NAME} ${word(SKILL_WORD)} ${word(EFFECT_WORD)}`)
  if (modifiers.weakBody) lines.push(`${YELLOW}${WEAK_BODY_NAME} ${word(SKILL_WORD)} ${word(EFFECT_WORD)}`)
  if (modifiers.massage) lines.push(`${YELLOW}${subItemNameOf(MASSAGE_SLOT)} ${word(EFFECT_WORD)}`)
  return lines
}

export interface AbilityTrainingBonusSource {
  /** 타입 보너스가 붙었으면 타입 이름 (0x1400080[타입] · 투수 [2 + 타입]) */
  readonly typeName: string | null
  /** 훈련 칸 k — 서브 아이템 `기록[0x58 + k]` 를 가졌으면 그 칸, 아니면 null */
  readonly subItemSlot: number | null
  /** 능력치 이름 — 타자 StrMODE[0x23 + k] · 투수 [0x28 + k] */
  readonly abilityName: string
  readonly modifiers: TrainingModifiers
}

/**
 * 능력치 훈련(칸 0~3) 결과 창의 글 — 0x17f5c 186c4~18a58 (직접 떴다). 글 상자 [sp+0xfc] 를 "!C" 로 시작했다가 1872a 에서
 * **길이 칸 [sp+0x108] 을 0 으로** 지워(문자열 객체 +0xc = 길이, 0xbc974) 보정 줄만 남긴다. 줄마다 "!N" 으로 끝난다:
 * ```
 * 18750  타입 보너스  "!cFFFFFF[!cFFFF00" + 타입 이름 + "!cFFFFFF]" + " " + StrMODE[194]
 * 187f6  서브 아이템  "!cFFFFFF[!cFFFF00" + StrITEM[0x58 + k] + "!cFFFFFF]" + " " + 능력치 이름 + " " + "+2"
 * 188cc  자동안마기   "!cFFFFFF[!cFFFF00" + StrITEM[0x5c] + "!cFFFFFF]" + " " + "사기감소-1"
 * 1891c  병아리(장착) "!cFFFFFF[!cFFFF00" + StrCOMMON[0x37] + "!cFFFFFF]" + " " + StrMODE[201]
 * 1898e  몹쓸몸(보유) "!cFFFFFF[!cFFFF00" + StrCOMMON[0x3a] + "!cFFFFFF]" + " " + StrMODE[202]
 * 18a24  0x1552af4(결과 창 글 칸)를 지우고, 길이 > 0 이면 그 글을 옮긴다 — 보정이 없으면 글 칸이 빈다
 * ```
 * 상승 수치 · 사기 줄은 **글에 없다** (창의 능력치 · 사기 행이 보인다).
 */
export function abilityTrainingBonusLinesOf(source: AbilityTrainingBonusSource): string[] {
  const word = (index: number) => ORIGINAL_MODE_TEXT[index] ?? ''
  const lines: string[] = []
  if (source.typeName !== null) lines.push(`${bracketed(source.typeName)} ${word(TYPE_BONUS_TEXT)}`)
  if (source.subItemSlot !== null) {
    lines.push(`${bracketed(subItemNameOf(source.subItemSlot))} ${source.abilityName} ${SUB_ITEM_GAIN_TEXT}`)
  }
  if (source.modifiers.massage) lines.push(`${bracketed(subItemNameOf(MASSAGE_SLOT))} ${MASSAGE_TEXT}`)
  if (source.modifiers.rookie) lines.push(`${bracketed(ROOKIE_NAME)} ${word(ROOKIE_TEXT)}`)
  if (source.modifiers.weakBody) lines.push(`${bracketed(WEAK_BODY_NAME)} ${word(WEAK_BODY_TEXT)}`)
  return lines
}

/**
 * 휴식 결과 창 글 — 0x18e3c 18e7c~18eb4: `strcpy(StrMODE[24])` · `strcat(" ")`(0xcc338) · `0xbc73d(|수치|)` ·
 * `strcat(수치 >= 0 ? StrMODE[83] : [84])`. 모드 갈래가 없어 타자편 · 투수편이 같다.
 */
export function restResultTextOf(moraleGain: number): string {
  const verb = rawModeText(moraleGain >= 0 ? RISE_TEXT : FALL_TEXT)
  return `${ORIGINAL_MODE_TEXT[MORALE_NAME] ?? ''} ${Math.abs(moraleGain)}${verb}`
}

const ABILITY_SLOTS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
/** 타자 능력치 이름 StrMODE[0x23 + k] (0x18862) */
const BATTER_ABILITY_NAME_BASE = 0x23

/**
 * 타자 훈련 결과 글 — 능력치 칸은 `abilityTrainingBonusLinesOf`(보정 줄만, 없으면 빈 배열),
 * 필살타법은 첫 줄 · 사기 줄(괄호 보정) · `specialTrainingTailLinesOf` (0x18116~0x18368).
 */
export function trainingOutcomeLinesOf(outcome: TrainingOutcome, typeName = ''): string[] {
  const progress = outcome.specialSwing
  if (progress !== null) {
    // 기술 이름 StrCOMMON[0x18 + n] + StrMODE[87] (0x18124~0x1813e) · 아니면 StrMODE[86] (0x18170) — 원문 표 그대로
    return [
      specialTrainingHeadTextOf(progress.name, progress.isLevelUp, progress.sessions, progress.required),
      trainingMoraleLossTextOf(outcome.moraleLoss, outcome.modifiers),
      ...specialTrainingTailLinesOf(outcome.modifiers),
    ]
  }
  const [ability] = Object.keys(outcome.gains) as (keyof BatterAbility)[]
  const slot = ability === undefined ? -1 : ABILITY_SLOTS.indexOf(ability)
  return abilityTrainingBonusLinesOf({
    typeName: outcome.typeBonus > 0 ? typeName : null,
    subItemSlot: outcome.hasSubItemBonus && slot >= 0 ? slot : null,
    abilityName: ORIGINAL_MODE_TEXT[BATTER_ABILITY_NAME_BASE + slot] ?? '',
    modifiers: outcome.modifiers,
  })
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
