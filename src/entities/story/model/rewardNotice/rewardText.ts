import type { EventReward } from '@/entities/story/model/eventReward'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { isBugFixed } from '@/shared/config/bugfixes'
import { pitchTypeNameOf } from '@/entities/story/model/rewardNotice/otherSlices'
import { originalMoneyText, salaryAfter, skillNameOf, sprintf } from '@/entities/story/model/rewardNotice/textParts'
import {
  BATTER_MODE,
  PITCHER_MODE,
  REWARD_KIND,
  SEASON_MODE,
  SILENT_KINDS,
  type RewardNoticeContext,
} from '@/entities/story/model/rewardNotice/types'

const MODE_TEXT = ORIGINAL_MODE_TEXT
/** StrMODE 이름 칸 — 22 + 종류 */
const REWARD_NAME_BASE = 22
const ILLNESS_COUNT = 4
/** 이름 k = 종류. 13~16 은 모드 3(투수편) +5 · 모드 2(시즌) +9 → S[22 + k] */
const SHIFTED_NAME_FIRST = 13
const SHIFTED_NAME_LAST = 16
const NAME_SHIFT_OF_MODE: Readonly<Record<number, number>> = { [PITCHER_MODE]: 5, [SEASON_MODE]: 9 }
/** 종류 9 이름표 머리 — 시즌 StrITEM[119] · 그 밖 [98] */
const SEASON_GP_ITEM_NAME_BASE = 119
const NARI_GP_ITEM_NAME_BASE = 98
/** 종류 9 — 모드 4 이고 값 10 이면 + 값 (그 밖은 값 − 1) */
const BATTER_SPECIAL_GP_ITEM = 10

/**
 * 종류 6 의 값 v → 구질 번호 — 표 0xd4e40 u32 = [18, 19, 20, 21] (직접 읽었다). 이름은 원본 이름표 [0x140026c + 4t]
 * (`ORIGINAL_PITCH_TYPE_NAMES`): 18 GYRO · 19 P.SINKER · 20 P.SLIDER · 21 KNUCKLE.
 */
const HIDDEN_PITCH_TYPE_NUMBERS: readonly number[] = [18, 19, 20, 21]

/** 연차 보정 표 — 종류 → 연차마다 더할 값 */
type YearAdjustTable = Readonly<Record<number, number>>

/** 0x8d508~0x8d69c — 393~395 · 396, 모드 2 와 그 밖이 다르다 */
function yearAdjustTableOf(eventId: number, isSeason: boolean): YearAdjustTable | null {
  if (eventId >= 393 && eventId <= 395) return isSeason ? { 0: 5, 1: 5, 3: 5 } : { 0: 3, 1: -2, 3: 1 }
  if (eventId === 396) return isSeason ? { 0: -10, 1: -2 } : { 0: -4, 1: -3 }
  return null
}

/** 연차 보정 0x8d508~0x8d69c — 393~395 · 396, 모드 2 와 그 밖이 다르다. 명령 값을 덮어 쓴다 */
export function yearAdjusted(items: readonly EventReward[], eventId: number, ctx: RewardNoticeContext): readonly EventReward[] {
  const y = ctx.years
  const table = yearAdjustTableOf(eventId, ctx.mode === SEASON_MODE)
  if (table === null) return items
  return items.map((item) => {
    const perYear = table[item.kind]
    return perYear === undefined ? item : { ...item, value: item.value + perYear * y }
  })
}

/** 항목 하나의 글과 (고쳤으면 고친) 항목 */
interface RewardLine {
  readonly text: string
  readonly item: EventReward
}

/** 머리말 뒤 본문 — 종류마다. `name` 은 S[22 + k] */
type RewardBody = (item: EventReward, name: string, ctx: RewardNoticeContext) => RewardLine

/** 종류 11 — 값 < 0: 지금 질병 이름 · 값 ≥ 0: r = 0xbfa55(0, 4) 굴림, **명령 값 = r + 1** (0x8c718 이 그 질병을 건다) */
function rollIllnessLine(item: EventReward, ctx: RewardNoticeContext): RewardLine {
  if (item.value < 0) return { text: sprintf(MODE_TEXT[206], MODE_TEXT[185 + ctx.illness] ?? ''), item }
  const rolled = ctx.random.rand(0, ILLNESS_COUNT)
  return { text: sprintf(MODE_TEXT[207], MODE_TEXT[186 + rolled] ?? ''), item: { kind: item.kind, value: rolled + 1 } }
}

/** 종류 9 — S[31] "!N" "[!cFFFF00" I[(시즌 119 · 그 밖 98) + 값 − 1 (모드 4 이고 값 10 이면 + 값)] "!cFFFFFF]" */
function gpItemText(value: number, ctx: RewardNoticeContext): string {
  const base = ctx.mode === SEASON_MODE ? SEASON_GP_ITEM_NAME_BASE : NARI_GP_ITEM_NAME_BASE
  const offset = ctx.mode === BATTER_MODE && value === BATTER_SPECIAL_GP_ITEM ? value : value - 1
  return `${MODE_TEXT[31]}!N[!cFFFF00${ORIGINAL_ITEMS[base + offset] ?? ''}!cFFFFFF]`
}

/**
 * 종류 3 — 원본 0x8c2a4~0x8c2d2: 값 ≥ 0 이면 " +", 금액은 |값 × 100| 이라 **줄 때는 부호가 없다** (B-78).
 * 고침(bugfixes.json B-78, 기본 켬): 줄 때 금액 앞에 "-" — 그 밖 종류의 `%d`(" -5")와 같은 꼴. 굴림 없음
 */
function moneyText(value: number, name: string): string {
  const minus = value < 0 && isBugFixed('B-78') ? '-' : ''
  return `${name}${value >= 0 ? ' +' : ''} ${minus}${originalMoneyText(Math.abs(value * 100))}만`
}

/** 종류 4 — "!cFFFF00" '"' 스킬 이름 '"' "!cFFFFFF" "!N" " " "!N" S[26] + (값 > 0 ? 획득 : 제거) */
function skillText(value: number, name: string, ctx: RewardNoticeContext): string {
  const skillName = skillNameOf(Math.abs(value) - 1, ctx.mode)
  return `!cFFFF00"${skillName}"!cFFFFFF!N !N${name}${value > 0 ? '을 획득하였습니다.' : '이 제거되었습니다.'}`
}

const REWARD_BODIES: Readonly<Record<number, RewardBody>> = {
  [REWARD_KIND.스킬]: (item, name, ctx) => ({ text: skillText(item.value, name, ctx), item }),
  // 6 구질 — sprintf(S[222], 구질 이름 [0x140026c + 4 × (18 + 값)])
  [REWARD_KIND.구질]: (item) => ({ text: sprintf(MODE_TEXT[222], pitchTypeNameOf(HIDDEN_PITCH_TYPE_NUMBERS[item.value] ?? 0)), item }),
  [REWARD_KIND.GP아이템]: (item, _name, ctx) => ({ text: gpItemText(item.value, ctx), item }),
  [REWARD_KIND.질병]: (item, _name, ctx) => rollIllnessLine(item, ctx),
  [REWARD_KIND.소지금]: (item, name) => ({ text: moneyText(item.value, name), item }),
  // 20 연봉 — "연봉 " (r × 100) "만 결정!"
  [REWARD_KIND.연봉]: (item, _name, ctx) => ({ text: `연봉 ${salaryAfter(ctx.salaryBase, item.value) * 100}만 결정!`, item }),
}

function nameKindOf(kind: number, ctx: RewardNoticeContext): number {
  if (kind < SHIFTED_NAME_FIRST || kind > SHIFTED_NAME_LAST) return kind
  return kind + (NAME_SHIFT_OF_MODE[ctx.mode] ?? 0)
}

/** 머리말("!N" · "!C") 뒤 본문 — 5 · 7 · 8 은 없음, 표에 없는 종류는 S[22 + k] (값 ≥ 0 이면 " +") " " 값 */
function rewardBodyOf(item: EventReward, ctx: RewardNoticeContext): RewardLine {
  const name = MODE_TEXT[REWARD_NAME_BASE + nameKindOf(item.kind, ctx)] ?? ''
  const body = REWARD_BODIES[item.kind]
  if (body !== undefined) return body(item, name, ctx)
  if (SILENT_KINDS.has(item.kind)) return { text: '', item }
  return { text: `${name}${item.value >= 0 ? ' +' : ''} ${item.value}`, item }
}

/** 18 · 19 — sprintf(S[182] 또는 S[183], …) 만, 앞 "!N" · "!C" 없음 (18 은 값 0 → 4, 그 밖 → 1 · 19 는 값). 그 밖은 null */
function orderLineOf(item: EventReward): RewardLine | null {
  if (item.kind === REWARD_KIND.타순경로) return { text: sprintf(MODE_TEXT[182], item.value === 0 ? 4 : 1), item }
  if (item.kind === REWARD_KIND.타순) return { text: sprintf(MODE_TEXT[183], item.value), item }
  return null
}

/** 항목 i 의 글 — i > 0 이면 "!N", 늘 "!C", 그리고 본문 */
function rewardLineOf(item: EventReward, index: number, ctx: RewardNoticeContext): RewardLine {
  const orderLine = orderLineOf(item)
  if (orderLine !== null) return orderLine
  const head = index === 0 ? '!C' : '!N!C'
  const body = rewardBodyOf(item, ctx)
  return { text: head + body.text, item: body.item }
}

/** 0x8beb8 — 항목들의 알림 글과 고친 항목 (굴림은 종류 11 값 ≥ 0 마다 한 번) */
export function buildRewardText(
  items: readonly EventReward[],
  ctx: RewardNoticeContext,
): { readonly text: string; readonly items: readonly EventReward[] } {
  let text = ''
  const resolved: EventReward[] = []
  items.forEach((item, index) => {
    const line = rewardLineOf(item, index, ctx)
    text += line.text
    resolved.push(line.item)
  })
  return { text, items: resolved }
}
