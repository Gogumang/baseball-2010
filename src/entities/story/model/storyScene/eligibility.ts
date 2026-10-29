import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isBugFixed } from '@/shared/config/bugfixes'
import { hasSeen, meetsConditions } from '@/entities/story/model/storyScene/conditions'
import { GAMES_PER_SEASON, type PlayerCareer } from '@/entities/story/model/storyScene/otherSlices'

const BATTER_AUDIENCES: ReadonlySet<number> = new Set([1, 2])

/**
 * 날짜 창 검사 (0xacfbc 7번, A-2 확정).
 *
 * ```
 * 네 바이트 a,b,c,d 중 **하나라도 0 이면 검사 자체를 건너뛴다**
 * from = (a−1)·45 + b · to = (c−1)·45 + d
 * now  = 연차(0부터)·45 + 치른 경기 수 + 1        ; 45 로 자르지 않는다
 * from <= now <= to
 * ```
 * 앞서 웹은 ① 연차 둘 다 0 일 때만 생략하고 ② 경기 번호를 45 로 잘랐으며
 * ③ 한 시즌을 100 으로 셌다 — 셋 다 원본과 달랐다.
 */
function isInDateWindow(event: OriginalEvent, career: PlayerCareer): boolean {
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  if ([fromSeason, fromGame, toSeason, toGame].includes(0)) return true
  const now = (career.season - 1) * GAMES_PER_SEASON + career.gamesPlayed + 1
  const from = (fromSeason - 1) * GAMES_PER_SEASON + fromGame
  const to = (toSeason - 1) * GAMES_PER_SEASON + toGame
  return now >= from && now <= to
}

/**
 * 발렌타인 2차 대결 재도전(228 타자편 · 229 투수편)의 선행 이벤트 — 원본 이벤트 표(r_event.zt1)는 **219(1차 패배)** 라,
 * 1차를 이기고(218) 2차에서 진(227) 사람에게는 재도전이 안 나오고, 1차에 진 적만 있으면 2차를 치르기도 전에 나올 수 있다 (B-33).
 * 1차 재도전 220 이 `requiresEvent = 219`(1차 패배) · 조건 "218 안 봄" 인 것과 같은 꼴로, 2차는 227(2차 패배) · "226 안 봄" 이어야 맞다.
 */
const SECOND_VALENTINE_RETRY_EVENT_IDS: ReadonlySet<number> = new Set([228, 229])
const SECOND_VALENTINE_LOSS_EVENT_ID = 227

/**
 * 이벤트의 선행 번호(`requiresEvent`) — 데이터 버그 B-33 고침(기본)이면 228 · 229 를 227 로 덮어 읽는다. 타자편 · 투수편 공용.
 * 굴림이 없는 판정이라 난수 차례는 훑기 결과가 바뀌는 자리만 달라진다
 */
export function requiredEventIdOf(event: Pick<OriginalEvent, 'id' | 'requiresEvent'>): number {
  if (SECOND_VALENTINE_RETRY_EVENT_IDS.has(event.id) && isBugFixed('B-33')) return SECOND_VALENTINE_LOSS_EVENT_ID
  return event.requiresEvent
}

function hasSeenRequiredEvent(event: OriginalEvent, career: PlayerCareer): boolean {
  const requiredEventId = requiredEventIdOf(event)
  return requiredEventId === 0 || hasSeen(career, requiredEventId)
}

/** trigger · 대상 · 선행 · 날짜 · 조건 차례 — 조건(굴림)은 앞이 다 맞을 때만 본다 */
export function isEligible(event: OriginalEvent, career: PlayerCareer, trigger: number, random: RandomPort | undefined): boolean {
  return (
    event.trigger === trigger &&
    BATTER_AUDIENCES.has(event.audience) &&
    hasSeenRequiredEvent(event, career) &&
    isInDateWindow(event, career) &&
    meetsConditions(event, career, random)
  )
}
