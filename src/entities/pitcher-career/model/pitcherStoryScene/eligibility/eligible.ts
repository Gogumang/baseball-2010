import { isIllnessCooldownBlocked, placeTriggerOf, requiredEventIdOf } from '@/entities/pitcher-career/model/pitcherStoryScene/otherSlices'
import { hasSeen, meetsConditions } from '@/entities/pitcher-career/model/pitcherStoryScene/eligibility/conditions'
import { GAMES_PER_SEASON } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 모드 3 이 받는 대상 — 1 공통 · 3 투수 (타자편 1·2) */
const PITCHER_AUDIENCES: ReadonlySet<number> = new Set([1, 3])

/** 연차 · 경기 번호를 한 줄 날짜로 — 연차idx·45 + 경기 */
const dayOf = (season: number, game: number) => (season - 1) * GAMES_PER_SEASON + game

/** 날짜 창 — 네 바이트 중 하나라도 0 이면 생략, now = 연차idx·45 + 경기 수 + 1 */
function isInDateWindow(event: OriginalEvent, career: PitcherCareer): boolean {
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  if (fromSeason === 0 || fromGame === 0 || toSeason === 0 || toGame === 0) return true
  const now = dayOf(career.season, career.gamesPlayed + 1)
  return now >= dayOf(fromSeason, fromGame) && now <= dayOf(toSeason, toGame)
}

/** 선행 이벤트 — B-33 고침이면 228 · 229 의 선행 번호를 227 로 (`requiredEventIdOf`) */
function hasRequiredEvent(event: OriginalEvent, career: PitcherCareer): boolean {
  const required = requiredEventIdOf(event)
  return required === 0 || hasSeen(career, required)
}

/** `0xacfbc` 의 모드 3 판정 (본 이벤트 · 대상 · trigger · 선행 이벤트 · 날짜 · 조건) */
export function isPitcherEventEligible(
  event: OriginalEvent,
  career: PitcherCareer,
  trigger: number,
  random?: RandomPort,
  /** mgr+0x304 → reader+0x34 — 장면이 새로 선 뒤 관리 메뉴 확인 키를 아직 안 눌렀다 */
  isFreshScene = false,
): boolean {
  return (
    PITCHER_AUDIENCES.has(event.audience) &&
    !isIllnessCooldownBlocked(event, career.illnessCooldown, isFreshScene) &&
    !hasSeen(career, event.id) &&
    event.trigger === trigger &&
    hasRequiredEvent(event, career) &&
    isInDateWindow(event, career) &&
    meetsConditions(event, career, random)
  )
}

/**
 * 외출 장소 배정 `0x8cdc0` (지도 진입 0x118e4) — 처음부터 훑어 통과한 trigger ≥ 2 이벤트를 장소 trigger−2 칸에,
 * **비어 있을 때만** 넣는다 → 장소마다 파일 순서 첫 이벤트. [들어가기] 는 `0x8ce58` 이 이 번호를 부른다.
 * 무작위를 굴리지 않는다(장소 이벤트에는 질병 조건이 없다 — 판정이 trigger 를 조건보다 먼저 본다).
 */
export function pitcherPlaceEventOf(career: PitcherCareer, events: readonly OriginalEvent[], placeFrame: number): OriginalEvent | null {
  const trigger = placeTriggerOf(placeFrame)
  return events.find((event) => isPitcherEventEligible(event, career, trigger)) ?? null
}
