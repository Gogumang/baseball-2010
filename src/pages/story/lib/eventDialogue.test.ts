import { describe, expect, it } from 'vitest'
import {
  DIALOGUE_CURSOR, EVENT_DIALOGUE, EVENT_DIALOGUE_CHOICE, layoutDialogue, lowerDialogueBox, pageEndOf, pressDialogue,
  restartDialogueText, speakerPrefixOf, startDialogue, tickDialogue,
} from '@/pages/story/lib/eventDialogue'
import {
  batterEvaluationExpressionOf, evaluationReputationTierOf, pitcherEvaluationExpressionOf, streakSayExpressionOf,
} from '@/pages/story/lib/evaluationDialogue'

describe('say 대사 상자 배치 0x7fbc4 · 0x6ef4c', () => {
  it('상자는 화면 폭 전체 55 · 띠 12 · 꺾임 W − 67 · 글 (5, 위 5) 폭 W − 20 · 줄 14 · 세 줄', () => {
    expect(EVENT_DIALOGUE.boxHeight).toBe(55)
    expect(EVENT_DIALOGUE.bandSplit).toBe(173)
    expect(EVENT_DIALOGUE.text).toEqual({ x: 5, top: 5, width: 220, lineHeight: 14, linesPerPage: 3 })
  })

  it('바이트는 CP949 — 한글 2 · 영문 1 · !N 2 · !cRRGGBB 8, 쪽 끝은 다음 쪽 첫 줄의 시작 바이트', () => {
    const layout = layoutDialogue('가a!N나!cFF0000다!N라!N마')
    expect(layout.totalBytes).toBe(2 + 1 + 2 + 2 + 8 + 2 + 2 + 2 + 2 + 2)
    expect(layout.lines.map((line) => line.glyphs.map((glyph) => glyph.character).join(''))).toEqual(['가a', '나다', '라', '마'])
    expect(pageEndOf(layout, 0)).toBe(layout.lineStarts[3])
    expect(pageEndOf(layout, 3)).toBe(layout.totalBytes)
  })

  it('줄은 글자 폭(한글 9 · 자간 1)으로 220 을 넘기 전에 끊는다', () => {
    const layout = layoutDialogue('가'.repeat(30))
    expect(layout.lines[0].glyphs).toHaveLength(22)
    expect(layout.lineStarts[1]).toBe(44)
  })

  it('찍기: 다 오른 틀부터 3 바이트씩, 쪽 끝에서 단계 3 · 확인으로 다음 쪽 · 글 끝 단계 4', () => {
    const layout = layoutDialogue('하나!N둘!N셋!N넷')
    let state = startDialogue(true)
    for (let i = 0; i < 3; i += 1) state = tickDialogue(state, layout)
    expect(state).toMatchObject({ height: 45, shown: 0, stage: 0 })
    state = tickDialogue(state, layout)
    expect(state).toMatchObject({ height: 55, shown: 3, stage: 1 })
    state = pressDialogue(state).state
    state = tickDialogue(state, layout)
    expect(state).toMatchObject({ shown: pageEndOf(layout, 0), stage: 3 })
    state = pressDialogue(state).state
    expect(state).toMatchObject({ firstLine: 3, stage: 1 })
    state = tickDialogue(state, layout)
    expect(state.stage).toBe(4)
    expect(pressDialogue(state).advance).toBe(true)
  })

  it('선택지 갈래 0x7fd22 — 줄 사이 11 + 3 · 고른 줄 테두리 (3, y − 1) 211 × 13 · 넘김 표시 (W − 3, H − 3)', () => {
    expect(EVENT_DIALOGUE_CHOICE.lineStep).toBe(14)
    expect(EVENT_DIALOGUE_CHOICE.cursor).toEqual({ x: 3, top: -1, width: 211, height: 13, color: '#FFFF00' })
    expect(DIALOGUE_CURSOR).toEqual({ x: 237, y: 317, animation: 0 })
  })

  it('선택지 갈래는 높이만 오르고 찍기 칸은 그대로 · 내리기 0x7f7cc 는 높이 0 · 글 처음으로 0x7f7d4 는 높이를 둔다', () => {
    const up = { height: 55, firstLine: 3, shown: 9, stage: 1 as const }
    expect(tickDialogue({ ...up, height: 30 }, null)).toEqual({ ...up, height: 45 })
    expect(tickDialogue(up, null)).toEqual(up)
    expect(restartDialogueText(up)).toEqual({ height: 55, firstLine: 0, shown: 0, stage: 0 })
    expect(tickDialogue(restartDialogueText(lowerDialogueBox(up)), null).height).toBe(15)
  })

  it('말하는 이 머리말 0xd4f50', () => {
    expect(speakerPrefixOf('감독')).toBe('[!c00CC00감독!cFFFFFF] : ')
    expect(speakerPrefixOf(null)).toBe('')
  })
})

describe('116 평가 say 의 감독 표정 [명령+8] — 0x1278c 표 0xcc600 · 0xcc570', () => {
  it('평판 구간은 150 · 450 · 750 · 1000 미만, 다 넘으면 0', () => {
    expect([0, 150, 449, 450, 999, 1000].map(evaluationReputationTierOf)).toEqual([0, 1, 1, 2, 3, 0])
  })
  it('타자편: 표[구간 × 9 + 인기도 변화 칸], 칸 밖이면 0', () => {
    expect(batterEvaluationExpressionOf(100, -2)).toBe(3)
    expect(batterEvaluationExpressionOf(100, 6)).toBe(4)
    expect(batterEvaluationExpressionOf(500, 1)).toBe(0)
    expect(batterEvaluationExpressionOf(100, 9)).toBe(0)
  })
  it('투수편: 감독 글 = 구간 바탕(2 · 11 · 20 · 29) + 칸, 글 38 은 0', () => {
    expect(pitcherEvaluationExpressionOf(100, 2)).toBe(3)
    expect(pitcherEvaluationExpressionOf(200, 11 + 7)).toBe(4)
    expect(pitcherEvaluationExpressionOf(100, 38)).toBe(0)
  })
  it('연속 기록 say 는 나쁜 칸이 있으면 3 · 아니면 1', () => {
    expect(streakSayExpressionOf(true)).toBe(3)
    expect(streakSayExpressionOf(false)).toBe(1)
  })
})
