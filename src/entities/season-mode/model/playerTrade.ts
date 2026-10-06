import {
  HALL_OF_FAME_FIRST_ID, OWN_PLAYER_ID, PLAYER_OWN_BIT, withSlot, withTableTeam,
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
 * 선수 바이트 `+0x1b` 는 이제 선수 표에 있다(`RosterPlayer.grade`) — 성공률의 차이 항 `d` 와 성공 시 소지금 변화가 읽는다.
 *
 * 성공 뒤 두 명단 맞바꾸기(0xd1cc~0xd3ae)도 직접 떴다 — `swapTradedPlayers` 머리 주석.
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
 *
 * 강제 성공이어도 **뽑기는 먼저 한다** (직접 떴다 — d160 `bfa55(1,101)` → d16c `< r` 이면 성공,
 * 아니면 d170 에서 this+0x148 을 본다). 난수 하나가 늘 나간다.
 */
export function rollTradeSuccess(random: RandomPort, rate: number, isForced = false): boolean {
  const drawn = randomIntegerBelow(random, 1, 101)
  return drawn < rate || isForced
}

/**
 * 성공한 트레이드의 소지금 변화 — 직접 떴다 (0xcfa0~0xcfba 에서 만든 d 를 0xd180~0xd1a0 이 SR+2 에 더한다).
 * ```
 * d = (내.+0x1b − 상대.+0x1b) × 10 ; d < 0 이면 d ×= 2
 * 성공: SR+2 = clamp(SR+2 + d, 0, 9999)        ; 실패는 손대지 않는다
 * ```
 * 성공률 깎기에 쓰는 바로 그 d 다 — 좋은 선수를 내주면 돈이 들어오고, 데려오면 두 배로 나간다(100만 단위).
 */
export function tradeMoneyChangeOf(myGrade: number, opponentGrade: number): number {
  const difference = (myGrade - opponentGrade) * TRADE_GRADE_SCALE
  return difference < 0 ? difference * 2 : difference
}

/** 소지금 상한 (SR+2, 0xd18c `0x270f`) */
const TRADE_MONEY_LIMIT = 9999

/** 성공한 트레이드 뒤 레코드 — SR+2 += d (0..9999) */
export function withTradeMoney(record: SeasonRecord, myGrade: number, opponentGrade: number): SeasonRecord {
  const money = record.money + tradeMoneyChangeOf(myGrade, opponentGrade)
  return { ...record, money: Math.min(Math.max(money, 0), TRADE_MONEY_LIMIT) }
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

/**
 * 성공한 트레이드가 맞바꿀 두 칸 — 장면 객체 칸 그대로(this+0x14c 내 칸 · +0x150 상대 칸 · +0x154 탭 · +0x158 상대 팀).
 */
export interface TradeSwap {
  readonly opponentTeamId: number
  /** 0 투수 · 1 타자 (`0xb5695` 의 탭 — 0xd1c6 `cmp 탭, #0` · 0xd2e0 `cmp 탭, #1`) */
  readonly tab: number
  /** 내 팀 레코드 배열의 칸 */
  readonly myIndex: number
  /** 상대 팀 레코드 배열의 칸 */
  readonly opponentIndex: number
}

/** 트레이드 한 번의 결과 — 화면이 만들고 세션이 한 번에 저장한다 */
export interface TradeSettlement {
  /** SR+0x56 이 선 레코드 (성공이면 소지금 SR+2 도 바뀌었다) */
  readonly record: SeasonRecord
  /** 이번에 쓴 G (저장+0x64 에서 나간다) */
  readonly gamePointCost: number
  readonly isSuccess: boolean
  /** 성공이면 맞바꿀 두 칸 — 세션이 시즌 저장의 두 팀 레코드에 `swapTradedPlayers` 를 건다. 실패면 없다 */
  readonly swap?: TradeSwap
}

/** 트레이드 탭 — `0xb5695(팀, 탭, i)`: 0 이면 투수 배열(0xb51fc) · 1 이면 타자 배열(0xb53d0) */
export const TRADE_TAB = { 투수: 0, 타자: 1 } as const

export interface TradedRosters {
  readonly mine: SeasonTeamRoster
  readonly theirs: SeasonTeamRoster
}

/**
 * **성공 뒤 두 팀 명단 맞바꾸기** — 0xcf24 의 0xd1a6~0xd3ae (직접 떴다).
 * ```
 * d1a6  M = 0x1f9a9(저장, 모드, 내 팀) ; O = 0x1f9a9(저장, 모드, 상대 팀)        ; 시즌 저장의 두 팀 레코드
 * d1c2  탭 == 0 (투수):
 *   d1cc  i = 0..3: 0xb51fc(M, 내칸)[0x19 + i/2] &= 0xf << (i%2)·4               ; 장비 니블 넷 — 고리를 다 돌면
 *                  0xb51fc(O, 상대칸)[0x19 + i/2] &= 0xf << (i%2)·4               ;   +0x19·+0x1a 가 둘 다 0
 *   d214  A = 0xb6c81(임시) ; B = 0xb6c81(임시)
 *   d22e  memcpy(A, 0xb51fc(M, 내칸), 0x30) ; memcpy(B, 0xb51fc(O, 상대칸), 0x30)
 *   d26a  0xb5625(M, B, 내칸) ; 0xb5625(O, A, 상대칸)                            ; 0x30 바이트를 그대로 덮는다
 * d2e0  탭 == 1 (타자): 같은 고리를 0xb53d0 으로 · 임시는 0xb8de5 · 덮기는 0xb5649
 * 그 밖의 탭은 아무 것도 안 한다 → d3b6 SR+0x56 = 1 · 0x1fded · 저장 0x22755
 *
 * 0xb5625(T, P, j) = memcpy(0xb51fc(T, j), P, 0x30)                               ; 투수 — 고치는 칸 없음
 * 0xb5649(T, P, j): pos = T.타자[j].+0x1c & 0xf ; memcpy(T.타자[j], P, 0x30)
 *                   0xb8e85(T.타자[j], pos, 0)  → +0x1c = pos                     ; 수비 위치는 자리에 남는다
 *                   0xb6605(T.타자[j], j)       → +0xa 하위 5비트 = j              ; 칸 번호는 새 칸
 * ```
 * - 레코드 0x30 바이트째 옮기므로 id(+0, 곧 붙박이 표 행)·+0x1b·스태미나(+0x2c)·성적 칸이 선수를 따라간다 — 웹은
 *   `tableTeamId`(`withTableTeam`)·`stamina` 로 따라가게 한다. **투수는 칸 번호(+0xa 하위 5비트)도 옛 팀 것 그대로**다
 *   (0xb5625 는 고치지 않는다 — 영입 0xb521c 투수 가지처럼 표시용 칸 번호만 어긋난다, 원본 그대로).
 * - 장비 니블(+0x19·+0x1a, 0xb646c 의 장비 보너스 칸)은 두 선수 모두 0 이 된다. 리그 열 팀(Xls 0~9팀) 선수는
 *   원래 그 두 바이트가 0 이고(`XlsPITCHER_DATA`·`XlsBATTER_DATA` 를 줄마다 확인 — 0 이 아닌 줄은 14팀뿐),
 *   웹 시즌 선수에는 장비 칸이 없어 할 일이 없다. 나리·명전 선수(장비가 있을 수 있다)는 트레이드에서 거절된다.
 * - 임시 레코드 생성자·소멸자(0xb6c81/0xb6cb5 · 0xb8de5/0xb8e19)는 버퍼 준비뿐이라 옮길 것이 없다.
 */
export function swapTradedPlayers(
  myTeamId: number,
  rosters: TradedRosters,
  swap: TradeSwap,
): TradedRosters {
  const { mine, theirs } = rosters
  const { opponentTeamId, tab, myIndex, opponentIndex } = swap
  if (tab === TRADE_TAB.투수) {
    const given = mine.pitchers[myIndex]
    const taken = theirs.pitchers[opponentIndex]
    // 0xb51fc 가 0(칸 밖)을 돌려주는 판은 원본도 널 포인터를 건드린다 — 웹 명단은 늘 8명 이상이라 닿지 않는다
    if (given === undefined || taken === undefined) return rosters
    const mineNext = [...mine.pitchers]
    const theirsNext = [...theirs.pitchers]
    mineNext[myIndex] = withTableTeam(taken, opponentTeamId, myTeamId)
    theirsNext[opponentIndex] = withTableTeam(given, myTeamId, opponentTeamId)
    return { mine: { ...mine, pitchers: mineNext }, theirs: { ...theirs, pitchers: theirsNext } }
  }
  if (tab === TRADE_TAB.타자) {
    const given = mine.batters[myIndex]
    const taken = theirs.batters[opponentIndex]
    if (given === undefined || taken === undefined) return rosters
    const mineNext = [...mine.batters]
    const theirsNext = [...theirs.batters]
    // 0xb5649 — 들어온 선수는 그 자리의 수비 위치(+0x1c & 0xf)와 칸 번호 j 를 받는다
    mineNext[myIndex] = withSlot(
      { ...withTableTeam(taken, opponentTeamId, myTeamId), fieldPosition: given.fieldPosition & 0xf },
      myIndex,
    )
    theirsNext[opponentIndex] = withSlot(
      { ...withTableTeam(given, myTeamId, opponentTeamId), fieldPosition: taken.fieldPosition & 0xf },
      opponentIndex,
    )
    return { mine: { ...mine, batters: mineNext }, theirs: { ...theirs, batters: theirsNext } }
  }
  return rosters
}
