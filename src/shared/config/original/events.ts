// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import data from '@/shared/config/original/data/events.json'

/** 원본 data/r_event.zt1 이벤트 스크립트 (binary.mod 0xadd10 해석기 기준으로 해독). */
export const ORIGINAL_EVENTS: readonly OriginalEvent[] = data as readonly OriginalEvent[]
