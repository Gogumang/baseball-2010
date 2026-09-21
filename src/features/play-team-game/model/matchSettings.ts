import type { BaseState } from '@/entities/game/model/baseState'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'

/**
 * **경기진행 설정** (J-3 · R4 4절, 저장 형식·경기 루프 판정 확정).
 *
 * 원본은 이 설정을 보고 **타석마다** "지금 장면을 사람이 조작하나" 를 정한다
 * (`0xc1e04`, 결과 [sp+0xc]: 0 = 사람이 조작 · 1 = 자동 진행).
 *
 * 저장 칸 (모드 칸 m = 일반 0 · 시즌 1 · 대전 2 — 모드마다 따로 저장한다):
 * ```
 * +0x12c+m  (s8)  종류 0 찬스 · 1 이닝 · 2 상세
 * +0x146+m  (s8)  찬스/이닝 선택값
 * +0x120+2m (u16) 상세 타자조작 — 타순 비트 0..8
 * +0x124+2m (u16) 상세 투수조작 — 이닝 비트 (칸 8 = 9회 이후 전부, 연장 포함)
 * +0x128+m  (u8)  상세 공격주자 — 베이스 비트 0·1·2 = 1·2·3루
 * +0x12a+m  (u8)  상세 수비주자 — 베이스 비트
 * ```
 */

export const MATCH_SETTING_KIND = { 찬스: 0, 이닝: 1, 상세: 2 } as const

/** 찬스 값 — 0 = 사람이 공격 중 2·3루 · 1 = 사람이 수비 중 3루 (V5 정정) */
export const CHANCE_VALUE = { 공격득점권: 0, 수비삼루: 1 } as const

/** 이닝 값 — 0 전체 · 1 "3이닝 자동진행"(4회부터) · 2 "6이닝 자동진행"(7회부터) */
export const INNING_VALUE = { 전체: 0, 넷째이닝부터: 1, 일곱째이닝부터: 2 } as const

export interface MatchProgressSettings {
  /** +0x12c+m */
  readonly kind: number
  /** +0x146+m */
  readonly value: number
  /** +0x120+2m — 비트 0~8 = 타순 1~9번 */
  readonly battingOrderBits: number
  /** +0x124+2m — 비트 0~7 = 1~8회, 비트 8 = 9회 이후 전부 */
  readonly pitchingInningBits: number
  /** +0x128+m — 비트 0·1·2 = 1·2·3루 */
  readonly offenseRunnerBits: number
  /** +0x12a+m — 비트 0·1·2 = 1·2·3루 */
  readonly defenseRunnerBits: number
}

/**
 * 웹판 기본 설정 — "모든 이닝을 직접 플레이"(이닝 값 0).
 * 원본 저장은 0 으로 초기화되므로 종류 0(찬스)·값 0 이 진짜 기본이지만,
 * 그러면 득점권 타석만 조작하게 되어 화면을 처음 열었을 때 할 일이 없다.
 * 설정 화면을 아직 안 옮겨서 **고를 길이 없으므로** 전부 조작하는 쪽을 기본으로 둔다 (웹판 판단).
 */
export const FULL_PLAY_SETTINGS: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.이닝,
  value: INNING_VALUE.전체,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

/** 베이스 비트 (0·1·2 = 1·2·3루) 에 주자가 있는가 */
function hasRunnerOnBits(bases: BaseState, bits: number): boolean {
  if ((bits & 0b001) !== 0 && bases.first) return true
  if ((bits & 0b010) !== 0 && bases.second) return true
  if ((bits & 0b100) !== 0 && bases.third) return true
  return false
}

/** 찬스 마스크 — 값 0 은 6(2·3루), 값 ≠0 은 4(3루) (c1f8a `movs r6,#6` · c1fe2 `movs r6,#4`) */
const CHANCE_MASK = { 공격득점권: 0b110, 수비삼루: 0b100 } as const

export interface MatchControlContext {
  /** 원본 게임 모드 (1 일반 · 2 시즌 · 8·9 대전) */
  readonly mode: number
  /** 사람이 **공격 팀**을 조작하는가 — 상태 `+0x31 + [상태+9] == 0` */
  readonly humanControlsOffense: boolean
  /** 사람이 **수비 팀**을 조작하는가 — 상태 `+0x31 + [상태+0xa] == 0` */
  readonly humanControlsDefense: boolean
  readonly bases: BaseState
  /** **0-기준** 이닝 (상태 +0x6b). 1회면 0 이다 */
  readonly inningIndex: number
  /** 지금 타석에 선 타자의 타순 칸 0~8 (0xae85d). 9 이상이면 타순 비트를 보지 않는다 */
  readonly battingOrderIndex: number
}

/**
 * 지금 타석을 **사람이 조작하는가** (`0xc1e04`).
 *
 * 이 설정 분기는 점프표 `0xd90c0` 의 **상황 0·1·7·8** 에서만 탄다.
 * 상황 = `[상태+1] − 1` 이고 `[상태+1]` 은 경기 장면이 들고 있는 **게임 모드**다
 * (R10 이 `st[1] ∈ {5,6}` 을 모드 검사로 쓴다) → 상황 0·1·7·8 = **모드 1·2·8·9**,
 * 곧 J-4 의 팀 능력치 마스크 0x306 과 같은 네 모드다 (**추정** — 점프표 칸 이름은 문서에 없다).
 * 상황 7·8(대전)만 `이닝idx ≤ 5` 조건이 따로 붙는데, 대전 자동진행이 6회까지만인 것과 맞는다.
 */
export function isHumanControlled(
  settings: MatchProgressSettings,
  context: MatchControlContext,
): boolean {
  const { mode } = context
  // 모드 3~7(나리·미션·홈런더비)은 이 분기를 타지 않는다 — 늘 사람이 친다
  if (mode !== TEAM_GAME_MODE.일반 && mode !== TEAM_GAME_MODE.시즌 && !isVersusMode(mode)) {
    return true
  }
  // ⚠️ 대전(8·9)은 이닝idx ≤ 5 일 때만 설정을 본다. 그 밖에서 무엇을 하는지는 문서에 없어
  //    **사람 조작**으로 둔다 (자동진행이 6회까지만인 것과 맞춘 **추정**).
  if (isVersusMode(mode) && context.inningIndex > 5) return true

  switch (settings.kind) {
    case MATCH_SETTING_KIND.찬스:
      return isChancePlay(settings, context)
    case MATCH_SETTING_KIND.이닝:
      return isInningPlay(settings, context)
    case MATCH_SETTING_KIND.상세:
      return isDetailPlay(settings, context)
    default:
      // 그 밖은 자동 진행
      return false
  }
}

function isVersusMode(mode: number): boolean {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
}

/**
 * 찬스 (c1f52~c2014).
 * - 값 0: **사람이 공격 중**이고 2루 또는 3루에 주자 (득점 찬스)
 * - 값 ≠0: **사람이 수비 중**이고 3루에 주자 (실점 위기)
 * 보는 쪽(공격/수비)이 값마다 다르다는 것은 V5 검증이 찾아낸 정정이다.
 */
function isChancePlay(settings: MatchProgressSettings, context: MatchControlContext): boolean {
  if (settings.value === CHANCE_VALUE.공격득점권) {
    if (!context.humanControlsOffense) return false
    return hasRunnerOnBits(context.bases, CHANCE_MASK.공격득점권)
  }
  if (!context.humanControlsDefense) return false
  return hasRunnerOnBits(context.bases, CHANCE_MASK.수비삼루)
}

/** 이닝 (c2016~c2046) — 값 0 늘 · 1 이닝idx > 2(4회~) · 2 이닝idx > 5(7회~) */
function isInningPlay(settings: MatchProgressSettings, context: MatchControlContext): boolean {
  if (settings.value === INNING_VALUE.전체) return true
  if (settings.value === INNING_VALUE.넷째이닝부터) return context.inningIndex > 2
  if (settings.value === INNING_VALUE.일곱째이닝부터) return context.inningIndex > 5
  return false
}

/** 투수조작 비트 8 = **9회 이후 전부**(연장 포함) — c2162~c2176 (R4 가 "연장(유력)" 을 확정으로 올렸다) */
const EXTRA_INNING_BIT = 8

/**
 * 상세 (c2050~c2176).
 * 공격 가지(사람이 공격 팀일 때)와 수비 가지가 갈린다 — 분기 조건은 찬스와 같은 `+0x31+[+9]` 다.
 */
function isDetailPlay(settings: MatchProgressSettings, context: MatchControlContext): boolean {
  if (context.humanControlsOffense) {
    const slot = context.battingOrderIndex
    if (slot <= 8 && ((settings.battingOrderBits >> slot) & 1) !== 0) return true
    return hasRunnerOnBits(context.bases, settings.offenseRunnerBits)
  }
  const inning = context.inningIndex
  if (inning <= 8 && ((settings.pitchingInningBits >> inning) & 1) !== 0) return true
  if (inning > 8 && ((settings.pitchingInningBits >> EXTRA_INNING_BIT) & 1) !== 0) return true
  return hasRunnerOnBits(context.bases, settings.defenseRunnerBits)
}

/** 상세는 최소 한 항목을 골라야 한다 — StrMAINMENU[126] (0x60240) */
export function hasAnyDetailSelection(settings: MatchProgressSettings): boolean {
  return (
    settings.battingOrderBits !== 0 ||
    settings.pitchingInningBits !== 0 ||
    settings.offenseRunnerBits !== 0 ||
    settings.defenseRunnerBits !== 0
  )
}
