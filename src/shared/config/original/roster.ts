// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import data from '@/shared/config/original/data/roster.json'

export interface RosterPlayer {
  readonly id: number
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 (투수는 제구 · 구속 · 변화 · 체력) — 0xb6414 인덱스 순서 */
  readonly ability: readonly [number, number, number, number]
}

// JSON 은 네 칸 튜플을 나타내지 못해 한 번 더 단언한다
export const BATTERS = data.batters as unknown as readonly RosterPlayer[]
export const PITCHERS = data.pitchers as unknown as readonly RosterPlayer[]
