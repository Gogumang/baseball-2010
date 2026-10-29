/**
 * `career+0x1ca` u16 — **그 해 MVP 비트**다 (0xa4d2c 가 `|= 1 << 연차idx`).
 * A 문서가 "미해결" 로 뒀던 칸을 B-5 가 확정했다.
 * 0xa4d50 은 bit0..12 를 세어 **통산 MVP 횟수**를 낸다 — 칭호 2(1년차 MVP)·11(6회)·12(10회)·
 * 13(7회)·32/48(2년 연속)·33/49(4회)가 이 수를 본다.
 *
 * 칸은 `PlayerCareer.mvpSeasonBits`(투수편도 같은 이름)이고, 여기는 비트를 다루는 순수 함수만 둔다.
 * 원본 0xa4d78 은 방금 세운 비트를 그대로 읽는다(`hasMvpInSeason`).
 */
export const MVP_YEAR_COUNT = 13
const MVP_BITS_MASK = 0xffff

/** 연차(1부터) → 비트 자리 (연차idx = career+0xb3) */
function seasonBitOf(season: number): number {
  return 1 << (season - 1)
}

export function recordMvpSeason(bits: number, season: number): number {
  if (season < 1 || season > MVP_YEAR_COUNT) return bits
  return (bits | seasonBitOf(season)) & MVP_BITS_MASK
}

export function hasMvpInSeason(bits: number, season: number): boolean {
  if (season < 1 || season > MVP_YEAR_COUNT) return false
  return (bits & seasonBitOf(season)) !== 0
}

/** 통산 MVP 횟수 (0xa4d50 — bit0..12 만 센다) */
export function careerMvpCount(bits: number): number {
  let count = 0
  for (let season = 1; season <= MVP_YEAR_COUNT; season += 1) {
    if (hasMvpInSeason(bits, season)) count += 1
  }
  return count
}

/** 두 해 연속 MVP 인가 — 칭호 32 "괴물 타자" · 48 "괴물 투수" 가 본다 */
export function hasBackToBackMvp(bits: number): boolean {
  for (let season = 1; season < MVP_YEAR_COUNT; season += 1) {
    if (hasMvpInSeason(bits, season) && hasMvpInSeason(bits, season + 1)) return true
  }
  return false
}
