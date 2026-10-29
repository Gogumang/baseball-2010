import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { hasSeen } from '@/entities/story/model/storyScene/conditions'
import { isEligible } from '@/entities/story/model/storyScene/eligibility'
import { isIllnessCooldownBlocked } from '@/entities/story/model/storyScene/illness'
import type { PlayerCareer } from '@/entities/story/model/storyScene/otherSlices'
import { OPENING_EVENT_ID } from '@/entities/story/model/storyScene/schedule'

/** 이벤트 한 번 훑기의 결과 — 뽑힌 이벤트와 **다음 호출이 이어서 볼 자리**(0xadc70 의 reader+0x28) */
export interface EventScan {
  readonly event: OriginalEvent | null
  readonly cursor: number
}

/**
 * 커서에서 이어 훑는다 (0xadc70, A-1 확정).
 *
 * ```
 * while cursor < 개수:
 *     if acfbc(레코드): return 찾음            ; 커서는 그 레코드에 **멈춘다**
 *     cursor += 1
 * cursor = 0; return 없음                      ; 끝까지 없으면 되감고 이번 호출은 "없음"
 * ```
 * 당첨 레코드에 커서가 멈추는 것이 핵심이다 — 그 이벤트는 본 것이 되므로 다음 호출은
 * 판정 4번(본 이벤트면 불발)에 걸려 곧바로 그 다음 칸으로 넘어간다.
 * 번호로 부를 때(0xae170)는 "현재 레코드 **다음** 위치" 를 커서로 남긴다 — 오프닝이 그 갈래다(`openingScanOf`).
 * 오프닝 451 은 대상 0 이라 이 훑기로는 안 나온다 — 새 선수 플래그(장면+0x165)를 보는 0x1cfa6 이 번호로 부른다(A-54).
 *
 * 무작위 조건(질병)은 random 이 있을 때만 판정한다 — 지도 [!] 표시처럼 미리 보기만 할 때는
 * random 없이 부른다.
 */
export function scanEventFrom(
  career: PlayerCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  cursor: number,
  random?: RandomPort,
  /** mgr+0x304 → reader+0x34 — 장면이 새로 선 뒤 관리 메뉴 확인 키를 아직 안 눌렀다 (`isIllnessCooldownBlocked`) */
  isFreshScene = false,
): EventScan {
  for (let at = Math.max(0, cursor); at < events.length; at += 1) {
    const event = events[at]
    // 판정 0xacfbc 는 본 이벤트를(0xad07e~0xad08c `0xacf30` 참이면 불발) trigger · 선행 · 날짜 · 조건보다 **먼저** 본다 —
    // 본 이벤트에는 무작위 조건(22 질병 · 20 스킬 획득 굴림)을 굴리지 않는다
    if (isIllnessCooldownBlocked(event, career.illnessCooldown, isFreshScene)) continue
    if (!hasSeen(career, event.id) && isEligible(event, career, trigger, random)) {
      return { event, cursor: at }
    }
  }
  return { event: null, cursor: 0 }
}

/**
 * **오프닝 451** — 105 · 112 틀의 0x1cfa6 이 새 선수 플래그 장면+0x165 ≠ 0 이면 자동 발동 훑기 대신 `0x8bde0`(모드 3·4 → 451)을
 * 번호로 부르고 플래그를 지운다(1cfd6~1cfd8). 플래그는 100 진입 끝 0x1c3be~0x1c3f8 이 이전 상태가 104(등록)일 때만 켠다 —
 * 저장에 없는 칸이라 451 도중 끊고 이어하면 다시 틀지 않는다. 번호 호출(0xae170)은 "그 다음 칸" 을 커서로 남긴다.
 * 투수편 `pitcherOpeningScanOf` 와 같은 함수다
 */
export function openingScanOf(events: readonly OriginalEvent[], cursor: number): EventScan {
  const index = events.findIndex((event) => event.id === OPENING_EVENT_ID)
  return index < 0 ? { event: null, cursor } : { event: events[index], cursor: index + 1 }
}

/**
 * 배열 처음부터 훑어 지금 볼 이벤트 (커서를 안 쓰는 갈래).
 * 외출 장소 [!] 배정 0x8cdc0 이 이렇게 **늘 처음부터** 훑으므로 미리 보기는 이 창구를 쓴다.
 *
 * **"분기 전용 이벤트 제외" 규칙은 원본에 없다** (A-1 확정). 원본은 분기로만 닿는 이벤트를
 * **대상(audience) 0** 으로 막는데, 그 검사는 `isEligible` 의 `BATTER_AUDIENCES` 가 이미 하고 있다.
 */
export function nextEventFor(career: PlayerCareer, events: readonly OriginalEvent[], trigger: number, random?: RandomPort): OriginalEvent | null {
  return scanEventFrom(career, events, trigger, 0, random).event
}
