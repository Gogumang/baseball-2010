import { FINAL_STAGE, matchTeamOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import {
  BRACKET_END_BOXES,
  BRACKET_FINAL_BOXES,
  BRACKET_FINAL_TITLE_FRAME,
  BRACKET_FRAME,
  BRACKET_LEAGUE_BOXES,
  BRACKET_LEAGUE_TITLE_BASE,
} from '@/pages/national-cup/lib/nationalCupLayout'
import type { BracketBox } from '@/pages/national-cup/lib/nationalCupLayout'

/** 한 칸: 로고 박스 · 이름표 박스 · 팀 */
export interface BracketSlot {
  readonly team: number
  readonly logoBox: BracketBox
  readonly labelBox: BracketBox
}

/** 대진판 `0x85af4` 의 한 단계(`L+0xad`) 그림 — mode_ui 프레임 · 제목 글자(없으면 null) · 제목 박스 · 칸들 */
export interface BracketStage {
  readonly frame: number
  readonly titleFrame: number | null
  readonly titleBox: BracketBox
  readonly slots: readonly BracketSlot[]
}

/** 단계 n — n > 결승이면 풀리그(두 경기), 결승이면 결승, 그 밖은 끝(우승국 하나) */
export function bracketStageOf(cup: NationalCup): BracketStage {
  if (cup.stage > FINAL_STAGE) return leagueStageOf(cup)
  if (cup.stage === FINAL_STAGE) return finalStageOf(cup)
  return endStageOf(cup)
}

/** 풀리그 — 프레임 66, 네 칸 */
function leagueStageOf(cup: NationalCup): BracketStage {
  const { stage } = cup
  return {
    frame: BRACKET_FRAME.풀리그,
    titleFrame: BRACKET_LEAGUE_TITLE_BASE - stage,
    titleBox: BRACKET_LEAGUE_BOXES[0],
    slots: [0, 1, 2, 3].map((i) => ({
      team: matchTeamOf(cup, stage, i),
      logoBox: BRACKET_LEAGUE_BOXES[i + 1],
      labelBox: BRACKET_LEAGUE_BOXES[i + 5],
    })),
  }
}

/** 결승 — 프레임 67, 두 칸 */
function finalStageOf(cup: NationalCup): BracketStage {
  const { stage } = cup
  return {
    frame: BRACKET_FRAME.결승,
    titleFrame: BRACKET_FINAL_TITLE_FRAME,
    titleBox: BRACKET_FINAL_BOXES[0],
    slots: [0, 1].map((i) => ({
      team: matchTeamOf(cup, stage, i),
      logoBox: BRACKET_FINAL_BOXES[i + 1],
      labelBox: BRACKET_FINAL_BOXES[i + 3],
    })),
  }
}

/** n ≤ 0: S+0x12c(대회 중) 이면 S+0x144 우승국 — 이 화면은 대회 중에만 뜬다. 제목 글자 없음 */
function endStageOf(cup: NationalCup): BracketStage {
  return {
    frame: BRACKET_FRAME.끝,
    titleFrame: null,
    titleBox: BRACKET_FINAL_BOXES[0],
    slots: [{ team: cup.champion, logoBox: BRACKET_END_BOXES[0], labelBox: BRACKET_END_BOXES[1] }],
  }
}
