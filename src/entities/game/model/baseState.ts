import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { isBugFixed } from '@/shared/config/bugfixes'

export interface BaseState {
  readonly first: boolean
  readonly second: boolean
  readonly third: boolean
}

export const EMPTY_BASES: BaseState = { first: false, second: false, third: false }

export function runnerCountOf(bases: BaseState): number {
  return Number(bases.first) + Number(bases.second) + Number(bases.third)
}

export interface AdvanceResult {
  readonly bases: BaseState
  readonly runsScored: number
  readonly outsAdded: number
}

const MAXIMUM_OUTS_PER_INNING = 3

/**
 * 땅볼 아웃에 주자가 한 루 나가는 확률 (binary.mod 0xc11f0, 상한 0xc17ec = 5999).
 * 원본(c15b8~c160c, 직접 뜬 것)은 `state[6] ≤ 1 && rand(0,10000) ≤ 5999 && 개수(0xa9598) > 0 &&
 * 목록[개수−1](0xa9565)+0x8c ≤ 2` 일 때 `0xc0fb4(sim, 1)` 로 전원을 한 루 민다.
 *
 * **확정 (2026-10 r87)**: "목록의 마지막 주자 루 ≤ 2" 는 "3루가 비었다" 와 같다.
 * - 새 주자 추가 0xa93ac 는 먼저 목록 vt20 = 0xa9c68(+0x96 이 선(아웃·득점) 주자를 빼고 차례대로 당기기, 목록 vtable 0xd8308)를
 *   부르고 0xa9374 로 칸을 하나씩 밀어 0 번에 넣는다 → 0 번이 가장 최근, 끝 칸이 가장 앞선 주자다.
 * - 득점한 주자는 0xc0fb4(c1010)가 +0x96 = 1 · +0x8c = 4 로 두고 목록에서 안 뺀다. 그래도 간이 타석이 진루 굴림(c15b8)에 닿기 전에
 *   늘 vt20 이 돈다 — 타석 머리 0xc262c 의 c2676 · 안타 c11c2 · 볼넷 c195a · 도루 c1adc(도루는 전원 한 루라 앞지르기 없음, 득점 없음).
 *   그래서 c15b8 시점의 목록은 산 주자만, 루 차례대로다 → 끝 칸 = 가장 앞선 주자.
 */
export const GROUND_OUT_ADVANCE_LIMIT = 5999

/** 진루타가 될 수 있는 상황인가 */
export function canAdvanceOnGroundOut(bases: BaseState, outsBefore: number): boolean {
  return outsBefore < MAXIMUM_OUTS_PER_INNING - 1 && !bases.third && runnerCountOf(bases) > 0
}

/** 주자를 한 루씩 민다. 3루 주자는 없으므로 득점은 나오지 않는다 */
export function advanceOnGroundOut(bases: BaseState): BaseState {
  return { first: false, second: bases.first, third: bases.second }
}

/**
 * 타격 결과에 따라 주자를 진루시킨다.
 * 병살·주루사처럼 확률이 개입하는 플레이는 아직 넣지 않았다 (YAGNI).
 * 희생플라이만 예외로 넣었다 — 3루 주자가 뜬공에 들어오지 않으면 야구로 보이지 않는다.
 */
export function advanceRunners(
  bases: BaseState,
  outcome: AtBatOutcome,
  outsBefore: number,
  /**
   * CPU 끼리의 간이 엔진(0xc11f0)인가. **원본 간이 엔진에는 희생플라이가 없다** — 결과 코드 0(아웃)은
   * 주자를 전혀 움직이지 않는다 (E-2, 확정). 사람 경기는 수비 시뮬레이션이 태그업을 처리한다.
   */
  options: { readonly quickEngine?: boolean } = {},
): AdvanceResult {
  switch (outcome.kind) {
    case '홈런':
      return { bases: EMPTY_BASES, runsScored: runnerCountOf(bases) + 1, outsAdded: 0 }
    case '안타':
      return advanceForHit(bases, outcome.bases)
    case '볼넷':
    // 사구도 같은 밀어내기다 — 0xae24c 가 투구 판정 3(볼넷)·4(사구)를 함께 상태 0x17(밀어내기 주루)로 보낸다
    case '사구':
      return advanceForWalk(bases)
    case '삼진':
      return { bases, runsScored: 0, outsAdded: 1 }
    case '아웃':
      return advanceForOut(bases, outcome.detail, outsBefore, options.quickEngine === true)
  }
}

function advanceForHit(bases: BaseState, hitBases: 1 | 2 | 3): AdvanceResult {
  if (hitBases === 3) {
    return {
      bases: { first: false, second: false, third: true },
      runsScored: runnerCountOf(bases),
      outsAdded: 0,
    }
  }
  if (hitBases === 2) {
    return {
      bases: { first: false, second: true, third: bases.first },
      runsScored: Number(bases.second) + Number(bases.third),
      outsAdded: 0,
    }
  }
  return {
    bases: { first: true, second: bases.first, third: bases.second },
    runsScored: Number(bases.third),
    outsAdded: 0,
  }
}

/**
 * **간이 엔진의 볼넷** (0xc1818 c1918~c194a, 디스어셈 대조 — 확정): 타자를 주자 목록 0번 칸에 넣고(0xa93ac, 루 0) 곧장
 * `0xc0fb4(sim, 1)` 로 **모든 주자를 한 루씩** 민다 — 안타 진루와 같은 함수다. 밀려나지 않는 주자도 가므로(2루 주자 → 3루,
 * 3루 주자 → 득점) 밀어내기가 아니다. ⚠️ 원본 버그(B-14).
 * 사람 경기의 볼넷·사구(판정 A 0xae24c → 상태 0x17 밀어내기 주루)는 `advanceRunners` 의 밀어내기다.
 *
 * **고침(`bugfixes.json` B-14, 기본 켬)**: 사람 경기와 같은 밀어내기 — 밀려난 주자만 한 루 가고 만루에서만 1점.
 * 이 함수는 굴림을 안 쓰지만, 루가 달라지면 뒤이은 도루 굴림(후보가 있을 때만)·땅볼 진루 판정이 달라져 난수 차례가 바뀔 수 있다.
 */
export function advanceOnQuickWalk(bases: BaseState): AdvanceResult {
  return isBugFixed('B-14') ? advanceForWalk(bases) : advanceForHit(bases, 1)
}

/** 볼넷·사구는 밀려난 주자만 진루한다. 만루에서만 점수가 난다. */
function advanceForWalk(bases: BaseState): AdvanceResult {
  if (!bases.first) return { bases: { ...bases, first: true }, runsScored: 0, outsAdded: 0 }
  if (!bases.second) return { bases: { ...bases, second: true }, runsScored: 0, outsAdded: 0 }
  if (!bases.third) return { bases: { first: true, second: true, third: true }, runsScored: 0, outsAdded: 0 }
  return { bases, runsScored: 1, outsAdded: 0 }
}

/**
 * 아웃일 때의 주자 처리.
 *
 * **원본 간이 엔진(0xc11f0)에는 희생플라이가 없다** (E-2, 확정): 결과 코드 0(아웃)은 주자를 전혀
 * 움직이지 않아 CPU 경기에서는 3루 주자가 있어도 점수가 나지 않는다. 그래서 `quickEngine` 이면 곧장 아웃이다.
 *
 * 사람 경기의 원본은 여기서 점수를 주는 게 아니라 수비 시뮬레이션이 정한다 (P2 7절):
 * 뜬공을 잡으면 모든 주자의 요구 루가 원래 루가 되고(0xa9620 태그업), 자동 진루 0xaf918 이
 * **수비 송구보다 2틱 이상 빠를 때만** 다음 루로 보낸다 — 즉 희생플라이가 보장되지 않고,
 * 1·2루 주자의 태그업 진루도 있다.
 *
 * 그 수비 시뮬레이션은 `features/defense-play/runDefensePlay` 로 옮겨졌고, **사람이 잡은 타석은
 * 넷 다 그 길로 간다**: 타자편(`play-game`)·팀 경기(`play-team-game`)·투수편(`play-pitcher-game`)·
 * 미션(`entities/mission/model/missionRun.missionPlay` — 인플레이 타구는 진행기 결과의 advance 를 쓴다).
 * 자동으로 넘기는 타석은 원본도 간이 엔진이므로 `quickEngine` 갈래를 쓴다.
 *
 * ⚠️ 아래 "3루 주자면 1점" 근사는 판 결과 없이 아웃을 먹이는 길(시험 · 판을 안 도는 옛 호출)에만 남는다.
 */
function advanceForOut(
  bases: BaseState,
  detail: '땅볼아웃' | '뜬공아웃' | '직선타아웃',
  outsBefore: number,
  quickEngine: boolean,
): AdvanceResult {
  if (quickEngine) return { bases, runsScored: 0, outsAdded: 1 }

  const canSacrifice =
    detail === '뜬공아웃' && bases.third && outsBefore < MAXIMUM_OUTS_PER_INNING - 1

  if (canSacrifice) {
    return { bases: { ...bases, third: false }, runsScored: 1, outsAdded: 1 }
  }
  return { bases, runsScored: 0, outsAdded: 1 }
}
