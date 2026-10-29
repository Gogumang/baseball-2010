import type { Screen } from '@/app/model/screen'
import { DERBY_PICK_BGM, POSTSEASON_REENTRY_BGM, SCREEN_BGM, STORY_BGM } from '@/app/model/screenBgm/screenBgmTable'
import { endingBgmOf } from '@/app/model/screenBgm/endingBgm'

/** 128 대진 — 이어하기로 들어왔으면 4, 경기 뒤 116 → 114 는 S+0x50 == 2 라 40 을 안 튼다 (`STORY_BGM` 가드), 그 밖은 40 */
export function postseasonBgmOf(isFromReentry: boolean, isAfterGame: boolean): number | null {
  if (isFromReentry) return POSTSEASON_REENTRY_BGM
  return isAfterGame ? null : STORY_BGM
}

/** 들어선 길에 따라 갈리는 화면의 배경음 — 표로 정하는 화면이면 undefined */
function enteredScreenBgmOf(screen: Screen, enteredFrom: Screen['kind'] | null): number | null | undefined {
  if (screen.kind === '엔딩') return endingBgmOf(screen.endingIndex)
  if (screen.kind === '포스트시즌') return postseasonBgmOf(screen.fromReentry === true, enteredFrom === '경기평가')
  // 115 연초 이벤트는 0x8a680 이 만든 내장 이벤트([관리자+0x39f] = 1) — 40 을 안 튼다.
  // 대결결과(140 → 114)도 40 이다 (확정): 미션 장면 결과 0x4ea0c 가 S+0x50 을 쓰는 곳은 4eb3e(`[장면+0xf08]` 이 있으면 3) ·
  // 4f044 · 4f1ca(다른 모드 갈래)뿐이고, 모드 5 · 6 갈래 0x4ef18~0x4f01e 는 안 쓴다. +0xf08 은 적재 0x3f584 의 모드 3 · 4 갈래
  // (0x3f6a4)만 세우고 모드 5(0x3f6e0) · 6(0x3f6bc)은 안 세워 new(0x2ac4 의 memset 0) 그대로 0 → 4eb3e 도 건너뛴다.
  // 곧 대결은 S+0x50 을 안 바꾸고, 대결을 연 114 진입이 이미 2 를 3 으로 고친 뒤라 140 → 114 의 가드는 늘 열린다
  if (screen.kind === '이벤트') return screen.context === '연초' ? null : STORY_BGM
  // 하위 16 홈런더비 선수 고르기 — 0x24ab8 표 0xcea84[13] = 24af0: 이전 상태 == 5(게임시작 목록)면 3
  if (screen.kind === '홈런더비') return enteredFrom === '메인메뉴' ? DERBY_PICK_BGM : null
  return undefined
}

/**
 * 이 화면에서 틀 배경음. 바꾸지 않는 화면이면 null.
 * `enteredFrom` 은 이 화면에 들어설 때의 앞 화면이다 (128 대진이 경기 뒤 길인지 가른다).
 */
export function screenBgmOf(screen: Screen, enteredFrom: Screen['kind'] | null = null): number | null {
  const entered = enteredScreenBgmOf(screen, enteredFrom)
  if (entered !== undefined) return entered
  const table: Partial<Record<string, number>> = SCREEN_BGM
  return table[screen.kind] ?? null
}
