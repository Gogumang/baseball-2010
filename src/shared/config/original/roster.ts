// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import data from '@/shared/config/original/data/roster.json'

export interface RosterPlayer {
  readonly id: number
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 (투수는 제구 · 구속 · 변화 · 체력) — 0xb6414 인덱스 순서 */
  readonly ability: readonly [number, number, number, number]
  /**
   * 수비 위치 코드 — 원본 레코드 +0x1c (XlsBATTER_DATA 행 바이트 28).
   * 1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격 ·
   * 7 = 1루 쪽 외야(우익 자리) · 8 = 3루 쪽 외야(좌익 자리) · 9 중견 · 0 = 자리 없는 후보.
   * 수비 칸 번호는 `code - 1` 이고 칸 0(투수)은 이 검색에서 빠진다 (0xb1048).
   * ⚠️ 원본 그대로: 기록 번호(7 좌익 · 8 중견 · 9 우익)와 7·8·9 가 어긋난다.
   * 투수 명단에는 없다.
   */
  readonly position?: number
}

// JSON 은 네 칸 튜플을 나타내지 못해 한 번 더 단언한다
export const BATTERS = data.batters as unknown as readonly RosterPlayer[]
export const PITCHERS = data.pitchers as unknown as readonly RosterPlayer[]
