// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import data from '@/shared/config/original/data/seasonEvents.json'

/** s_event 는 대상 4(시즌 자동 발동)를 쓴다 — r_event 의 0~3 밖이라 넓혀 둔다 */
export type SeasonOriginalEvent = Omit<OriginalEvent, 'audience'> & { readonly audience: 0 | 4 }

/** 원본 data/s_event.zt1 시즌모드 이벤트 스크립트 30편 (r_event 와 같은 형식 — 0xadd10 해석기). 파일 차례 그대로다. */
export const ORIGINAL_SEASON_EVENTS: readonly SeasonOriginalEvent[] = data as readonly SeasonOriginalEvent[]
