import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { gainMorale, MAXIMUM_MORALE, MAXIMUM_POPULARITY, MAXIMUM_REPUTATION, spendCycleAction } from '@/entities/career/model/playerCareer'
import type { OutingEffect, OutingFunction, OutingRange, RolledOutingEffect } from '@/shared/config/outingPlaces'
import { HOSPITAL_RECOVERY, REST_RECOVERY, rollRecovery } from '@/entities/career/model/recovery'
import type { RecoverableCareer } from '@/entities/career/model/recovery'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyOutingSubItems, outingSubItemIdOf, SUB_ITEMS } from '@/entities/career/model/subItems'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 외출 커맨드 — 2010판에서 신규 추가된 기능이다.
 * 원작 설명서: "전체 맵으로 이동할 수 있으며 ... 각 건물마다 특수 기능을 사용할 수 있으며"
 */

export type OutingBlockReason = '소지금부족' | '건강함' | '인기도부족' | '사기최고'

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
  Pick<PlayerCareer, 'hasActedThisCycle' | 'popularity' | 'reputation' | 'morale' | 'money' | 'subItemIds' | 'outingsThisSeason'>

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
export function outingBlockReasonOf(career: OutingCareer, outingFunction: OutingFunction): OutingBlockReason | null {
  // 행동함(S+4)은 보지 않는다 — 0x16cf0 은 아래 넷뿐이다
  // StrMODE[62] "인기도가 부족합니다. 필요한 인기도 : %d"
  if (career.popularity < outingFunction.requiredPopularity) return '인기도부족'
  // StrMODE[77] — 원본은 보험증서(서브아이템 7)를 보지 않는다 (B-25). 고친 길은 서브 아이템을 먹인 실제 비용으로 견준다
  const moneyCost = outingMoneyCostOf(career, outingFunction)
  if (moneyCost > 0 && career.money < moneyCost) return '소지금부족'
  // StrMODE[196] "건강한 상태입니다 입원할 필요가 없습니다"
  if (outingFunction.effect.healsInjury && !career.isInjured && !career.isSick) return '건강함'
  // 외식은 사기가 최고면 막힌다 (StrMODE[91])
  if (outingFunction.id === '외식' && career.morale >= MAXIMUM_MORALE) return '사기최고'
  return null
}

/**
 * 소지금 검사가 보는 비용 — 원본(0x16d42)은 표 비용 그대로라 보험증서가 있어 실제로는 공짜인 입원도 소지금이 모자라면 막는다.
 * **B-25 고침**: 효과 0x15234 가 실제로 빼는 값(서브 아이템 보정 뒤 `applyOutingSubItems` 의 비용 — 입원 + 보험증서면 0)으로 견준다.
 * 굴림이 없는 판정이라 난수 차례는 같다
 */
function outingMoneyCostOf(career: OutingCareer, outingFunction: OutingFunction): number {
  const cost = outingFunction.effect.moneyCost
  if (!isBugFixed('B-25')) return cost
  const applied = applyOutingSubItems(career, outingFunction.id, {
    moneyCost: cost,
    popularityGain: 0,
    reputationGain: 0,
    moraleGain: 0,
    healsInjury: outingFunction.effect.healsInjury,
  })
  return applied.moneyCost
}

/** 막힘 알림 원문 — StrMODE[62] · [77] · [196] · [91] 을 원문 표에서 마크업째 읽는다(r216), 이미 행동함은 r_event_txt[176] */
export function outingBlockTextOf(reason: OutingBlockReason, outingFunction: OutingFunction): string {
  switch (reason) {
    case '인기도부족':
      return (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(outingFunction.requiredPopularity))
    case '소지금부족':
      return ORIGINAL_MODE_TEXT[77] ?? ''
    case '건강함':
      return ORIGINAL_MODE_TEXT[196] ?? ''
    case '사기최고':
      return ORIGINAL_MODE_TEXT[91] ?? ''
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
/** 상태 126 연출 중인 외출 — 고른 기능 id 와 장소 p([gfx+0x184], 지도 프레임 − 1) */
export interface OutingPresentation {
  readonly functionId: string
  readonly place: number
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
 * 상승·하락은 **굴림+보정 ≥ 0** 으로 고른다 (0x153fa). 원본 [83]·[84] 는 앞에 빈칸이 붙은 글(" !c00CC00상승…")이라
 * 숫자 뒤에 빈칸 하나가 들어간다 — 생성 표가 원문 앞 빈칸을 그대로 둔다(r223).
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
function outingEffectTextOf(outingFunction: OutingFunction, rolled: RolledOutingEffect, applied: RolledOutingEffect, ownsSubItem: boolean): string {
  const subItemId = outingSubItemIdOf(outingFunction.id)
  const lines =
    effectLineOf(MODE_TEXT_POPULARITY, rolled.popularityGain, applied.popularityGain - rolled.popularityGain) +
    effectLineOf(MODE_TEXT_REPUTATION, rolled.reputationGain, applied.reputationGain - rolled.reputationGain) +
    effectLineOf(MODE_TEXT_MONEY, -rolled.moneyCost, rolled.moneyCost - applied.moneyCost) +
    effectLineOf(MODE_TEXT_MORALE, rolled.moraleGain, applied.moraleGain - rolled.moraleGain)
  const subItemLine = ownsSubItem && subItemId !== null ? `!N!cFFFF00${SUB_ITEMS[subItemId].name} ${ORIGINAL_MODE_TEXT[MODE_TEXT_EFFECT]}` : ''
  return `!C${lines}${subItemLine}`
}

/**
 * 입원 회복 글 (0x157ba~0x158d2). 질병이 나으면 sprintf(StrMODE[206], 병 이름) ·
 * 부상이 나으면 (앞 글이 있으면 "!N", 없으면 "!C") + "부상에서 회복 되었습니다."(0xcca04).
 */
function hospitalRecoveryTextOf(before: RecoverableCareer, after: RecoverableCareer): string {
  const illness = before.isSick && !after.isSick ? ORIGINAL_MODE_TEXT[MODE_TEXT_ILLNESS_CURED].replace('%s', before.illnessName ?? '') : ''
  const injury = before.isInjured && !after.isInjured ? `${illness === '' ? '!C' : '!N'}부상에서 회복 되었습니다.` : ''
  return illness + injury
}

/**
 * 상태 126 장소 기능 — 효과 0x15234 (→ 입원이면 회복 0x1575c).
 * 굴림 차례는 원본 그대로: 인기도 → 평판 → 사기 bfa55 세 번, 입원이면 이어서 질병·부상 bfa55(0,100) (아픈 칸만).
 * 원본은 효과를 연출 끝(0x84e58)에, 회복을 효과 팝업이 닫힐 때 굴린다 — 그 사이 다른 굴림이 없어 차례는 같다.
 */
export function performOuting<T extends OutingCareer>(career: T, outingFunction: OutingFunction, random: RandomPort): OutingOutcome<T> {
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

export function restBlockReasonOf(career: PlayerCareer): '사기최고' | null {
  // 행동함(S+4)은 보지 않는다 — 105 키 0x1261c 휴식 칸(12682~126bc)은 사기만 본다
  // 0x1261c — 사기가 100 이면 아파도 StrMODE[91] 로 거절한다 (행동으로 치지 않음)
  return isRestRefusedAtFullMorale(career) ? '사기최고' : null
}

/**
 * 휴식 가드 0x12682~0x1269a — 원본은 `사기 == 100` 하나만 보아 **아프거나 다쳐도** StrMODE[91] 로 거절한다(회복 판정 0x1b308 을
 * 굴릴 기회가 없다). **B-24 고침**: 질병·부상 중이면 사기가 100 이어도 휴식을 받는다(사기는 100 에서 잘리고 회복 판정은 그대로 돈다).
 * 고친 길에서 새로 열리는 휴식은 원본에 없던 굴림(사기 bfa55 · 회복 bfa55)을 먹는다 — 그 자리만 난수 차례가 달라진다.
 * 타자편 · 투수편 공용(`pitcherRestBlockReasonOf`)
 */
export function isRestRefusedAtFullMorale(career: Pick<RecoverableCareer, 'isInjured' | 'isSick'> & { readonly morale: number }): boolean {
  if (career.morale < MAXIMUM_MORALE) return false
  return !(isBugFixed('B-24') && (career.isInjured || career.isSick))
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

/**
 * 112 외출 지도 취소(CLR → 105, 키 0x13ba4)가 남기는 행동함(S+4).
 * 원본 13bc0~13bca 는 **늘 S+4 = 0** 으로 내린다 — 트레이닝 · 휴식 · 외출로 행동한 뒤 흑백 외출 칸에 들어갔다 취소하면 세 칸이 다시 켜져
 * 한 주기에 두 번 행동한다 (B-26).
 * **B-26 고침**: 105 에서 지도로 들어설 때의 값으로 되돌린다 — 들어설 때 행동하지 않았으면 원본처럼 내리고(지도 진입 이벤트가 켠
 * 행동함을 취소가 되돌리는 원본 동작은 그대로), 이미 행동했으면 그대로 둔다. 들어설 때 값을 모르면(`null`) 지금 값을 둔다.
 * 굴림이 없어 난수 차례는 같다
 */
export function actedAfterOutingMapCancel(actedNow: boolean, actedAtEntry: boolean | null): boolean {
  if (!isBugFixed('B-26')) return false
  return actedAtEntry ?? actedNow
}
