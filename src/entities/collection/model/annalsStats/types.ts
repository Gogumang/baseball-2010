/** 원본 모드 번호 — 0x1552d10 */
export type StatMode = 2 | 3 | 4

/**
 * **플레이 시간 누계 `0x4e8b0(장면)`** (직접 떴다, 0x4e8b0~0x4e9da):
 * ```
 * now = 0x14005c8()                                   ; 밀리초 시계 (64비트)
 * d = now − [장면+0x19d8] − [장면+0x19e0]               ; 시작 시각 · 멈춘 시간
 * 0x22efc(G, d, [장면+0x1104])                          ; 모드 칸에 더한다 · 0x1f1e1 저장
 * 0x3f554(장면)                                        ; [+0x19d8] = now · [+0x19e0] = 0 — 다시 잰다
 * 모드 3: (u64 +0x3c) / 3600000 > 9 → 0x62368(ui, 0x1f = 31, 0)   ; 열기 + 알림
 * 모드 4: (u64 +0x34) / 3600000 > 9 → 0x62368(ui, 0x2f = 47, 0)
 * ```
 * - 시작 시각 `0x3f554` 를 부르는 곳은 경기 장면 적재 `0x3f584`(0x3fa3e)와 `0x4e8b0` 자신뿐이다.
 * - 멈춘 시간 `+0x19e0`(= 0xcf << 5)을 쓰는 곳은 `0x3f554` 의 0 하나뿐이다(이진 전체에서 0xcf << 5 를 만드는 곳은 0x3f562 · 0x4e8c8 둘,
 *   0x19d8 · 0x19e0 · 0x19dc · 0x19e4 리터럴도 없다) — **늘 0**, 멈춘 동안도 센다(원본 그대로).
 * - `0x4e8b0` 을 부르는 곳(전수): 경기 끝 정산 `0x4ea0c` 의 끝 0x4f54a(모든 모드 — 함수의 유일한 출구 바로 앞),
 *   홈런더비 결과 `0x4f574` 의 0x4f6be, 상태 0x18 이어하기 자동 저장 `0x4f928` 의 0x4fa9e(모드 1 · 2 · 8 · 9 만).
 */
export interface AnnalsStats {
  /** `+4 + n` u8 [40] — 기록달성 번호 n 의 누계 (0x22df0). 옛 저장에는 없어 0 으로 */
  readonly recordCounts: readonly number[]
  /** `+0xa8` u16 [3][10] — 칸 m·10 + i */
  readonly itemPurchaseCounts: readonly number[]
  /** `+0x6c` u32 [8] */
  readonly gamePointUsage: readonly number[]
  /** `+0x8c` u32 [7] — 모드별 획득 GP (0x22c7d) */
  readonly gamePointEarned: readonly number[]
  /** `+0xf4` (타자편) · `+0xf8` (투수편) — 한 번이라도 켠 스킬 비트 */
  readonly batterEquippedSkillBits: number
  readonly pitcherEquippedSkillBits: number
  /** `+0x106 + k` u8 [8] — 달성 표시 (0x22dd4). 옛 저장에는 없어 0 으로 */
  readonly achievementMarks: readonly number[]
  /** `+0x2c + 8i` u64 [8] — 모드 칸별 플레이 시간 밀리초 (0x22efc). 옛 저장에는 없어 0 으로 */
  readonly playTimes?: readonly number[]
  /**
   * `+0xfc + 2i` u16 [5] — 기록연감 통계 셀 8~12 "%d회"(StrMAINMENU[136~140]). 쓰는 곳은 하루 끝 `0xb818c` 의 정규시즌 1위
   * 갈래 하나: 모드 4 → `+0xfc`(b827e) · 3 → `+0xfe`(b8288) · 2 → `+0x100`(b82ec~b830a), 바이트 둘로 읽어 +1 하고 되쓴다
   * (16비트 넘침은 0). 칸 3 · 4(친구 추천 · 이벤트 미션 다운)는 쓰는 곳이 없어 늘 0. 옛 저장에는 없어 0 으로
   */
  readonly leagueFirstCounts?: readonly number[]
}
