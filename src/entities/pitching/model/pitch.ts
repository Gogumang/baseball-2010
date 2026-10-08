import type { Coordinate } from '@/shared/lib/geometry/coordinate'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { PitcherGameAbilityParts } from '@/entities/pitching/model/pitcherGameStats'

/**
 * 구질 이름. 원작 21종의 이름을 그대로 쓴다 (FASTBALL·SLIDER·CURVE…).
 * 이름·변화량·비행 프레임은 전부 shared/config/original/pitchTypes.ts 에 있다.
 */
export type PitchType = string

export interface Pitch {
  readonly type: PitchType
  /** 홈플레이트 통과 지점 (존 좌표). 타자가 맞혀야 하는 실제 코스다. */
  readonly plate: Coordinate
  /**
   * 변화량. 궤적 초반에는 plate에서 이 값을 뺀 지점을 향하다가
   * 도착 직전에 plate로 휜다. 직구는 (0, 0)이다.
   */
  readonly breakOffset: Coordinate
  /** 릴리스 → 홈플레이트 도달 시간. = frameCount × 한 틱 */
  readonly flightDurationMilliseconds: number
  /** 공이 나는 틱 수 N — 한 틱에 곡선 점 하나씩 (원본 투구 레코드 frames) */
  readonly frameCount: number
  /** 제구 등급 (0xb74bc). 판정 배율을 정한다. 사용자 투구처럼 등급이 없으면 −1 */
  readonly controlTier: number
  /**
   * 원본 3D 궤적 N 점 (월드 좌표, 0x4dc78). 마지막 점이 도착점이다.
   * 사용자 투구(투수편)는 아직 원본 입력을 옮기지 않아 null — 화면은 2D 추정 곡선으로 그린다.
   */
  readonly worldPath: readonly WorldPoint[] | null
  /** 화면 배치 side — 투영 원점(0xcfb18)과 기준점(0xcfb54)을 고른다 */
  readonly stageSide: number
  /**
   * 이번 공에 실린 마구 번호 = 공 객체 +0x10 (0x3de10). 0 이면 마구 보정이 없다.
   * ⚠️ 원본이 이 칸을 되돌리지 않아서, 마구 뒤의 직구·변화구에도 값이 남는다 (H2 3-4).
   * 아직 안 옮긴 곳(사용자 투구)은 없는 값이라 `?? 0` 으로 읽는다.
   */
  readonly magicNumber?: number
  /**
   * ball.pzx 공 그림 종류 = 경기+0x1080 — 0 보통 · 1 불꽃 · 2 날개. **던질 때 정해지는 값**(0x46fa8, 마구 8·9)만 담는다.
   * 0x1080 은 날아가는 도중 0x3b55e 도 1 로 쓴다(마구 1 · 폼 묶음 0 인 마구 4, 경로 번호 8 부터) —
   * 그건 그릴 때 `magicBallKindAtPath` 로 덮는다 (`widgets/batting-stage/lib/trajectory.ts`).
   */
  readonly ballKind?: number
  /**
   * 이번 공의 **구질이 마구(22)인가** = 경기+0xfc8 == 0x16.
   * 원본 이펙트 세 곳이 전부 이 칸으로 열린다 — 공 이펙트 0x3b4e0 · 마선수 이펙트 0x46fc0 ·
   * 투수 이펙트 0x3919e. 공 객체 +0x10(`magicNumber`)은 한 번 실리면 안 지워져서(H2 3-4)
   * "이번 공이 마구인가" 를 못 말해 준다 — 그래서 칸을 따로 둔다.
   */
  readonly isMagicPitch?: boolean
  /**
   * 던진 **투수 레코드 +0x18** — 마구 번호(1~4) 또는 마선수 번호(5~9), 0 이면 없다.
   * 이펙트 고르기는 공 +0x10 이 아니라 **늘 이 칸**을 본다 (0x3b4dc `ldrb r2,[투수,#0x18]`).
   */
  readonly pitcherMagicNumber?: number
  /** 던진 투수 폼 = `rec[0xb] >> 4` (0xb6e24). 마구 4 는 `폼 >> 1 == 0` 일 때만 그림 이펙트를 쓴다 */
  readonly pitcherForm?: number
  /**
   * CPU 투수가 이 공을 던진 **뒤**의 체력% (`PitcherAbility.staminaPercentAfterPitch`) — 사람 스윙 판정 0xab214 가 수비 투수를
   * `0xb570c(…, 체력%)` 로 부르고(ab548 · ab582) ab838 이 0 이면 B · C 에 +2000 을 더한다. 원본은 공이 손을 떠나는 0x11 진입에서
   * 이미 깎았다. 없으면 타석 화면이 넘긴 `PitcherAbility.staminaPercent` 다.
   */
  readonly pitcherStaminaPercent?: number
}

/** 투수 레코드에서 온 폼·구질 (pitcherRepertoires) */
export interface PitcherRepertoireInfo {
  readonly form: number
  readonly pitchMask: number
  readonly magicId: number
}

export interface PitcherAbility {
  /** 제구 0~100. 낮을수록 의도한 코스에서 벗어난다. */
  readonly control: number
  /** 구속 0~100. 높을수록 비행 시간이 짧아진다. */
  readonly velocity: number
  /** 변화 0~100. 없으면 구속으로 대신한다 (추정) */
  readonly breaking?: number
  /** 없으면 기본 투수 레퍼토리 */
  readonly repertoire?: PitcherRepertoireInfo
  /**
   * 원본 눈금 경기용 능력치 재료 — `0xb570c` 를 피로(0xb58e6) 앞뒤로 쪼갠 값 (`pitcherGameStats`).
   * 있으면 CPU 투구(`selectPitch`)가 0~100 칸 대신 이것으로 제구 등급·구속 단계를 낸다.
   * 없으면 옛 경계(0~100 칸 × 10)다.
   */
  readonly gameAbility?: PitcherGameAbilityParts
  /**
   * 투수 체력% — `0xaebb0(팀)` = trunc(레코드 +0x2c / 100), 홈런더비(모드 7)는 100.
   * 피로 감소(0xb58e6)와 제구 등급의 지친 갈래(0xb74bc, 0 일 때)가 본다. 없으면 지치지 않은 것으로 본다.
   */
  readonly staminaPercent?: number
  /**
   * **이 구질을 던져 깎은 뒤의 체력%** — 구질 번호를 받아 `0xa5e14` 소모 뒤의 `0xaebb0` 를 돌려준다.
   * 원본은 구질을 고른 뒤(0xf · 0x10 의 0x344dc) 상태 0x11 **진입** 0x3de10 의 0x3dec6 에서 깎고, 놓기 0x4dc78(0x11 의 틱 10)의
   * 제구 등급 0x4dbac · 피로 능력치 0x34968, 사람 스윙 판정 0xab214(ab548 · ab582 · ab838)가 그 **깎은 뒤** 값을 본다.
   * 있으면 `selectPitch` 가 구질을 정한 뒤 이 값으로 피로·등급을 내고 공(`Pitch.pitcherStaminaPercent`)에 실어 스윙 판정까지 넘긴다.
   * 없으면 `staminaPercent` 그대로다(홈런더비 — 0xaebb0 이 늘 100 · 시험).
   */
  readonly staminaPercentAfterPitch?: (pitchTypeNumber: number) => number
}

export const DEFAULT_PITCHER_ABILITY: PitcherAbility = {
  control: 60,
  velocity: 60,
}
