import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import {
  EMPTY_HOME_RUN_SCORE_BOARD,
  closesDefenseScene,
  drawRunScoreBoardScene,
  runScoreBoardRunIn,
  type HomeRunScoreBoard,
} from '@/pages/defense/lib/runScoreBoard'

/** 홈 자리 — 주자가 여기 닿은 틱이 메시지 0x13(주자 하나 홈인)이다 */
const HOME_PLATE = basePosition(0)
const isAtHome = (runner: { readonly x: number; readonly z: number }) => runner.x === HOME_PLATE.x && runner.z === HOME_PLATE.z

/** 재생 갈래 득점 점수판의 셈 — 다음에 볼 갱신 · 주자별 홈을 떠났나/밟았나 · 들어온 수 · 점수판 칸 · 닫힌 셈 */
export interface RecordedBoardTally {
  readonly nextIndex: number
  readonly leftHome: ReadonlySet<number>
  readonly scored: ReadonlySet<number>
  readonly runs: number
  /** [+0x10f8] 타이머 · [+0x10fc] 수 · [+0x1101] 간격 · [+0x1100] 홈런 판 섰음 — 두 갈래가 같이 쓴다 */
  readonly board: HomeRunScoreBoard
  /** +0x1094 — 판이 닫힌(마지막 틱 뒤) 갱신 수 */
  readonly closedCount: number
  /** 0x35108 을 지났다 (0x17 끝) */
  readonly ended: boolean
  /** 마지막 그리기에서 판이 섰나 · 공격 쪽에서 뺄 점수 */
  readonly visible: boolean
  readonly hidden: number
  /** 이 갱신에 보낸 메시지 0x13 의 주자 칸들 — 0x51fb8 머리의 함성(`runInCheerSoundIdOf`)을 고른다 */
  readonly runIns: readonly number[]
}

export const EMPTY_RECORDED_TALLY: RecordedBoardTally = {
  nextIndex: 0,
  leftHome: new Set(),
  scored: new Set(),
  runs: 0,
  board: EMPTY_HOME_RUN_SCORE_BOARD,
  closedCount: 0,
  ended: false,
  visible: false,
  hidden: 0,
  runIns: [],
}

/**
 * 재생 갱신 하나를 지난다. 마지막 틱까지는 그 틱의 갱신 — 홈을 떠난 적 있는 주자(타자주자는 홈에서 출발한다)가 홈 자리에 닿으면
 * 1점(메시지 0x13, 홈런 재생은 그 주자 칸으로 홈런 갈래). 마지막 틱 뒤는 닫힌 갱신(+0x1094 — `closesDefenseScene`).
 * 끝나지 않았으면 그 갱신 그리기 한 번까지 돌린다.
 */
export function stepRecordedBoard(tally: RecordedBoardTally, view: DefenseViewState, isHomeRun: boolean, isClosed: boolean): RecordedBoardTally {
  const play: BoardPlay = {
    leftHome: new Set(tally.leftHome),
    scored: new Set(tally.scored),
    runs: tally.runs,
    board: tally.board,
    closedCount: tally.closedCount,
    runIns: [],
  }
  if (isClosed) {
    play.closedCount += 1
    // 52a1c — 홈런 판이 서 있는 동안은 안 닫는다
    if (closesDefenseScene(play.closedCount, isHomeRun, play.board)) {
      return { ...tally, nextIndex: tally.nextIndex + 1, closedCount: play.closedCount, ended: true, visible: false, hidden: 0, runIns: play.runIns }
    }
  } else {
    for (const runner of view.runners) passRunner(play, runner.index, isAtHome(runner), isHomeRun)
  }
  const drawn = drawRunScoreBoardScene(play.board, isHomeRun)
  return {
    nextIndex: tally.nextIndex + 1,
    leftHome: play.leftHome,
    scored: play.scored,
    runs: play.runs,
    board: drawn.next,
    closedCount: play.closedCount,
    ended: false,
    visible: drawn.visible,
    hidden: drawn.hidden,
    runIns: play.runIns,
  }
}

/** 갱신 하나를 지나며 고치는 셈 */
interface BoardPlay {
  readonly leftHome: Set<number>
  readonly scored: Set<number>
  runs: number
  board: HomeRunScoreBoard
  closedCount: number
  readonly runIns: number[]
}

/** 주자 하나 — 홈을 떠나 있으면 적어 두고, 떠났던 주자가 홈 자리에 닿으면 1점(메시지 0x13) */
function passRunner(play: BoardPlay, index: number, atHome: boolean, isHomeRun: boolean): void {
  if (play.scored.has(index)) return
  if (!atHome) {
    play.leftHome.add(index)
    return
  }
  if (!play.leftHome.has(index)) return
  play.scored.add(index)
  play.runs += 1
  play.runIns.push(index)
  play.board = runScoreBoardRunIn(play.board, index, isHomeRun, false)
}

/**
 * 창이 선 첫 그림([창+0x250]) — 갱신 없이 그리기 0x46c88 만 한 번 더(52efe): 득점 점수판 0x41a64 가 타이머를 한 번 더 줄인다.
 * 함성(메시지 0x13)은 갱신 몫이라 없다
 */
export function redrawRecordedBoard(tally: RecordedBoardTally, isHomeRun: boolean): RecordedBoardTally {
  if (tally.ended) return tally
  const drawn = drawRunScoreBoardScene(tally.board, isHomeRun)
  return { ...tally, board: drawn.next, visible: drawn.visible, hidden: drawn.hidden, runIns: [] }
}
