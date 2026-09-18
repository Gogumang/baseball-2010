import { swingResultOf } from '@/entities/batting/model/swingResult'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import { timingOf } from '@/entities/batting/model/swingTiming'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { drawPattern, outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 스윙 입력 — 원본 컨트롤러 0x53670 */
export interface BattingSwing {
  /** 키를 누른 순간의 공 프레임 F */
  readonly frame: number
  /** 타자 좌우 이동 fe4 (−9~9, 3 단위) */
  readonly shift: number
  /** 0 스윙 · 1~3 번트 종류 */
  readonly buntKind: number
}

export interface BattingContext {
  readonly batter: BatterAbility
  /** 투구 엔진 눈금 0~100 */
  readonly pitcher: PitcherAbility
  readonly mode: SwingMode
  readonly batterSkillIds: readonly number[]
  readonly situation: SwingSituation
  /** 마선수가 던지고 있는가 — 원본 isAce (0xb6388). 팀 레벨은 아직 없어 0(보너스 최대)으로 둔다 (추정) */
  readonly isPitcherAce?: boolean
}

export interface PitchOutcomeDetail {
  readonly resolution: PitchResolution
  /** 배트를 냈는가 (번트 포함). 미션 스윙 수 제한에 쓴다 */
  readonly hasSwung: boolean
  /** 번트 성공 타구인지. 미션 목표 판정에 쓴다 */
  readonly isBunt: boolean
  /** 방향까지 붙인 원본 결과 코드. 스윙하지 않았으면 null */
  readonly resultCode: number | null
}

/** 존 좌표 1.0 이 원본 픽셀 몇 개인가 — 33px 존의 절반 (stageLayout 과 같은 값) */
const ZONE_HALF_PIXELS = 16.5
const PITCHER_ORIGINAL_SCALE = 10
const SPECIAL_PITCH = 'SPECIAL'

/** 판정 기준점 (표 0xcfb54) — side 0 · 1 */
const SWEET_SPOTS = [
  { x: 242, y: 326 },
  { x: 237, y: 326 },
]

/**
 * 도착점 − 기준점(0xcfb54) + 좌우 이동 (0x51226). 원본 궤적이 있으면 마지막 점을 투영한 판정 좌표(0x4dff8)를 쓴다.
 * 궤적이 없는 사용자 투구는 웹 존 가운데(0,0)를 기준점으로 보고 존 좌표를 픽셀로 옮긴다 (추정).
 */
export function plateErrorOf(pitch: Pitch, shift: number): { horizontal: number; vertical: number } {
  const path = pitch.worldPath
  if (path !== null && path.length > 0) {
    const plate = projectToPlate(path[path.length - 1], pitch.stageSide)
    const sweet = SWEET_SPOTS[pitch.stageSide] ?? SWEET_SPOTS[0]
    return { horizontal: plate.x - sweet.x + shift, vertical: plate.y - sweet.y }
  }
  return {
    horizontal: Math.round(pitch.plate.x * ZONE_HALF_PIXELS) + shift,
    vertical: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
  }
}


/**
 * 투구 하나를 끝까지 처리한다: 스윙 결과(0xab214) → 방향(0x5141c) → 원본 타구 패턴 → 안타·아웃(대체 근사, 추정).
 * 패턴 덱은 섞인 순서를 이어 쓰므로 새 덱을 함께 돌려준다.
 */
export function resolvePitch(
  pitch: Pitch,
  swing: BattingSwing | null,
  context: BattingContext,
  deck: PatternDeck,
  random: RandomPort,
): { readonly detail: PitchOutcomeDetail; readonly deck: PatternDeck } {
  if (swing === null) {
    const resolution: PitchResolution = isInsideStrikeZone(pitch.plate)
      ? { kind: '스트라이크', isSwinging: false }
      : { kind: '볼' }
    return { detail: { resolution, hasSwung: false, isBunt: false, resultCode: null }, deck }
  }

  const error = plateErrorOf(pitch, swing.shift)
  const result = swingResultOf(
    {
      horizontalError: error.horizontal,
      verticalError: error.vertical,
      timing: timingOf(swing.frame, pitch.frameCount, pitch.type === SPECIAL_PITCH),
      buntKind: swing.buntKind,
      controlTier: pitch.controlTier,
      batter: context.batter,
      pitcher: {
        control: context.pitcher.control * PITCHER_ORIGINAL_SCALE,
        velocity: context.pitcher.velocity * PITCHER_ORIGINAL_SCALE,
      },
      mode: context.mode,
      isPitcherAce: context.isPitcherAce,
      isPitcherExhausted: false,
      batterSkillIds: context.batterSkillIds,
      pitcherSkillIds: [],
      situation: context.situation,
    },
    random,
  )
  if (result.kind === '헛스윙') {
    const resolution: PitchResolution = { kind: '스트라이크', isSwinging: true }
    return { detail: { resolution, hasSwung: true, isBunt: false, resultCode: null }, deck }
  }

  const direction = hitDirectionOf(
    { code: result.code, frame: swing.frame, frameCount: pitch.frameCount, batterSide: context.situation.batterSide },
    random,
  )
  const code = result.code + direction
  const drawn = drawPattern(deck, code, random)
  const batted = outcomeOfPattern(code, drawn.pattern, random)
  const detail: PitchOutcomeDetail =
    batted.kind === '파울'
      ? { resolution: { kind: '파울' }, hasSwung: true, isBunt: false, resultCode: code }
      : { resolution: { kind: '타구', outcome: batted.outcome }, hasSwung: true, isBunt: batted.isBunt, resultCode: code }
  return { detail, deck: drawn.deck }
}
