import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'
import { isBugFixed } from '@/shared/config/bugfixes'
import { OWN_PLAYER_ID, PLAYER_KIND, PLAYER_OWN_BIT, withSlot } from '@/entities/season-mode/model/playerRecruit/playerRecord'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit/seasonPlayer'

/**
 * **나리 선수 기록** — 영입 후보 칸 0(투수) · 5(타자)의 원본 `0x22168(저장)` · `0x220ec(저장)` (직접 떴다):
 * ```
 * 0x213c0(저장, 3|4, 1)                         ; 나만의리그 투수편(3)·타자편(4) 저장을 올린다
 * L = [저장 + 0xb8|0xbc] ; 팀 = (s8)L[0x11d]       ; 그 저장의 내 팀
 * T = L + 4 + 팀·0x1c
 * for i in 0..수: P = 0xb51fc|0xb53d0(T, i) ; (s8)P[0xa] < 0 → return P   ; 첫 육성 선수(bit7)
 * return 0
 * ```
 * 그 기록은 나리 선수 생성 0x17360 이 `+0xa = 0x80`(투수) / `0xa0`(타자, 0x1762e~0x17634 · 타자편은 0x1764a 가 0xa7)으로,
 * 나리 경기 쪽 사본도 `+0 = 0xfe`(0x10ff8 · 0x110e2)로 단 내 선수다 — id `0xfe` 는 `0xb6278` 이 명전 구간에서 빼는 값이다.
 * 하위 5비트(나리 팀 칸)는 영입 `0xb6604` 가 덮어쓰므로 상위 비트만 의미가 있다.
 * 영입 0xc554 는 이 기록을 명전 칸과 똑같이 통째로 옮긴다(복사 전 고치는 칸은 +0xa 하위 5비트 · 투수 +0x2c 뿐).
 */
export const NARI_PITCHER_KIND_BYTE = PLAYER_OWN_BIT
export const NARI_BATTER_KIND_BYTE = PLAYER_OWN_BIT | PLAYER_KIND.일반타자

/** 나리 선수 기록 → 시즌 명단 선수 (id 0xfe · +0xa 0x80/0xa0 · 기록 사본) */
export function nariRecruitPlayerOf(record: SeasonEntryBatterRecord | SeasonEntryPitcherRecord, isPitcher: boolean): SeasonPlayer {
  return {
    id: OWN_PLAYER_ID,
    kindByte: isPitcher ? NARI_PITCHER_KIND_BYTE : NARI_BATTER_KIND_BYTE,
    fieldPosition: 0,
    stamina: 0,
    record,
  }
}

/** 영입된 투수의 스태미나는 10000 으로 채워진다 (`선수+0x2c = 0x2710`) */
export const RECRUIT_PITCHER_STAMINA = 10_000

/**
 * 투수 끼워넣기 — `0xb521c` 의 기본 가지 (S6 4-3).
 * ```
 * 0xb4e34(T, 1)                                    ; 배열을 한 칸 늘린다
 * memcpy(맨 끝 칸, 0xb51fc(T, k), 0x30)            ; 옛 k번 선수를 맨 끝으로
 * memcpy(0xb51fc(T, k), 새선수, 0x30)              ; k 칸에 새 선수
 * ```
 * ⚠️ **투수 쪽만 뒷정리가 빠졌다** (S6 4-4, 원본 그대로 둔다): 타자 가지는 밀려난 선수의
 * 칸 번호를 `0xb6605` 로 고쳐 주는데 투수 가지에는 그 줄이 없다 → 밀려난 투수와 새 투수가
 * **같은 `+0xa` 하위 5비트**를 갖는다. 배열 접근은 첨자로만 하므로 경기에는 영향이 없고
 * 표시용 칸 번호만 어긋난다.
 */
export function insertPitcher(pitchers: readonly SeasonPlayer[], player: SeasonPlayer, slot: number): SeasonPlayer[] {
  const next = [...pitchers]
  const pushed = next[slot]
  if (pushed === undefined) return next
  // 고침(`bugfixes.json` B-22, 기본 켬): 진짜 교체 — 옛 선수는 빠지고 그 칸에 새 선수만(칸 번호도 겹치지 않는다)
  if (!isBugFixed('B-22')) next.push(pushed) // 옛 선수는 맨 끝으로 — 칸 번호는 고치지 않는다(원본 버그 B-22)
  next[slot] = player
  return next
}

/**
 * 타자 끼워넣기 — `0xb53f0` 의 기본/`0x20` 가지 (S6 4-3).
 * ```
 * 0xb4e34(T, 0)                                    ; 배열 한 칸 늘림
 * pos = old[0x1c] & 0xf                            ; 밀려날 선수의 수비 위치
 * 0xb8e85(old, 0, 0)                               ; 그 선수 수비 위치 = 0
 * 0xb6605(old, T+0x10 − 1)                         ; 그 선수 칸 번호 = 마지막
 * memcpy(맨 끝 칸, old, 0x30) ; memcpy(k 칸, 새선수, 0x30)
 * 0xb8e85(새선수, pos, 0)                          ; 새 선수 수비 위치 = 밀려난 선수의 자리
 * ```
 */
export function insertBatter(batters: readonly SeasonPlayer[], player: SeasonPlayer, slot: number): SeasonPlayer[] {
  const next = [...batters]
  const pushed = next[slot]
  if (pushed === undefined) return next
  const position = pushed.fieldPosition & 0xf
  const lastIndex = next.length // 한 칸 늘린 뒤의 마지막 첨자
  // 고침(B-22, 기본 켬): 밀려난 선수는 빠진다 — 새 선수가 그 칸 · 수비 위치를 그대로 잇는다
  if (!isBugFixed('B-22')) next.push(withSlot({ ...pushed, fieldPosition: 0 }, lastIndex))
  next[slot] = { ...player, fieldPosition: position }
  return next
}
