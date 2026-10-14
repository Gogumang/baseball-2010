// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  MATCH_INFO_STADIUM_MIRRORED, RIGHT_HANDED_CROWD_SHIFT, RIGHT_HANDED_MIRROR_X, rightHandedBoxShiftOf,
  drawMatchInfoStadium, drawScenery, scoreboardScrollX, seasonBoardFrameOf, seasonFenceFramesOf, seasonScoreboardBoxOf, seasonTeamIconBoxesOf,
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

// 0x78578(구장, y, 움직임): y 는 구장 0x77974 와 바닥 0x7725c 에만 더해진다 — 하늘 0x77fe8 은 인자가 없다.
describe('drawScenery — 결과 창 밀기 offsetY (0x45c18 → 0x78578(구장, +0x17e2, 1))', () => {
  function 기록컨텍스트() {
    const translates: [number, number][] = []
    const fills: number[][] = []
    const context = {
      fillStyle: '',
      fillRect: (...rect: number[]) => fills.push(rect),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      save: () => {},
      restore: () => {},
      translate: (x: number, y: number) => translates.push([x, y]),
      scale: () => {},
      drawImage: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    }
    return { context: context as unknown as CanvasRenderingContext2D, translates, fills }
  }
  const 장면 = { skyRow: 0, skyColumn: 0, tick: 0, stadium: 0, ourTeamId: null, opponentTeamId: null }

  it('타석(밀기 0)은 펜스를 제자리에 둔다', () => {
    const { context, translates } = 기록컨텍스트()
    drawScenery(context, 장면)
    expect(translates).toEqual([[0, 0]])
  })

  it('밀기 값만큼 펜스 묶음을 아래로 내리고 하늘은 그대로 칠한다', () => {
    const 기준 = 기록컨텍스트()
    drawScenery(기준.context, 장면)
    const { context, translates, fills } = 기록컨텍스트()
    drawScenery(context, { ...장면, offsetY: 40 })
    expect(translates).toEqual([[0, 40]])
    expect(fills).toEqual(기준.fills)
  })
})

// 0x77fe8 의 78040~78088: 구장 +0x70 == 8 이면 화면 전체를 RGB(0xc6, 0xd4, 0xd7) 로 칠하고 끝 — 그라데이션 · 구름 없음.
describe('drawScenery — 구장 8 하늘 단색 (0x78046)', () => {
  function 기록컨텍스트() {
    const fills: { readonly style: string; readonly rect: readonly number[] }[] = []
    let gradients = 0
    const context = {
      fillStyle: '',
      fillRect(...rect: number[]) {
        fills.push({ style: String(this.fillStyle), rect })
      },
      createLinearGradient: () => {
        gradients += 1
        return { addColorStop: () => {} }
      },
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      drawImage: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    }
    return { context: context as unknown as CanvasRenderingContext2D, fills, gradients: () => gradients }
  }
  const 장면 = { skyRow: 0, skyColumn: 0, tick: 0, ourTeamId: null, opponentTeamId: null }

  it('구장 8 — 검정 지우기 뒤 (0, 0, 240, 320) 한 색 하나, 그라데이션 없음', () => {
    const { context, fills, gradients } = 기록컨텍스트()
    drawScenery(context, { ...장면, stadium: 8 })
    expect(fills.slice(1)).toEqual([{ style: 'rgb(198, 212, 215)', rect: [0, 0, 240, 320] }])
    expect(gradients()).toBe(0)
  })

  it('구장 7 — 그라데이션 하늘 그대로', () => {
    const { context, fills, gradients } = 기록컨텍스트()
    drawScenery(context, { ...장면, stadium: 7 })
    expect(fills.length).toBe(4)
    expect(gradients()).toBe(1)
  })
})

// 0x5fd04 → 0x581dc(스킨, 무대, 1): 흰 화면 → 0x78578(무대, 0, 1) — 카메라 y −68(경기 −70)이라 구장 묶음이 2 내려간다.
describe('drawMatchInfoStadium — 경기정보 바탕의 날 그림', () => {
  function 기록컨텍스트() {
    const fills: { readonly style: string; readonly rect: readonly number[] }[] = []
    const translates: [number, number][] = []
    const context = {
      fillStyle: '',
      fillRect(...rect: number[]) {
        fills.push({ style: String(this.fillStyle), rect })
      },
      createLinearGradient: () => ({ addColorStop: () => {} }),
      save: () => {},
      restore: () => {},
      translate: (x: number, y: number) => translates.push([x, y]),
      scale: () => {},
      drawImage: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    }
    return { context: context as unknown as CanvasRenderingContext2D, fills, translates }
  }
  const 무대 = { stadium: 3, fieldPalette: 2, skyRow: 0, side0TeamId: 1, side1TeamId: 2, gameMode: 1 }

  it('흰색으로 지우고 하늘(위 단색 끝 10 + 2) · 구장 묶음 2 내림', () => {
    const { context, fills, translates } = 기록컨텍스트()
    drawMatchInfoStadium(context, 무대)
    expect(fills[0]).toEqual({ style: '#fff', rect: [0, 0, 240, 320] })
    expect(fills[1]?.rect).toEqual([0, 0, 240, 12])
    expect(translates).toEqual([[0, 2]])
  })

  it('무대는 생성자 0x76ac8 이 +0x60 = 0 으로 두어 우타 거울 길이다', () => {
    expect(MATCH_INFO_STADIUM_MIRRORED).toBe(true)
  })

  it('구장 8 — 흰색 뒤 하늘 단색 한 칸', () => {
    const { context, fills } = 기록컨텍스트()
    drawMatchInfoStadium(context, { ...무대, stadium: 8 })
    expect(fills.slice(0, 2)).toEqual([
      { style: '#fff', rect: [0, 0, 240, 320] },
      { style: 'rgb(198, 212, 215)', rect: [0, 0, 240, 320] },
    ])
  })
})

// 0x77974 · 0x77494 · 0x7725c — 구장 +0x60 == 0(우타)이면 펜스 · 바닥을 효과 0x11 로 뒤집는다 (화면 x → 238 − x)
describe('우타 거울 — 구장 +0x60 (0x779a4 · 0x772ca)', () => {
  it('펜스 박스로 놓는 그림은 잰 박스만큼 옮긴다 — 펜스 0 · 1 · 2 모두 141', () => {
    expect(rightHandedBoxShiftOf({ offsetX: -204, width: 768 })).toBe(141)
    expect(rightHandedBoxShiftOf({ offsetX: -163, width: 686 })).toBe(141)
    expect(rightHandedBoxShiftOf({ offsetX: -187, width: 734 })).toBe(141)
  })

  it('관중 ppl 은 안 뒤집고 0x78 + 21 옮긴다', () => {
    expect(RIGHT_HANDED_CROWD_SHIFT).toBe(141)
  })

  it('거울 축은 (239, 0) — 좌타 XL + p 와 우타 XR − 1 − p 의 합이 238', () => {
    expect(RIGHT_HANDED_MIRROR_X).toBe(239)
  })
})
