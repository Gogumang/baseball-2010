import type { BaseState } from '@/entities/game/model/baseState'
import type { QuickAtBatSituation } from '@/entities/game/model/quickAtBat'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { AtBatOutcome } from '@/entities/game/model/simulateHalfInning/otherSlices'

export interface HalfInningPitching {
  /** 이 이닝 전까지 이어지던 연속 삼진 수 */
  readonly strikeoutCombo: number
  /** 이 이닝 전까지 우리 투수가 잡은 삼진 수 */
  readonly strikeouts: number
}

export const EMPTY_HALF_INNING_PITCHING: HalfInningPitching = { strikeoutCombo: 0, strikeouts: 0 }

/**
 * 타석 하나가 시작·끝날 때 부르는 갈고리 — **돌발미션 발동(0x8f158)과 판정(0x8f414)** 자리다.
 *
 * 원본 경기 장면은 반 이닝을 뭉뚱그리지 않고 타석마다 상태 0xd → 0xe → **0xf(준비)** → … → 0x18 을
 * 지나고, 0xf 에서 돌발을 굴리고 타석이 끝나는 자리에서 결과비트로 판정한다 (K 4절 1-6).
 * 반 이닝을 한 번에 도는 이 함수에 그 두 자리를 열어 두어, 부르는 쪽이 같은 시점에 끼어들 수 있게 한다.
 * 안 넘기면 아무 일도 하지 않으므로 하루치 다른 팀 경기(0xc2a48)처럼 장면이 없는 길은 그대로다.
 */
export interface HalfInningHooks {
  /** 상태 0xf — 이 타석이 시작될 때의 루·아웃 */
  readonly onAtBatStart?: (state: {
    readonly bases: BaseState
    readonly outs: number
    readonly battingOrderIndex: number
    /** 이 타석 전까지 이 투수가 잡은 삼진 (돌발 조건 b6 = 3) */
    readonly strikeoutsSoFar: number
  }) => void
  /** 타석이 끝나는 자리 — 결과비트를 만들 재료 */
  readonly onAtBatEnd?: (state: {
    readonly outcome: AtBatOutcome
    readonly runsBattedIn: number
    readonly outsBefore: number
    readonly outsAdded: number
    readonly inningEnded: boolean
  }) => void
  /**
   * **경기 끝 판정 0xb68fc** — 원본 간이 경기 고리는 타석(0xc262c 한 번)마다 0xc2198 머리 c21d6 에서 이것을 보고
   * 참이면 그 자리에서 경기를 끝낸다(3아웃 전이어도 — 말 공격의 끝내기 · 홈 10점 콜드). 이 반 이닝의 득점·아웃을 받아
   * 부르는 쪽이 경기 점수로 `isGameOverAt` 을 본다. 안 주면 3아웃까지 돈다.
   */
  readonly endsGame?: (state: { readonly runs: number; readonly outs: number }) => boolean
  /**
   * **자동진행이 사람에게 넘기는 자리** — 0x21 갱신 0x48480 은 타석마다 0xc2198 → 0xc1e04 로 "이 타석도 자동인가" 를 다시 묻고
   * 아니면 0x18 로 넘긴다(반 이닝 중간이어도). 타석을 열기 앞(대타 · 교체 판정 0xc1ba4 보다 먼저)에 이것이 참이면 그 자리에서 멈춘다 —
   * 미션 타자 미션의 미션 타자 차례(0xc1d38). 안 주면 3아웃까지 돈다.
   */
  readonly stopsBefore?: (state: { readonly battingOrderIndex: number; readonly lineup?: QuickLineup }) => boolean
}

/** 반 이닝 내내 같은 0xab214 의 모드·팀 조작 칸 (`QuickAtBatSituation` 에서 이닝을 뺀 것) */
export type HalfInningSwingContext = Omit<QuickAtBatSituation, 'inning'>
