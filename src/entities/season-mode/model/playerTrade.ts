import {
  HALL_OF_FAME_FIRST_ID, OWN_PLAYER_ID, PLAYER_OWN_BIT,
} from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 시즌 트레이드 — 상태 **0xe4**(팀 고르기) → **0xe5**(영입할 선수) → **0xe6**(보상할 선수)
 * → **0xe7**(확인·진행). `docs/re/P4-season-flow.md` 1a·1b 표 · `docs/re/R13-season-leftovers.md`
 * 그리기 표, 성공률·비용은 `docs/re/J-modes-rules.md` 4-4 **확정**(0xcf24)이다.
 *
 * ⚠️ **웹에 없어서 못 옮긴 것** (지어내지 않았다):
 *   - **선수 등급 바이트 `+0x1b`** — 성공률의 차이 항 `d` 가 읽는 칸인데 웹 선수 표
 *     (`shared/config/original/data/roster.json`)에 없다. 부르는 쪽이 0 을 넘기면 `d = 0` 이다.
 *   - **투수 보직 `0xb6705`** — 웹 로스터에 보직 칸이 없다(`teamGameRoster.ts` 머리 주석과 같은 한계).
 *     그래서 투수 쪽 자리 벌점은 늘 0 이 된다.
 *   - **성공 뒤 두 팀 명단을 실제로 맞바꾸는 루틴** — J 4-4 는 성공률 함수만 풀었다.
 *     `applyTrade` 는 "고른 자리를 상대 선수로 바꾼다" 는 가장 단순한 모양이고 **근사다**.
 */

/** 트레이드 비용 칸 (StrMODE[168]·[169]·[170]) */
export const TRADE_BOOST_COUNT = 3

/** 성공률 가산 표 `0xcbbf0` s8 — 기본 0 · +50% · +20% */
export const TRADE_BOOST_RATE: readonly number[] = [0, 50, 20]
/** 비용 표 `0xcbbed` s8 [0, 20, 10] 에 ×100 한 G (저장+0x64 에서 나간다) */
export const TRADE_BOOST_COST_TABLE: readonly number[] = [0, 20, 10]
export const TRADE_BOOST_COST_SCALE = 100

/** 칸별 G 비용 — 0G · 2000G · 1000G */
export function tradeBoostCostOf(boost: number): number {
  return (TRADE_BOOST_COST_TABLE[boost] ?? 0) * TRADE_BOOST_COST_SCALE
}

/** 성공률 바닥 40, 최저 3, 상한 100 (0xd0ba~0xd0f8) */
export const TRADE_RATE_BASE = 40
export const TRADE_RATE_FLOOR = 3
export const TRADE_RATE_LIMIT = 100
/** 등급 차이는 ×10 하고, 내 쪽이 낮으면(음수) 한 번 더 ×2 한다 (0xcfa0~0xcfba) */
export const TRADE_GRADE_SCALE = 10
/** `|d| × 100 / 250` — 정수 나눗셈이다 */
export const TRADE_GRADE_DIVISOR = 250

/**
 * 타자 탭 자리 벌점 — `0xb6561(p)` 로 본 수비 자리.
 * 자리 0 → 10 · 자리 7 → 8 · 자리 1·4 → 6 · 그 밖 0.
 */
export function batterPositionPenaltyOf(position: number): number {
  if (position === 0) return 10
  if (position === 7) return 8
  if (position === 1 || position === 4) return 6
  return 0
}

/**
 * 투수 탭 보직 벌점 — 보직 3 → 10 · 2·4 → 8 · 0 → 6 · 그 밖 0.
 * ⚠️ 웹 로스터에 보직 칸이 없어 지금은 아무도 이 값을 못 채운다(위 머리 주석).
 */
export function pitcherRolePenaltyOf(role: number): number {
  if (role === 3) return 10
  if (role === 2 || role === 4) return 8
  if (role === 0) return 6
  return 0
}

export interface TradeRateInput {
  /** 내가 내주는 선수의 등급(`+0x1b`) */
  readonly myGrade: number
  /** 데려올 상대 선수의 등급 */
  readonly opponentGrade: number
  /** 내 선수의 자리 벌점 */
  readonly myPenalty: number
  /** 상대 선수의 자리 벌점 */
  readonly opponentPenalty: number
  /** 비용 칸 0·1·2 */
  readonly boost: number
}

/**
 * 성공률 `r` — 원본 0xcf24 그대로 (J 4-4 확정).
 * ```
 * d = (내.+0x1b − 상대.+0x1b) × 10 ; if d < 0: d ×= 2
 * r = 40 − |d|·100/250 − pen(내) − pen(상대) ; r = max(r, 3)
 * r += [0, 50, 20][선택] ; r = min(r, 100)
 * ```
 * ⚠️ **차이를 절댓값으로 본다** — 내가 더 좋은 선수를 내줘도 확률이 떨어진다
 * (좋은 선수를 달라고 하면 음수 쪽이라 두 배로 떨어진다). 원본 그대로 옮겼다.
 */
export function tradeSuccessRate(input: TradeRateInput): number {
  const difference = (input.myGrade - input.opponentGrade) * TRADE_GRADE_SCALE
  const weighted = difference < 0 ? difference * 2 : difference
  const raw = TRADE_RATE_BASE
    - Math.trunc((Math.abs(weighted) * 100) / TRADE_GRADE_DIVISOR)
    - input.myPenalty
    - input.opponentPenalty
  const floored = Math.max(raw, TRADE_RATE_FLOOR)
  return Math.min(floored + (TRADE_BOOST_RATE[input.boost] ?? 0), TRADE_RATE_LIMIT)
}

/**
 * 성공 판정 — `bfa55(1, 101) < r` 또는 **강제 성공 플래그**(this+0x148, CPU 요청 수락).
 * 뽑기가 1..100 이라 실제 확률은 `(r − 1)%` 다 ⚠️ (원본 그대로).
 */
export function rollTradeSuccess(random: RandomPort, rate: number, isForced = false): boolean {
  if (isForced) return true
  return randomIntegerBelow(random, 1, 101) < rate
}

/** 거절 사유 — StrMODE[165] 나만의리그 선수 · [166] 명예의 전당 선수 */
export type TradeRefusal = '나리선수' | '명예선수'

/**
 * 트레이드 못 하는 선수인가 — 원본은 `0xb6389`(나만의리그)·`0xb6349`(명예의 전당) 로 본다
 * (P4 5절 · J 4-5: CPU 요청 대상에서도 빠진다).
 *
 * ⚠️ 그 두 판정 함수의 속은 해독되지 않았다. 웹에는 같은 뜻의 칸이 이미 있어
 * **영입 화면과 같은 규칙**으로 읽는다 — 명예의 전당은 id 구간(`0xb4~`), 나만의리그 육성
 * 선수는 `+0xa` 의 bit7(`PLAYER_OWN_BIT`)이다. 판정 대응은 **근사다**.
 */
export function tradeRefusalOf(player: SeasonPlayer): TradeRefusal | null {
  if (player.id !== OWN_PLAYER_ID && player.id >= HALL_OF_FAME_FIRST_ID) return '명예선수'
  if ((player.kindByte & PLAYER_OWN_BIT) !== 0) return '나리선수'
  return null
}

/** 트레이드 커맨드가 남아 있는가 — SR+0x56 이 0 일 때만 쓸 수 있다 (구단관리 커맨드 1회) */
export function canUseTradeCommand(record: SeasonRecord): boolean {
  return record.tradeUsed === 0
}

/**
 * 트레이드 커맨드를 썼다고 표시한다 (SR+0x56).
 * ⚠️ 이 칸을 **0 으로 되돌리는 곳은 GP 아이템 칸 5(협회허가증, `rec[0x56] = 0` + StrMODE[127])
 * 하나뿐**이다 (P4 6절 표 · R12 3d). 주기마다 지우는 코드는 문서에 없어 넣지 않았다.
 */
export function markTradeUsed(record: SeasonRecord): SeasonRecord {
  return { ...record, tradeUsed: 1 }
}

/** 트레이드 한 번의 결과 — 화면이 만들고 세션이 한 번에 저장한다 */
export interface TradeSettlement {
  /** SR+0x56 이 선 레코드 */
  readonly record: SeasonRecord
  /** 성공이면 바뀐 명단, 실패면 그대로 */
  readonly roster: SeasonTeamRoster
  /** 이번에 쓴 G (저장+0x64 에서 나간다) */
  readonly gamePointCost: number
  readonly isSuccess: boolean
}

/**
 * 성공한 트레이드를 명단에 반영한다 — **근사**.
 *
 * 원본에서 두 팀 명단을 실제로 맞바꾸는 루틴은 해독되지 않았고(J 4-4 는 성공률만 풀었다),
 * 웹은 **상대 팀 명단을 저장하지 않는다**(CPU 팀은 붙박이 표라 되쓸 수 없다).
 * 그래서 여기서는 내 명단의 **고른 자리만 데려온 선수로 바꾼다**(영입과 달리 1:1 이라 끼워넣지
 * 않는다). 자리 번호(`+0xa` 하위 5비트)와 수비 자리는 내주는 선수 것을 그대로 물려준다.
 */
export function applyTrade(
  roster: SeasonTeamRoster,
  isPitcher: boolean,
  slot: number,
  acquired: SeasonPlayer,
): SeasonTeamRoster {
  const players = isPitcher ? roster.pitchers : roster.batters
  const given = players[slot]
  if (given === undefined) return roster
  const next = players.map((player, index) =>
    index === slot
      ? { ...acquired, kindByte: given.kindByte, fieldPosition: given.fieldPosition }
      : player,
  )
  return isPitcher ? { ...roster, pitchers: next } : { ...roster, batters: next }
}
