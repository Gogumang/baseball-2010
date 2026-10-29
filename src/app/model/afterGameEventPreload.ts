/**
 * **경기 뒤 이벤트 판 그림 미리 받기** — 경기 장면이 서 있는 동안 유휴 줄로 받는다(기다리지 않는다, 게임 타이밍 그대로).
 *
 * r134 측정(지연 80ms, 나리 타자편 · 장타형): 경기가 끝나고 관리 화면에 돌아오자 이벤트 5(1년 3경기 · 선배)가 떴는데
 * 초상 프레임(event_char_0 27~29 · 34~48 · 63~70)을 아무도 미리 받지 않아 빈 그림이 108프레임 남았다. 다음 경기 뒤 평가
 * 116 의 감독도 측정 목록(애니 19 = 116~119)에 없는 표정(애니 16 · 22)이면 비었다. 그래서 두 가지를 **이벤트 데이터에서 계산**한다:
 *
 *  1. 평가 감독 — 0x8a6fc 가 띄울 수 있는 표정 전부(`evaluationManagerAnimations`, 표 0xcc600 · 0xcc570 · 0x8ac32)
 *  2. 경기 뒤 관리 화면이 처음 띄울 이야기 이벤트 — 원본이 경기 뒤에 하는 대로 훑는다:
 *       - 경기 정산이 내 경기 수를 하나 올린다(`applyGameResult` 의 gamesPlayed + 1 — 날짜 창 0xacfbc 가 본다)
 *       - 경기 뒤 나리 장면이 다시 서며(0xf684 → 0x8ce94 → 0xacf60) 반복 이벤트의 본 표시와 커서를 지운다(`forgetRepeatableEvents`)
 *       - 관리 화면 trigger 0 을 처음부터 훑는다(`nextEventFor`, 무작위 조건은 굴리지 않는다 — 질병 따위는 안 받을 뿐)
 *     그 이벤트와 선택지 · 대결 결과로 닿는 이벤트의 say · choice 초상(주인공은 장타형 +8 · 피부 팔레트 번호 지도까지)을 받는다.
 *
 * 경기 결과로 달라지는 조건(인기도 · 평판)은 경기 전 값으로 본다 — 빗나가면 그 이벤트 그림이 예전처럼 늦게 뜰 뿐이다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EVENT_TRIGGER, forgetRepeatableEvents, nextEventFor } from '@/entities/story/model/storyScene'
import { evaluationManagerAnimations } from '@/pages/story/lib/evaluationDialogue'
import type { EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { portraitAnimationOf, portraitPaletteOf } from '@/widgets/event-portraits/lib/portraitSlots'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const PORTRAIT_JSON = ['animations.json', 'origins.json'] as const

/** 평가 감독(event_char_0 · 캐릭터 2) — 띄울 수 있는 애니 전부 */
export function afterGameEvaluationPreloads(): SpriteFolderPreload[] {
  return [{ folder: assetUrl('./sprites/event_char_0/frames'), frames: [], animations: evaluationManagerAnimations(), json: PORTRAIT_JSON }]
}

/** 이벤트가 닿는 다른 이벤트 — 선택지 gotoEvent · 예아니오 · 대결 결과 (events.json 명령 칸) */
function branchEventIdsOf(event: OriginalEvent): number[] {
  return event.commands.flatMap((command) => {
    if (command.op === 'choice') return command.choices.map((choice) => choice.gotoEvent)
    if (command.op === 'yesno') return [command.yesEvent, command.noEvent]
    if (command.op === 'match') return [...command.resultEvents]
    return []
  })
}

/** 이벤트와 그 갈래로 닿는 이벤트들의 초상 전부 (같은 이벤트는 한 번) */
export function reachablePortraitsOf(events: readonly OriginalEvent[], first: OriginalEvent): EventPortrait[] {
  const byId = new Map(events.map((event) => [event.id, event]))
  const visited = new Set<number>()
  const pending: OriginalEvent[] = [first]
  const portraits: EventPortrait[] = []
  while (pending.length > 0) {
    const event = pending.pop()
    if (event === undefined || visited.has(event.id)) continue
    visited.add(event.id)
    for (const command of event.commands) {
      if (command.op === 'say' || command.op === 'choice') portraits.push(...command.portraits)
    }
    for (const id of branchEventIdsOf(event)) {
      const next = byId.get(id)
      if (next !== undefined && !visited.has(id)) pending.push(next)
    }
  }
  return portraits
}

/** 초상 목록 → 받을 그림. 애니 번호는 화면과 같은 식(`portraitAnimationOf`), 피부 팔레트를 쓰면 번호 지도 · palette.json 도 */
export function portraitPreloadsOf(portraits: readonly EventPortrait[], battingTypeIndex: number, skinIndex: number): SpriteFolderPreload[] {
  const requests: SpriteFolderPreload[] = []
  for (const portrait of portraits) {
    const frames = assetUrl(`./sprites/${portrait.file}/frames`)
    const animation = portraitAnimationOf(portrait, battingTypeIndex)
    requests.push({ folder: frames, frames: [], animations: [animation], json: PORTRAIT_JSON })
    if (portraitPaletteOf(portrait, skinIndex) !== null) {
      requests.push(
        { folder: assetUrl(`./sprites/${portrait.file}`), frames: [], json: ['palette.json'] },
        { folder: `${frames}/index`, frames: [], animations: [animation], animationsIn: frames },
      )
    }
  }
  return mergeSpritePreloads(requests)
}

/** 경기 뒤 관리 화면이 처음 띄울 이야기 이벤트(예상) — 위 머리말 2 */
export function afterGameStoryEventOf(career: PlayerCareer, events: readonly OriginalEvent[]): OriginalEvent | null {
  const afterGame = forgetRepeatableEvents({ ...career, gamesPlayed: career.gamesPlayed + 1 }, events)
  return nextEventFor(afterGame, events, EVENT_TRIGGER.관리)
}

/** 경기 뒤 이벤트 판 그림 전부 — 평가 감독 + 예상 이야기 이벤트 */
export function afterGameEventPreloadsOf(career: PlayerCareer, events: readonly OriginalEvent[]): SpriteFolderPreload[] {
  const story = afterGameStoryEventOf(career, events)
  const portraits = story === null ? [] : reachablePortraitsOf(events, story)
  return mergeSpritePreloads(portraitPreloadsOf(portraits, career.battingTypeIndex, career.skinIndex), afterGameEvaluationPreloads())
}

/**
 * 나리 타자편 경기 장면이 서 있는 동안 경기 뒤 이벤트 판 그림을 유휴로 받는다. 이벤트 본문은 `useStorySchedule` 처럼
 * 따로 불러온다(같은 묶음이라 이미 받았으면 곧바로 풀린다).
 */
interface PreloadBasis {
  readonly career: PlayerCareer
  readonly events: readonly OriginalEvent[] | null
}

/** 이벤트 표 · 날짜 · 본 이벤트 · 몸 · 피부가 그대로면 앞 바탕을 그대로 둔다 */
function keepPreloadBasis(previous: PreloadBasis | null, next: PreloadBasis): PreloadBasis {
  if (previous === null || previous.events !== next.events) return next
  const [before, now] = [previous.career, next.career]
  const isSameCareer =
    before.season === now.season &&
    before.gamesPlayed === now.gamesPlayed &&
    before.seenEventIds === now.seenEventIds &&
    before.battingTypeIndex === now.battingTypeIndex &&
    before.skinIndex === now.skinIndex
  return isSameCareer ? previous : next
}

export function useAfterGameEventPreload(career: PlayerCareer): void {
  const [events, setEvents] = useState<readonly OriginalEvent[] | null>(null)
  useEffect(() => {
    let isLive = true
    void import('@/shared/config/original/events').then((module) => {
      if (isLive) setEvents(module.ORIGINAL_EVENTS)
    })
    return () => {
      isLive = false
    }
  }, [])
  // 경기 중에는 날짜 · 본 이벤트 · 몸 · 피부가 바뀌지 않는다 — 그 밖의 커리어 변화로 다시 계산하지 않는다
  const basis = useRenderMachine(keepPreloadBasis, { career, events })
  const requests = useMemo(() => (basis.events === null ? null : afterGameEventPreloadsOf(basis.career, basis.events)), [basis])
  useEffect(() => {
    if (requests !== null) preloadSprites(requests, 'idle')
  }, [requests])
}
