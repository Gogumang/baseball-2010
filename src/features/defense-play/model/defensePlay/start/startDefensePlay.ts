import { isWideFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState, createFielders } from '@/entities/fielding/model/fieldingState'
import { type CatchForecast, forecastCatch } from '@/features/defense-play/model/catchForecast'
import { groundPointOf } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { DEFAULT_ABILITY, DEFAULT_MAXIMUM_TICKS, FULL_FORECAST_WINDOW } from '@/features/defense-play/model/defensePlay/constants'
import { bigHitWatchOf } from '@/features/defense-play/model/defensePlay/start/bigHitWatch'
import { CONTACT_MESSAGE_ROLLS, type ContactMessageRoll, rollContactMessage } from '@/features/defense-play/model/defensePlay/start/contactMessage'
import { initialPlayStateOf } from '@/features/defense-play/model/defensePlay/start/initialPlayState'
import { coversAtStart, playAtStart } from '@/features/defense-play/model/defensePlay/start/openingPlay'
import { createPlayRunners, leadRunnersForBattedBall } from '@/features/defense-play/model/defensePlay/start/playRunners'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * 타구 하나를 **시작 상태**로 세운다 — 포구 예보 · 필살수비 굴림 · 커버 배정까지.
 *
 * ⚠️ 난수는 여기서 **메시지 0x11 굴림 묶음 · 도루 리드 굴림만** 돈다. 펌블·악송구·레이저는 틱 안에서 돈다 —
 * 그 순서와 횟수가 씨앗 결과를 정하므로 자리를 옮기면 안 된다.
 */
export function startDefensePlay(input: DefensePlayInput): DefensePlayState {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS
  const fieldersAtCreate = createFielders(abilities, input.defenseTeamBonus ?? 0)
  const message = rollOrRecallContactMessage(input)
  const { trajectory } = message
  const uncatchable = message.uncatchable || input.isUncatchable === true
  const forecast = openingForecastOf(input, fieldersAtCreate, message)
  // 잡힐 뜬공인가(vt94) — 고른 포구가 낙구 전(0xb3b38 우선순위 1~5)일 때. 점프·슬라이딩 창이 열려 낙구 전 포구가 생기면
  // 그것도 뜬공이다. 필살타법 타구(공 속성 4 = 필살타법 표시)는 아무도 쥐지 않는다. 실제 뜬공 아웃(state[0x1f])은 쥐는 틱의 0xb36d0 이 낸다
  const onTheFly = !uncatchable && forecast.choice.catchTick <= trajectory.landingTick
  const runners = rollOpeningRunners(input, onTheFly)
  const catchTick = Math.max(0, Math.min(forecast.choice.catchTick, maximumTicks))
  // 추적야수 AI 1(b4aca~b4b5a, 직접 뜬 것): b4b40 0xa25b0(공, +0x174 포구 틱)의 점 → b4b50~b4b5a 0xa100c(야수, x, **0**, z) —
  // 야수 목표는 늘 땅 위다. 포구 틱 다리(6b 절 쥐기)도 이 점에 세운다(r162 — 예전 웹은 높이째 포구 지점이었다)
  const catchPoint = groundPointOf(trajectory.pointAt(catchTick))
  const chasing = fieldersChasingAtStart(fieldersAtCreate, forecast, catchPoint)
  // state[7] — 0x511ae 가 1 로 세운 뒤 state[0x19](0.1% 사건)가 아니면 0x511ce 가 0x9d640(쏜 a)로 덮는다
  const launched = message.launchedPattern
  const wideFair = input.specialEvent === true || launched === undefined || isWideFairAngle(launched[0])
  const opening = { input, runners, trajectory, forecast, catchPoint }
  const covered = coversAtStart(opening, chasing, wideFair)
  const play = playAtStart(opening, covered.play.coverOfBase, catchTick, covered.fielders)
  return initialPlayStateOf({
    input: inputAfterContact(input, trajectory, uncatchable),
    message,
    abilities,
    maximumTicks,
    uncatchable,
    onTheFly,
    runners,
    forecast,
    catchTick,
    catchPoint,
    covered,
    play,
    wideFair,
  })
}

/**
 * **메시지 0x11 굴림 묶음** (필살수비 · 표시 패턴 · 두 공 폴 · 필살타법).
 * 원본은 맞은 판정 틀(0x51408 515c0 → 0x50faa · 5174c · 517e6)에서 굴린다. 사람 타격 화면은 그 틀에 미리 굴려 쏜 공에 묶어 두고
 * (`preRollContactMessage`) 판은 그 값을 되찾는다 — 0x13 그림의 파티클 굴림이 그 사이에 든다. 미리 굴리지 않은 판(머리 없는 진행 ·
 * 시험)은 여기서 굴린다 — 맞은 틀과 판 시작 사이에 다른 굴림이 없으니 차례가 같다
 */
function rollOrRecallContactMessage(input: DefensePlayInput): ContactMessageRoll {
  const swungContact = contactOfOutcome(input.outcome)
  const recalled = swungContact === undefined ? undefined : CONTACT_MESSAGE_ROLLS.get(swungContact)
  return recalled ?? rollContactMessage(input)
}

/**
 * 예보 0xb12d0 (vt24) — 원본은 굴림 사이사이 여러 번 다시 만든다. 마지막 것은 쏜 궤적 · 열린 창으로 만든 표다.
 * 플레이 +0x127 — 패턴 플래그 비트 1 (0x514e6). 예보 · 추적야수가 낙구 지점으로 달린다
 */
function openingForecastOf(input: DefensePlayInput, fielders: readonly FielderState[], message: ContactMessageRoll): CatchForecast {
  const { specialDefense, trajectory } = message
  const chase = { chaseToLanding: input.trajectory.landingChase === true }
  if (!specialDefense.jumpUnlocked && !specialDefense.slideUnlocked && !message.relaid) {
    return forecastCatch(trajectory, fielders, FULL_FORECAST_WINDOW, chase)
  }
  const windows = { jumpUnlocked: specialDefense.jumpUnlocked, slideUnlocked: specialDefense.slideUnlocked }
  return forecastCatch(trajectory, fielders, FULL_FORECAST_WINDOW, { ...chase, ...windows })
}

/**
 * 주자 목록 — 0xa9e44 의 1루 주자 예외 (a9ed6): 2아웃 전 잡힐 뜬공이면 1루 주자는 포스 목표를 안 받는다.
 * 상태 0x17 진입 0x46418 → 0x3d7b8: 판 시작(vt18) 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다.
 * 필살수비 굴림(메시지 0x11)보다 뒤다. 도루 주자만 rand(0,9) 한 번 — 종류 1 은 그 뒤 도루 표시를 지운다(state[0x14+b] = 0)
 */
function rollOpeningRunners(input: DefensePlayInput, onTheFly: boolean): MutableRunner[] {
  const speedOf = (fromBase: number) =>
    runnerSpeedOf(input.runAbilities?.[fromBase as 0 | 1 | 2 | 3] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
  const firstBaseException = onTheFly && input.outs !== 2 ? { stealingFrom: input.stealingFrom ?? [] } : null
  const runners = createPlayRunners(input.bases, speedOf, firstBaseException, input.batterHand ?? contactOfOutcome(input.outcome)?.batterHand)
  leadRunnersForBattedBall(runners, input)
  return runners
}

/**
 * 시작 목표를 미리 세워 둔다 — 첫 틱부터 쫓는 야수는 공 쪽, 커버 야수는 제 루 쪽을 보고 있어야 한다.
 * 0xb3b38 담장 갈래 — 담장선이 먼저면 고른 야수는 AI 0xb 로 담장 앞 공점(aa4 − 2)에 간다(`fenceChasePoint`):
 * b3e8c AI 0xb · b3e96~b3eba +0x90 만 — 목표(+0x2c)는 AI 고리 b4b5c 가 vt14 로 적는다(1c 절, r214).
 * b3f5c — 백업 갈래: 외야 추적야수 곁의 가장 가까운 외야수 AI 0xc (목표는 AI 고리 b4b78 이 고른다, r180)
 */
function fieldersChasingAtStart(fielders: readonly FielderState[], forecast: CatchForecast, catchPoint: WorldPoint): readonly FielderState[] {
  const chaserSlot = forecast.choice.slot
  return fielders.map((fielder) => {
    if (fielder.slot === chaserSlot) return chaserAtStart(fielder, forecast.fenceChasePoint, catchPoint)
    return fielder.slot === forecast.backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder
  })
}

function chaserAtStart(fielder: FielderState, fenceChasePoint: WorldPoint | null, catchPoint: WorldPoint): FielderState {
  if (fenceChasePoint !== null) return { ...fielder, pickUpPoint: fenceChasePoint, aiState: AI_STATE.PICK_UP }
  return { ...fielder, target: catchPoint, aiState: AI_STATE.CHASE }
}

/** 큰 타구 감상 플래그 0x392ac(515e0)는 0x50faa 뒤의 쏜 판 공을 본다 — 표시 패턴 · 폴 굴림으로 다시 깐 공이면 그 공으로 다시 본다.
 * 판 시작이 굴린 필살타법 성공(0x517e6)을 입력 칸에 적어 둔다 — 결과의 `isUncatchable` 이 그 값을 낸다 */
function inputAfterContact(input: DefensePlayInput, trajectory: BattedBallTrajectory, uncatchable: boolean): DefensePlayInput {
  const watchedInput =
    trajectory === input.trajectory || input.bigHitWatch !== undefined
      ? input
      : { ...input, bigHitWatch: bigHitWatchOf({ outcome: input.outcome, trajectory }) }
  return uncatchable === (input.isUncatchable === true) ? watchedInput : { ...watchedInput, isUncatchable: uncatchable }
}
