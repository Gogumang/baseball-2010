/**
 * 원작 '나만의 타자'의 능력치 4종. 원본과 같은 0~999 눈금 (선수 레코드 u16, 999 로 자름 0xb6414).
 * 2013판에서 수비가 멘탈로 교체되지만 2010 기준은 이 네 가지다.
 */
export interface BatterAbility {
  /** 히트 — 배트에 맞히는 능력. 컨택 판정의 기준선을 올린다. */
  readonly hit: number
  /** 파워 — 타구 속도. 장타/홈런 여부를 가른다. */
  readonly power: number
  /** 주루 — 내야 안타 확률에 관여한다. */
  readonly run: number
  /** 수비 — 0단계(타석 대결)에서는 아직 쓰이지 않는다. */
  readonly defense: number
}

/** 능력치 눈금. 0~1 비율이 필요한 곳은 이 값으로 나눈다 */
export const ABILITY_SCALE = 1000

/** 커리어가 없을 때 쓰는 기본 타자 — 원본 근거 없음 (추정) */
export const ROOKIE_BATTER_ABILITY: BatterAbility = {
  hit: 450,
  power: 400,
  run: 500,
  defense: 400,
}
