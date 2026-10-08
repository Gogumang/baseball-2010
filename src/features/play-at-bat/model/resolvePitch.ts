import { swingResultOf } from '@/entities/batting/model/swingResult'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'
import { timingOf } from '@/entities/batting/model/swingTiming'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { contactOfPattern, drawPattern, launchPatternOf } from '@/entities/batting/model/battedBallOutcome'
import { provisionalOutcomeOf, registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
import { contactSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import { cpuPitchStatsOf } from '@/entities/pitching/model/pitcherGameStats'
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
  /**
   * 필살타법 스윙인가 — 스윙 객체 `S+0x10`(필살 번호) ≠ 0 (0x51e40). '0' 키(메시지 0x6a6)는 일반 스윙
   * (0x6a5 → 0x51db6)과 똑같이 **그 틱에 스윙을 예약**하고 S+0x10 만 다르게 쓴다 — 따로 거는 단계는 없다.
   * 헛스윙 바람 소리를 8 대신 27 로 바꾸고 (0x51350), 맞으면 성공 굴림 0x34c74 를 한다. 안 넘기면 보통 스윙이다.
   */
  readonly isSpecial?: boolean
}

export interface BattingContext {
  readonly batter: BatterAbility
  /** 투구 엔진 눈금 0~100 */
  readonly pitcher: PitcherAbility
  readonly mode: SwingMode
  readonly batterSkillIds: readonly number[]
  readonly situation: SwingSituation
  /**
   * 타자·투수가 **육성·명전 선수**(rec[0xa] 비트7, `0xb6389`)인가 — 나리(모드 3·4)의 내 선수 보너스와 계수,
   * 투수 미션(모드 5)의 +100 을 켠다. 마선수(비트6)는 해당하지 않는다. 안 넘기면 거짓.
   */
  readonly isBatterOwnPlayer?: boolean
  readonly isPitcherOwnPlayer?: boolean
  /** 나리 연차 idx (0 = 1년차, 저장 레코드 +0xb3) — 내 선수 보너스를 깎는다. 안 넘기면 0 = 보너스 최대 */
  readonly careerYearIndex?: number
  /**
   * 이번 스윙·공의 **보정 구조체 0x34d6c** (필살타법 = 타자 쪽, 공에 실린 마구 = 투수 쪽).
   * 원본은 판정 바로 앞(0x51294)에서 매번 만든다 — 타석 화면이 `swingBoostOf` 로 채운다. 안 넘기면 0.
   */
  readonly swingBoost?: SwingBoost
  /**
   * 필살 성공 굴림(0x34c74)이 볼 값 — 고른 번호(+0x18)와 마타자 여부. `swing.isSpecial` 일 때만 쓴다.
   * 안 넘기면 번호 0 으로 보아 확률 0 (굴리지 않는다).
   */
  readonly specialSwing?: { readonly number: number; readonly isAceBatter: boolean }
}

export interface PitchOutcomeDetail {
  readonly resolution: PitchResolution
  /** 배트를 냈는가 (번트 포함). 미션 스윙 수 제한에 쓴다 */
  readonly hasSwung: boolean
  /** 번트 성공 타구인지. 미션 목표 판정에 쓴다 */
  readonly isBunt: boolean
  /** 방향까지 붙인 원본 결과 코드. 스윙하지 않았으면 null */
  readonly resultCode: number | null
  /**
   * 이 타구가 덱에서 **실제로 뽑은 원본 패턴** [각, 세기, 높이, 플래그] (0x51408 이 각·속도·높이를 꺼내는 그 한 장).
   * 맞은 공(파울 포함)에만 있다. 홈런더비는 이 패턴으로 비거리(0xa600c)와 이벤트 존 플래그(0xb07c8 = flags & 2)를 본다.
   */
  readonly pattern?: BattedBallPattern
  /**
   * **판을 돌 파울 각 공** — 쏜 패턴 · 결과 코드 · 필살 스윙 재료(`BattedContact`). 파울(`resolution.kind === '파울'`)에만 있다.
   * 원본은 맞은 공이면 파울 각이라도 판(상태 0x17)을 돌아 낙구 · 담장선 틱에 0x9d5bc 가 7 을 내야 파울이고, 그 전에 잡히면
   * 뜬공 아웃(13)이다. 받는 쪽이 이것으로 수비 판을 돌리고(필살타법 성공 굴림 0x517e6 도 판 시작이 한다), 판이 파울로 닫히면
   * 그제야 스트라이크를 올린다(0x35108 → 0xb6b58). CPU 타자의 `CpuPitchOutcome.foulContact` 와 같은 칸이다.
   */
  readonly foulContact?: BattedContact
  /**
   * **타구 순간에 울릴 소리 번호** (`atBatSounds.contactSoundIdOf`). 울릴 것이 없으면 null.
   *
   * 여기서 정해 실어 보내는 이유: 번호를 고르는 데 **방금 뽑은 타구 패턴**(각·세기·높이)이
   * 필요한데 그 패턴을 밖으로 내보내지 않기 때문이다. 심판 콜은 볼카운트를 알아야 해서
   * 받는 쪽(`app/model`)이 `pitchCallSoundIdOf` 로 따로 고른다.
   */
  readonly contactSoundId?: number | null
  /**
   * 이 공의 **구질 번호** 1~22 (`game+0xfc8`). 원본은 공이 손을 떠날 때(0x3de10 의 0x3dec6)
   * `0xa5e14(ctx, 구질)` 로 상대 투수 투구 수·스태미나를 깎는다 — 받는 쪽이 그 일을 하라고 싣는다.
   * 타석 화면(`BattingStage`)이 CPU 공에 채운다. 견제는 공이 아니라 여기 오지 않는다.
   */
  readonly pitchTypeNumber?: number
}

/** 존 좌표 1.0 이 원본 픽셀 몇 개인가 — 33px 존의 절반 (stageLayout 과 같은 값) */
const ZONE_HALF_PIXELS = 16.5

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
 * 사구 사각형 — 표 `0xcfd50` = (x 171, y 240, 폭 38, 높이 130). 판정 좌표계(카메라 오프셋 없음, `projectToPlate`)다.
 * 우타자(side 0) 몸 자리다 — 타자 앵커 x 184(표 0xcfb2c)가 이 안에 든다.
 */
export const HIT_BY_PITCH_BOX = { x: 171, y: 240, width: 38, height: 130 } as const
/** 좌타 뒤집기 기준 폭 — `0x35a7a~0x35a84`: x ← 480 − x − w (월드 폭 480) */
const HIT_BY_PITCH_MIRROR_WIDTH = 480
const LEFT_HANDED_BATTER = 1

/**
 * **몸에 맞는 공 판정 `0x35a20`** — 상태 0x12 진입(공 도착 판정) `0x3dfac` 가 맨 먼저 부르고(0x3dfc4)
 * 결과를 state[0x12] 에 넣는다(0x3dfc8). 투구 판정 `0x9d57c` 는 이 칸을 **볼·스트라이크보다 먼저** 본다.
 *
 * ```
 * 35a2c: 스윙 객체([scene+0xf9c])+0xd ≠ 0  또는  state[0x10] ≠ 0  → 0     ; 스윙(번트 포함)했으면 사구 없음
 * 35a40: 상자 = 표 0xcfd50 (x, y, w, h)
 * 35a6c: 0xb63c0(현재 타자) 참(좌타)이면 x ← 480 − x − w
 * 35a86: (px, py) = (scene+0x10dc, scene+0x10e0)                            ; 공 도착 판정 좌표
 * 35aaa: x ≤ px ≤ x+w  그리고  y ≤ py ≤ y+h  → 1                           ; 경계 포함
 * ```
 * 판정 좌표는 공 도착점이다 — 웹은 `plateErrorOf` 와 같은 자리(궤적 마지막 점을 `projectToPlate`)를 쓴다.
 * 난수를 쓰지 않는다.
 * 궤적이 없는 투구(`worldPath === null`)는 판정 좌표가 없어 사구를 내지 않는다 — 지금 타석 화면의
 * CPU 투구는 늘 궤적이 있다.
 */
export function isHitByPitch(pitch: Pitch, batterSide: number): boolean {
  const path = pitch.worldPath
  if (path === null || path.length === 0) return false
  const point = projectToPlate(path[path.length - 1], pitch.stageSide)
  const box = HIT_BY_PITCH_BOX
  const left = batterSide === LEFT_HANDED_BATTER ? HIT_BY_PITCH_MIRROR_WIDTH - box.x - box.width : box.x
  return point.x >= left && point.x <= left + box.width && point.y >= box.y && point.y <= box.y + box.height
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
): {
  readonly detail: PitchOutcomeDetail
  readonly deck: PatternDeck
  /**
   * 필살타법이 성공한 타구인가 — 0x517e6 `p·10 > rand(0,1000)` 이 참이면 0xaf180(…, 4, 0, −1) 이 공 속성 4(필살타법 표시 — 송구 공과 무관, 포구 틱 b4246 이 보고 0xbc3)를 단다
   * (야수가 쥐지 않고 지나친다, `features/defense-play` 의 `isUncatchable`).
   */
  readonly isUncatchable: boolean
} {
  if (swing === null) {
    // 사구가 볼·스트라이크보다 먼저다 (0x9d57c 첫머리 0x9d582 — state[0x12] 면 곧장 4)
    if (isHitByPitch(pitch, context.situation.batterSide)) {
      return {
        detail: { resolution: { kind: '사구' }, hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null },
        deck,
        isUncatchable: false,
      }
    }
    const resolution: PitchResolution = isInsideStrikeZone(pitch.plate)
      ? { kind: '스트라이크', isSwinging: false }
      : { kind: '볼' }
    return {
      detail: { resolution, hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null },
      deck,
      isUncatchable: false,
    }
  }

  const error = plateErrorOf(pitch, swing.shift)
  // 투수 체력%는 공에 실린 **깎은 뒤** 값이다 — 원본은 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)에서 이미 깎았다
  const pitcherStats = cpuPitchStatsOf(
    pitch.pitcherStaminaPercent === undefined
      ? context.pitcher
      : { ...context.pitcher, staminaPercent: pitch.pitcherStaminaPercent },
  )
  const result = swingResultOf(
    {
      horizontalError: error.horizontal,
      verticalError: error.vertical,
      timing: timingOf(swing.frame, pitch.frameCount, pitch.isMagicPitch === true),
      buntKind: swing.buntKind,
      controlTier: pitch.controlTier,
      batter: context.batter,
      // ab548(구속 k=1)·ab582(제구 k=0) 가 0xb570c 를 스택 인자 [sp+0xc8] = 투수 체력%로 부른다 (P7 G1) —
      // 투구 AI 와 같은 피로·팀·코치 차례다. 원본 재료(`gameAbility`)가 없으면 옛 경계(×10, 피로 없음) 그대로
      pitcher: { control: pitcherStats.control, velocity: pitcherStats.velocity },
      mode: context.mode,
      isBatterOwnPlayer: context.isBatterOwnPlayer,
      isPitcherOwnPlayer: context.isPitcherOwnPlayer,
      careerYearIndex: context.careerYearIndex,
      // 이 판정은 사람이 치는 타석이다 — 공격 팀 사람, 수비 팀 CPU (0xb6c20)
      isOffenseHuman: true,
      isDefenseHuman: false,
      boost: context.swingBoost,
      // ab838 `[sp+0xc8] == 0` 이면 B·C 에 2000 (같은 체력% 인자)
      isPitcherExhausted: !pitcherStats.isNotExhausted,
      batterSkillIds: context.batterSkillIds,
      pitcherSkillIds: [],
      situation: context.situation,
    },
    random,
  )
  if (result.kind === '헛스윙') {
    const resolution: PitchResolution = { kind: '스트라이크', isSwinging: true }
    // 헛스윙 바람 소리 8 / 필살 스윙 27 (0x51350)
    const contactSoundId = contactSoundIdOf({
      hasSwung: true,
      hasHit: false,
      buntKind: swing.buntKind,
      isSpecialSwing: swing.isSpecial === true,
      resultCode: null,
      pattern: null,
    })
    // 헛스윙(경기+0xfd2 == 0)은 0x5135c 에서 0x51840 으로 건너뛰어 필살 굴림이 없다
    return { detail: { resolution, hasSwung: true, isBunt: false, resultCode: null, contactSoundId }, deck, isUncatchable: false }
  }

  const direction = hitDirectionOf(
    { code: result.code, frame: swing.frame, frameCount: pitch.frameCount, batterSide: context.situation.batterSide },
    random,
  )
  const code = result.code + direction
  // 0x51490 덱 꺼내기 → 0x514f2 코드 25·26 의 특수 타구 표 (rand(0,1000) ≤ 19 → rand(0,4))
  const drawn = drawPattern(deck, code, random)
  const pattern = launchPatternOf(code, drawn.pattern, random)
  // 파울 각(state[0x1c], 0x9d660)만 여기서 가른다 — 페어 각은 판이 결과를 낸다(`battedContact` 머리말).
  // 2스트라이크 번트 파울은 아웃이다 (0x9d5e2~0x9d600). `situation.strikes` 는 이 공을 먹이기 전의 카운트다
  const contact = contactOfPattern(code, pattern, {
    strikes: context.situation.strikes,
    buntKind: swing.buntKind,
  })
  // 필살 성공 굴림 0x34c74 → 0x517e6 — 맞은 공(0xfd2 ≠ 0)이면 어느 갈래든 0x517c8 로 모인다. 원본 차례는 메시지 0x11
  // (0x515c6 → 0x50faa: 필살수비 굴림 · 표시 패턴 · 쏘기의 폴 굴림) **뒤**라, 맞은 공은 모두(페어 타구 · 파울 각 공 · 2스트라이크
  // 번트 파울) 굴림 재료만 쏜 공에 실어 보내고 수비 판 시작(`startDefensePlay`)이 그 차례에 굴린다 — 여기서는 굴리지 않는다
  const specialSwing =
    swing.isSpecial === true
      ? { number: context.specialSwing?.number ?? 0, isAceBatter: context.specialSwing?.isAceBatter === true }
      : undefined
  // 타격음 7·9·5·59·6 — 쏜 패턴의 각·세기·높이로 고른다 (0x515de~0x5164a — 0x514f2 의 특수 표 덮어쓰기 뒤)
  const contactSoundId = contactSoundIdOf({
    hasSwung: true,
    hasHit: true,
    buntKind: swing.buntKind,
    resultCode: code,
    pattern,
  })
  // 2스트라이크 번트 파울(판정 11)도 파울 각 공이다 — 원본은 이 공도 판(상태 0x17)을 돌아 낙구 · 담장선 틱의 0x9d5bc 가
  // (state[4] > 1 && 번트) 로 11 을 낸다(9d5e2~9d600). 판 시작 · 판 끝은 부르는 쪽이 이 공 앞의 스트라이크 · 번트 종류를 실어 돌린다.
  // 낙구 전에 잡히면 다른 파울처럼 뜬공 아웃(13)이다
  const isFoulAngle = contact.kind === '파울' || contact.kind === '번트파울아웃'
  const detail: PitchOutcomeDetail = isFoulAngle
    ? {
        resolution: { kind: '파울' },
        hasSwung: true,
        isBunt: false,
        resultCode: code,
        pattern,
        // 파울 각이라도 판을 돈다 — 부르는 쪽이 이 쏜 공으로 판을 돌린다(필살타법 굴림까지 판 시작에 맡긴다)
        foulContact: { pattern, resultCode: code, ...(specialSwing === undefined ? {} : { specialSwing }) },
        contactSoundId,
      }
    : {
        // 페어 타구 — 결과는 수비 판이 낸다. 타석에 싣는 결과는 **타석을 끝내기 위한 임시 값**이고(`provisionalOutcomeOf`),
        // 쏜 패턴은 그 결과 객체에 묶어 둔다(`contactOfOutcome`) — 경기 진행기가 그 패턴으로 판을 돌린다
        resolution: {
          kind: '타구',
          outcome: registerContact(provisionalOutcomeOf(pattern), {
            pattern,
            resultCode: code,
            ...(specialSwing === undefined ? {} : { specialSwing }),
          }),
        },
        hasSwung: true,
        isBunt: contact.kind === '타구' && contact.isBunt,
        resultCode: code,
        pattern,
        contactSoundId,
      }
  return { detail, deck: drawn.deck, isUncatchable: false }
}

