import { PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { placedAt, withCarriedSlack } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE, type PlayView, createFielders, createRunner, initialPlayView } from '@/entities/fielding/model/fieldingState'
import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import { type PickoffStart, startPickoff } from '@/entities/fielding/model/pickoff'
import { applyRunnerLead, previousTargetAfterLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import type { BaseState } from '@/entities/game/model/baseState'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { enterDefenseScene } from '@/features/defense-play/model/defenseScene'
import { NO_LASER_FLAGS } from '@/features/defense-play/model/laserTick'
import { DEFAULT_ABILITY, PITCHER_SLOT } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import type { PickoffPlayInput, PickoffRunner } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayTickSound } from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **1. 시작 0xb28be** · **2. 상태 0x17 진입 0x46418** — 판 칸을 연다. 굴림은 주자 리드(주자마다 rand(0,100) 한 번, 목록 차례)뿐이고
 * 송구의 악송구 굴림(첫 틱)보다 앞이다.
 */
export function openPickoffPlay(input: PickoffPlayInput, ticks: DefensePlayView[], sound: RunnerPlayTickSound): PickoffFrame {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const start = startPickoff(input.targetBase)
  const fielders = openingFieldersOf(input, abilities, start)
  // `manualThrowBase` 는 다리다(startPickoff 주석) — 웹 수비 판단 함수들이 사람 목표로 읽지 않게 지운다.
  // 대상 루는 이 판의 `targetBase`(= state[0x27]) 가 들고 있다.
  const play: PlayView = { ...initialPlayView(start.play.kind), ...start.play, manualThrowBase: NONE }
  const runners = rollLeadingRunners(input)
  return {
    input,
    ticks,
    sound,
    abilities,
    autoBaserunningEnabled: input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동',
    targetBase: input.targetBase,
    log: [],
    previousActions: new Map<string, { action: number; since: number }>(),
    fielders,
    play,
    runners,
    ...COUNTS_AT_OPEN,
    outs: input.outs,
    fielderArrivals: fielders.map(() => false),
    ...BALL_SLOTS_AT_OPEN,
    scene: enterDefenseScene(input.scene, false),
    ...LASER_SLOTS_AT_OPEN,
    fumbleMarks: Array.from({ length: fielders.length }, () => 0),
    throwErrorMarks: Array.from({ length: fielders.length }, () => 0),
    runnerAceIndexes: runnerAceIndexesOf(input.runnerAces, input.bases),
    runnerAceSprite: loadedRunnerAceOf(input.runnerAces, input.bases),
    cpuThrowEnabled: input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동',
  }
}

/**
 * b28ca vt20(0) — b1144 가 +0xcc 쓰기(b1156)를 건너뛰어 앞 판이 남긴 값을 들고 연다(`DefenseScene.fielderSlack`, r196).
 * 투수는 공을 쥐고, 커버는 b2908~b2930: 야수(b + 1) 에 0xbef58(야수, 0xd86b0[b]) — 0xbee60(위치 · 구간 출발 = 그 점) 뒤 vt14(그 점)라
 * 판이 열리는 순간 **루 위에 서 있다**(걸어가는 것이 아니다). 목표는 vt14 관문이 열릴 때만 그 점이다(`placedAt`, r196)
 */
function openingFieldersOf(input: PickoffPlayInput, abilities: readonly (number | null)[], start: PickoffStart): readonly FielderState[] {
  const created = withCarriedSlack(createFielders(abilities, input.defenseTeamBonus ?? 0), input.scene?.fielderSlack)
  return created.map((fielder) => {
    if (fielder.slot === PITCHER_SLOT) return { ...fielder, holdingBall: true, aiState: start.pitcherAiState }
    const goal = start.coverTargets.get(fielder.slot)
    if (goal === undefined) return fielder
    return placedAt(fielder, goal, start.play.coverOfBase.indexOf(fielder.slot))
  })
}

/**
 * 상태 0x17 진입 0x46418 — 주자 고리 0x4657e 의 0x3d7b8: 주자마다 다음 루로 `0xcffac`[루] = 5 틱 (+5 if rand(0,100) == 0) 몰아 돌린 뒤
 * 목표를 닿은 루(+0x8c)로 되돌린다 → 판이 열리면 제 루로 돌아오는 중. 그 뒤 0x4677a 가 살아 있는 주자를 모두 vt0x48(+0x8c) — 같은 목표다.
 * 목록은 루 순서(1·2·3) — 원본 0xa9a10 이 3·2·1 순으로 맨 앞에 끼워 넣어 같은 순서가 된다.
 * 번호는 1 부터 센다 — 0 은 타자주자 자리라 그림(`viewStateOf`)이 타자로 그리지 않게 비워 둔다.
 * 굴림: 주자마다 rand(0,100) 한 번(목록 차례)
 */
function rollLeadingRunners(input: PickoffPlayInput): PickoffRunner[] {
  const runners: PickoffRunner[] = []
  for (const base of [1, 2, 3] as const) {
    if (!isOccupied(input.bases, base)) continue
    const runner = createRunner(runners.length + 1, base, runnerSpeedFor(input, base), { isBatterRunner: false })
    const lead = runnerLeadOf(runner, { playKind: PICKOFF_PLAY_KIND, stealing: false, random: input.random })
    const led = applyRunnerLead(runner, lead)
    runners.push({ state: led, counted: false, arrivedThisListTick: false, previousTarget: previousTargetAfterLead(led) })
  }
  return runners
}

const OCCUPIED_OF: Readonly<Record<1 | 2 | 3, keyof BaseState>> = { 1: 'first', 2: 'second', 3: 'third' }

function isOccupied(bases: BaseState, base: 1 | 2 | 3): boolean {
  return bases[OCCUPIED_OF[base]]
}

function runnerSpeedFor(input: PickoffPlayInput, base: 1 | 2 | 3): number {
  return runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
}

/** 셈 · 결과 칸의 처음 값 */
const COUNTS_AT_OPEN = {
  outsAdded: 0,
  runsScored: 0,
  slidingSoundPlayed: false,
  tagOut: false,
  throwArrivalTick: -1,
  errantThrow: false,
  fumbled: false,
  resultCode: null,
  catchTick: -1,
  endCounter: 0,
  closingListTickOpen: false,
  counterBeforeHead: 0,
  deferredThrowReceiver: NONE,
  deferredThrowBase: NONE,
  relayFinalSlot: NONE,
  relayBase: NONE,
  grabbed: false,
  manualThrowBase: NONE,
  ballEventThisTick: false,
  outJudgedThisTick: false,
  tickMessageCode: 0,
  lastJudgedKind: OUT_KIND.NONE,
  pausedAtHead: false,
  pausedThisTick: false,
} as const

/** 공 칸의 처음 값 — 투수가 쥐고 연다(쫓는 공 · 공 궤적 없음) */
const BALL_SLOTS_AT_OPEN = { flight: null, chase: null, ballBody: undefined, ballPath: null, relayFlag: true } as const

/** 레이저 · 연출 칸의 처음 값 */
const LASER_SLOTS_AT_OPEN = {
  laserOutFlag: false,
  laserFlags: NO_LASER_FLAGS,
  laserArmed: false,
  laserThrow: false,
  laserTrailOn: false,
  gamePaused: false,
} as const
