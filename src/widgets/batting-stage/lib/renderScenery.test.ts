import { describe, expect, it } from 'vitest'
import {
  scoreboardScrollX, seasonBoardFrameOf, seasonFenceFramesOf, seasonScoreboardBoxOf, seasonTeamIconBoxesOf,
} from '@/widgets/batting-stage/lib/renderScenery'

// 전광판 흐르는 글자 (0x77fb4, R2-game-effects.md 6절): 상자 폭+2 에서 시작해 틱당 1px 씩
// 왼쪽으로 흐르고, −153 밑으로 완전히 빠지면 시작값으로 되감는다.
describe('scoreboardScrollX — 전광판 글자 x 이동', () => {
  const boxWidth = 48

  it('틱 0 은 시작값(상자 폭 + 2) 이다', () => {
    expect(scoreboardScrollX(boxWidth, 0)).toBe(boxWidth + 2)
  })

  it('틱마다 1px 씩 왼쪽(음의 방향)으로 흐른다', () => {
    expect(scoreboardScrollX(boxWidth, 1)).toBe(boxWidth + 1)
    expect(scoreboardScrollX(boxWidth, 10)).toBe(boxWidth + 2 - 10)
  })

  it('−153 을 넘어가기 직전까지는 되감지 않는다', () => {
    const start = boxWidth + 2
    const ticksToThreshold = start - -153 // start 에서 -153 까지 걸리는 틱 수
    expect(scoreboardScrollX(boxWidth, ticksToThreshold)).toBe(-153)
  })

  it('−153 밑으로 빠지면 시작값으로 되감는다', () => {
    const start = boxWidth + 2
    const ticksToThreshold = start - -153
    expect(scoreboardScrollX(boxWidth, ticksToThreshold + 1)).toBe(start)
  })

  it('음수 틱은 0 취급한다', () => {
    expect(scoreboardScrollX(boxWidth, -5)).toBe(boxWidth + 2)
  })
})

// ── 시즌 구장 (0x77494) ─────────────────────────────────────────────────────
// 적재 0x76cf0: 전광판 칸 ≤ 3 → stadium/fence_board.pzx, > 3 → stadium/hidden_board_(칸−4).pzx.
// 그리기 0x775d0: 칸 ≤ 3 이면 프레임 = 칸, > 3 이면 프레임 0.
describe('seasonBoardFrameOf — 전광판 칸으로 그림 고르기', () => {
  it('칸 0~3 은 fence_board 의 같은 번호 프레임이다', () => {
    for (const board of [0, 1, 2, 3]) {
      expect(seasonBoardFrameOf(board)).toEqual({ folder: './sprites/fence_board/frames', frame: board })
    }
  })

  it('칸 4~6 은 hidden_board_(칸−4) 의 프레임 0 이다', () => {
    expect(seasonBoardFrameOf(4)).toEqual({ folder: './sprites/hidden_board_0/frames', frame: 0 })
    expect(seasonBoardFrameOf(5)).toEqual({ folder: './sprites/hidden_board_1/frames', frame: 0 })
    expect(seasonBoardFrameOf(6)).toEqual({ folder: './sprites/hidden_board_2/frames', frame: 0 })
  })
})

// 0x7773e·0x77744: 전광판 칸이 0 이거나 5 면 흐르는 글자를 아예 안 그린다.
// 0x7776a: 칸 3 일 때만 상자 2 (0·1 은 팀 아이콘 자리라서다).
describe('seasonScoreboardBoxOf — 전광판 화면이 들어가는 상자', () => {
  it('칸 0·5 는 원본이 건너뛰므로 상자가 없다', () => {
    expect(seasonScoreboardBoxOf(0)).toBeNull()
    expect(seasonScoreboardBoxOf(5)).toBeNull()
  })

  it('칸 1·2·4·6 은 그림의 박스 0 이다', () => {
    expect(seasonScoreboardBoxOf(1)).toEqual([154, 158, 48, 20])
    expect(seasonScoreboardBoxOf(2)).toEqual([154, 143, 48, 20])
    expect(seasonScoreboardBoxOf(4)).toEqual([152, 156, 50, 20])
    expect(seasonScoreboardBoxOf(6)).toEqual([150, 148, 55, 19])
  })

  it('칸 3 만 박스 2 다 — 0·1 은 팀 아이콘이 쓴다', () => {
    expect(seasonScoreboardBoxOf(3)).toEqual([154, 143, 48, 20])
    expect(seasonTeamIconBoxesOf(3).slice(0, 2)).toEqual([[133, 141, 18, 24], [205, 141, 18, 24]])
  })

  it('칸 3 이 아니면 팀 아이콘 자리가 없다', () => {
    for (const board of [0, 1, 2, 4, 5, 6]) expect(seasonTeamIconBoxesOf(board)).toEqual([])
  })
})

// 0x774c6: 바탕(관중석) = 칸 × 5 · 0x77570: 덧그림(관중) = 칸 × 5 + 관중단계 + 1 (R6 1절).
// 칸 4~6 은 hidden_fence_(칸−4) 로 파일이 갈리며 프레임을 0 부터 다시 센다 (0x774da).
describe('seasonFenceFramesOf — 관중석 바탕·관중 덧그림 프레임', () => {
  it('관중석 0~3 은 fence_season 안에서 5칸씩 묶인다', () => {
    expect(seasonFenceFramesOf(0, 0)).toEqual({ folder: './sprites/fence_season/frames', standFrame: 0, crowdFrame: 1 })
    expect(seasonFenceFramesOf(2, 3)).toEqual({ folder: './sprites/fence_season/frames', standFrame: 10, crowdFrame: 14 })
    expect(seasonFenceFramesOf(3, 0)).toEqual({ folder: './sprites/fence_season/frames', standFrame: 15, crowdFrame: 16 })
  })

  it('관중석 4~6 은 hidden_fence_(칸−4) 의 0 번부터 다시 센다', () => {
    expect(seasonFenceFramesOf(4, 2)).toEqual({ folder: './sprites/hidden_fence_0/frames', standFrame: 0, crowdFrame: 3 })
    expect(seasonFenceFramesOf(6, 0)).toEqual({ folder: './sprites/hidden_fence_2/frames', standFrame: 0, crowdFrame: 1 })
  })
})
