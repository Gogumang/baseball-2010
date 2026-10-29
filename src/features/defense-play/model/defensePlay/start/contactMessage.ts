import { battedBallTrajectory, trajectoryWithRandom } from '@/entities/batting/model/battedBallFlight'
import { displayPatternOf, scenePatternDeckOf } from '@/entities/batting/model/battedBallOutcome'
import { type BattedContact, contactOfOutcome } from '@/entities/batting/model/battedContact'
import { earlyPassPatternOf } from '@/entities/batting/model/earlyPassBall'
import { rollSpecialSwing } from '@/entities/batting/model/specialSwing'
import { BATTER_CAREER_MODE, HOME_RUN_DERBY_MODE, SIXTH_SENSE_SKILL_ID } from '@/entities/defense-controls/model/laserThrow'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { rollSpecialDefense } from '@/entities/fielding/model/fieldingErrors'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import { DEFAULT_ABILITY, FULL_FORECAST_WINDOW } from '@/features/defense-play/model/defensePlay/constants'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * **메시지 0x11 의 굴림 묶음 결과** — 맞은 판정 틀(0x51408)이 0x13 을 세우기 전에 다 굴린 것 (A-37, r314):
 * ```
 * 515c0  0xbfbac(…, 0x11, 0, &+0xfcc) → 0x50faa
 * 50fe6 · 51012  필살수비 A(점프) · B(슬라이딩) 굴림
 * 5107c · 5112c  창이 열리면 표시 패턴(0xb097c · 0xb09ac rand)으로 +0xfcc 를 덮는다
 * 51188  판 공 [+0x204] 쏘기 — 세계 0xbfed0 의 폴 굴림 rand(−25, 25)
 * 5174c · 517ce  [+0xf2c] 공(+0xfcc + d) 쏘기 — 같은 폴 굴림
 * 517e6  필살타법 성공 0x34c74
 * ```
 * 그 뒤 0x13(0x3d720 → 경로 0x33e34 · 이른 넘김 0x406e8 · 각 0x406a4 · 카메라 3f23e)이 서므로 0x13 은 전부 **표시 패턴**을 본다.
 */
export interface ContactMessageRoll {
  /** 필살수비 창 — 점프(A) · 슬라이딩(B) */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 실제로 쏜 패턴 (+0xfcc — 창이 열리면 표시 패턴). 쏜 공이 없는 호출(시험 · 옛 길)은 없다 */
  readonly launchedPattern: BattedBallPattern | undefined
  /** 판 공 [+0x204] 의 궤적 — 쏜 패턴 · 폴 굴림까지 깐 것 */
  readonly trajectory: BattedBallTrajectory
  /** 폴 굴림으로 판 공 궤적을 다시 깔았는가 (예보를 다시 만든다) */
  readonly relaid: boolean
  /** 필살타법 성공 (0x517e6) — 결과를 넘겨받은 호출의 `isUncatchable` 은 따로 본다 */
  readonly uncatchable: boolean
}

/** 맞은 틀에 미리 굴린 묶음 — 쏜 공(`BattedContact`) 하나에 한 번. 판 시작이 되찾는다 */
export const CONTACT_MESSAGE_ROLLS = new WeakMap<object, ContactMessageRoll>()

/**
 * 메시지 0x11 굴림 묶음을 **판 입력으로** 굴린다 — 판 시작(`startDefensePlay`)과 맞은 틀(`preRollContactMessage`)이 같은 셈을 쓴다.
 * 난수를 안 준 입력(예측 · 시험)은 하나도 굴리지 않는다.
 */
export function rollContactMessage(input: DefensePlayInput): ContactMessageRoll {
  const specialDefense = rollSpecialDefenseAtContact(input)
  const swungContact = contactOfOutcome(input.outcome)
  const displayed = rollDisplayPattern(input, specialDefense, swungContact)
  // ── 쏘기 + 세계 0xbfed0 (메시지 0x11 의 51172~511a4) — 필살수비 굴림(50fe6 · 51012) 뒤다 ──
  // 궤적 계산 안의 굴림은 폴 충돌 0xa2c64 의 rand(−25, 25) 하나뿐이다. 부르는 쪽은 난수 없이 궤적을 깔아 넘기므로
  // 그 굴림이 있던 궤적이면 여기서 난수로 다시 깐다 (굴림이 없던 궤적은 그대로 — 난수를 안 쓴다).
  const trajectory = trajectoryWithRandom(displayed.trajectory, input.random)
  const relaid = trajectory !== displayed.trajectory
  rollEarlyPassBall(input, displayed.launchedPattern, swungContact)
  const uncatchable = rollUncatchableSwing(input, swungContact)
  return { specialDefense, launchedPattern: displayed.launchedPattern, trajectory, relaid, uncatchable }
}

/**
 * **필살수비 굴림** (메시지 0x11 = 타구가 떠난 순간, I-controls 2c) — A(점프, +0x1f5) 를 먼저 굴리고 실패했을 때만 B(슬라이딩, +0x1f6).
 * 창을 여는 것뿐이라 보통 포구가 낙구 전에 되면 쓰이지 않는다 (고르기 우선순위 4·5 — P2 3절).
 * 원본은 "이미 고른 추적야수" 의 칸으로 조건을 보므로 여기서도 예보를 한 번 돌린 뒤에 굴린다
 */
function rollSpecialDefenseAtContact(input: DefensePlayInput): ContactMessageRoll['specialDefense'] {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const fielders = createFielders(abilities, input.defenseTeamBonus ?? 0)
  const chase = { chaseToLanding: input.trajectory.landingChase === true }
  const forecast = forecastCatch(input.trajectory, fielders, FULL_FORECAST_WINDOW, chase)
  const chaserSlot = forecast.choice.slot
  return rollSpecialDefenseFor({
    random: input.random,
    ability: abilities[chaserSlot] ?? DEFAULT_ABILITY,
    skillIds: input.fielderSkillIds?.[chaserSlot],
    gameMode: input.gameMode,
    chaserSlot,
    buntKind: input.buntKind ?? 0,
  })
}

/**
 * **필살수비가 열리면 표시 패턴으로 바꿔 쏜다** — 5107c 점프 0xb097c(목록 비트 2) · 5112c 슬라이딩 0xb09ac(목록 비트 3).
 * 장면 덱(덱을 섞을 때 만든 두 목록)에서 rand(0, 개수) 로 한 장을 골라 쏠 패턴의 (a, b, c) 를 덮는다(`displayPatternOf`).
 * 바꿔 쏜 공의 각이 파울 각이면 511b8 state[0x1c] 도 그 각으로 선다(목록 B 에는 파울 각 패턴이 있다).
 * ⚠️ 쏜 공(`contactOfOutcome`)이나 장면 덱이 없는 호출(시험 · 결과를 넘겨받은 옛 길)은 바꿀 패턴을 몰라 그대로 쏜다(웹 전용).
 * 원본은 여기서 예보를 다시 만든다 — 굴림이 없고 이 묶음에서 더 안 보므로 건너뛴다(판 시작이 마지막 예보를 만든다)
 */
function rollDisplayPattern(
  input: DefensePlayInput,
  specialDefense: ContactMessageRoll['specialDefense'],
  swungContact: BattedContact | undefined,
): Pick<ContactMessageRoll, 'launchedPattern' | 'trajectory'> {
  const unchanged = { launchedPattern: swungContact?.pattern, trajectory: input.trajectory }
  const windowOpen = specialDefense.jumpUnlocked || specialDefense.slideUnlocked
  const random = input.random
  if (!windowOpen || random === undefined || swungContact === undefined) return unchanged
  const sceneDeck = scenePatternDeckOf(random)
  if (sceneDeck === undefined) return unchanged
  const launchedPattern = displayPatternOf(sceneDeck.deck, specialDefense.jumpUnlocked ? 'jump' : 'slide', swungContact.pattern, random)
  return { launchedPattern, trajectory: battedBallTrajectory(launchedPattern) }
}

/**
 * **[경기+0xf2c] 공 쏘기 + 세계 0xbfed0** (0x51408 5174c · 517ce) — 판 공과 수평각만 d 다른 공(`earlyPassPatternOf`, 50faa 가
 * 고친 +0xfcc 그대로 + d). 그 공도 점을 깔며 폴에 맞으면 rand(−25, 25) 를 하나 굴린다 — 판 공 굴림 뒤 · 필살타법 굴림 앞.
 * 궤적은 이른 넘김(상태 0x13 0x406e8)만 보고 판은 안 본다 — 여기서는 굴림 차례만 맞춘다. 쏜 공이 없는 결과(결과 넘김 길)는 건너뛴다
 */
function rollEarlyPassBall(input: DefensePlayInput, launchedPattern: BattedBallPattern | undefined, swungContact: BattedContact | undefined): void {
  if (input.random === undefined || launchedPattern === undefined || swungContact === undefined) return
  trajectoryWithRandom(battedBallTrajectory(earlyPassPatternOf(launchedPattern, swungContact.batterHand)), input.random)
}

/**
 * **필살타법 성공 굴림 0x517e6** (0x34c74 · p·10 > rand(0, 1000)) — 메시지 0x11(515c6 → 0x50faa: 필살수비 굴림 · 표시 패턴 ·
 * 51188 쏘기의 폴 굴림) · [경기+0xf2c] 의 폴 굴림 **뒤**다. 515c6 과 517e6 사이(0x392ac · 0x35988 · 0x39304 · 0x34be0 · 0xac758 ·
 * 메시지 0xbc5 진동 · 0x494b4 · 0xae89c)에는 그 밖의 굴림이 없다(호출 그래프). 성공하면 517ec 0xaf180(공+0x5c, 4) — 포구 틱 b4246 이 보고 0xbc3.
 * 예전 웹은 타석 판정 안(방향 · 패턴 바로 뒤)에서 굴려 필살수비 · 폴 굴림보다 앞섰고, "필살타법 타구면 필살수비를 안 굴린다"
 * 를 두었다 — 원본 차례에서는 필살수비를 굴릴 때 성공 여부를 아직 모른다. 결과를 넘겨받은 호출이 이미 성공을 실었으면 굴리지 않는다
 */
function rollUncatchableSwing(input: DefensePlayInput, swungContact: BattedContact | undefined): boolean {
  const specialSwing = swungContact?.specialSwing
  if (input.isUncatchable === true || specialSwing === undefined || input.random === undefined) return false
  return rollSpecialSwing(specialSwing.number, input.random, specialSwing.isAceBatter)
}

/**
 * **맞은 판정 틀에 메시지 0x11 굴림 묶음을 미리 굴린다** (A-37, r314) — 사람 타격 화면(타자편 `BattingStage` · 사람 투구 장면의
 * CPU 타자)이 판정 틀에 부른다. 판 입력은 그 판이 설 때와 같은 것(같은 수비 · 같은 쏜 공 · 같은 난수)이어야 한다.
 * 굴린 묶음은 쏜 공(`contactOfOutcome(input.outcome)`)에 묶여 판 시작(`startDefensePlay`)이 되찾는다 — 같은 공은 두 번 굴리지 않는다.
 * 쏜 공이 없거나 난수가 없는 입력은 굴리지 않고 null.
 */
export function preRollContactMessage(input: DefensePlayInput): ContactMessageRoll | null {
  const contact = contactOfOutcome(input.outcome)
  if (contact === undefined || input.random === undefined) return null
  const rolled = CONTACT_MESSAGE_ROLLS.get(contact)
  if (rolled !== undefined) return rolled
  const roll = rollContactMessage(input)
  CONTACT_MESSAGE_ROLLS.set(contact, roll)
  return roll
}

interface SpecialDefenseRollInput {
  readonly random?: RandomPort
  readonly ability: number
  readonly skillIds?: readonly number[]
  readonly gameMode?: number
  readonly chaserSlot: number
  /** state[0x13] — 번트 종류 (0 = 스윙) */
  readonly buntKind: number
}

/**
 * 필살수비 굴림의 관문 (0x50faa 가지, I-controls 2c — 직접 뜬 것):
 * ```
 * 50fba  [장면+0x1104](모드) == 7 → 굴림 없음
 * 50fc0  0x36140(장면) ≠ 0 → 굴림 없음
 * 50fc8  (s8)state[0x13](번트 종류) ≠ 0 → 굴림 없음          ; 번트 타구는 필살수비를 안 굴린다
 * 50fda  장면+0xfe8 == 0 이면 A 0x50930 · 아직 0 이면 B 0x508c0
 * ```
 * 0x50930 · 0x508c0 안에서 공 쫓는 야수가 투수(0)·포수(1)면 굴리지 않는다. 나머지 조건(경기+0x19·0x1e, 담장 판정 0x36140)은
 * 이 진행기가 도는 시점에 이미 참이다(페어 인플레이 타구만 돌린다).
 */
function rollSpecialDefenseFor(input: SpecialDefenseRollInput): {
  readonly jumpUnlocked: boolean
  readonly slideUnlocked: boolean
} {
  const 닫힘 = { jumpUnlocked: false, slideUnlocked: false }
  if (input.random === undefined) return 닫힘
  if (input.gameMode === HOME_RUN_DERBY_MODE) return 닫힘
  if (input.buntKind !== 0) return 닫힘
  if (input.chaserSlot === 0 || input.chaserSlot === 1) return 닫힘
  return rollSpecialDefense(input.ability, input.random, {
    hasSixthSense: input.skillIds?.includes(SIXTH_SENSE_SKILL_ID) === true,
    isBatterCareerMode: input.gameMode === BATTER_CAREER_MODE,
  })
}
