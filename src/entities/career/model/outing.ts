import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  gainMorale,
  MAXIMUM_MORALE,
  MAXIMUM_POPULARITY,
  MAXIMUM_REPUTATION,
  spendCycleAction,
} from '@/entities/career/model/playerCareer'
import type { OutingEffect, OutingFunction, OutingRange, RolledOutingEffect } from '@/shared/config/outingPlaces'
import { HOSPITAL_RECOVERY, REST_RECOVERY, rollRecovery } from '@/entities/career/model/recovery'
import type { RecoverableCareer } from '@/entities/career/model/recovery'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyOutingSubItems, outingSubItemIdOf, SUB_ITEMS } from '@/entities/career/model/subItems'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/**
 * 외출 커맨드 — 2010판에서 신규 추가된 기능이다.
 * 원작 설명서: "전체 맵으로 이동할 수 있으며 ... 각 건물마다 특수 기능을 사용할 수 있으며"
 */


export type OutingBlockReason = '소지금부족' | '이미행동함' | '건강함' | '인기도부족' | '사기최고'

/**
 * 외출이 읽고 쓰는 칸만 추린 것 — **타자편·투수편이 함께 쓴다.**
 *
 * 원본 모드 3(투수편)·4(타자편)는 한 장면 0x106 의 같은 상태 112·113·126 을 돈다 (디스어셈 확정):
 *   - 105 커맨드 칸 3(점프표 0xcc540 → 0x126be)은 모드를 보지 않고 곧장 상태 0x70(112) 로 간다.
 *   - 112 진입 0x118e4(지도 적재 0x7f49c · [!] 배정 0x8cdc0) · 113 키·가드 0x16c64 · 효과 0x15234 ·
 *     입원 회복 0x1575c 어디에도 모드 갈림이 없다 — 표(0xcc402 · 0xcc344 · 0xcc358 · 0xcc34e · 0xcc33a)와
 *     서브 아이템 칸(`기록[0x5d + 장소]`, 점프표 0xcc6c4)·인기도 +0x48 · 평판 +0x62 · 소지금 +2 · 사기 0xa3a45 를
 *     장면의 기록(`[장면+0xb0]`)에 그대로 쓴다.
 * 그래서 커리어 타입을 묶지 않고 이 칸들을 가진 것이면 무엇이든 받는다 (`PlayerCareer`·`PitcherCareer`).
 */
export type OutingCareer = RecoverableCareer &
  Pick<
    PlayerCareer,
    'hasActedThisCycle' | 'popularity' | 'reputation' | 'morale' | 'money' | 'subItemIds' | 'outingsThisSeason'
  >

/**
 * 외출 막힘 판정 — **원본 0x16cf0 의 순서 그대로**다 (G-3 확정):
 *   1. 필요 인기도 `0xcc402[장소]` > 인기도 → StrMODE[62]
 *   2. 비용 > 소지금 → StrMODE[77]
 *   3. 입원인데 질병·부상 없음 → StrMODE[196]
 *   4. 외식인데 사기 100 → StrMODE[91]
 *
 * ⚠️ **원본 버그를 그대로 옮긴다** (DECISIONS 2026-09-20): 2번 소지금 검사는 **보험증서를 보지 않는다**
 * (0x16d42) → 보험증서가 있어 실제로는 공짜인 입원도 소지금이 모자라면 막힌다.
 */
export function outingBlockReasonOf(
  career: OutingCareer,
  outingFunction: OutingFunction,
): OutingBlockReason | null {
  if (career.hasActedThisCycle) return '이미행동함'
  // StrMODE[62] "인기도가 부족합니다. 필요한 인기도 : %d"
  if (career.popularity < outingFunction.requiredPopularity) return '인기도부족'
  // StrMODE[77] — 보험증서(서브아이템 7)를 보지 않는다 (원본 그대로)
  if (outingFunction.effect.moneyCost > 0 && career.money < outingFunction.effect.moneyCost) return '소지금부족'
  // StrMODE[196] "건강한 상태입니다 입원할 필요가 없습니다"
  if (outingFunction.effect.healsInjury && !career.isInjured && !career.isSick) return '건강함'
  // 외식은 사기가 최고면 막힌다 (StrMODE[91])
  if (outingFunction.id === '외식' && career.morale >= MAXIMUM_MORALE) return '사기최고'
  return null
}

/** 막힘 알림 원문 — StrMODE[62] · [77] · [196] · [91] (색 표식 `!C`·`!N`·`!c…` 은 뺐다), 이미 행동함은 r_event_txt[176] */
export function outingBlockTextOf(reason: OutingBlockReason, outingFunction: OutingFunction): string {
  switch (reason) {
    case '인기도부족':
      return `인기도가 부족합니다. 필요한 인기도 : ${outingFunction.requiredPopularity}`
    case '소지금부족':
      return '소지금이 부족합니다'
    case '건강함':
      return '건강한 상태입니다 입원할 필요가 없습니다'
    case '사기최고':
      return '사기 최고 상태입니다'
    case '이미행동함':
      return '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다'
  }
}

const clamp = (value: number, maximum: number) => Math.min(maximum, Math.max(0, value))

function rollRange(random: RandomPort, [first, second]: OutingRange): number {
  const sign = first < 0 ? -1 : 1
  return sign * random.rand(Math.abs(first), Math.abs(second))
}

/** 효과 표의 난수를 뽑는다 — 순서 인기도 → 평판 → 사기 (0x1524c · 0x1526e · 0x1528e, G 3-2 확정) */
export function rollOutingEffect(effect: OutingEffect, random: RandomPort): RolledOutingEffect {
  return {
    moneyCost: effect.moneyCost,
    popularityGain: rollRange(random, effect.popularity),
    reputationGain: rollRange(random, effect.reputation),
    moraleGain: rollRange(random, effect.morale),
    healsInjury: effect.healsInjury,
  }
}

/**
 * 상태 126 장소 기능 한 번의 결과 — 커리어와 원본 팝업 두 장의 글.
 *   `effectText`   — 효과 0x15234 가 끝에 띄우는 팝업 `0xbbef8(글, 1, 코드 3, 1)` 의 글
 *   `recoveryText` — 그 팝업이 닫힌 뒤 126 틀 0x1575c 가 입원(장소 2)일 때 만드는 회복 글. 없으면 ''
 *                    (글이 있을 때만 팝업 `0xbbef8(글, 1, 1, 1)` 을 띄우고, 어느 쪽이든 곧장 105 로 간다)
 */
export interface OutingResult {
  readonly effectText: string
  readonly recoveryText: string
}
export interface OutingOutcome<T extends OutingCareer> extends OutingResult {
  readonly career: T
}

const MODE_TEXT_POPULARITY = 22
const MODE_TEXT_REPUTATION = 23
const MODE_TEXT_MORALE = 24
const MODE_TEXT_MONEY = 25
const MODE_TEXT_RISE = 83
const MODE_TEXT_FALL = 84
const MODE_TEXT_EFFECT = 195
const MODE_TEXT_ILLNESS_CURED = 206

/**
 * 효과 한 줄 (0x15382~0x1541a 와 같은 꼴 네 번) — **굴린 값(보정 전)이 0 이면 줄이 없다**.
 *   이름 StrMODE[n] + " " + |굴림+보정| + (보정 ≠ 0 이면 "(" + 부호 + |보정| + ")") + ([83] 상승 | [84] 하락) + "!N"
 * 상승·하락은 **굴림+보정 ≥ 0** 으로 고른다 (0x153fa). 숫자와 [83]·[84] 사이에 띄어쓰기가 없다 (원본 그대로).
 */
function effectLineOf(nameId: number, rolled: number, bonus: number): string {
  if (rolled === 0) return ''
  const total = rolled + bonus
  const bonusText = bonus === 0 ? '' : `(${bonus > 0 ? '+' : '-'}${Math.abs(bonus)})`
  const verb = ORIGINAL_MODE_TEXT[total >= 0 ? MODE_TEXT_RISE : MODE_TEXT_FALL]
  return `${ORIGINAL_MODE_TEXT[nameId]} ${Math.abs(total)}${bonusText}${verb}!N`
}

/**
 * 효과 팝업 글 (0x15378~0x156da). "!C" 뒤에 줄 차례는 **인기도 → 평판 → 소지금 → 사기** 다
 * (StrMODE[22] · [23] · [25] · [24]). 소지금은 기록 단위(100만)에 ×100 해 찍으므로 웹 단위(만원) 그대로다.
 * 서브 아이템(`기록[0x5d+장소]`)이 있으면 "!N" + "!cFFFF00" + 아이템 이름(0x845d4 = 이름표 93+장소) + " " + [195] "효과".
 */
function outingEffectTextOf(
  outingFunction: OutingFunction,
  rolled: RolledOutingEffect,
  applied: RolledOutingEffect,
  ownsSubItem: boolean,
): string {
  const subItemId = outingSubItemIdOf(outingFunction.id)
  const lines =
    effectLineOf(MODE_TEXT_POPULARITY, rolled.popularityGain, applied.popularityGain - rolled.popularityGain) +
    effectLineOf(MODE_TEXT_REPUTATION, rolled.reputationGain, applied.reputationGain - rolled.reputationGain) +
    effectLineOf(MODE_TEXT_MONEY, -rolled.moneyCost, rolled.moneyCost - applied.moneyCost) +
    effectLineOf(MODE_TEXT_MORALE, rolled.moraleGain, applied.moraleGain - rolled.moraleGain)
  const subItemLine =
    ownsSubItem && subItemId !== null
      ? `!N!cFFFF00${SUB_ITEMS[subItemId].name} ${ORIGINAL_MODE_TEXT[MODE_TEXT_EFFECT]}`
      : ''
  return `!C${lines}${subItemLine}`
}

/**
 * 입원 회복 글 (0x157ba~0x158d2). 질병이 나으면 sprintf(StrMODE[206], 병 이름) ·
 * 부상이 나으면 (앞 글이 있으면 "!N", 없으면 "!C") + "부상에서 회복 되었습니다."(0xcca04).
 */
function hospitalRecoveryTextOf(before: RecoverableCareer, after: RecoverableCareer): string {
  const illness =
    before.isSick && !after.isSick
      ? ORIGINAL_MODE_TEXT[MODE_TEXT_ILLNESS_CURED].replace('%s', before.illnessName ?? '')
      : ''
  const injury = before.isInjured && !after.isInjured ? `${illness === '' ? '!C' : '!N'}부상에서 회복 되었습니다.` : ''
  return illness + injury
}

/**
 * 상태 126 장소 기능 — 효과 0x15234 (→ 입원이면 회복 0x1575c).
 * 굴림 차례는 원본 그대로: 인기도 → 평판 → 사기 bfa55 세 번, 입원이면 이어서 질병·부상 bfa55(0,100) (아픈 칸만).
 * 원본은 효과를 연출 끝(0x84e58)에, 회복을 효과 팝업이 닫힐 때 굴린다 — 그 사이 다른 굴림이 없어 차례는 같다.
 */
export function performOuting<T extends OutingCareer>(
  career: T,
  outingFunction: OutingFunction,
  random: RandomPort,
): OutingOutcome<T> {
  const blockReason = outingBlockReasonOf(career, outingFunction)
  if (blockReason !== null) {
    throw new Error(`외출할 수 없습니다 (${blockReason}): ${outingFunction.name}`)
  }

  const rolled = rollOutingEffect(outingFunction.effect, random)
  const effect = applyOutingSubItems(career, outingFunction.id, rolled)
  const subItemId = outingSubItemIdOf(outingFunction.id)
  const ownsSubItem = subItemId !== null && career.subItemIds.includes(subItemId)
  // 반영 범위는 원본 그대로 (0x152f4~0x15374): 인기도 0..9999 · 평판 0..999 · 사기 0..100 (두 모드 같은 한계)
  const gained: T = {
    ...career,
    hasActedThisCycle: true,
    outingsThisSeason: career.outingsThisSeason + 1,
    money: Math.max(0, career.money - effect.moneyCost),
    morale: clamp(career.morale + effect.moraleGain, MAXIMUM_MORALE),
    popularity: clamp(career.popularity + effect.popularityGain, MAXIMUM_POPULARITY),
    reputation: clamp(career.reputation + effect.reputationGain, MAXIMUM_REPUTATION),
  }
  const effectText = outingEffectTextOf(outingFunction, rolled, effect, ownsSubItem)
  if (!effect.healsInjury) return { career: gained, effectText, recoveryText: '' }
  const recovered = rollRecovery(gained, HOSPITAL_RECOVERY, random).career
  return { career: recovered, effectText, recoveryText: hospitalRecoveryTextOf(gained, recovered) }
}

export function runOuting<T extends OutingCareer>(career: T, outingFunction: OutingFunction, random: RandomPort): T {
  return performOuting(career, outingFunction, random).career
}

/**
 * 원작 [휴식] 커맨드 (0x18e3c) — 사기 bfa55(10,16) = 10~15 회복, 이어서 질병 60% · 부상 30% 회복 판정 (0x1b308, 누락 탐색 7차).
 */
const REST_MORALE_RANGE = { minimum: 10, maximumExclusive: 16 }

export function restBlockReasonOf(career: PlayerCareer): '이미행동함' | '사기최고' | null {
  if (career.hasActedThisCycle) return '이미행동함'
  // 0x1261c — 사기가 100 이면 아파도 StrMODE[91] 로 거절한다 (행동으로 치지 않음)
  return career.morale >= MAXIMUM_MORALE ? '사기최고' : null
}

/** 휴식 결과 (0x18e3c) — 사기만 오른다. 회복 판정은 결과 창을 닫을 때 recoverAfterRest 로 한다 (0x1b308) */
export function runRest(career: PlayerCareer, random: RandomPort): { career: PlayerCareer; moraleGain: number } {
  if (restBlockReasonOf(career) !== null) {
    throw new Error(`휴식할 수 없습니다 (${restBlockReasonOf(career)})`)
  }
  const moraleGain = random.rand(REST_MORALE_RANGE.minimum, REST_MORALE_RANGE.maximumExclusive)
  return { career: gainMorale(spendCycleAction(career), moraleGain), moraleGain }
}

export function recoverAfterRest(career: PlayerCareer, random: RandomPort) {
  return rollRecovery(career, REST_RECOVERY, random)
}
