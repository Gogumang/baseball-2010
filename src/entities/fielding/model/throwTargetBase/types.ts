import type { DefenseContext } from '@/entities/fielding/model/fieldingState'

/** 후보표 한 칸 (0x30바이트 표의 루 하나) */
export interface BaseCandidate {
  /** +0 주자 도착 틱 (없으면 −1) */
  runTick: number
  /** +2 포스/리터치 의무 표시 */
  force: boolean
  /** +3 플레이 vt 0x80 — "포스로 밀려 오는 주자인가" */
  forced: boolean
  /** +4 수비 도착 틱 */
  defTick: number
  /** +6 + 2r 루 b 로 보낸 뒤 다시 루 r 로 보내는 틱 */
  rethrow: number[]
}

export interface ThrowTargetInput extends DefenseContext {
  /**
   * **지금 아웃 수** (`state[6]`) — 0xafa60 이 `제어기.vt14(인자)` 로 넘기는 값이다 (직접 뜬 것):
   * ```
   * afaba: r3 = [제어기+0x10] ; r1 = (s8)[r3+6] ; 제어기.vt14(r1) = 0xafb24
   * 3ecf6: 제어기+0x10 = [0x1552d0c]          ; 화면 초기화 0x3e340 — 전역 경기 상태(P7: state = 0x1552d0c)
   * 3e790: 플레이+0x28 = [0x1552d0c]          ; 같은 객체 — 플레이가 state[0x1e]·[0x1f]·[0x87] 을 쓰는 곳
   * b36fa: [플레이+0x28]+6 += 1               ; 아웃 판정 0xb36d0 의 아웃 꼬리 = 아웃 수
   * ```
   * S7·P2 가 이 칸을 "설정 +6 = 난이도" 로 읽어 예전 웹은 옵션 난이도 2 로 못 박았는데, 그 전역은
   * 설정(0x1f1d8)이 아니라 경기 상태다. 0~1아웃이면 점수식, 2아웃이면 확실한 후보가 있을 때만 "여유 최대".
   * (그 판에서 이미 잡은 아웃까지 센 값이다 — 아웃 꼬리가 그 자리에서 올린다.)
   */
  readonly outs: number
  /** 0xa990c(주자관리) = 살아 있는 주자 수. 0 이고 내야수가 잡았으면 안 던진다 */
  readonly activeRunnerCount: number
}

export interface ThrowTargetDebug {
  readonly candidates: readonly BaseCandidate[]
  readonly margins: readonly number[]
  readonly topScores: readonly number[]
  readonly sure: boolean
  readonly chosen: number
}

/** 루 번호를 0~3 으로 (원본 표는 5칸이고 [4] 가 홈의 사본) */
export const wrapBase = (base: number) => ((base % 4) + 4) % 4
