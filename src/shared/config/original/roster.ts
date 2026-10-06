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
  /**
   * 레코드 +0x1b (u8) — 트레이드가 두 선수를 견주는 칸 (XlsBATTER_DATA·XlsPITCHER_DATA 행 바이트 27).
   * CPU 트레이드 요청 0x93c8 은 내 선수 값 ≥ 상대 값일 때만 요청을 세우고, 진행 0xcf24 는 차이 × 10 으로
   * 성공률을 깎고 성공하면 소지금(SR+2)에 더한다. 칸의 뜻(등급·몸값)은 미확정이다.
   */
  readonly grade: number
  /**
   * 레코드 +0xb (u8) — 윗 3비트 타자 타입(0x5e864 한계 행) · 아랫 2비트 보직(0xb6704: 투수 한계 행 · 타자 내야/외야).
   */
  readonly profile: number
  /** 레코드 +0x14 (u32) — 장착 스킬 비트. 0xb62b4(p, n) = (값 >> n) & 1 */
  readonly skillBits: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 (부위 0·1 = +0x19 윗·아랫, 2·3 = +0x1a 윗·아랫). 0 = 없음, n = 레벨 + 1.
   * 시즌 팀 레코드는 이 행을 그대로 복사해 시작한다 — 리그 열 팀은 모두 0, 외인구단(팀 14)만 차 있다.
   */
  readonly equipment: readonly [number, number, number, number]
}

// JSON 은 네 칸 튜플을 나타내지 못해 한 번 더 단언한다
export const BATTERS = data.batters as unknown as readonly RosterPlayer[]
export const PITCHERS = data.pitchers as unknown as readonly RosterPlayer[]
