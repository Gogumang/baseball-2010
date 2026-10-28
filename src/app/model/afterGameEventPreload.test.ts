import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  afterGameEvaluationPreloads,
  afterGameEventPreloadsOf,
  afterGameStoryEventOf,
  portraitPreloadsOf,
  reachablePortraitsOf,
} from '@/app/model/afterGameEventPreload'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { OPENING_EVENT_ID } from '@/entities/story/model/storyScene'
import { evaluationManagerAnimations } from '@/pages/story/lib/evaluationDialogue'
import { seasonGameEvaluationExpressionOf } from '@/entities/season-mode/model/seasonGameEvaluation'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { animationFramesOf } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'

const EVENT_CHAR_0 = JSON.parse(readFileSync('public/sprites/event_char_0/frames/animations.json', 'utf8')) as unknown

function framesOf(requests: readonly SpriteFolderPreload[], folder: string): number[] {
  const request = requests.find((entry) => entry.folder === folder)
  if (request === undefined) return []
  return animationFramesOf(EVENT_CHAR_0, request.animations ?? [])
}

/** r134 측정 세이브와 같은 자리 — 1년 2경기를 치른 뒤(경기 뒤 3경기째 날짜), 1~4 · 오프닝은 본 장타형 */
function measuredCareer(overrides: Partial<PlayerCareer> = {}): PlayerCareer {
  return {
    ...createCareer('kim'),
    season: 1,
    gamesPlayed: 1,
    battingTypeIndex: 1,
    seenEventIds: [String(OPENING_EVENT_ID), '1', '2', '3', '4'],
    ...overrides,
  }
}

describe('평가 감독 초상 (0x8a6fc · 표 0xcc600 · 0xcc570)', () => {
  it('띄울 수 있는 표정은 0 · 1 · 3 · 4 · 6 — 애니 16 · 17 · 19 · 20 · 22', () => {
    expect(evaluationManagerAnimations()).toEqual([16, 17, 19, 20, 22])
    // 시즌 0xdea0 의 표정도 이 안에 든다
    for (const change of [-3, 0, 1, 2]) expect(evaluationManagerAnimations()).toContain(16 + seasonGameEvaluationExpressionOf(change))
  })

  it('r111 이 잰 116~119(애니 19)와 r134 에 빈 109 · 120~123 을 모두 받는다', () => {
    const frames = framesOf(afterGameEvaluationPreloads(), './sprites/event_char_0/frames')
    for (const frame of [109, 110, 116, 117, 118, 119, 120, 121, 122, 123]) expect(frames).toContain(frame)
  })
})

describe('경기 뒤 이야기 이벤트 초상', () => {
  it('경기 뒤 날짜(내 경기 + 1)로 관리 trigger 0 을 훑는다 — 측정 자리에서는 이벤트 5(1년 3경기)', () => {
    expect(afterGameStoryEventOf(measuredCareer(), ORIGINAL_EVENTS)?.id).toBe(5)
  })

  it('장타형 주인공은 +8 애니로 받는다 — r134 에 빈 27~29 · 34~48 · 63~70 이 모두 든다', () => {
    const requests = afterGameEventPreloadsOf(measuredCareer(), ORIGINAL_EVENTS)
    const frames = framesOf(requests, './sprites/event_char_0/frames')
    for (const frame of [27, 28, 29, ...Array.from({ length: 15 }, (_, i) => 34 + i), 63, 64, 65, 66, 67, 68, 69, 70]) {
      expect(frames).toContain(frame)
    }
    // 피부 0(황인)은 팔레트를 안 갈아 끼우므로 번호 지도를 안 받는다
    expect(requests.some((request) => request.folder.endsWith('/index'))).toBe(false)
  })

  it('피부 1 · 2 주인공은 번호 지도와 palette.json 도 받는다 (0x63a7e)', () => {
    const portraits = reachablePortraitsOf(
      ORIGINAL_EVENTS,
      ORIGINAL_EVENTS.find((event) => event.id === 5)!,
    )
    const requests = portraitPreloadsOf(portraits, 1, 2)
    const index = requests.find((request) => request.folder === './sprites/event_char_0/frames/index')
    expect(index?.animationsIn).toBe('./sprites/event_char_0/frames')
    // 이벤트 5 본문의 표정 0 · 2 · 3 · 4 (+8) — 갈래로 닿는 이벤트 몫이 더 붙는다
    expect(index?.animations).toEqual(expect.arrayContaining([8, 10, 11, 12]))
    expect(requests.find((request) => request.folder === './sprites/event_char_0')?.json).toEqual(['palette.json'])
  })

  it('선택지 · 대결 결과로 닿는 이벤트의 초상까지 모은다', () => {
    const branching = ORIGINAL_EVENTS.find((event) => event.commands.some((command) => command.op === 'choice'))!
    const choice = branching.commands.find((command) => command.op === 'choice')
    const target = ORIGINAL_EVENTS.find((event) => choice?.op === 'choice' && event.id === choice.choices[0]?.gotoEvent)!
    const own = reachablePortraitsOf(ORIGINAL_EVENTS, target)
    const all = reachablePortraitsOf(ORIGINAL_EVENTS, branching)
    for (const portrait of own) expect(all).toContainEqual(portrait)
  })
})
