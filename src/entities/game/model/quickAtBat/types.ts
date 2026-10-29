import type { AtBatOutcome, SwingMode } from '@/entities/game/model/quickAtBat/otherSlices'
import type { BaseState } from '@/entities/game/model/baseState'

/** 간이 타석의 타자 — 0xc11f0 · 0xab214 가 공격 팀 레코드로 읽는 값 */
export interface QuickAtBatBatter {
  readonly hit: number
  readonly power: number
  /** 주력 — 내야안타와 한 루 더 가는 판정에 쓴다 (player_stat kind 3) */
  readonly run: number
  readonly skillIds: readonly number[]
  /** 손 `0xb63c0(타자)` — 0 우타 · 1 좌타. 투수 스킬 28·29 가 본다. 안 넘기면 0 */
  readonly hand?: number
  /**
   * 레코드 칸 `0xb6394(타자)` = `+0xa & 0x1f` — 타순이 아니라 팀 안 레코드 칸(일반 타자 0~11, 마타자 순번).
   * 투수 스킬 31(0xabcd8)이 2·3·4 를 본다. 안 넘기면 0
   */
  readonly recordSlot?: number
  /** 마선수(0xb633c = 레코드 +0xa 비트6)면 그 순번·레벨 — 0xab214 에 넘기는 보정 구조체에 히트·파워를 얹는다 (`quickSwingBoostOf`) */
  readonly ace?: QuickAceSlot
  /**
   * 내 육성·명전 선수(0xb6389 = 레코드 +0xa 비트7)인가 — 0xab214 가 레코드를 직접 읽어 나리(모드 3·4)의 내 선수 보너스를 건다
   * (`SwingResultInput.isBatterOwnPlayer`). 안 넘기면 거짓
   */
  readonly isOwnPlayer?: boolean
}

/** 마선수 한 명의 순번(0xb63a0, 0~4)과 레벨(`mgr[0x13f/0x13a + 순번]`, 0~4) */
export interface QuickAceSlot {
  readonly order: number
  readonly level: number
}

/** 제구 · 구속 한 쌍 */
export interface PitcherStats {
  readonly control: number
  readonly velocity: number
}

/** 간이 타석의 투수 — 0xc11f0 · 0xc1818 · 0xab214 가 수비 팀 레코드로 읽는 값 */
export interface QuickAtBatPitcher {
  readonly control: number
  readonly velocity: number
  /** 0 이면 탈진이라 0xab214 가 B·C 에 2000 을 얹는다 */
  readonly stamina: number
  readonly skillIds: readonly number[]
  /**
   * **내 육성·명전 선수**(0xb6389 = 레코드 +0xa 비트7)면 스트라이크존 기준이 10 낮아진다 (0xc1818 c182a·c1880).
   * ⚠️ 마선수(비트6)가 아니다 — 예전 이름 `isAce` 는 이 비트를 마선수로 잘못 읽은 것이었다(`SwingResultInput.isPitcherOwnPlayer` 와 같은 비트).
   */
  readonly isOwnPlayer?: boolean
  /** 손 `0xb63c0(투수)` — 0 우투 · 1 좌투 (`pitcherHandOf`). 타자 스킬 13·14 가 본다. 안 넘기면 0 */
  readonly hand?: number
  /** 마선수면 그 순번·레벨 — 보정 구조체에 구속·제구를 얹는다 (`quickSwingBoostOf`) */
  readonly ace?: QuickAceSlot
  /**
   * **체력%로 부른 경기 능력** `0xb570c(수비, k, 투수, 1, 체력% 0xaebb0, 1)` — 피로 0xb58e6 을 먹은 제구·구속.
   * 위 `control`·`velocity` 는 체력 인자 90(피로 없음)으로 부른 값이다. 0xc11f0·0xc1818 은 두 값을 갈라 쓴다:
   * - 체력% — 구위 등급(c1430~c1448) · 스트라이크존 기준(c1852·c1878) · 0xab214 투수 쪽(ab548, [sp+0x20] = 체력%)
   * - 90 — 스윙 앞 두 겨루기(c12f8·c135a) · 헛스윙 세 번째 겨루기(c1764)
   * 안 넘기면 90 값 그대로다(피로 없음 — 체력%를 모르는 부르는 쪽). 반 이닝 엔진은 공마다 채운다.
   */
  readonly tired?: PitcherStats
}

/** 타석 동안 바뀌지 않는 상황 */
export interface QuickAtBatSituation {
  /** 1부터. 11회부터 연장 보정이 붙는다 (원본 이닝은 0-기준이라 `이닝 > 9`) */
  readonly inning: number
  /**
   * 0xab214 가 읽는 전역 모드(0x1552d10) 묶음 — 팀 조작 보정(0xab5c0~0xab5fc)과 내 선수 보너스 갈래가 본다.
   * 간이 타석도 같은 0xab214 라 모드를 그대로 받는다(0xc11f0 은 모드를 넘기지 않고 0xab214 가 전역을 읽는다).
   * 안 넘기면 '일반'.
   */
  readonly mode?: SwingMode
  /** 공격 팀을 사람이 조작하는가 (state[0x31 + state[9]] == 0) — 모드 6 의 +100. 안 넘기면 거짓 */
  readonly isOffenseHuman?: boolean
  /**
   * 수비 팀을 사람이 조작하는가 (state[0x31 + state[0xa]] == 0) — 모드 3·4 밖이면 hit·power 쪽 −10.
   * 자동진행으로 넘긴 상대 타석이어도 사람 팀이 수비면 참이다. 안 넘기면 거짓(CPU 끼리 경기)
   */
  readonly isDefenseHuman?: boolean
  /**
   * 0xab214 스킬 상황 칸 중 타석 동안 바뀌지 않는 것 — 공격 팀이 지고 있나(0xab966 `0xb69b0(수비) > 0xb69b0(공격)`, 스킬 10) ·
   * 이 타순 칸의 오늘 타석 결과 링(팀 객체 + 타순×0x18 + 0x34, 오래된 차례 — 스킬 16·17). 안 넘기면 거짓 · 빈 링
   */
  readonly isLosing?: boolean
  readonly recentAtBatCodes?: readonly number[]
  /** 나리 연차 idx — 0xab214 의 내 선수 보너스를 깎는다 (`SwingResultInput.careerYearIndex`). 안 넘기면 0 */
  readonly careerYearIndex?: number
}

/** 타석 하나의 결과와, 기록달성 판정에 쓰는 투구 내역 */
export interface QuickAtBatPlay {
  readonly outcome: AtBatOutcome
  /** 이 타석에서 던진 공 수 — 삼구 삼진(16) 판정에 쓴다 */
  readonly pitches: number
  /** 끝났을 때의 볼 카운트 — 풀카운트 삼진(17) 판정에 쓴다 */
  readonly balls: number
  readonly strikes: number
  /**
   * 이 타석에 파울(스윙 코드 9)이 한 번이라도 났나 — 0xc11f0 c1662 가 sim+0xc4(중계 글 코드)를 13 "파울" 로 적고, 코드 0 뜬공 아웃
   * (c1642)은 이 칸을 안 고쳐 남는다. 0x21 중계 글(0xc25e4)이 이 값을 본다. 난수와 상관없다.
   */
  readonly fouled?: true
  /**
   * 헛스윙 세 번째 스트라이크 겨루기(c1748)에서 타자가 이겨 **삼진이 아닌 아웃**이 됐다 — 결과는 `'아웃'` 이지만
   * 중계 글 코드 sim+0xc4 는 5 "삼진 아웃" 이다(c17d8). 난수와 상관없다.
   */
  readonly swingingStrikeOutLost?: true
}

/** 투구 판정 결과 (0x9d57c 가 돌려주는 코드 1·2·3·4·5) */
export type PitchJudgement = '스트라이크' | '볼' | '포볼' | '삼진'

/** 투구 하나가 지나는 자리에 부르는 갈고리 */
export interface QuickAtBatHooks {
  /**
   * 투구 판정 경로(0xc1818)가 볼·스트라이크를 가른 **바로 뒤**.
   * 원본은 이 자리에서만 **도루**를 굴린다 (E-defense-rules E-5) — 스윙 경로(0xc11f0)에는 없다.
   * 안 넘기면 아무 일도 하지 않으므로 난수 순서도 그대로다.
   */
  readonly onPitchJudged?: (judgement: PitchJudgement) => void
  /**
   * 공 하나를 던지기 **바로 앞** — 0xc262c 는 공마다 스태미나 소모 `0xa5e14`(c26c8)를 먼저 부르고 나서 경로 굴림
   * `rand(0,100)`(c26d4)과 투구(0xc11f0 / 0xc1818)로 간다. 돌려준 투수가 이 공의 투수다(소모가 반영된 체력%).
   * 안 넘기면 받은 `startingPitcher` 를 그대로 쓴다. 난수를 쓰지 않는다.
   */
  readonly beforePitch?: () => QuickAtBatPitcher
  /**
   * 이 공을 던질 때의 루 — 0xab214 가 주자 목록(sim+0x80)으로 주자 수(스킬 12·37)·2루 주자(스킬 33)를 본다. 도루로 타석 중에도
   * 바뀌므로 공마다 묻는다. 안 넘기면 빈 루다. 난수를 쓰지 않는다.
   */
  readonly basesAtPitch?: () => BaseState
  /**
   * 스윙 경로(0xc11f0)로 간 공 — 그 길은 늘 0xab214 에 닿고 0xab214 는 ab4c0~ab4d8 에서 **공격 팀 레코드**로 0xb570c 를 부른다
   * (c1428 → c14e4 사이 빠지는 갈래 없음 · ab214 머리 → ab4b4 사이 pop 없음, r104 직접 뜸). 난수를 쓰지 않는다
   */
  readonly onSwingPath?: () => void
}
