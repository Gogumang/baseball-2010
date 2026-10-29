import { OUTS_PER_INNING } from '@/entities/game/model/gameRecords/outs'

const COMPLETE_GAME = { completeGame: 28, shutout: 29, noHitter: 30, perfect: 31 } as const
/** 퍼펙트게임은 아웃이 28 미만일 때만 인정된다 — 연장에 가면 안 된다 (0xa7de8) */
const PERFECT_GAME_OUT_LIMIT = 28

export interface CompleteGameInput {
  /** 게임 모드 (0x1552d10). 원본은 **모드 4(나만의리그 타자편)면 완투 계열을 주지 않는다** */
  readonly mode: number
  /** 사람 팀이 이겼는가 (0xb69c8 — 동점이면 팀 0 승) */
  readonly won: boolean
  /** 이 경기에서 사람이 투구 코스를 한 번이라도 확정했는가 (state+0x8c) */
  readonly pitchCourseConfirmed: boolean
  /** 실제로 치른 이닝 수 — 연장이면 그만큼 늘어난다 (state[0x6b]+1) */
  readonly inningsPlayed: number
  /** 우리 투수가 잡은 아웃 수 */
  readonly outsRecorded: number
  readonly hitsAllowed: number
  /**
   * 출루 허용 state[0x88] — 정산 a8c5c~a8ca6 이 그 정산의 주자 목록 마지막 원소가 안 끝났으면(+0x96 == 0) 세우는 표시
   * (`baserunnerAllowedOfPlay`). 볼넷 · 사구 · 안타는 물론 에러 출루 · 산 주자가 남는 견제 판도 세운다
   */
  readonly baserunnerAllowed: boolean
  readonly runsAllowed: number
}

/** 완투 계열을 주지 않는 모드 — 나만의리그 타자편 (0xa7de8 의 `모드 == 4 → 끝`) */
const NO_COMPLETE_GAME_MODE = 4

/** 0xa7de8 이 먼저 보는 넷 — 사람 팀 승 · 모드 ≠ 4 · 투구 코스 확정 · 아웃 == 3 × 치른 이닝 */
function passesCompleteGameGate(input: CompleteGameInput): boolean {
  if (!input.won || input.mode === NO_COMPLETE_GAME_MODE || !input.pitchCourseConfirmed) return false
  return input.outsRecorded === input.inningsPlayed * OUTS_PER_INNING
}

/** 등급 — 출루·피안타·실점 0 이고 아웃 < 28 이면 퍼펙트 · 피안타·실점 0 노히트노런 · 실점 0 완봉승 · 그 밖 완투승 */
function completeGameGradeOf(input: CompleteGameInput): number {
  const isPerfect = input.hitsAllowed === 0 && !input.baserunnerAllowed && input.runsAllowed === 0 && input.outsRecorded < PERFECT_GAME_OUT_LIMIT
  if (isPerfect) return COMPLETE_GAME.perfect
  if (input.hitsAllowed === 0 && input.runsAllowed === 0) return COMPLETE_GAME.noHitter
  if (input.runsAllowed === 0) return COMPLETE_GAME.shutout
  return COMPLETE_GAME.completeGame
}

/**
 * 완투 계열 기록 (0xa7de8). 마스크 0xe0f 라 0xa77f0 의 팀 게이트는 건너뛰지만,
 * **부르는 쪽인 0xa7de8 이 스스로 네 가지를 먼저 본다** (R8 6절, 확정):
 *   ① 사람 팀이 이긴 경기 ② 모드 ≠ 4(나만의리그 타자편)
 *   ③ 이 경기에서 사람이 투구 코스를 한 번이라도 확정했음 (state+0x8c)
 *   ④ 현재 투수가 잡은 아웃 == 3 × 치른 이닝 — **정규 9이닝이 아니라 경기에서 치른 이닝 전부**
 * 그 다음에 등급을 가린다:
 *   출루·피안타·실점이 모두 0 이고 아웃 ≤ 27 → 퍼펙트게임(31)
 *   피안타·실점이 0 → 노히트노런(30) · 실점이 0 → 완봉승(29) · 그 밖 → 완투승(28)
 *
 * 지금 웹의 나만의리그 타자편은 모드 4 라 **원본대로면 이 넷이 한 번도 나오지 않는다.**
 * 투수편·일반모드를 옮기면 그때 살아난다.
 *
 * 볼넷은 투구 판정 경로(0xc1818)를 옮기면서 들어왔다. 데드볼(코드 4, 상태 플래그 state[0x12])은
 * 사람 타석에만 있다 — **스윙하지 않았고** 공의 판정 좌표가 사각형 0xcfd50 (x 171, y 240, 폭 38, 높이 130)
 * 안이면 사구다(0x35a20, `resolvePitch.isHitByPitch`). 간이 엔진에서는 나오지 않는다(`quickAtBat.judgePitchOf`).
 * 정산 0xa8024 는 사구에도 투수 볼넷 칸 +0x2a 를 올리고 타석 결과 9 로 적는다(R8 5-4).
 * **출루 칸 state[0x88] 에 사구도 들어간다** (확정): 0xa8c5c~0xa8cae 가 정산 뒤 주자 목록의 **마지막 주자**가
 * 살아 있으면(+0x96 == 0) 수비 팀이 사람일 때 state[0x88] = 1 로 세운다(R15 11-1 · S5 정정). 사구 플레이는
 * 아웃이 없어 모든 주자가 살아 있으므로 늘 선다 — 그래서 `baserunnerAllowed` 는 볼넷 · 사구에도 선다.
 * (덧붙여 0xa8e1c~0xa8e36: 사구면 투수 기록 코드 0x1d(R+0x148) ++, 이닝 퍼펙트 칸 ctx+0x184 = 0 — 볼넷 0x1c 와 같은 자리.)
 * 지금 웹에서 사람이 수비하는 화면(투수편·팀 경기 수비)은 CPU 타자가 사구를 맞는 길이 아직 없다.
 */
export function completeGameRecordIdsOf(input: CompleteGameInput): number[] {
  if (!passesCompleteGameGate(input)) return []
  return [completeGameGradeOf(input)]
}
