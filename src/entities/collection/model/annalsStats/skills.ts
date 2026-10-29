import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

/**
 * 스킬 켜기 `0xb663c` 의 저장 쪽 — 모드 4 면 `+0xf4`, 3 이면 `+0xf8` 에 `1 << 스킬` 을 OR 한다 (그 밖 모드는 안 쓴다).
 * 원본은 **이미 켜져 있으면 들어오지 않으니** 부르는 쪽이 새로 켤 때만 부른다.
 */
export function markSkillEquipped(stats: AnnalsStats, mode: number, skillId: number): AnnalsStats {
  if (skillId < 0 || skillId > 31) return stats
  const bit = (1 << skillId) >>> 0
  if (mode === 4) return { ...stats, batterEquippedSkillBits: (stats.batterEquippedSkillBits | bit) >>> 0 }
  if (mode === 3) return { ...stats, pitcherEquippedSkillBits: (stats.pitcherEquippedSkillBits | bit) >>> 0 }
  return stats
}

/** 기록연감 스킬 탭 칸 수 — 0x58a3c 가 40칸을 −1 로 채운다(`movs r0,#0x27` … `bpl`) */
export const ANNALS_SKILL_CELLS = 40
const COMMON_SKILL_CELLS = 8
const BATTER_SKILL_LAST_CELL = 0x17
/** 투수 칸 24~39 ↔ +0xf8 비트 8~23 */
const PITCHER_CELL_OFFSET = 16

const hasBit = (bits: number, bit: number) => ((bits >>> bit) & 1) !== 0
const isSkillCell = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < ANNALS_SKILL_CELLS

/** 칸 0~7 은 두 편 어느 쪽이든 · 8~23 은 타자편 · 24~39 는 투수편 비트 */
function isCellGained(stats: AnnalsStats, cell: number, bit: number): boolean {
  if (cell < COMMON_SKILL_CELLS) return hasBit(stats.batterEquippedSkillBits, cell) || hasBit(stats.pitcherEquippedSkillBits, cell)
  if (cell <= BATTER_SKILL_LAST_CELL) return hasBit(stats.batterEquippedSkillBits, cell)
  return hasBit(stats.pitcherEquippedSkillBits, bit)
}

/**
 * **기록연감 스킬 탭 표 `[+0x13c]` = `0x58a3c`** (탭 고름 0x2b640 의 0x2b6fc 가 부른다, 직접 떴다) — 칸 → 스킬 비트 번호, 못 얻었으면 −1.
 * ```
 * 표 40칸 = −1                                   ; 58a4a~58a5a
 * 칸 0~7   : +0xf4 비트 i 또는 +0xf8 비트 i → i   ; 58a64~58ad4 (두 편 어느 쪽이든)
 * 칸 8~23  : +0xf4 비트 k → k                    ; 58ad6~58b06
 * 칸 24~39 : +0xf8 비트 k(8~23) → k              ; 58b08~58b3a (칸 = k + 16)
 * ```
 * 칸 그리기(0x2f150~0x2f20e)·설명(0x2f37e~0x2f3ae)·그림 두 장(0x2f3b0~)이 모두 이 값이 −1 인지로 '얻음' 을 가른다.
 * 비트는 스킬 켜기 0xb663c 만 세우니 **보유(+0x1b8)가 아니라 "한 번이라도 장착한 스킬"** 이다 — 칸이 가득 차 못 낀 플러스 스킬은 안 뜬다.
 */
export function annalsSkillOfCell(stats: AnnalsStats, cell: number): number {
  if (!isSkillCell(cell)) return -1
  const bit = cell <= BATTER_SKILL_LAST_CELL ? cell : cell - PITCHER_CELL_OFFSET
  return isCellGained(stats, cell, bit) ? bit : -1
}

/** 0x2f37e `adds r3,#1; bne` — 표 값이 −1 이 아니면 얻은 칸 */
export const isAnnalsSkillGained = (stats: AnnalsStats, cell: number): boolean => annalsSkillOfCell(stats, cell) !== -1
