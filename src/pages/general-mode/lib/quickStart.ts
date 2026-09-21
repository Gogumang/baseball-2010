/**
 * **빠른실행** (J-2 · J 1-2, 확정 — 0x314b0 앞부분이 준비 기록을 통째로 굴린다).
 *
 * 메인 메뉴에서 일반모드를 고를 때 빠른실행을 잡으면 준비 1~6 단계를 건너뛰고 바로
 * 경기정보(상태 22)로 가며, 그 진입 함수가 기록을 이렇게 채운다:
 *
 * ```
 * 31500: 0x9f5a0(저장) → [rec+0] 유저 팀
 * 31512: 0x9f5a0(저장) → [rec+4] AI 팀        ; 같은 함수를 두 번 — 재추첨이 없다
 * 3151a: bfa55(0,2) != 0 → [rec+8] = 1        ; 선공/후공 50%
 * 3152e: [rec+0xc] = 유저 팀                   ; 구장 = 유저 팀 번호
 * 31538: 0x9f650(저장) → [rec+0xe] 마투수
 * 31546: 0x9f604(저장) → [rec+0xd] 마타자
 * ```
 *
 * 경기정보에서 `*` 를 누르면 20틱 동안 이 굴림을 매 틱 되풀이하다 멈춘다(슬롯머신, R4 3b).
 */
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  ACE_PER_ROLE,
  NO_ACE,
  type GeneralModeSetup,
} from '@/pages/general-mode/lib/generalModeSetup'
import { HIDDEN_TEAM_FIRST_ID } from '@/pages/general-mode/lib/hiddenTeam'

/** 기본(히든이 아닌) 팀 열 개는 늘 후보다 */
export const OPEN_TEAM_COUNT = 10

/** 저장에 적힌 "지금 열려 있는 것" 들 — 빠른실행이 여기서만 뽑는다 */
export interface QuickStartOpenState {
  /** 전역 기록 +0x70+idx (= 저장 +0x7a+k) 가 켜진 히든 팀 번호 10~14 */
  readonly openedHiddenTeamIds?: readonly number[]
  /** 저장 +0x30..0x34 — 열린 마투수 번호 0~4 */
  readonly openedAcePitcherIds?: readonly number[]
  /** 저장 +0x35..0x39 — 열린 마타자 번호 0~4 */
  readonly openedAceBatterIds?: readonly number[]
}

/** `bfa55(0, n)` 균등 뽑기 — [0, n) 정수 */
function uniform(random: RandomPort, count: number): number {
  return Math.trunc(random.nextInRange(0, count))
}

/**
 * `0x9f5a0(저장)` — 팀 0..9 에 열린 히든 팀을 이어 붙인 목록에서 **균등**하게 하나.
 * 목록은 번호 오름차순으로 쌓인다.
 */
export function quickStartTeamCandidates(openedHiddenTeamIds: readonly number[] = []): readonly number[] {
  const hidden = [...new Set(openedHiddenTeamIds)]
    .filter((id) => id >= HIDDEN_TEAM_FIRST_ID)
    .sort((left, right) => left - right)
  return [...Array.from({ length: OPEN_TEAM_COUNT }, (_unused, index) => index), ...hidden]
}

/** `0x9f650` / `0x9f604` — 열린 마선수 중 균등. 하나도 없으면 표 0xd7638[0] = −1(없음) */
function rollAce(random: RandomPort, opened: readonly number[] = []): number {
  const list = [...new Set(opened)]
    .filter((id) => id >= 0 && id < ACE_PER_ROLE)
    .sort((left, right) => left - right)
  if (list.length === 0) return NO_ACE
  return list[uniform(random, list.length)]
}

/**
 * 준비 기록을 한 번 굴린다.
 *
 * ⚠️ **원본 버그 — 같은 팀끼리 경기가 나올 수 있다.** 유저 팀과 AI 팀을 같은 함수로 따로 뽑기만
 * 하고 재추첨하는 코드가 없다 (J 2절 "원본 버그" 첫 줄). 상태 18·19 에서 사람이 고를 때도
 * 같은 팀 검사가 없으니(R4 3a 상태 19) 원본 동작이 한결같다 — **고치지 않는다**.
 *
 * ⚠️ **구장은 유저 팀 번호를 그대로 쓴다.** 구장 목록은 0~9 뿐인데 유저 팀이 히든(10~14)이면
 * 구장 번호도 10~14 가 된다. 원본이 자르지 않으므로 여기서도 자르지 않는다 —
 * 그림(stadium_symbol)이 열 장뿐이라 화면 쪽에서 없는 번호를 빈칸으로 둔다.
 */
export function rollQuickStart(random: RandomPort, open: QuickStartOpenState = {}): GeneralModeSetup {
  const candidates = quickStartTeamCandidates(open.openedHiddenTeamIds)
  const userTeamId = candidates[uniform(random, candidates.length)]
  const aiTeamId = candidates[uniform(random, candidates.length)]
  const playerSide = uniform(random, 2) !== 0 ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT
  // 굴림 차례가 원본과 같아야 같은 시드에서 같은 결과가 나온다 — 마투수(+0xe) 가 마타자(+0xd) 보다 먼저다
  const acePitcherId = rollAce(random, open.openedAcePitcherIds)
  const aceBatterId = rollAce(random, open.openedAceBatterIds)
  return { userTeamId, aiTeamId, playerSide, stadiumId: userTeamId, aceBatterId, acePitcherId }
}

/** 경기정보에서 `*` 를 눌렀을 때 도는 틱 수 (메뉴+0x154 가 0 에서 20 까지, R4 3b) */
export const QUICK_RESPIN_TICKS = 20
