import type { EventReward } from '@/entities/story/model/eventReward'
import { ILLNESS_NAMES } from '@/entities/career/model/condition'
import { salaryOfferOf } from '@/entities/career/model/seasonFlow'
import type { SalaryHolder } from '@/entities/career/model/seasonFlow'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import { pitcherHiddenOpenTextOf } from '@/entities/pitcher-career/model/pitcherEquipment'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **보상 명령 7 의 알림** — 실행 0x8d4c4 · 글 0x8beb8 · 기다림 0x8daa0 (직접 떴다).
 *
 * ```
 * 0x8d4c4  첫 종류 [명령+5] == 0x15 → [0x1552adc] = 1 · 0x8a4ec(mgr) · 상자 비우기 → 재생 끝(엔딩)            ; 글 · 창 없음
 *          이벤트 393 · 394 · 395 · 396 이면 연차 보정을 명령 값에 **덮어 쓴다**(0x8d508~0x8d69c, y = [[mgr+0x2fc]+0x33])
 *          0x8beb8(mgr, 명령) — 글을 [mgr+0xba] 에 짓는다(아래). 종류 11 은 여기서 굴린다
 *          첫 종류 == 4 → 0x1552af4 = 글 · 0x741a1(창, 높이 0x64, 그리기 값 > 0 ? 0x8e0b1(획득) : 0x8e0a5(제거), 키 0x8e081, mgr)
 *          첫 종류 == 7 → 이 명령은 창을 안 세운다 — 곧이어 0x8c460 의 종류 7(0x8c60e)이 0x62368(전역, |값|, 1)로
 *                         **같은 공용 창** [0x140005c] 에 히든 오픈 알림을 띄운다(0x6249e 0x74ef5(창, 글, 종류 1, 0, 0) — OK 하나).
 *                         기다림 0x8daa0 은 그 창의 답을 기다린다 → 알림 창으로 다룬다(`HIDDEN_OPEN_KIND`)
 *          그 밖      → 0xbbef8([mgr+0xba], 1, 1, 1) → 0x74ef4(창, 글, 종류 1(알림), …) · [창+0x248] = 1
 *          0x8c460(mgr, 명령) — 보상을 **그 자리에서** 준다(창을 띄운 뒤, 같은 갱신)
 * 기다림  0x8daa0: 창이 떠 있고 답이 0 · 0x14 면 답 = −1 · [mgr+8] = 1 → 다음 명령. 창이 없으면 그대로 기다린다.
 *         스킬 창(0x741a0)은 키 0x8e054 가 OK −5 · '5' · CLR −16 에 창을 닫고(0x742a9) [mgr+8] = 1.
 * ```
 *
 * 글 0x8beb8 — 항목 i 마다 (글 칸 [mgr+0xba] 0x200 을 비우고 끝에 옮긴다, 표 S = StrMODE · I = StrITEM):
 * ```
 * 이름 k = 종류. 13~16 은 모드 3(투수편) +5 · 모드 2(시즌) +9 → S[22 + k]
 * 18 · 19     sprintf(S[182] 또는 S[183], …) 만 — 앞 "!N" · "!C" 없음 (18 은 값 0 → 4, 그 밖 → 1 · 19 는 값)
 * 그 밖       i > 0 이면 "!N", 늘 "!C", 그리고
 *   4  스킬    "!cFFFF00" '"' 스킬 이름(0x8457c, |값| − 1) '"' "!cFFFFFF" "!N" " " "!N" S[26] + (값 > 0 ? "을 획득하였습니다." : "이 제거되었습니다.")
 *   5 · 7 · 8  없음
 *   6  구질    sprintf(S[222], 구질 이름 [0x140026c + 4 × (18 + 값)])
 *   9  GP      S[31] "!N" "[!cFFFF00" I[(시즌 119 · 그 밖 98) + 값 − 1 (모드 4 이고 값 10 이면 + 값)] "!cFFFFFF]"
 *   11 질병    값 < 0: sprintf(S[206], S[185 + 지금 질병 [선수+5]])
 *              값 ≥ 0: r = 0xbfa55(0, 4) — sprintf(S[207], S[186 + r]) · **명령 값 = r + 1** (0x8c718 이 그 질병을 건다)
 *   3  소지금  S[25] (값 ≥ 0 이면 " +") " " 0x55cf4(|값 × 100|) "만"
 *   20 연봉    r = 0xa39fc(선수) + [선수+0x1c8], 값 0 +30% · 1 · 4 +20% · 2 · 5 +10% · 3 −20% · 6 +5% · 7 −10% (몫 버림)
 *              "연봉 " (r × 100) "만 결정!"
 *   그 밖      S[22 + k] (값 ≥ 0 이면 " +") " " 값
 * ```
 * 글은 0x8c460 보다 먼저 짓는다 — 같은 명령의 보상이 아직 안 들어간 값을 읽는다(연봉 · 지금 질병).
 */

/** 창 [창+0x20] — 2 시즌모드 · 3 나리 투수편 · 4 나리 타자편 */
export type RewardNoticeMode = 2 | 3 | 4

export interface RewardNoticeContext {
  readonly mode: RewardNoticeMode
  /** 연차 보정 y — 0 기준 연차 (393~396) */
  readonly years: number
  /** 지금 질병 [선수+5] — 0 없음 · 1~4 (StrMODE[185 + n]) */
  readonly illness: number
  /** 연봉 기준 r = 0xa39fc(선수) + 연봉 [선수+0x1c8] (100만원 단위) */
  readonly salaryBase: number
  /** 종류 11 의 굴림 0xbfa55(0, 4) */
  readonly random: RandomPort
}

/** 0x8beb8 뒤 창 — 첫 종류로 가른다 */
export type RewardNotice =
  /** 0xbbef8 → 0x74ef4 종류 1 (OK 하나, CLR 도 0) */
  | { readonly kind: '알림'; readonly text: string }
  /** 0x741a0 — 그리기 0x87108(img_text 370 획득 / 371 제거 + 글) */
  | { readonly kind: '스킬'; readonly text: string; readonly gained: boolean }
  /** 첫 종류 7 인데 0x62368 글을 웹이 못 짓는 id(≤ 12 · ≥ 51 — 데이터에 없다) — 창 없이 지나간다(⚠️ 미해결) */
  | { readonly kind: '없음' }
  /** 첫 종류 21 — 엔딩(0x8d4c4), 글 · 창 없음 */
  | { readonly kind: '엔딩' }

export interface RewardNoticeResult {
  readonly notice: RewardNotice
  /** 0x8beb8 이 고친 항목 — 종류 11 의 값 ≥ 0 은 굴린 질병 번호(1~4). 연차 보정은 담지 않는다(주는 쪽이 다시 한다) */
  readonly items: readonly EventReward[]
}

const MODE_TEXT = ORIGINAL_MODE_TEXT
/** StrMODE 이름 칸 — 22 + 종류 */
const REWARD_NAME_BASE = 22
const SKILL_KIND = 4
const HIDDEN_OPEN_KIND = 7
const ENDING_KIND = 0x15
const ILLNESS_KIND = 11
const ILLNESS_COUNT = 4
const ORDER_PATH_KIND = 18
const ORDER_KIND = 19
const SALARY_KIND = 20
const MONEY_KIND = 3
const PITCH_KIND = 6
const GP_ITEM_KIND = 9
const SILENT_KINDS: ReadonlySet<number> = new Set([5, 7, 8])
const BATTER_MODE = 4
const PITCHER_MODE = 3
const SEASON_MODE = 2

/**
 * 종류 6 의 값 v → 구질 번호 — 표 0xd4e40 u32 = [18, 19, 20, 21] (직접 읽었다). 이름은 원본 이름표 [0x140026c + 4t]
 * (`ORIGINAL_PITCH_TYPE_NAMES`): 18 GYRO · 19 P.SINKER · 20 P.SLIDER · 21 KNUCKLE.
 */
const HIDDEN_PITCH_TYPE_NUMBERS: readonly number[] = [18, 19, 20, 21]

/** 연봉 변동 (0x8c304~0x8c374) — 값별 [나눔 수, 더함(1) · 뺌(−1)]. 값 0 은 ×30 ÷ 100 */
function salaryAfter(base: number, code: number): number {
  const part = (divisor: number) => Math.trunc(base / divisor)
  switch (code) {
    case 0: return base + Math.trunc((base * 30) / 100)
    case 1: case 4: return base + part(5)
    case 2: case 5: return base + part(10)
    case 3: return base - part(5)
    case 6: return base + part(20)
    case 7: return base - part(10)
    default: return base
  }
}

/** 0x55cf4 — 9999 이하 "%d", 1억 이상 "%d억" · "%d억%03d" (만원 단위, "만" 없음 — `features/shop` 의 `formatOriginalMoney` 와 같은 식) */
function originalMoneyText(amount: number): string {
  const hundredMillion = 10_000
  if (amount < hundredMillion) return String(amount)
  const head = Math.trunc(amount / hundredMillion)
  const rest = amount % hundredMillion
  return rest === 0 ? `${head}억` : `${head}억${String(rest).padStart(3, '0')}`
}

/** 0x8457c — 스킬 s ≤ 7 이면 StrCOMMON[55 + s], 그 밖 모드 4 면 55 + s · 아니면 71 + s */
function skillNameOf(skill: number, mode: RewardNoticeMode): string {
  const index = skill <= 7 || mode === BATTER_MODE ? skill : skill + 16
  return ORIGINAL_SKILLS[index]?.name ?? ''
}

const sprintf = (format: string, value: string | number) => format.replace(/%[ds]/, String(value))

/** 연차 보정 0x8d508~0x8d69c — 393~395 · 396, 모드 2 와 그 밖이 다르다. 명령 값을 덮어 쓴다 */
function yearAdjusted(items: readonly EventReward[], eventId: number, ctx: RewardNoticeContext): readonly EventReward[] {
  const y = ctx.years
  const isSeason = ctx.mode === SEASON_MODE
  const table: Readonly<Record<number, number>> | null = eventId >= 393 && eventId <= 395
    ? (isSeason ? { 0: 5, 1: 5, 3: 5 } : { 0: 3, 1: -2, 3: 1 })
    : eventId === 396
      ? (isSeason ? { 0: -10, 1: -2 } : { 0: -4, 1: -3 })
      : null
  if (table === null) return items
  return items.map((item) => {
    const perYear = table[item.kind]
    return perYear === undefined ? item : { ...item, value: item.value + perYear * y }
  })
}

/** 0x8beb8 — 항목들의 알림 글과 고친 항목 (굴림은 종류 11 값 ≥ 0 마다 한 번) */
function buildRewardText(
  items: readonly EventReward[], ctx: RewardNoticeContext,
): { readonly text: string; readonly items: readonly EventReward[] } {
  let text = ''
  const resolved: EventReward[] = []
  items.forEach((item, index) => {
    const { value } = item
    let kind = item.kind
    if (kind >= 13 && kind <= 16) kind += ctx.mode === PITCHER_MODE ? 5 : ctx.mode === SEASON_MODE ? 9 : 0
    if (item.kind === ORDER_PATH_KIND) {
      text += sprintf(MODE_TEXT[182], value === 0 ? 4 : 1)
      resolved.push(item)
      return
    }
    if (item.kind === ORDER_KIND) {
      text += sprintf(MODE_TEXT[183], value)
      resolved.push(item)
      return
    }
    if (index !== 0) text += '!N'
    text += '!C'
    const name = MODE_TEXT[REWARD_NAME_BASE + kind] ?? ''
    if (item.kind === SKILL_KIND) {
      const skillName = skillNameOf(Math.abs(value) - 1, ctx.mode)
      text += `!cFFFF00"${skillName}"!cFFFFFF!N !N${name}${value > 0 ? '을 획득하였습니다.' : '이 제거되었습니다.'}`
    } else if (SILENT_KINDS.has(item.kind)) {
      // 5 · 7 · 8 — 머리말("!N" · "!C")만 남는다
    } else if (item.kind === PITCH_KIND) {
      text += sprintf(MODE_TEXT[222], pitchTypeNameOf(HIDDEN_PITCH_TYPE_NUMBERS[value] ?? 0))
    } else if (item.kind === GP_ITEM_KIND) {
      const base = ctx.mode === SEASON_MODE ? 119 : 98
      const offset = ctx.mode === BATTER_MODE && value === 10 ? value : value - 1
      text += `${MODE_TEXT[31]}!N[!cFFFF00${ORIGINAL_ITEMS[base + offset] ?? ''}!cFFFFFF]`
    } else if (item.kind === ILLNESS_KIND) {
      if (value < 0) {
        text += sprintf(MODE_TEXT[206], MODE_TEXT[185 + ctx.illness] ?? '')
      } else {
        const rolled = ctx.random.rand(0, ILLNESS_COUNT)
        text += sprintf(MODE_TEXT[207], MODE_TEXT[186 + rolled] ?? '')
        resolved.push({ kind: item.kind, value: rolled + 1 })
        return
      }
    } else if (item.kind === MONEY_KIND) {
      text += `${name}${value >= 0 ? ' +' : ''} ${originalMoneyText(Math.abs(value * 100))}만`
    } else if (item.kind === SALARY_KIND) {
      text += `연봉 ${salaryAfter(ctx.salaryBase, value) * 100}만 결정!`
    } else {
      text += `${name}${value >= 0 ? ' +' : ''} ${value}`
    }
    resolved.push(item)
  })
  return { text, items: resolved }
}

/**
 * 보상 명령 하나의 알림 (0x8d4c4). 이벤트 번호는 연차 보정(393~396)을 가린다 — 보정한 값은 글에만 쓰고
 * 돌려주는 항목에는 담지 않는다(`applyEventRewards` 가 다시 보정한다).
 */
export function rewardNoticeOf(items: readonly EventReward[], eventId: number, ctx: RewardNoticeContext): RewardNoticeResult {
  const first = items[0]?.kind
  if (first === ENDING_KIND) return { notice: { kind: '엔딩' }, items }
  const adjusted = yearAdjusted(items, eventId, ctx)
  const built = buildRewardText(adjusted, ctx)
  // 연차 보정은 종류 0 · 1 · 3 만 건드린다 — 질병 굴림만 원래 항목에 옮긴다
  const resolved = items.map((item, index) =>
    item.kind === ILLNESS_KIND && item.value >= 0 ? (built.items[index] ?? item) : item)
  if (first === SKILL_KIND) {
    return { notice: { kind: '스킬', text: built.text, gained: (adjusted[0]?.value ?? 0) > 0 }, items: resolved }
  }
  if (first === HIDDEN_OPEN_KIND) {
    const text = hiddenOpenNoticeTextOf(items)
    return { notice: text === null ? { kind: '없음' } : { kind: '알림', text }, items: resolved }
  }
  return { notice: { kind: '알림', text: built.text }, items: resolved }
}

/**
 * **첫 종류 7 의 창 글** — 0x8c460 이 항목마다 종류 7 이면 0x62368(전역, |값|, 1)을 부른다. 셋째 인자 1 이라 이미 열렸는지
 * (0x61f5c)를 안 보고 **늘** 공용 창을 띄운다(R13 11절). 글은 StrCOMMON[139] "히든 아이템 오픈!! [이름]" + 쓰는 곳 줄
 * (id 13~18 [141] 시즌 · 19~34 [142] 투수편 · 35~50 [143] 타자편, 0x62420~0x62480) — 모드와 상관없이 id 로 갈린다
 * (투수편 장소 이벤트 304 · 305 의 타자 id 도 타자편 글). 글은 상점 알림과 같은 웹 글(`pitcherHiddenOpenTextOf` ·
 * `hiddenOpenTextOf`)을 쓴다.
 * 한 명령에 종류 7 이 여럿이면 0x62368 이 같은 창을 차례로 다시 세워 **마지막 것**이 남는다(유력 — 데이터의 종류 7 명령
 * 304 · 305 · 306 · 307 은 모두 한 항목이라 겉으로 갈리지 않는다). 웹이 글을 못 짓는 id 면 null.
 */
function hiddenOpenNoticeTextOf(items: readonly EventReward[]): string | null {
  const opened = items.filter((item) => item.kind === HIDDEN_OPEN_KIND)
  const last = opened[opened.length - 1]
  if (last === undefined) return null
  const id = Math.abs(last.value)
  return pitcherHiddenOpenTextOf(id) ?? hiddenOpenTextOf(id)
}

/** 알림 글이 읽는 선수 칸 — 나리 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 가 같은 이름으로 든다 */
export interface RewardNoticeCareer extends SalaryHolder {
  /** 1 기준 연차 — 연차 보정 y = 연차 − 1 (`applyEventRewards` 와 같은 잣대) */
  readonly season: number
  readonly isSick: boolean
  readonly illnessName: string | null
}

/** 나리 두 편의 알림 맥락 — 모드 4 타자편 · 3 투수편 */
export function rewardNoticeContextOf(career: RewardNoticeCareer, mode: RewardNoticeMode, random: RandomPort): RewardNoticeContext {
  const illnessIndex = career.isSick && career.illnessName !== null ? ILLNESS_NAMES.indexOf(career.illnessName) + 1 : 0
  return {
    mode,
    years: Math.max(0, career.season - 1),
    illness: Math.max(0, illnessIndex),
    salaryBase: salaryOfferOf(career).salary,
    random,
  }
}

/** 시즌모드 알림 글이 읽는 기록 칸 — `SeasonRecord` 가 같은 이름으로 든다 */
export interface SeasonRewardNoticeRecord {
  /** 연차 idx SR+0xb3 (0부터) — 연차 보정 y */
  readonly yearIndex: number
  /** 지금 질병 SR+5 — 0 없음 · 1~4 */
  readonly illness: number
}

/**
 * 시즌모드(모드 2)의 알림 맥락 — 0x8beb8 은 모드 2 에서도 같은 함수다: 13~16 이름 +9 · GP 이름 StrITEM 119 + 값 − 1 ·
 * 연차 보정(0x8d508) 모드 2 갈래. 선수 칸은 시즌 기록(SR)이다.
 * ⚠️ 연봉(종류 20)의 0xa39fc(선수) 는 s_event 에 그 종류가 없어(전수) 값을 두지 않는다 — 0 (미해결, 쓰이지 않는다).
 */
export function seasonRewardNoticeContextOf(record: SeasonRewardNoticeRecord, random: RandomPort): RewardNoticeContext {
  return { mode: SEASON_MODE, years: record.yearIndex, illness: record.illness, salaryBase: 0, random }
}
