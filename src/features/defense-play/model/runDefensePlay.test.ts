import { describe, expect, it } from 'vitest'
import { BURST_RESULT_BIT, burstResultBitsOf, hasBit } from '@/entities/burst-mission/model/burstResultBits'
import { registerContact } from '@/entities/batting/model/battedContact'
import { displayPatternListOf, openScenePatternDeck, scenePatternDeckOf } from '@/entities/batting/model/battedBallOutcome'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { AUTO_ADVANCE_TICK_MARGIN, beatsThrow } from '@/entities/fielding/model/autoAdvance'
import { BASE_POSITIONS, FIELDER_COUNT, FIELDER_START_POSITIONS, basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { DEFENSE_SCENE_START } from '@/features/defense-play/model/defenseScene'
import { runWalkPlay } from '@/features/defense-play/model/walkPlay'
import { AI_STATE, createFielders } from '@/entities/fielding/model/fieldingState'
import { throwTicksToFielder } from '@/entities/fielding/model/throwPlan'
import {
  cpuSpecialThrowOf,
  defenseAbilitiesOf,
  defensePlayResultOf,
  isBattedBallInPlay,
  isBallBeyondFence,
  isDefensePlayFinished,
  runDefensePlay,
  defenseSkillIdsOf,
  preRollContactMessage,
  startDefensePlay,
  stepDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayControls, DefensePlayInput, DefensePlayResult, DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 뜬공아웃: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
const 직선타아웃: AtBatOutcome = { kind: '아웃', detail: '직선타아웃' }
const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
const 이루타: AtBatOutcome = { kind: '안타', bases: 2 }
const 삼루타: AtBatOutcome = { kind: '안타', bases: 3 }

const 주자1루: BaseState = { first: true, second: false, third: false }
const 주자3루: BaseState = { first: false, second: false, third: true }
const 만루: BaseState = { first: true, second: true, third: true }

const isSamePointXZ = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x === b.x && a.z === b.z

/** 외야 깊숙한 뜬공 — 송구가 늦어 태그업이 걸린다. 원본 코드 0 [92, 895, 1017] (중견수가 낙구 24 전 23틱에 잡는다) */
const 깊은뜬공: BattedBallPattern = [92, 895, 1017, 0]
/**
 * 태그업이 걸리는 더 깊은 뜬공 — 원본 코드 0 [92, 781, 1313] (중견수가 30틱에 잡는다). 한 틱 이동 0xbf158 · 도착 틱 0xbf01c 가
 * 맨해튼 거리라 3루 → 홈 주자 틱(11215 ÷ 335 = 33)이 길어져 [92, 895, 1017] 로는 송구가 이겨 안 뛴다
 */
const 태그업뜬공: BattedBallPattern = [92, 781, 1313, 0]
/** 필살타법 타구가 중견수를 맞고 튕겨 백업 좌익수가 줍는 깊은 뜬공 — 원본 코드 0 [96, 646, 1374] (중견수 31틱 · 좌익수 61틱) */
const 필살뜬공: BattedBallPattern = [96, 646, 1374, 0]
/** 내야 뒤에 겨우 뜬 공 — 송구가 빨라 태그업이 안 걸린다 */
const 얕은뜬공: BattedBallPattern = [90, 250, 700, 0]
/** 2루수(칸 3)가 10틱에 줍는 땅볼 — 원본 코드 3 [70, 1000, 202, 0]. 대표 땅볼(투수가 줍는다)로는 펌블 · 레이저를 못 본다(투수 칸은 선수가 없다) */
const 이루수땅볼: BattedBallPattern = [70, 1000, 202, 0]

/**
 * 타구 하나를 **CPU 수비**(사람 타석의 수비 — CPU 송구 결정 0xafa60 이 돈다)로 돌린다.
 * 결과(`outcome`)는 패턴을 안 줄 때 그 결과를 내는 원본 패턴을 고르는 데만 쓴다(`fixturePatternFor`) —
 * 진행기는 결과를 보지 않고, 안타·아웃은 판 끝 정산이 낸다(`DefensePlayResult.outcome`).
 */
function play(
  outcome: AtBatOutcome,
  bases: BaseState,
  outs: number,
  pattern: BattedBallPattern = fixturePatternFor(outcome),
  runAbility = 500,
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases,
    outs,
    runAbility,
    defenseIsCpu: true,
  })
}

/**
 * 주루 수동/자동까지 골라 돌린다.
 *
 * 송구는 **자동으로 못 박는다** — 이 갈래를 쓰는 시험들은 포스 사슬을 보는 것이고,
 * 송구 설정(+0xf4)의 원본 기본값은 수동이라 안 박아 두면 목표 루 고르는 함수가
 * 점수식 0xafb24 에서 0xb1c90 으로 바뀌어 아웃·득점이 따라 흔들린다.
 * 송구 갈림 자체는 아래 "송구 수동/자동" 묶음이 따로 본다.
 */
function play2(
  outcome: AtBatOutcome,
  bases: BaseState,
  outs: number,
  runningMode: '수동' | '자동',
  throwMode: '수동' | '자동' = '자동',
  pattern: BattedBallPattern = fixturePatternFor(outcome),
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases,
    outs,
    runAbility: 500,
    runningMode,
    throwMode,
  })
}

describe('한 플레이 진행기 — 타자주자도 원본 수비 규칙으로 움직이고, 결과는 판 끝 정산(0xa8024)이 낸다', () => {
  it('삼진·볼넷·홈런은 수비를 돌릴 것이 없다', () => {
    expect(isBattedBallInPlay({ kind: '삼진' })).toBe(false)
    expect(isBattedBallInPlay({ kind: '볼넷' })).toBe(false)
    expect(isBattedBallInPlay({ kind: '홈런' })).toBe(false)
    expect(isBattedBallInPlay(땅볼아웃)).toBe(true)
    expect(isBattedBallInPlay(단타)).toBe(true)
  })

  it('주자 없는 땅볼은 아웃 하나로 끝난다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(EMPTY_BASES)
    expect(결과.caughtOnTheFly).toBe(false)
  })

  it('1루 주자가 있는 땅볼 — CPU 송구 결정이 2루 포스를 고르면 1루 주자가 죽고 타자주자는 1루에 산다 (야수 선택)', () => {
    // 원본 코드 3 [55, 700, 200] — 대표 땅볼(투수가 줍는 [113, 500, 300])은 한 틱 이동 0xbf158 이 맨해튼 거리로 나눠 대각선
    // 1루 걸음이 느려진 뒤로 병살(2루 → 1루)이 된다
    const 결과 = play(땅볼아웃, 주자1루, 0, [55, 700, 200, 0])

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.bases).toEqual({ first: true, second: false, third: false })
    expect(결과.log).toContain('19틱 1번 주자 루 아웃 (0xb36d0 결과 2)')
    // 정산 0xa8024 의 야수 선택 [sp+0x18] — 목록 1번 주자가 +0x7c == 2 로 죽었다 → 안타가 아니다(타수만 든다)
    expect(결과.outcome).toEqual({ kind: '아웃', detail: '땅볼아웃' })
  })

  it('뜬공·직선타는 뜬 채로 잡히고 땅볼은 굴러간 공을 줍는다', () => {
    expect(play(뜬공아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(직선타아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(땅볼아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(false)
  })

  /**
   * 원본 `state[0x87]` — 아웃 콜 62/20 을 가르는 칸(0x51b44). "한 번이라도" 가 아니라
   * **마지막 아웃 판정이 태그였나** 다 (0xb36d0 이 부를 때마다 0 으로 지우고 시작한다).
   */
  it('tagOut = 마지막 아웃 판정이 태그였나 (state[0x87])', () => {
    // 아웃 판정이 한 번도 태그를 내지 않는 평범한 땅볼·뜬공은 서지 않는다
    expect(play(땅볼아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(뜬공아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(단타, 만루, 0).tagOut).toBe(false)
    // 1루 주자 땅볼에 사람이 '2'(2루 송구)를 누른다 — 키가 없으면 사람 수동 송구는 아무도 안 던진다
    const 이루송구 = (pattern: BattedBallPattern) =>
      runDefensePlay({
        outcome: 땅볼아웃,
        trajectory: battedBallTrajectory(pattern),
        bases: 주자1루,
        outs: 0,
        runAbility: 500,
        controls: 계속누름('수비', '2'),
      })
    // 공 쥔 야수가 2루를 밟고 있어 **포스(루) 아웃**(0xb3890 2a)이면 서지 않는다
    // (2a 의 vt10 = 0xa9f60 은 `산 주자 수 > [주자+0x8c]`, 곧 **마지막으로 닿은 루**를 본다)
    const 포스땅볼 = 이루송구([81, 897, 290, 1]) // 원본 코드 3
    expect(포스땅볼.tagOut).toBe(false)
    expect(포스땅볼.log.some((줄) => 줄.includes('루 아웃'))).toBe(true)
    // 1루 선상의 땅볼을 1루수(2)가 잡고(17틱), 1루로 뛰던 타자주자와 닿으면 태그(3a)다 — 타자주자도 판정을 받는다.
    // (예전 [47, 500, 301, 1] 은 맨해튼 걸음(0xbf158) 뒤로 타자주자가 1루수에 닿기 전에 판이 다른 길로 간다)
    const 태그땅볼 = 이루송구([45, 435, 100, 1]) // 원본 코드 6
    expect(태그땅볼.log).toContain('20틱 0번 주자 태그 아웃 (0xb36d0 결과 3)')
    expect(태그땅볼.tagOut).toBe(true)
    expect(태그땅볼.log.some((줄) => 줄.includes('태그 아웃'))).toBe(true)
  })

  it('쥐기 판정(0xb2758)이 낸 태그 아웃은 같은 플레이 틱의 두 번째 판정(b42f2 · b43de)이 state[0x87] 을 지워 콜 20 이다', () => {
    // 2루 주자 땅볼(표 14 번 [42, 280, 420]) — 1루수(2)가 공을 잡는 20틱의 쥐기 판정이 1루로 뛰던 타자주자를 태그(결과 3)한다. 쥐기가 +0xe0 을
    // 세우므로 같은 플레이 틱 0xb401c 가 b42ce 뒤 vt90 을 한 번 더 부르고(머리 b36dc 에서 state[0x87] = 0), 그 판정은 아무도 안 죽여
    // 0 이다 — 결과 코드 13 을 b4540 이 읽을 때 칸은 0 (예전 웹은 쥐기 판정의 태그를 그대로 들고 가 62 였다)
    // (예전 [48, 427, 323, 1] 은 맨해튼 걸음 뒤로 1루수가 17틱에 잡고 23틱 태그라 쥐기 판정이 아니다)
    const 결과 = play(땅볼아웃, { first: false, second: true, third: false }, 0, [42, 280, 420, 0])

    expect(결과.log).toContain('20틱 2번 야수가 잡았다 (종류 0)')
    expect(결과.log).toContain('20틱 0번 주자 태그 아웃 (0xb36d0 결과 3)')
    expect(결과.tagOut).toBe(false)
    // 쥐기 0xb2710 은 야수를 포구 지점으로 옮기지 않는다(r176) — 손 패턴 [50, 320, 355] 는 19틱에 못 닿은 채 쥐고, 포구 지점으로
    // 마저 걷는 다음 틱에 태그한다(그 틱은 쥐기 판정이 아니라 b43da 판정이라 콜 62)
    const 예전공 = play(땅볼아웃, { first: false, second: true, third: false }, 0, [50, 320, 355, 0])
    expect(예전공.log).toContain('19틱 2번 야수가 잡았다 (종류 0)')
    expect(예전공.log).toContain('20틱 0번 주자 태그 아웃 (0xb36d0 결과 3)')
    expect(예전공.tagOut).toBe(true)
  })

  it('얕게 뜬 공을 잡히면 주자는 원래 루에 그대로 있다 (0xa9620 리터치)', () => {
    const 결과 = play(직선타아웃, 만루, 0, 얕은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(만루)
  })

  it('안타 — 타자주자가 판 끝에 선 루가 곧 루타다 (정산 0xa8024 가 +0x8c 를 읽는다)', () => {
    expect(play(단타, EMPTY_BASES, 0).outcome).toEqual(단타)
    expect(play(이루타, EMPTY_BASES, 0).outcome).toEqual(이루타)
    expect(play(삼루타, EMPTY_BASES, 0).outcome).toEqual(삼루타)
    expect(play(단타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: true, second: false, third: false },
    })
    expect(play(이루타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: false, second: true, third: false },
    })
    expect(play(삼루타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: false, second: false, third: true },
    })
  })

  it('3루 주자는 안타에 홈을 밟는다', () => {
    const 결과 = play(단타, 주자3루, 0)

    expect(결과.advance.runsScored).toBe(1)
    expect(결과.advance.bases.third).toBe(false)
  })
})

describe('희생플라이는 "보장" 이 아니라 자동 진루 규칙(0xaf918)의 결과다', () => {
  it('외야 깊은 뜬공이면 3루 주자가 태그업해 들어온다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 태그업뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.advance.bases).toEqual(EMPTY_BASES)
  })

  it('내야 뒤 얕은 뜬공이면 3루 주자가 못 들어온다 — 원본에 희생플라이 보장이 없다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 얕은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(주자3루)
  })

  it('판정은 "수비 송구보다 2틱 넘게 빠를 때" 다 — 딱 1틱으로는 안 뛴다', () => {
    expect(AUTO_ADVANCE_TICK_MARGIN).toBe(2)
    expect(beatsThrow(20, 21)).toBe(false)
    expect(beatsThrow(20, 22)).toBe(true)
  })

  it('태그업은 포구 뒤에 시작한다 — 잡힐 뜬공이면 그 전에는 아무도 안 뛴다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 태그업뜬공)
    // 첫 포구 틱 — `catchTick` 은 뒤에 송구를 받은 틱으로 바뀐다
    const 첫포구 = Number.parseInt(
      결과.log.find((줄) => 줄.includes('잡았다'))!,
      10,
    )
    expect(첫포구).toBe(30)
    const 포구순간 = 결과.ticks[첫포구].runners.find((runner) => runner.index === 1)

    // 포구 순간까지 3루에 붙어 있다가, 잡히고 나서야 홈으로 뛴다
    expect(포구순간).toMatchObject({ x: BASE_POSITIONS[3].x, z: BASE_POSITIONS[3].z })
    expect(결과.ticks.length).toBeGreaterThan(첫포구 + 20)
  })
})

describe('2아웃 득점 보류 — state[0] (0xaa164 · 0xaa34c · 0xaa388)', () => {
  it('2아웃 뜬공 — 친 순간 뛴(0xa9e44) 3루 주자가 포구 전에 홈을 밟으면 공이 땅에 안 닿아 바로 득점(0xaa16e), 포구가 3아웃', () => {
    // 원본 그대로: 보류는 state[0x1e](공이 땅에 닿은 플레이)일 때만이라 뜬 공이 잡히기 전 득점은 남는다
    const 결과 = play(뜬공아웃, 주자3루, 2, 태그업뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.voidedRuns).toBe(0)
    expect(결과.log[0]).toContain('홈 — 보류 0 / 득점 1')
  })

  it('2아웃 땅볼 — 타자주자가 죽은 틱에 홈을 밟은 주자는 보류(0xaa1c0)되고 3아웃이라 영영 안 풀린다(0xaa388)', () => {
    // 원본 코드 4 [122, 501, 333] — 27틱 그림의 플레이 틱에서 타자주자가 1루 포스(0xb36d0 결과 2)로 죽는다. 3루 주자는
    // 그 그림의 목록 틱(26틱 6 절 이동)에 홈에 닿아, 플레이 틱 뒤의 득점 0xaa0a8(525fc)이 3아웃을 보고 보류한다.
    // (맨해튼 걸음 0xbf158 로 3루 → 홈이 33틱 남짓이라 예전 [63, 704, 224, 1] 은 홈인 전에 판이 닫힌다)
    // (씨앗을 다시 골랐다 — 예전 [99, 898, 290, 1] 은 득점을 아웃 판정 앞에 세던 옛 차례에 기댔다. 그 판은 이제 3아웃이 홈인
    //  그림보다 먼저라 G1 이 닫혀 주자가 홈에 못 닿는다 — 원본 차례 그대로)
    const 결과 = play(땅볼아웃, 주자3루, 2, [122, 501, 333, 0])

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.voidedRuns).toBe(1)
    expect(결과.log).toContain('27틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
    expect(결과.log).toContain('27틱 1번 주자 홈 — 보류 1 / 득점 0')
  })

  it('2아웃 땅볼 — 타자주자가 살아 뛰던 때 바로 올린 득점(0xaa1b0)은 뒤에 타자주자가 죽어 3아웃이 돼도 남는다', () => {
    // 원본 그대로: 바로 득점은 0xa5c34 가 점수판에 곧장 +1 하고, 팀+0x27c 칸을 되돌리는 코드는 없다.
    // 예전 웹은 S2 2-5 의 타석 단위 근사(3아웃 · 땅볼 · 타자주자 아웃 → 0)를 걸어 이 득점을 지웠다
    // 원본 코드 4 [127, 551, 301, 1] — 3루 주자가 27틱에 홈을 밟고 타자주자는 28틱에 1루에서 죽는다(예전 [266, 94, 785] 는
    // 맨해튼 걸음 뒤로 홈인보다 포수 포구가 먼저다)
    const 결과 = play(땅볼아웃, 주자3루, 2, [127, 551, 301, 1])

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.runnerFates[0].retired).toBe(true)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.voidedRuns).toBe(0)
    // 주자는 26틱 6 절 이동(그림 27 의 목록 틱)에 닿고 그림 27 의 슬롯 2 득점 0xaa0a8 이 센다
    expect(결과.log).toContain('27틱 1번 주자 홈 — 보류 0 / 득점 1')
    expect(결과.log).toContain('28틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
  })

  it('3아웃이 난 그림 뒤의 목록 틱에서야 홈에 닿을 주자는 득점도 보류도 없다 — 관문이 닫혀 0xaa0a8 이 안 돈다', () => {
    // 16틱 그림의 플레이 틱에서 타자주자가 1루 포스로 3아웃 → 그 그림 그리기 G3 부터 닫혀(b0dbe) 다음 그림의 목록 틱 · 슬롯 2 가
    // 없다. 3루 주자는 그 목록 틱에 홈에 닿을 참이었다 — 예전 웹은 득점을 아웃 판정 앞(6 절 이동 뒤)에 세어 보류 1 로 적었다
    const 결과 = play(땅볼아웃, 주자3루, 2, [99, 898, 290, 1])

    expect(결과.log).toContain('16틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.voidedRuns).toBe(0)
    expect(결과.log.some((line) => line.includes('주자 홈'))).toBe(false)
  })

  it('2아웃이라도 안타로 타자주자가 살면 점수는 그대로 난다', () => {
    const 결과 = play(단타, 주자3루, 2)

    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.runsScored).toBe(1)
  })
})

describe('화면 스냅샷 — 진행기가 DefenseViewState 를 틱마다 내준다', () => {
  it('틱마다 야수 9명과 주자들이 들어 있다', () => {
    const 결과 = play(단타, 주자1루, 0)

    expect(결과.ticks.length).toBeGreaterThan(1)
    결과.ticks.forEach((view, index) => {
      expect(view.tick).toBe(index)
      expect(view.fielders).toHaveLength(FIELDER_COUNT)
      expect(view.runners).toHaveLength(2)
      expect(view.fielders.map((fielder) => fielder.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    })
  })

  it('첫 틱의 공은 타구 시작점이고, 잡히기 전에는 날아가는 중이다', () => {
    const 궤적 = battedBallTrajectory(깊은뜬공)
    const 결과 = runDefensePlay({ outcome: 뜬공아웃, trajectory: 궤적, bases: EMPTY_BASES, outs: 0 })
    const 첫틱 = 결과.ticks[0]

    expect(첫틱.ball.x).toBe(궤적.pointAt(0).x)
    expect(첫틱.ball.z).toBe(궤적.pointAt(0).z)
    expect(첫틱.ball.height).toBe(궤적.pointAt(0).y)
    expect(첫틱.ball.isFlying).toBe(true)
    // 송구까지 끝나면 공은 더 날지 않는다
    expect(결과.ticks[결과.ticks.length - 1].ball.isFlying).toBe(false)
  })

  it('같은 동작이 이어지면 actionTick 이 올라간다', () => {
    const 결과 = play(뜬공아웃, EMPTY_BASES, 0, 깊은뜬공)
    const 쫓는야수 = 결과.catchFielderSlot
    const 동작들 = 결과.ticks.map((view) => view.fielders[쫓는야수])

    // 처음 잡힐 때까지 계속 달리므로 동작 번호가 유지되고 틱이 늘어난다
    const 달리는구간 = 동작들.slice(1, 5)
    expect(new Set(달리는구간.map((fielder) => fielder.action)).size).toBe(1)
    expect(달리는구간.map((fielder) => fielder.actionTick)).toEqual([1, 2, 3, 4])
  })
})

describe('대표 패턴 고르기 — 원본 표 안에서만 고른다', () => {
  it('고른 패턴은 원본 표에 그대로 들어 있는 항목이다', () => {
    const 모든패턴 = Object.values(BATTED_BALL_PATTERNS).flat()
    for (const outcome of [땅볼아웃, 뜬공아웃, 직선타아웃, 단타, 이루타, 삼루타]) {
      const pattern = fixturePatternFor(outcome)
      expect(모든패턴).toContain(pattern)
      // 페어 범위(45~135) 안이어야 타구가 된다
      expect(pattern[0]).toBeGreaterThanOrEqual(45)
      expect(pattern[0]).toBeLessThanOrEqual(135)
    }
  })

  it('같은 결과에는 늘 같은 패턴이 나온다', () => {
    expect(fixturePatternFor(이루타)).toEqual(fixturePatternFor(이루타))
  })
})

/** 굴림마다 늘 같은 비율인 난수 포트 — 0 이면 모든 확률 굴림이 성공하고, 1 에 가까우면 전부 실패한다 */
const 고정난수 = (value: number): RandomPort => createFractionRandom(() => value)

/** 비율을 차례대로 돌려주는 난수 포트 — 굴림 하나만 떼어 볼 때 쓴다 */
const 차례난수 = (values: readonly number[]): RandomPort => {
  let index = 0
  return createFractionRandom(() => values[Math.min(index++, values.length - 1)])
}

/** 틱마다 같은 키를 눌러 주는 조작 — 화면이 넘겨야 하는 모양 그대로다 */
const 계속누름 = (side: '공격' | '수비', key: string): DefensePlayControls => ({
  side,
  keyAt: () => ({ key, isRepeat: false }),
})

describe('확률 굴림은 난수를 줘야 돈다 — 펌블 · 악송구 · 필살수비 (I-controls 2a·2b·2c)', () => {
  const 굴림포함 = (random: RandomPort, extra: Partial<DefensePlayInput> = {}) =>
    runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random,
      ...extra,
    })

  it('난수를 안 주면 아무것도 굴리지 않는다 — 지금까지의 결정론 그대로다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(false)
    expect(결과.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
    expect(결과.laserThrow).toBe(false)
  })

  it('펌블이 나면 쥐지 않고, 틱 끝 0xb3148 이 공을 그 야수 자리에서 다시 쏘아 새 예보로 줍는다 (b4280 · b45a4)', () => {
    // 2루수(3)가 줍는 땅볼 — 투수(0)는 선수가 없어 펌블하지 않는다(아래 시험). 쫓는 야수가 2루수라 필살수비 A · B 를 굴린다.
    // 굴림 차례: 필살수비 A · B 실패(0.9) → 펌블 성공(0) → 0xb3148 의 rand(−20, 20)(0.9 → +16).
    // 레이저 굴림 0x66a8c 는 공 가진 야수가 외야수일 때만 돈다(0x523e6 — r201, 예전엔 내야 땅볼에도 0.9 하나를 먹었다)
    const 결과 = 굴림포함(차례난수([0.9, 0.9, 0, 0.9]), { trajectory: battedBallTrajectory(이루수땅볼) })
    const 보통 = 굴림포함(고정난수(0.9), { trajectory: battedBallTrajectory(이루수땅볼) })

    expect(결과.fumbled).toBe(true)
    // 보통 판에서 2루수가 처음 쥐는 틱(10 — 맨해튼 걸음 0xbf158 로 한 틱 늦다) — 그 틱에 펌블한다
    expect(보통.log).toContain('10틱 3번 야수가 잡았다 (종류 0)')
    expect(결과.log).toContain('10틱 3번 야수 펌블 (0xbc2)')
    // 다시 쏜 공: 속도 max(지금 점 속도·60%, 300) · v0 min(30%, 100) · 각 + 16
    const 튕김 = 결과.log.find((line) => line.includes('공 튕김'))
    // 펌블은 동작 잠금(+0xb4)이 없다 — 2루수가 다시 줍는다
    expect(튕김).toMatch(/^10틱 공 튕김 \(0xb3148\) — 속도 450 · v0 70 · 각 -54 · 3번 야수가 28틱에 줍는다$/)
    expect(결과.catchTick).toBe(28)
    expect(결과.log).toContain('28틱 3번 야수가 잡았다 (종류 0)')
  })

  it('늘 0 인 난수면 줍는 족족 펌블한다 — 원본도 포구 틱마다 굴린다(0xb41d0)', () => {
    const 결과 = 굴림포함(고정난수(0), { trajectory: battedBallTrajectory(이루수땅볼) })

    expect(결과.fumbled).toBe(true)
    expect(결과.log.filter((line) => line.includes('펌블')).length).toBeGreaterThan(1)
    expect(결과.log.some((line) => line.includes('잡았다'))).toBe(false)
  })

  it('투수(칸 0)의 펌블은 +0xec = 지명타자의 수비로 굴린다 — 공수 교대 판 0x3fac4 가 넣는다 (b41e4)', () => {
    // 대표 땅볼([113, 500, 300])은 투수가 11틱에 줍는다. 판 시작 0xb0fb4 는 칸 0 의 선수를 안 찾지만(b1032 — 송구 g · 악송구 보정만)
    // 펌블 표 b41e4 는 야수+0xec 를 본다 — 칸 0 의 +0xec 는 0x3fac4 가 넣은 지명타자다
    const 결과 = 굴림포함(고정난수(0))

    expect(결과.fumbled).toBe(true)
    expect(결과.log).toContain('11틱 0번 야수 펌블 (0xbc2)')
  })

  it('악송구가 나면 받을 야수가 아니라 예보 vt24(0)가 고른 야수가 줍는다 (0xa1828 · 0xb2e38 b2f8c 세계 · b307c)', () => {
    // 굴림 순서대로 값을 먹인다: (필살수비 A → B) → 펌블 → 악송구.
    // 대표 땅볼(원본 궤적)은 투수(0)가 줍는다 — 쫓는 야수가 투수·포수면 필살수비를 안 굴린다(0x50faa).
    // 레이저 굴림 0x66a8c 는 공 가진 야수가 외야수일 때만 돈다(0x523e6 — r201, 예전엔 투수가 줍는 땅볼에도 굴렸다).
    // 그래서 펌블 0.9, 악송구만 성공(0) 시켜 **악송구만** 떼어 본다.
    // 투수의 악송구 보정은 선수 없는 칸의 8 이다(b10a2 — 판 시작이 칸 0 의 선수를 안 찾는다, b1032).
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      // 키 없는 사람 수동 송구는 안 던지므로 사람이 '8'(홈 송구)을 누른 판으로 본다 — 사람 송구는 특수 굴림이 없다
      controls: 계속누름('수비', '8'),
      random: 차례난수([0.9, 0, 0.9]),
    })

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(true)
    // 흔들린 공(h' · w' · φ', 중력 70%)을 세계 0xbfed0 이 깔고, 던진 투수는 t ≤ 4 건너뜀 + +0xb1 첫 복제 틱으로 빠져
    // 홈 뒤의 포수가 4틱 뒤 가슴 높이로 줍는다 — 보통 포구 틱 갈래(펌블 굴림 · 쥐기)다
    // (대표 땅볼 [113, 500, 300] 을 투수가 11틱에 쥐고 준비 3틱 뒤 14틱에 던진다)
    expect(결과.log).toContain('14틱 0루로 송구 — 20틱 도착 (악송구 — 1번 야수가 줍는다) (0번 야수)')
    expect(결과.log).toContain('20틱 1번 야수가 잡았다 (종류 1)')
    // 홈 송구가 빗나가 아무도 안 죽는다 — 사람 수동 송구는 키('8')대로만 던져 1루로는 아무도 안 던졌다
    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.bases).toEqual({ first: true, second: true, third: false })
  })

  it('던진 야수는 +0xb1 잠금으로 던진 틱의 이동 한 번을 쉬고 그다음 틱부터 시작 자리로 걷는다 (a1a3a · a1346 · a143e, U-78)', () => {
    // 야수 틱 0xa1284: 동작이 14~18 이 아니고 vtc8(+0xb1 == 0 && +0xcc ≤ 0)이 거짓이면 이동(a1346) 없이 a143e 가 잠금을 지우고
    // vt10(목표 = 위치)을 부른다 — 에뮬로 동작 5 · +0xac 0 · +0xb1 1 을 한 번 돌리면 +0xb1 0 · 위치 그대로다
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('수비', '8'),
      // 펌블(0.9) → 악송구(0) — 레이저는 외야수만 굴린다(0x523e6, r201)
      random: 차례난수([0.9, 0, 0.9]),
    })
    expect(결과.log).toContain('14틱 0루로 송구 — 20틱 도착 (악송구 — 1번 야수가 줍는다) (0번 야수)')
    const 투수 = (tick: number) => {
      const fielder = 결과.ticks.find((view) => view.tick === tick)?.fielders.find((entry) => entry.slot === 0)
      return fielder === undefined ? null : { x: fielder.x, z: fielder.z }
    }
    // 그림 틱 N 은 N − 1 의 이동 뒤 자리다 — 14틱 이동은 쉬고(15 == 14), 15틱 이동부터 걷는다(16 ≠ 15)
    expect(투수(14)).not.toBeNull()
    expect(투수(15)).toEqual(투수(14))
    expect(투수(16)).not.toEqual(투수(15))
  })

  it('난수가 늘 1 에 가까우면 하나도 안 걸린다', () => {
    const 결과 = 굴림포함(고정난수(0.999))

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(false)
    expect(결과.specialDefense.jumpUnlocked).toBe(false)
  })

  it('필살수비는 A(점프) 먼저, 실패했을 때만 B(슬라이딩) — 그리고 모드 7 은 아예 안 굴린다', () => {
    const 걸림 = 굴림포함(고정난수(0), { trajectory: battedBallTrajectory(깊은뜬공), outcome: 뜬공아웃 })
    expect(걸림.specialDefense).toEqual({ jumpUnlocked: true, slideUnlocked: false })

    const 홈런더비 = 굴림포함(고정난수(0), {
      trajectory: battedBallTrajectory(깊은뜬공),
      outcome: 뜬공아웃,
      gameMode: 7,
    })
    expect(홈런더비.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
  })

  it('번트 타구(state[0x13] ≠ 0)는 필살수비를 안 굴린다 — 관문 50fc8', () => {
    const 번트 = 굴림포함(고정난수(0), { trajectory: battedBallTrajectory(깊은뜬공), outcome: 뜬공아웃, buntKind: 1 })
    expect(번트.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
  })
})

describe('사람 조작 — 상태 0x17 키 표 (I-controls 0·2b·2d·3b)', () => {
  it("수비일 때 '2' 는 2루 송구다 — 사람이 고른 목표가 CPU 점수식보다 앞선다", () => {
    const 자동 = play(단타, 주자1루, 0)
    const 수동 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('수비', '2'),
    })

    expect(수동.throwBase).toBe(2)
    expect(수동.log.some((line) => line.includes('사람이 2루로 송구 지시'))).toBe(true)
    // 자동은 같은 루를 고를 수도 있으니 "지시가 기록됐다" 로 가른다
    expect(자동.log.some((line) => line.includes('사람이'))).toBe(false)
  })

  it("공격일 때 '8' 은 3루 주자 진루다 — 얕은 뜬공에서 못 들어오던 주자를 뛰게 한다", () => {
    const 가만히 = play(뜬공아웃, 주자3루, 0, 얕은뜬공)
    const 태그업 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(얕은뜬공),
      bases: 주자3루,
      outs: 0,
      controls: 계속누름('공격', '8'),
    })

    expect(가만히.advance.runsScored).toBe(0)
    expect(태그업.log.some((line) => line.includes('진루'))).toBe(true)
  })

  it('OK 는 슬라이딩이다 — 진행률 71~94% 구간에 든 주자만 걸린다 (0xa9690)', () => {
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('공격', ' '),
    })

    expect(결과.log.some((line) => line.includes('슬라이딩'))).toBe(true)
  })

  it('레이저 송구는 반짝임 창 안에 새로 누른 키가 있어야 나간다 (0x66a8c · 0xb2648 · 0x4e858)', () => {
    const 공통 = {
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      // 굴림 차례: 필살수비 A(0, 성공) → 레이저(0, 성공) → 펌블(0.999, 실패) → 그 뒤 모두 0
      random: 차례난수([0, 0, 0.999, 0]),
    }
    const 굴림 = () => 차례난수([0, 0, 0.999, 0])
    const 눌렀다 = runDefensePlay({ ...공통, random: 굴림(), controls: 계속누름('수비', '2') })
    const 누르고있다 = runDefensePlay({
      ...공통,
      random: 굴림(),
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: true }) },
    })
    const 안눌렀다 = runDefensePlay({ ...공통, random: 굴림(), controls: { side: '수비', keyAt: () => null } })

    expect(눌렀다.laserThrow).toBe(true)
    // 누르고 있기로는 안 된다 — 원본이 키 반복 계수 0 만 받는다
    expect(누르고있다.laserThrow).toBe(false)
    expect(안눌렀다.laserThrow).toBe(false)
  })

  it('레이저 송구는 야수 vtb0 = 0xa222c 로 던진다 — +0xdc = 2000 고정 · 악송구 굴림 없음 (b2f06 · a229c)', () => {
    const 공통 = {
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
    }
    // 굴림 차례: 필살수비 A(0) → 레이저(0) → 펌블(0.999, 실패) → 그 뒤 0 — 0xa1828 의 rand(0,10000) = 0 < 기준이라
    // 0xa1620 송구는 늘 악송구다
    const 굴림 = () => 차례난수([0, 0, 0.999, 0])
    const 레이저 = runDefensePlay({ ...공통, random: 굴림(), controls: 계속누름('수비', '2') })
    const 보통 = runDefensePlay({
      ...공통,
      random: 굴림(),
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: true }) },
    })

    expect(레이저.laserThrow).toBe(true)
    // 레이저 송구 자체는 악송구가 없다. (받은 유격수가 펌블해 튕긴 공을 투수가 주우면 — 투수는 선수가 없어 펌블하지 않는다 —
    // 투수가 보통 송구로 다시 던지고 그 송구는 악송구가 날 수 있어 판 전체의 `errantThrow` 로는 못 본다)
    // (외야수가 공에 닿는 틱이 맨해튼 걸음 0xbf158 로 한 틱 늦다)
    expect(레이저.log.find((line) => line.includes('레이저 송구'))).toBe('28틱 2루로 레이저 송구 — 32틱 도착 (6번 야수)')
    expect(보통.laserThrow).toBe(false)
    expect(보통.errantThrow).toBe(true)
    // 같은 틱에 같은 루로 던져도 레이저(2000)가 먼저 닿는다
    expect(레이저.throwArrivalTick).toBeLessThan(보통.throwArrivalTick)
  })

  it('레이저 발사 0x400bc 는 경기를 멈춘다(+0x1993) — 발사한 그림의 슬롯 2 와 다음 그림이 빠지고 그 뒤 그림에 레이저로 던진다', () => {
    let state = startDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0, 0, 0.999, 0]),
      controls: 계속누름('수비', '2'),
    })
    const 틱마다: { tick: number; paused: boolean; step: number; counter: number }[] = []
    while (!isDefensePlayFinished(state)) {
      state = stepDefensePlay(state, { key: '2', isRepeat: false })
      틱마다.push({ tick: state.tick - 1, paused: state.gamePaused, step: state.scene.effectStep, counter: state.endCounter })
    }
    const 발사 = state.log.find((line) => line.includes('레이저 발사 (0x400bc)'))
    expect(발사).toBeDefined()
    const F = Number(발사!.split('틱')[0])
    // 그림 F 의 그리기가 단계 0 → 1, 그림 F+1 의 그리기가 단계 1 → 2 와 함께 +0x1993 을 내린다
    expect(틱마다.find((row) => row.tick === F)).toMatchObject({ paused: true, step: 1 })
    expect(틱마다.find((row) => row.tick === F + 1)).toMatchObject({ paused: false, step: 2 })
    expect(틱마다.find((row) => row.tick === F + 3)).toMatchObject({ step: -1 })
    // 송구는 멈춤이 풀린 그림 F+2 의 플레이 틱(사람 목표 b4660)이 +0x1f4 로 던진다
    // (뒤에 투수가 튕긴 공을 주워 다시 던지므로 마지막 송구 틱 `throwReleaseTick` 이 아니라 기록으로 본다)
    expect(state.log).toContain(`${F + 2}틱 2루로 레이저 송구 — 32틱 도착 (6번 야수)`)
    expect(state.laserThrow).toBe(true)
    expect(state.laserArmed).toBe(false)
  })

  it('단계 1 의 줌 펀치(0xbb39d → 0xbb84c)가 그림 F+1 부터 110 · 110 · 105 · 100% 로 화면을 늘리고, 단계 3 뒤 아웃(13)은 큰 OUT 을 그린다', () => {
    let state = startDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0, 0, 0.999, 0]),
      controls: 계속누름('수비', '2'),
    })
    while (!isDefensePlayFinished(state)) state = stepDefensePlay(state, { key: '2', isRepeat: false })
    const F = Number(state.log.find((line) => line.includes('레이저 발사 (0x400bc)'))!.split('틱')[0])
    const 배율 = state.ticks.filter((view) => view.zoom != null).map((view) => [view.tick, view.zoom!.percent])
    expect(배율).toEqual([
      [F + 1, 110],
      [F + 2, 110],
      [F + 3, 105],
      [F + 4, 100],
    ])
    // 중심 = 공 가진 야수의 바탕 그림 좌표 (x·620/40000, (z − y)/65)
    const 중심 = state.ticks.find((view) => view.zoom != null)!.zoom!
    const 쥔야수 = state.ticks.find((view) => view.tick === F + 1)!.fielders
    expect(쥔야수.some((fielder) => Math.trunc((fielder.x * 620) / 40000) === 중심.centerX)).toBe(true)
    // 이 판은 아웃이 없어 결과 판(0x46844)에 코드 13 이 안 온다 — 큰 OUT 도 없다
    expect(state.ticks.some((view) => view.bigOut != null)).toBe(false)
  })

  it('내야수가 잡은 뜬공 뒤에는 레이저도 큰 OUT 도 없다 — 레이저 굴림은 공 가진 야수가 외야수일 때만(0x523e6)', () => {
    // 원본 표 코드 0 패턴 [100, 757, 705, 0] — 유격수(5)가 16틱 뜬공 아웃(메시지 13 · 타이머 10). 예전 웹은 0x523e6 의 외야 관문을
    // "준비됐는지" 로 읽어 유격수에게도 레이저를 굴려 19틱 발사 · 22틱 단계 3 의 +0x1998 로 23~25틱 큰 OUT 을 그렸다(r201 에서 걷음).
    // 큰 OUT 이 결과 판 타이머 안에서만 남은 그림만큼 그려지는 것은 `laserPresentation.test.ts` 가 본다
    const pattern: BattedBallPattern = [100, 757, 705, 0]
    let state = startDefensePlay({
      outcome: { kind: '아웃', detail: '땅볼아웃' },
      trajectory: battedBallTrajectory(pattern),
      bases: 주자1루,
      outs: 0,
      // 굴림 차례: 필살수비 A(0) → 펌블(0.999, 실패) — 레이저 굴림이 없어 예전 차례 [0, 0, 0.999, 0] 에서 하나 빠진다
      random: 차례난수([0, 0.999, 0]),
      controls: 계속누름('수비', '2'),
    })
    while (!isDefensePlayFinished(state)) state = stepDefensePlay(state, { key: '2', isRepeat: false })
    expect(state.log).toContain('16틱 0번 주자 뜬공 아웃 (0xb36d0 결과 1)')
    expect(state.log.some((line) => line.includes('레이저'))).toBe(false)
    expect(state.ticks.some((view) => view.bigOut != null)).toBe(false)
  })
})

describe('2루 커버가 아닌 키스톤 야수 자리 — 0xb1c90 의 0xb203a (매 틱, 송구 없음)', () => {
  it('중견 앞 2루타에 1루 주자 — 2루 커버는 2루수, 유격수는 AI 0xa 로 표 0xd8764 자리 (14500, 17600) 로 걷는다', () => {
    const state = startDefensePlay({
      outcome: 이루타,
      // 원본 코드 18 [100, 1300, 600, 2] — 예전 [102, 866, 910] 은 맨해튼 걸음(0xbf158) 뒤로 10틱의 유격수가 표 자리가 아니라
      // 중계 갈래(b2144~b21b0)의 자리를 받는다
      trajectory: battedBallTrajectory([100, 1300, 600, 2]),
      bases: 주자1루,
      outs: 0,
    })
    const 시작 = state.fielders[5].position
    while (state.tick < 10) stepDefensePlay(state)

    expect(state.covers[2]).toBe(3)
    expect(state.fielders[5].aiState).toBe(0xa)
    expect(state.fielders[5].target).toEqual({ x: 14_500, y: 0, z: 17_600 })
    expect(state.fielders[5].position).not.toEqual(시작)
  })
})

describe('필살타법 성공 타구는 야수가 잡지 못한다 — 공 비트 4 (0x51800 · 0xaf180 · 0xbc3, S13 6절)', () => {
  const 필살타구 = (outcome: AtBatOutcome, bases: BaseState, outs: number, pattern?: BattedBallPattern) =>
    runDefensePlay({
      outcome,
      trajectory: battedBallTrajectory(pattern ?? fixturePatternFor(outcome)),
      bases,
      outs,
      isUncatchable: true,
    })

  it('첫 야수는 쥐지 못하고 0xbc3 · 사건만 난다 — 틱 끝 0xb3148 이 공을 그 야수에게서 튕겨 다시 쏜다', () => {
    // 원본 코드 0 [96, 646, 1374] — 예전 [92, 895, 1017] 은 백업 거리가 맨해튼(0xbfa2c, b3f2a)이 된 뒤로 좌익수가 백업으로
    // 안 붙어 중견수가 61틱에 다시 줍는다
    const 필살 = 필살타구(뜬공아웃, EMPTY_BASES, 0, 필살뜬공)

    expect(필살.isUncatchable).toBe(true)
    // 뜬 채로는 아무도 못 잡는다 — 예보(자르지 않은 표)가 고른 중견수가 낙구(34) 전 31틱 포구점에 닿아 맞고 튕긴다
    expect(필살.caughtOnTheFly).toBe(false)
    expect(필살.log).toContain('31틱 8번 야수에게 필살타법 타구가 맞았다 (0xbc3)')
    // 지금 점 속도 → 60% · v0 min(30%, 100) · 각 그대로(난수 없음).
    // 맞은 중견수는 b4588 vt74 → 0xa1e60 으로 +0xb4 = 15 — 새 예보의 복제가 그 잠금을 물려받아 t = 5(건너뛴 4틱 뒤) ~ 19 는 판정이 없다.
    // 좌익수(7)는 첫 고르기의 백업 갈래(b3f5c — 외야 추적야수 곁의 가장 가까운 외야수 AI 0xc)로 중견수 목표 2000 뒤(b4b78)까지 와
    // 있어 다시 쏜 공을 줍는다(r180 — 백업이 없던 예전 웹은 중견수가 61틱에 주웠다)
    expect(필살.log).toContain('31틱 공 튕김 (0xb3148) — 속도 387 · v0 100 · 각 -96 · 7번 야수가 61틱에 줍는다')
  })

  it('다시 쏜 공은 보통 공이다 — 속성 목록 +0x5c 를 0xa2610 이 비워 새 예보의 야수가 그대로 쥔다', () => {
    const 필살 = 필살타구(땅볼아웃, EMPTY_BASES, 0)

    const 맞음 = 필살.log.findIndex((line) => line.includes('필살타법 타구가 맞았다'))
    const 잡음 = 필살.log.findIndex((line) => line.includes('잡았다'))
    expect(맞음).toBeGreaterThanOrEqual(0)
    expect(잡음).toBeGreaterThan(맞음)
    // 맞은 투수는 15틱 잠금(+0xb4) — 예보에서 빠지고(가까운 야수 0xb3c4c 도 잠금이면 건너뜀) 3루수가 줍는다.
    // 다시 쏘기(b45a0)는 그림 11 의 슬롯 2 라 예보가 그 그림의 야수 자리(6 절 이동 앞)로 고른다
    // (대표 땅볼이 [113, 500, 300] — 투수 11틱 — 으로 바뀌어 줍는 야수 · 틱도 바뀌었다)
    expect(필살.log[맞음]).toBe('11틱 0번 야수에게 필살타법 타구가 맞았다 (0xbc3)')
    expect(필살.log[잡음]).toBe('28틱 4번 야수가 잡았다 (종류 0)')
  })

  it('맞은 야수는 +0xb4 = 15 동안 제자리이고 잠금이 0 이 된 틱의 걸음부터 걷는다 (a12b4~a12d6 · a1376, r155)', () => {
    // 야수 틱 0xa1284: +0xb4 > 0 이면 −1 만 하고 끝(a12c6 · a12d6) — 이동 0xbf094(a1376)는 그 뒤라 잠금 틱엔 못 간다.
    // 웹 6 절 걸음은 원본의 다음 야수 틱 몫이라 맞은 틱(31) 그 걸음부터 15번(31~45)을 쉬고 46 의 걸음부터 걷는다.
    // 그림 틱 N 은 N − 1 의 걸음 뒤 자리다
    const 필살 = 필살타구(뜬공아웃, EMPTY_BASES, 0, 필살뜬공)
    expect(필살.log).toContain('31틱 8번 야수에게 필살타법 타구가 맞았다 (0xbc3)')
    const 중견수 = (tick: number) => {
      const fielder = 필살.ticks.find((view) => view.tick === tick)?.fielders.find((entry) => entry.slot === 8)
      return fielder === undefined ? null : { x: fielder.x, z: fielder.z }
    }
    expect(중견수(31)).not.toBeNull()
    for (let tick = 32; tick <= 46; tick += 1) expect(중견수(tick)).toEqual(중견수(31))
    // 잠금이 풀린 뒤에도 그 자리다(r180): 다시 쏜 공의 고르기가 좌익수를 고르고 중견수를 백업(AI 0xc)으로 둔다. 풀리는 a12c8 의 vt10 이
    // 목표 = 위치로 두고, b4b78 은 좌익수 목표와의 차가 `dx > 2000 || dz > 2000`(음수 쪽은 안 봄 — 원본 그대로)일 때만 vt14 라 안 움직인다
    for (let tick = 47; tick <= 53; tick += 1) expect(중견수(tick)).toEqual(중견수(31))
  })

  it('맞은 틱에만 효과음 53 칸이 선다 — 틱 끝 b4588 → 0xa1e60 a1e82 즉시 재생', () => {
    let state = startDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(깊은뜬공),
      bases: EMPTY_BASES,
      outs: 0,
      isUncatchable: true,
    })
    const 소리틱: number[] = []
    while (!isDefensePlayFinished(state)) {
      const tick = state.tick
      state = stepDefensePlay(state)
      if (state.hitStaggerSoundThisTick) 소리틱.push(tick)
    }
    expect(소리틱).toEqual([23])
  })

  it('튕기는 동안에도 3루 주자는 홈을 밟는다', () => {
    // 원본 코드 1 [117, 1121, 900] — 좌익수가 맞고 튕긴 공을 중견수가 70틱에 줍는 사이 타자주자가 134틱에 홈까지 돈다
    // (예전 [92, 895, 1017] 은 맨해튼 걸음 0xbf158 로 타자주자가 2루에서 멈춘다)
    const 필살 = 필살타구(뜬공아웃, 주자3루, 2, [117, 1121, 900, 0])

    // 홈을 밟은 주자는 +0x96(죽음)이다(0xaa0a8 → aa1da 0xa9520) — 앞길 검사 0xa9924 의 앞 주자 0xa97d4 가 건너뛰어 타자주자도
    // 3루에서 막히지 않고 홈까지 돈다(예전 웹은 득점 주자를 산 주자로 보아 타자주자를 3루에 세웠다)
    expect(필살.advance.runsScored).toBe(2)
  })
})

describe('수비 아홉 칸 능력치 — 자리 코드 −1 이 칸 번호다 (0xb103e~0xb105e)', () => {
  it('자리 코드 2~9 가 칸 1~8 로 가고, 칸 0 은 지명타자(니블 1)다 — 공수 교대 판 0x3fac4 의 +0xec (b1032 는 송구 쪽만)', () => {
    const 능력치 = defenseAbilitiesOf([
      { position: 2, defense: 610 }, // 포수 → 칸 1
      { position: 3, defense: 620 }, // 1루수 → 칸 2
      { position: 9, defense: 690 }, // 중견 → 칸 8
      { position: 1, defense: 999 }, // 지명 — 칸 0 의 +0xec(펌블 · 레이저)
      { position: 0, defense: 999 }, // 후보 — 자리 없음
    ])

    expect(능력치).toHaveLength(FIELDER_COUNT)
    // 칸 0 은 송구 쪽(g · 악송구 보정)은 안 읽고 펌블 · 레이저만 본다(`recordPlayerAbilityOf`)
    expect(능력치[0]).toBe(999)
    expect(능력치[1]).toBe(610)
    expect(능력치[2]).toBe(620)
    expect(능력치[8]).toBe(690)
    // 못 채운 칸은 원본 평균대(등급 3)로 둔다
    expect(능력치[3]).toBe(500)
  })

  it('같은 자리가 두 번 나오면 앞 선수가 이긴다 — 뒤는 후보다', () => {
    expect(
      defenseAbilitiesOf([
        { position: 4, defense: 700 },
        { position: 4, defense: 100 },
      ])[3],
    ).toBe(700)
  })

  it('안 주면 아홉 칸 모두 500 이다 — 지금까지의 기본값 그대로', () => {
    expect(defenseAbilitiesOf([])).toEqual(Array.from({ length: FIELDER_COUNT }, () => 500))
  })
})

describe('협살 — AI 상태 8 (0xb48b6 · 시작 0xb3a94, S8 1절)', () => {
  // 시작 0xb3fa8 은 **주자가 달려가는 루(+0x7c)의 커버가 공을 쥐고** 공 가진 야수가 내야(≤ 5)일 때만이다.
  // 원본 코드 3 [86, 899, 400, 1]: 타자주자를 15틱에 1루 포스로 잡고, 18틱 귀루 키('3')로 1루로 돌아오는
  // 1번 주자(1→2루 출발)를 두고 공 쥔 1루 커버(2)와 유격수(5)가 협살을 세운다
  // (예전 [68, 808, 282, 1] · 16틱은 한 틱 이동 0xbf158 이 맨해튼 거리로 나눠 대각선 주자가 느려진 뒤로 협살 대상 조건이 안 선다)
  // (예전 장면 [87, 1388, 222] 씨앗 26 은 **투수 펌블**로 튄 공에 기대 있었다 — 투수 칸은 판 시작 0xb0fb4 가 선수를 안 찾아(b1032)
  //  펌블 확률이 0 이라 원본엔 그 판이 없다)
  const 협살판 = [86, 899, 400, 1] as const
  const 협살상황 = (defenseIsCpu: boolean, keys: Record<number, string> = { 18: '3' }) =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([...협살판]), // 원본 코드 3
      bases: 주자1루,
      outs: 0,
      runAbility: 500,
      defenseIsCpu,
      controls: { side: '공격', keyAt: (tick) => (keys[tick] === undefined ? null : { key: keys[tick] }) },
    })

  it('수비가 CPU 일 때만 걸린다 — 사람이 수비하면 원본에서도 안 일어난다 (state[0x31+수비측])', () => {
    expect(협살상황(true).log).toContain('18틱 협살 시작 — 1번 주자 1↔2루 (야수 2·5)')
    expect(협살상황(false).log.some((line) => line.includes('협살 시작'))).toBe(false)
  })

  it('안 주면 안 돈다 — 부르는 쪽이 말해 주지 않으면 시작하지 않는다', () => {
    const 기본 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([85, 1203, 600, 0]),
      bases: 주자1루,
      outs: 0,
    })

    expect(기본.rundowns).toBe(0)
    expect(기본.log.some((line) => line.includes('협살'))).toBe(false)
  })

  it('짝 송구는 보통 송구 0xb2e38 이다 — 받는 짝은 고르기 vt34 가 AI 1 로 바꿔 협살 AI 를 떠나고, 포구 틱 갈래로 쥔다 (b4a4a, A-34)', () => {
    // 같은 판에서 19틱 진루 키('2')로 주자가 다시 2루로 가면 1루수(1루 커버)가 짝(유격수 5)에게 던진다. 공은 세계 공이고
    // 목표 루 [7] 은 짝의 목표점(2루 좌표, vt68)이다. 받는 틱은 예보가 정한 포구 틱(받는 점이 점[T − 1])이라 27틱이고,
    // 받는 것은 보통 포구 틱 갈래(펌블 굴림 · 쥐기 0xb2710)다. 받은 유격수는 AI 1 이라 협살 AI(분기표 0xd8808[8])를 안 탄다 —
    // 20틱 귀루로 주자가 1루로 돌아가 협살이 풀린 뒤, 쥔 유격수가 다시 협살을 세운다(45틱, 2↔1루)
    const 결과 = 협살상황(true, { 18: '3', 19: '2', 20: '3' })

    expect(결과.log).toContain('18틱 협살 시작 — 1번 주자 1↔2루 (야수 2·5)')
    expect(결과.log).toContain('19틱 2루로 송구 — 27틱 도착 (협살 짝 송구) (2번 야수)')
    expect(결과.log).toContain('19틱 협살 송구 2→5 — 27틱 도착 (5번 야수가 받는다)')
    expect(결과.log).toContain('27틱 5번 야수가 잡았다 (종류 0)')
    expect(결과.log.some((line) => line.includes('협살 송구 5→2'))).toBe(false)
    expect(결과.log).toContain('45틱 협살 시작 — 1번 주자 2↔1루 (야수 5·2)')
    expect(결과.rundowns).toBe(2)
    // 그림: 날아가는 동안(20~26틱) 공은 세계 공 궤적 위에 떠 있다 — 예전 웹은 마지막 보통 송구의 루(1루) 자리에 붙박아 그렸다
    const 일루 = basePosition(1)
    for (let 틱 = 20; 틱 < 27; 틱 += 1) {
      const 공 = 결과.ticks[틱].ball
      expect(공.isFlying).toBe(true)
      expect(공.height).toBeGreaterThan(0)
      expect(공.x === 일루.x && 공.z === 일루.z).toBe(false)
    }
  })

  it('짝 송구는 보통 송구처럼 악송구 · 흔들림 굴림을 먹고, 받는 짝의 포구 틱에 펌블 굴림이 선다 (0xa1620 a1828 · b4228, A-34)', () => {
    // 키 표(`keyAt`)는 판 틱마다 머리(0 절)에서 한 번 불리므로 그 사이 굴림을 틱별로 모은다
    const 씨앗 = createSeededRandom(1)
    const 틱별: Record<number, string[]> = {}
    let 지금 = -1
    const 난수: RandomPort = {
      rand: (min, max) => {
        ;(틱별[지금] ??= []).push(`${min}..${max}`)
        return 씨앗.rand(min, max)
      },
      rand9d: (n) => 씨앗.rand9d(n),
    }
    const 키: Record<number, string> = { 18: '3', 19: '2' }
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([...협살판]),
      bases: 주자1루,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: 난수,
      controls: {
        side: '공격',
        keyAt: (tick) => {
          지금 = tick
          return 키[tick] === undefined ? null : { key: 키[tick] }
        },
      },
    })
    expect(결과.log).toContain('19틱 협살 송구 2→5 — 27틱 도착 (5번 야수가 받는다)')
    // 19틱: 악송구 굴림 rand(0, 10000)(a1828) — 거리 ≤ 0x2008 이라 긴 송구 흔들림 굴림(a198c)은 없다
    expect(틱별[19]).toEqual(['0..10000'])
    // 27틱: 받는 짝의 펌블 굴림(b4228) — 예전 웹은 도착 틱만 세어 이 굴림도 없었다
    expect(틱별[27]).toEqual(['0..10000'])
  })

  // r313 — 협살 AI 0xb48b6 은 플레이 vt4c 야수 고리(분기표 0xd8808[8])에서 칸 차례로 돈다. 목표만 vt14 관문으로 적고 걸음은 다음
  // 목록 틱이 하며, 태그는 아웃 판정 0xb36d0(6b 절)이 다음 그림에 낸다
  const 협살판돌리기 = (pattern: BattedBallPattern, bases: BaseState, seed: number, key?: (tick: number) => string | null) =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(pattern),
      bases,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: createSeededRandom(seed),
      controls: {
        side: '공격',
        keyAt: (tick) => {
          const pressed = key?.(tick) ?? null
          return pressed === null ? null : { key: pressed }
        },
      },
    })

  it('협살 AI 는 목표만 고치고 걸음은 다음 목록 틱이라, 태그는 아웃 판정(6b)이 그다음 그림에 낸다 (b4a96 vt4c → vt14 · b43da, r313)', () => {
    // 예전 웹은 2b 절이 공 쥔 유격수를 관문 없이 곧바로 한 걸음 옮기고 그 자리에서 태그를 봐 24틱에 잡았다
    const 결과 = 협살판돌리기([48, 800, 282, 1], 주자1루, 405 * 31 + 1)
    expect(결과.log).toContain('20틱 협살 시작 — 1번 주자 2↔1루 (야수 5·0)')
    expect(결과.log).toContain('25틱 협살 태그 — 1번 주자 아웃')
    expect(결과.log.some((line) => line.startsWith('24틱 협살 태그'))).toBe(false)
  })

  it('협살 AI 는 계획을 지금 상태로 다시 세어(0xb3a04) 이 칸이 [0] · [1] 에 없으면 푼다 — 기록칸 야수가 아니라 (b48f0~b4912, r313)', () => {
    // 53틱 협살(유격수 5 · 포수 0) 뒤 1루 커버(+0xf0)가 1루수 2 로 바뀌자, 다시 센 계획에 포수가 없어 포수 차례(56틱)에 푼다.
    // 예전 웹은 기록칸의 두 야수만 보아 풀지 않았다
    const 결과 = 협살판돌리기([9, 687, 658, 0], { first: false, second: true, third: false }, 726 * 31 + 7 + 3, (tick) =>
      tick >= 10 && tick % 6 === 0 ? '3' : tick >= 10 && tick % 6 === 3 ? '2' : null,
    )
    expect(결과.log).toContain('53틱 협살 시작 — 0번 주자 2↔1루 (야수 5·0)')
    expect(결과.log).toContain('56틱 협살 종료 — 0번 야수의 협살 AI 가 풀었다 (b4912)')
  })

  it('주자가 다시 진루로 돌아도 2루에 닿기 전까지는 협살 대상이다 — 주자 +0x14 = 위치라 0xb398c 의 비율은 늘 100 (r276)', () => {
    // 자동 주루(0xaf918)는 앞으로 가는 판정만 한다. 18틱 귀루 뒤 19틱 진루 키로 주자가 다시 2루로 가도, 원본 고르기(0xb398c)는
    // 0xbf01c 를 +0x14(움직인 틱마다 위치 — 0xbf240)에서 재므로 루에 거의 다 와도 대상에서 안 빠진다(예전 웹은 35% 미만 남으면 풀었다).
    // 협살이 이어져 짝 송구(2→5)가 28틱에 닿고, 2루에 아직 안 닿은 주자가 태그(0xb36d0 결과 3)로 죽는다
    const 결과 = 협살상황(true, { 18: '3', 19: '2' })

    expect(결과.rundowns).toBe(1)
    expect(결과.log).toContain('18틱 협살 시작 — 1번 주자 1↔2루 (야수 2·5)')
    expect(결과.log).toContain('19틱 협살 송구 2→5 — 27틱 도착 (5번 야수가 받는다)')
    // 짝이 받는 쥐기 0xb2710 의 판정(b2758)이 태그(결과 3)를 낸다 — 협살 중이라 협살 아웃으로 센다
    expect(결과.log).toContain('27틱 협살 태그 — 1번 주자 아웃')
    expect(결과.advance.bases).toEqual({ first: false, second: false, third: false })
    expect(결과.advance.outsAdded).toBe(2)
  })

  it('사람이 귀루 키를 누르면 되돌아 뛰다가 협살 태그로 죽는다', () => {
    // 협살은 수비가 CPU 일 때만 걸리므로 공격은 늘 사람이다. 되돌아 뛰는 것은 귀루 키('3' = 1루 주자,
    // 메시지 0x584)이고, 아웃은 거리 ≤ 499 태그(0xb36d0 결과 3)다 — 협살 중이라 협살 아웃으로 센다.
    // 18틱 귀루: 달려가는 루가 1루로 바뀐 주자를 공 쥔 1루수가 마주 쫓아 32틱에 태그한다
    const 결과 = 협살상황(true)

    expect(결과.log).toContain('18틱 귀루 — 주자 1')
    expect(결과.rundowns).toBe(1)
    expect(결과.rundownOuts).toBe(1)
    expect(결과.log).toContain('32틱 협살 태그 — 1번 주자 아웃')
    // 타자주자 1루 포스(15틱) + 협살 태그
    expect(결과.advance.outsAdded).toBe(2)
  })

  it('같은 귀루 키도 **누르고 있어서 되풀이된 사건**이면 안 먹는다 — 원본 [조작+0x1c] & 0xf0 (0x53370~0x53390)', () => {
    // 바로 위 시험과 같은 판에서 키만 "반복"(브라우저 KeyboardEvent.repeat = 원본 경기+0x6c 비트 4~7)으로 준다.
    const 같은판 = (isRepeat: boolean) =>
      runDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([47, 1038, 596, 0]),
        bases: { first: true, second: true, third: false },
        outs: 0,
        defenseIsCpu: true,
        // 2루를 밟고 3루로 가는 1번 주자 — 인자는 +0x8c 로 찾는다(0xa97a0): '1' = 귀루 2
        controls: { side: '공격', keyAt: (tick) => (tick === 32 ? { key: '1', isRepeat } : null) },
      })
    const 반복 = 같은판(true)

    expect(반복.log.some((line) => line.includes('귀루'))).toBe(false)
    expect(반복.log.some((line) => line.includes('태그 아웃 (0xb36d0 결과 3)'))).toBe(false)
    // 새로 누른 키(반복 아님)는 그대로 먹는다
    expect(같은판(false).log.some((line) => line.includes('귀루'))).toBe(true)
    // 전원 귀루(CLR)는 게이트가 없어 반복이어도 먹는다
    const 전원 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([47, 1038, 596, 0]),
      bases: { first: true, second: true, third: false },
      outs: 0,
      defenseIsCpu: true,
      controls: { side: '공격', keyAt: (tick) => (tick === 32 ? { key: 'Escape', isRepeat: true } : null) },
    })
    expect(전원.log.some((line) => line.includes('귀루'))).toBe(true)
  })

  it('담장선을 넘어 홈런 사건(8)이 선 공은 아무도 쥐지 않는다 — 포구 틱 갈래는 플레이.vt50 0xb2ac8(+0x111 등)에 막힌다', () => {
    // 원본 코드 24 [118, 961, 1367, 2]: 29틱에 담장선을 넘는다(결과 코드 8 → 0xb2bd8 +0x111). 예전 웹은 42틱에 좌익수가 넘어간 공을
    // 쥐고 중계해 85틱에 홈으로 달려가는 타자주자를 협살로 잡았다(0번 주자 4↔3루). 원본은 b4064 vt50 이 거짓이라 포구 틱 갈래를
    // 통째로 건너뛰고, 관문 b0e04 가 주자가 다 들어올 때까지 판을 연다
    const 결과 = runDefensePlay({
      outcome: 삼루타,
      trajectory: battedBallTrajectory([118, 961, 1367, 2]),
      bases: EMPTY_BASES,
      outs: 0,
      defenseIsCpu: true,
    })

    expect(결과.log).toContain('29틱 담장선 — 판 끝 결과 코드 8 (0x9d5bc)')
    expect(결과.log.some((line) => line.includes('잡았다'))).toBe(false)
    expect(결과.outcome).toEqual({ kind: '홈런' })
    expect(결과.advance).toEqual({ bases: EMPTY_BASES, runsScored: 1, outsAdded: 0 })
  })

  it('담장을 넘은 공은 낙구 + 2 · 담장선 + 6 을 다 지나면 안 그리고, 홈런 칸이 스냅샷에 실린다 (0x36dfc 36e2a~36ea4 · 0x3f0f0)', () => {
    const 궤적 = battedBallTrajectory([118, 961, 1367, 2])
    const 결과 = runDefensePlay({ outcome: 삼루타, trajectory: 궤적, bases: EMPTY_BASES, outs: 0, defenseIsCpu: true })
    const 사라짐 = Math.max(궤적.landingTick + 2, 궤적.fenceTick + 6)

    결과.ticks.forEach((view, tick) => {
      expect(view.ball.isBeyondFence).toBe(tick > 사라짐)
    })
    // 홈런 칸(+0x111)은 담장선 틱의 사건 코드 처리(다음 그림)부터 선다
    expect(결과.ticks[궤적.fenceTick + 1].homeRunFlag).toBe(true)
    expect(결과.ticks[궤적.fenceTick - 1].homeRunFlag).toBe(false)
  })
})

describe('공+0x68(재생 틱) 0 인 그림은 공을 안 그린다 (0x36dfc 36e24)', () => {
  it('판 첫 그림(vt18 → b12da)은 공+0x68 = 0 이라 안 그리고, 다음 그림부터 그린다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)
    expect(결과.ticks[0].ball.isPlaybackStart).toBe(true)
    expect(결과.ticks[1].ball.isPlaybackStart).toBe(false)
  })

  it('송구를 던진 그림(b307c → b12da)도 공+0x68 = 0 — 그 그림만 안 그리고 다음 그림은 1 번 점이다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)
    const 던진틱 = 결과.log.map((줄) => /^(\d+)틱 \d루로 .*송구 — /.exec(줄)).find((m) => m !== null)
    expect(던진틱).toBeDefined()
    const 틱 = Number(던진틱![1])
    expect(결과.ticks[틱].ball.isPlaybackStart).toBe(true)
    expect(결과.ticks[틱 + 1].ball.isPlaybackStart).toBe(false)
    const 그밖 = 결과.ticks.filter((view, at) => at !== 0 && at !== 틱 && view.ball.isPlaybackStart === true)
    expect(그밖).toHaveLength(0)
  })
})

describe('공 사라짐 판정 0x36dfc (36e2a~36e80)', () => {
  it('담장선이 있거나 홈런이면, 낙구 + 2 와 담장선 + 6 을 둘 다 넘은 틱부터다', () => {
    expect(isBallBeyondFence(40, 32, 29, false)).toBe(true)
    expect(isBallBeyondFence(35, 32, 29, false)).toBe(false)
    expect(isBallBeyondFence(36, 32, 29, false)).toBe(true)
    expect(isBallBeyondFence(34, 40, 10, false)).toBe(false)
    expect(isBallBeyondFence(43, 40, 10, false)).toBe(true)
  })

  it('담장선이 없으면(−1) 홈런 칸이 설 때만 본다', () => {
    expect(isBallBeyondFence(100, 30, -1, false)).toBe(false)
    expect(isBallBeyondFence(100, 30, -1, true)).toBe(true)
  })
})

describe('화면 스냅샷 배선 — 번쩍임 · 마선수 그림 · 팀 팔레트 (R2 2절 · C-16 · C-1)', () => {
  /**
   * 필살 슬라이딩 캐치가 골라지는 원본 패턴 (코드 15) — 창이 열려야 골라진다. 포구 거리 d 가 맨해튼(0xbfa2c, b15b4)이라
   * 예전 [49, 802, 799] 는 창 1999 < d ≤ 3000 에 안 든다
   */
  const 슬라이딩캐치패턴: BattedBallPattern = [55, 848, 620, 8]
  /** 필살 점프 캐치가 골라지는 원본 패턴 (코드 15) */
  const 점프캐치패턴: BattedBallPattern = [126, 674, 811, 0]

  it('안 넘기면 지금까지와 똑같다 — 번쩍임 없음 · 보통 수비수 그림 · 팔레트 없음', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
    expect(결과.ticks[0].fielders.every((야수) => 야수.aceIndex === null)).toBe(true)
    expect(결과.ticks[0].fielders.every((야수) => 야수.teamIndex === null)).toBe(true)
    expect(결과.ticks[0].runners.every((주자) => 주자.teamIndex === null)).toBe(true)
  })

  it('마선수 번호와 팀 번호가 화면 스냅샷까지 내려간다', () => {
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      // 칸 6(유격) 이 마선수 2번(로제) — 나머지는 보통 수비수 그림
      aceIndexes: [null, null, null, null, null, null, 2, null, null],
      defenseTeamIndex: 4,
      offenseTeamIndex: 11,
    })

    const 첫틱 = 결과.ticks[0]
    expect(첫틱.fielders[6].aceIndex).toBe(2)
    expect(첫틱.fielders[5].aceIndex).toBeNull()
    expect(첫틱.fielders.every((야수) => 야수.teamIndex === 4)).toBe(true)
    expect(첫틱.runners.every((주자) => 주자.teamIndex === 11)).toBe(true)
  })

  it('번쩍임은 필살 포구에서만 뜬다 — 보통 포구 타구에는 한 틱도 없다', () => {
    // 레이저 반짝임(경기+0x19ad)은 deadly_effect 가 아니다 — 켜도 번쩍임이 뜨지 않는다
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random: 고정난수(0),
      controls: { side: '수비', keyAt: () => null },
    })

    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
  })

  it('필살 점프 캐치가 나가는 틱에 번쩍임 B 가 뜬다 (플레이+0x1f7, 0xd87f4 종류 3)', () => {
    // 굴림 차례: 필살수비 A(점프) 성공 → 나머지 실패. 원본 굴림 순서 그대로다
    const 결과 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(점프캐치패턴),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0, 0.9]),
    })

    expect(결과.specialDefense).toEqual({ jumpUnlocked: true, slideUnlocked: false })
    const 번쩍임 = 결과.ticks.filter((틱) => 틱.flash?.kind === 'b')
    expect(번쩍임.length).toBeGreaterThan(0)
    // deadly_effect 애니 0 은 네 칸이고 마지막 칸에서 멈춘다. 점프는 방향 칸을 안 쓴다
    expect(번쩍임[0].flash?.step).toBe(0)
    expect(번쩍임.every((틱) => (틱.flash?.step ?? 0) <= 3)).toBe(true)
    expect(번쩍임.every((틱) => 틱.flash?.direction === undefined)).toBe(true)
  })

  it('필살 슬라이딩 캐치가 나가는 틱에 방향이 달린 번쩍임 C 가 뜬다 (플레이+0x1f8, 종류 4)', () => {
    // 굴림 차례: A(점프) 실패 → B(슬라이딩) 성공 → 나머지 실패
    const 결과 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(슬라이딩캐치패턴),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0.9, 0, 0.9]),
    })

    expect(결과.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: true })
    const 번쩍임 = 결과.ticks.filter((틱) => 틱.flash?.kind === 'c')
    expect(번쩍임.length).toBeGreaterThan(0)
    // 방향 값은 슬라이딩 캐치 동작 번호 0xf~0x12 와 같은 칸을 쓴다
    expect(번쩍임.every((틱) => (틱.flash?.direction ?? 0) >= 0xf && (틱.flash?.direction ?? 0) <= 0x12)).toBe(true)
  })
})

describe('필살 포구 연출 B · C 와 결과 판 — 슬롯 2 머리 켜기 · 그리기 0x441c4 · 0x44398 · 0x46844 (defenseScene)', () => {
  const 점프캐치 = (scene?: DefensePlayInput['scene']) =>
    runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory([126, 674, 811, 0]),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0, 0.9]),
      scene,
    })
  const 그림 = (result: DefensePlayResult) =>
    result.ticks
      .filter((view) => view.flash != null || view.judgeText != null || view.bigOut != null)
      .map((view) => [view.tick, view.flash?.step ?? null, view.judgeText?.frame ?? null, view.bigOut?.frame ?? null])

  it('동작 시작(포구 13 − 8 = 5틱)의 다음 그림에 켜져 단계 0 이 +0x1997 = 0 — 포구(13) 결과 판은 글자 없이 기다리다 B 끝(16) 뒤 큰 OUT', () => {
    const 결과 = 점프캐치()
    expect(결과.catchTick).toBe(13)
    expect(그림(결과)).toEqual([
      [13, 0, null, null],
      [14, 1, null, null],
      [15, 2, null, null],
      [16, 3, null, null],
      [17, null, null, 35],
      [18, null, null, 35],
      [19, null, null, 36],
      [20, null, null, 36],
      [21, null, null, 37],
      [22, null, null, 37],
    ])
    // 단계 6 의 줌이 그림 12 부터
    expect(결과.ticks.filter((view) => view.zoom != null).map((view) => [view.tick, view.zoom!.percent])).toEqual([
      [12, 110],
      [13, 110],
      [14, 105],
      [15, 100],
    ])
    // B 는 +0x1999 를 안 세운다 — 필살송구 아웃 표시가 없다
    expect(결과.laserOutFlag).toBe(false)
    expect(결과.scene).toMatchObject({ effectStep: -1, jumpFlash: false, deadlyAnim: { frameIndex: 3, ended: true } })
  })

  it('같은 경기의 다음 판은 앞 판의 scene 을 받는다 — 번쩍임은 안 되감긴 애니의 끝 칸 3 한 그림, 큰 OUT 은 앞 판에 남은 +0x1998 로 포구 그림부터', () => {
    const 첫판 = 점프캐치()
    // 첫 판의 큰 OUT 은 타이머(10)에 끊겨 끝 비트를 못 봤다 — +0x1998 이 남는다
    expect(첫판.scene.popup).toMatchObject({ bigOutArmed: true, shown: false })
    // 투구가 +0x1997 = 1 · 애니 2 되감기, 그 뒤 B 단계 0 이 다시 0 — 포구 그림(13)의 코드 13 결과 판이 남은 +0x1998 로 곧바로 큰 OUT
    expect(그림(점프캐치(첫판.scene))).toEqual([
      [13, 3, null, 35],
      [14, null, null, 35],
      [15, null, null, 36],
      [16, null, null, 36],
      [17, null, null, 37],
      [18, null, null, 37],
      [19, null, null, 38],
      [20, null, null, 38],
      [21, null, null, 37],
      [22, null, null, 37],
    ])
  })

  it('보통 땅볼 아웃은 아웃 판정 틱에 보통 판정 글자 OUT(코드 13 → 애니 1)을 공 가진 야수 자리에 그린다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)
    const 글자 = 결과.ticks.filter((view) => view.judgeText != null)
    expect(글자.length).toBe(10)
    expect(글자.map((view) => view.judgeText!.frame)).toEqual([35, 35, 37, 37, 38, 37, 37, 36, 39, 39])
    expect(결과.ticks.some((view) => view.bigOut != null)).toBe(false)
  })
})

describe('레이저 송구 반짝임이 화면까지 내려간다 (경기+0x19ad — 0x43406~0x4342c)', () => {
  const 공통 = {
    outcome: 단타,
    trajectory: battedBallTrajectory(fixturePatternFor(단타)),
    bases: 주자1루,
    outs: 0,
  }

  it('CPU 수비면 굴림은 돌되 반짝이지 않는다 — 곧바로 경기+0x19ae (0x52468~0x52484)', () => {
    // 0x523bc 는 수비 주체를 보지 않고 굴린 뒤(0x52456), 통과했을 때만
    // `경기[0x31 + 경기[0xa]]` 로 갈린다 — 0 이면 사람 → `+0x19ad`(반짝임),
    // 아니면 CPU → `+0x19ae`(반짝임 없이 곧바로 레이저).
    const cpu수비 = runDefensePlay({ ...공통, random: 고정난수(0.02), defenseIsCpu: true })
    const 공격조작 = runDefensePlay({
      ...공통,
      random: 고정난수(0.02),
      defenseIsCpu: true,
      controls: 계속누름('공격', ' '),
    })

    expect(cpu수비.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
    expect(공격조작.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
  })

  it('CPU 수비 타구도 난수를 한 번 더 뽑는다 — 굴림이 갈림 앞에 있다 (0x52456)', () => {
    // 이 한 번이 빠져 있어서 같은 씨앗인데도 CPU 수비 쪽 난수 차례가 원본과 어긋났다.
    const 뽑은수 = (extra: Partial<DefensePlayInput>) => {
      let count = 0
      const random: RandomPort = createFractionRandom(() => {
        count += 1
        return 0.9
      })
      runDefensePlay({ ...공통, random, ...extra })
      return count
    }

    // 사람 쪽은 송구 자동 — 키 없는 수동 송구는 안 던져서 악송구 굴림이 빠지기 때문이다
    expect(뽑은수({ defenseIsCpu: true })).toBe(뽑은수({ defenseIsCpu: false, throwMode: '자동' }))
  })

  it('굴림이 통과하면 **공 쥔 야수 칸**이 실린다 (플레이+0x130)', () => {
    // 0.02 는 레이저 기준(등급 3 = 60/1000)은 넘고 펌블·필살수비 기준에는 안 걸리는 값이다
    const 결과 = runDefensePlay({
      ...공통,
      random: 고정난수(0.02),
      controls: { side: '수비', keyAt: () => null },
    })

    const 반짝틱 = 결과.ticks.filter((틱) => 틱.laserShiningSlot !== null)
    // 창은 포구 −10 ~ +8틱인데 그중 **공을 쥔 뒤**만 그려진다 — 9틱
    expect(반짝틱.length).toBe(9)
    // 공을 쥔 뒤에만 그린다 — 포구 틱 앞은 창이 열려 있어도 안 그린다 (0x43406 의 첫 조건)
    expect(반짝틱.every((틱) => 틱.tick >= 결과.catchTick)).toBe(true)
    expect(반짝틱.every((틱) => 틱.laserShiningSlot === 결과.catchFielderSlot)).toBe(true)
  })

  it('굴림이 떨어지면 안 반짝인다 — deadly_effect 번쩍임과도 겹치지 않는다', () => {
    const 결과 = runDefensePlay({
      ...공통,
      random: 고정난수(0.999),
      controls: { side: '수비', keyAt: () => null },
    })

    expect(결과.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
  })
})

describe('주루 수동/자동 — 설정 +0xbd 와 0xae690 (직접 뜬 것)', () => {
  // 원본 배선(경기 장면 슬롯 2 = 0x524c0 안, 매 틱):
  //   5262e: 0xae690([장면+0x214], 설정+0xbd)
  //          = (경기[0x31 + 경기[9](공격측)] == 1)  ||  (설정+0xbd != 0)
  //   52638~5265e: 거짓이면 플레이+0x111·+0x129·종류 7 만 예외로 통과
  //   52660: 0xaf8c0(장면+0x210, 0) = 제어기.vt8 = 0xaf918 자동 추가 진루
  // ⚠️ 경기+0x24 는 이 갈림에 끼지 않는다 — 읽는 곳이 0x3e0e6·0x521fa 둘뿐이고
  //    둘 다 "투구 뒤 종류 5 수비 화면을 열까" 와 도루 칸 세우기다.
  const 깊은뜬공주자3루 = (extra: Partial<DefensePlayInput> = {}) =>
    runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(태그업뜬공),
      bases: 주자3루,
      outs: 0,
      runAbility: 500,
      ...extra,
    })

  it('자동이면 태그업으로 들어온다 — 안 넘겼을 때와 한 톨도 다르지 않다', () => {
    const 안넘김 = 깊은뜬공주자3루()
    const 자동 = 깊은뜬공주자3루({ runningMode: '자동' })

    expect(안넘김.advance).toEqual(자동.advance)
    expect(자동.advance.runsScored).toBe(1)
  })

  it('수동이면 자동 진루가 통째로 안 돈다 — 3루 주자가 그 자리에 선다', () => {
    const 수동 = 깊은뜬공주자3루({ runningMode: '수동' })

    expect(수동.advance.runsScored).toBe(0)
    expect(수동.advance.bases.third).toBe(true)
    // 뜬공 아웃 하나는 결과 코드가 정한 것이라 수동이어도 그대로다
    expect(수동.advance.outsAdded).toBe(1)
  })

  it('공격이 CPU 면 설정이 수동이어도 돈다 — 0xae690 의 앞 항', () => {
    const CPU공격 = 깊은뜬공주자3루({ runningMode: '수동', offenseIsCpu: true })

    expect(CPU공격.advance).toEqual(깊은뜬공주자3루({ runningMode: '자동' }).advance)
  })

  it('수동이어도 사람이 진루 키를 누르면 주자는 뛴다 — 수동은 "사람이 전부 누른다" 는 뜻이다', () => {
    const 가만히 = 깊은뜬공주자3루({ runningMode: '수동' })
    const 눌렀다 = 깊은뜬공주자3루({ runningMode: '수동', controls: 계속누름('공격', '8') })

    expect(가만히.log.some((line) => line.includes('진루'))).toBe(false)
    expect(눌렀다.log.some((line) => line.includes('진루'))).toBe(true)
    expect(눌렀다.advance.runsScored).toBe(1)
  })

  it('난수 굴림 차례는 수동/자동에 한 톨도 안 흔들린다', () => {
    const 굴림수 = (mode: '수동' | '자동') => {
      let calls = 0
      let seed = 12345
      const 하나 = () => {
        calls += 1
        seed = (seed * 1664525 + 1013904223) >>> 0
        return (seed >>> 8) / 0x1000000
      }
      const random: RandomPort = createFractionRandom(하나)
      깊은뜬공주자3루({ runningMode: mode, random })
      return calls
    }

    expect(굴림수('수동')).toBe(굴림수('자동'))
  })
})

describe('1루 주자 예외 — 0xa9e44 a9ed6: 2아웃 전 잡힐 뜬공이면 1루 주자는 포스 목표를 안 받는다', () => {
  // 판 첫 틱의 목표 루(그림의 base) — 리드(0x3d7b8) 뒤 목표를 판 시작 때의 목표로 되돌리므로 이 값이 0xa9e44 의 답이다
  const 첫목표 = (outcome: AtBatOutcome, bases: BaseState, outs: number, stealingFrom: (1 | 2 | 3)[] = []) =>
    runDefensePlay({
      outcome,
      trajectory: battedBallTrajectory(fixturePatternFor(outcome)),
      bases,
      outs,
      runAbility: 500,
      stealingFrom,
    }).ticks[0].runners.map((runner) => runner.base)

  it('0·1아웃 뜬공: 1루 주자도 그 앞 주자도 제 루가 목표다 — 사슬이 1루에서 끊긴다', () => {
    expect(첫목표(뜬공아웃, 주자1루, 0)).toEqual([1, 1])
    expect(첫목표(직선타아웃, 만루, 1)).toEqual([1, 1, 2, 3])
  })

  it('땅볼은 예외가 아니다 — 1루부터 밀린다', () => {
    expect(첫목표(땅볼아웃, 만루, 0)).toEqual([1, 2, 3, 0])
  })

  it('2아웃이면 예외가 없고 모든 주자가 친 순간 다음 루로 간다 (a9ef6)', () => {
    expect(첫목표(뜬공아웃, 만루, 2)).toEqual([1, 2, 3, 0])
  })

  it('도루 표시가 선 1루 주자는 +0x7c 가 이미 2 라 2루 주자는 밀린다 (a9eec 가 앞 주자 +0x7c 를 본다)', () => {
    expect(첫목표(뜬공아웃, { first: true, second: true, third: false }, 0, [1])).toEqual([1, 2, 3])
  })
})

describe('포스 사슬 — 머리는 늘 "타자주자 → 1루" (`createPlayRunners` · 0xa9f60)', () => {
  // 원본에는 "이 타구는 2루타" 라는 결과 코드가 없다. 타자주자가 2루까지 가면 그게 2루타다(판 끝 정산 0xa8024).
  // 그래서 포스 사슬 머리는 늘 "타자주자 → 1루" 고, 그 뒤는 루가 이어 차 있는 만큼만 밀린다. 원본은
  // **한 루에 산 주자를 둘 놓지 않는다**("루 b 의 주자" 0xa97a0 · 주루 키의 앞길/뒷길 검사 0xa99a8 · 0xa9924, I 3b).
  // (예전 웹은 타석 결과 코드가 준 최소 루 M 을 사슬 머리로 썼다 — 결과를 먼저 정한 웹 다리라 걷었다.)
  const 진루 = (bases: BaseState) => [bases.first, bases.second, bases.third]
  /**
   * 원본 코드 18 [45, 750, 1100] — 좌익선상으로 빠지는 단타. (예전 [69, 1000, 700] 은 맨해튼 걸음 0xbf158 · 도착 틱 0xbf01c 로
   * 1루 주자가 2루에서 3루까지 송구를 이기지 못해 자동 진루가 안 걸린다)
   */
  const 외야단타 = battedBallTrajectory([45, 750, 1100, 0])
  const 단타판 = (bases: BaseState, runningMode: '수동' | '자동') =>
    runDefensePlay({ outcome: 단타, trajectory: 외야단타, bases, outs: 0, runAbility: 500, runningMode, throwMode: '자동' })

  it('사람 공격 · 주루 수동이면 매 틱 자동 진루(52660)는 안 돌지만 판 시작 0x46766 의 force 한 번은 돈다 — 3루 주자 득점 · 1루 주자는 2루까지', () => {
    const 수동 = 단타판({ first: true, second: false, third: true }, '수동')

    // 3루 주자는 포스가 아니지만(2루가 비어 사슬이 끊긴다) 판 시작 0xaf8c0(제어기, 1) 은 주루 설정 갈림(0xae690)이 없다 —
    // 리드 뒤 제 루로 돌아오던 3루 주자가 송구보다 2틱 넘게 빨라 홈으로 간다. 1루 주자는 포스로 2루까지만(매 틱 자동 진루가 없다)
    expect(수동.advance.bases).toEqual({ first: true, second: true, third: false })
    expect(수동.advance.runsScored).toBe(1)
    expect(수동.outcome).toEqual(단타)
  })

  it('주루 자동이면 그 위에서 매 틱 자동 진루가 더 보낸다 — 1루 주자는 2루에 선 뒤 3루까지', () => {
    const 자동 = 단타판({ first: true, second: false, third: true }, '자동')

    expect(자동.advance.bases).toEqual({ first: true, second: false, third: true })
    expect(자동.advance.runsScored).toBe(1)
    expect(자동.outcome).toEqual(단타)
  })

  it('바운드로 담장을 넘은 공(결과 코드 10)은 종류 7 무조건 진루 — 수동이어도 투구 때 루 + 2 까지 가고 2루타로 적는다', () => {
    // 원본 코드 18 [73, 876, 1213] — 바운드로 담장을 넘는다(결과 코드 10). 대표 2루타 패턴은 맨해튼 걸음 뒤로 담장을 안 넘는
    // [109, 1200, 541] 로 바뀌어 패턴을 못 박는다
    const 담장바운드: BattedBallPattern = [73, 876, 1213, 0]
    expect(runDefensePlay({ outcome: 이루타, trajectory: battedBallTrajectory(담장바운드), bases: EMPTY_BASES, outs: 0 }).log).toContain(
      '28틱 낙구 — 판 끝 결과 코드 10 (0x9d5bc)',
    )
    const 한주자 = play2(이루타, 주자1루, 0, '수동', '자동', 담장바운드)
    expect(한주자.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(한주자.outcome).toEqual(이루타)

    const 만루 = play2(이루타, { first: true, second: true, third: true }, 0, '수동', '자동', 담장바운드)
    expect(만루.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(만루.advance.runsScored).toBe(2)

    const 삼루만 = play2(이루타, 주자3루, 0, '수동', '자동', 담장바운드)
    expect(진루(삼루만.advance.bases)).toEqual([false, true, false])
    expect(삼루만.advance.runsScored).toBe(1)
  })

  it('어느 갈래에서도 두 주자가 한 루에 겹치거나 앞 주자가 뒤로 밀리지 않는다', () => {
    const 루상황: BaseState[] = [
      EMPTY_BASES,
      주자1루,
      { first: false, second: true, third: false },
      주자3루,
      { first: true, second: true, third: false },
      { first: true, second: false, third: true },
      { first: false, second: true, third: true },
      만루,
    ]
    for (const outcome of [땅볼아웃, 뜬공아웃, 직선타아웃, 단타, 이루타, 삼루타]) {
      for (const bases of 루상황) {
        for (const mode of ['자동', '수동'] as const) {
          const 결과 = play2(outcome, bases, 0, mode)
          const 칸수 = 진루(결과.advance.bases).filter(Boolean).length
          const 주자수 = 1 + 진루(bases).filter(Boolean).length
          const 자리 = `${outcome.kind}/${진루(bases).join()}/${mode}`
          // **주자 수지 맞추기**: 득점 + 아웃 + 루에 선 주자 = 이 플레이에 있었던 주자 수.
          // 둘이 한 루에 겹치면 `basesOf` 가 하나를 지워 이 합이 모자란다 — 증발을 바로 잡아낸다.
          expect([자리, 결과.advance.runsScored + 결과.advance.outsAdded + 칸수]).toEqual([자리, 주자수])
        }
      }
    }
  })
})
describe('송구 수동/자동 — 환경설정 +0xf4 (0x5269c → 0xae6c8 → 0xafa60)', () => {
  // 원본 갈림(직접 뜬 것, 매 틱 도는 경기 장면 슬롯 2 = 0x524c0 안, 주루 갈림 바로 아래):
  //   5269c: r1 = 설정+0xf4 ; 526a4: bl 0xae6c8([장면+0x214], r1)
  //          → 반환 = (경기[0x31 + 경기[0xa](수비측)] == 1) || (설정+0xf4 != 0)
  //   526ac: 0 이면 건너뛴다 ; 526ae: 0xaf8e0 = 제어기.vt0xc = 0xafa60 CPU 송구 결정 → 점수식 0xafb24
  // 곧 사람이 수비하면서 설정이 수동이면 점수식이 아예 안 돈다. 그때 목표는 플레이 vt0x30 =
  // 0xb1c90 이 고른다 — 사람이 누른 목표(+0x160)가 먼저고, 안 눌렀으면 "앞선 주자부터 잡히는 첫 루".
  const 송구줄 = (result: DefensePlayResult) => result.log.find((line) => line.includes('루로') && line.includes('송구')) ?? '(송구 없음)'

  const 만루단타 = (extra: Partial<DefensePlayInput> = {}): DefensePlayResult =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 만루,
      outs: 0,
      runAbility: 500,
      ...extra,
    })

  it('안 넘기면 원본 기본값(수동)이다 — 설정 +0xf4 의 생성자 값이 0 이다', () => {
    expect(송구줄(만루단타())).toBe(송구줄(만루단타({ throwMode: '수동' })))
  })

  it('수동이면 키를 안 누른 사람 수비는 던지지 않는다 — 0xb1c90 자동 가지에는 송구 호출이 없다', () => {
    // 공을 내보내는 호출(플레이.vt58 0xb2c90 · vt5c 0xb2e38)은 0xafa60(CPU 결정) · b4660(+0x160 사람 목표) ·
    // 앞선 송구가 세운 중계/AI 상태 9 · 견제 · CPU 협살뿐이다. 0x509a0 앞머리는 빈 함수 0xae5f8 을 부른다.
    // 원본 코드 3 [113, 500, 300] — 투수가 11틱에 줍는다. (예전 [90, 900, 350, 1] 은 맨해튼 도착 틱(0xbf01c) 뒤로 점수식이 3루를 고른다)
    const 단타궤적 = battedBallTrajectory([113, 500, 300, 0])
    const 수동 = 만루단타({ throwMode: '수동', trajectory: 단타궤적 })
    expect(수동.throwBase).toBe(-1)
    expect(송구줄(수동)).toBe('(송구 없음)')
    // 자동이면 점수식이 루를 고른다 — 만루라 홈 포스
    expect(만루단타({ throwMode: '자동', trajectory: 단타궤적 }).throwBase).toBe(0)
  })

  it('포구 뒤에 누른 키는 준비 틱이 지난 뒤 그 틱에 던진다 — 플레이 틱 b4660~b46a8', () => {
    const 단타궤적 = battedBallTrajectory([92, 698, 565, 0])
    const 키없음 = 만루단타({ throwMode: '수동', trajectory: 단타궤적 })
    const 누른틱 = 키없음.catchTick + 8
    const 늦게 = 만루단타({
      throwMode: '수동',
      trajectory: 단타궤적,
      controls: { side: '수비', keyAt: (tick) => (tick === 누른틱 ? { key: '6', isRepeat: false } : null) },
    })

    expect(늦게.throwBase).toBe(1)
    expect(늦게.log.some((line) => line.startsWith(`${누른틱}틱 1루로 송구`))).toBe(true)
  })

  it('사람 수동에서도 아웃이 난 틱 끝에는 CPU 송구 결정이 한 번 돈다 — 결과 메시지 0xbba → 0x51d40 → 0xafa60', () => {
    // 만루 번트(원본 코드 7)를 포수가 잡아 들고 있는데 홈으로 밀려 오는 3루 주자가 옆을 지나다 태그(0xb36d0 결과 3)된다 →
    // 결과 코드 13 → 0x51d40 이 수비 조작이 사람이어도 `아웃 ≤ 2` 면 0xafa60 을 부른다 → 점수식이 1루를 고른다(병살)
    const 결과 = runDefensePlay({
      outcome: 이루타,
      // 원본 코드 7 [100, 188, 125, 1] — 포수가 6틱에 잡는다. (예전 [114, 201, 125, 1] 은 맨해튼 걸음 0xbf158 뒤로 3루 주자가
      // 포수 곁을 지날 때 거리가 안 맞아 태그가 안 난다)
      trajectory: battedBallTrajectory([100, 188, 125, 1]),
      bases: 만루,
      outs: 1,
      runAbility: 500,
      throwMode: '수동',
    })
    const 태그 = 결과.log.find((line) => line.includes('태그 아웃'))
    expect(태그).toBeDefined()
    const 아웃틱 = 태그!.split('틱')[0]
    // 3루 주자는 22틱 6 절 이동(그림 23 의 목록 틱)에 포수 옆으로 들어오고, 그림 23 의 플레이 틱 b43da 가 태그한다
    expect(아웃틱).toBe('23')
    expect(결과.log.some((line) => line.startsWith(`${아웃틱}틱 1루로 송구`) && line.includes('CPU 결정'))).toBe(true)
    expect(결과.throwBase).toBe(1)
    expect(결과.advance.outsAdded).toBe(2)
    // 2아웃째(이 판의 첫 아웃 + 1)라 `아웃 ≤ 2` — 3아웃이었다면 돌지 않는다
    const 셋째 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([100, 188, 125, 1]),
      bases: 만루,
      outs: 2,
      runAbility: 500,
      throwMode: '수동',
    })
    expect(셋째.log.some((line) => line.includes('태그 아웃'))).toBe(true)
    expect(셋째.log.some((line) => line.includes('CPU 결정'))).toBe(false)
  })

  describe('받은 야수의 이어 던지기 — 쥐기 0xb2710(+0x128 = 1) · 슬롯 2 의 0xafa60 · 결과 메시지 0xbba', () => {
    // 만루 땅볼 — 투수가 잡아 홈으로 던지고(포스), 받은 포수(1)가 준비 틱 3 이 지난 뒤 다시 고른다 — 1루로 던져 병살.
    // (r176: 쥐기 0xb2710 이 야수를 포구 지점으로 옮기지 않아, 예전 [90, 900, 350] 은 투수가 못 닿은 채 쥐어 홈 송구가 한 틱 늦고
    // 포수가 준비될 때 타자주자가 이미 1루라 이어 던지지 않는다 — 표 15 번 53째 공으로 바꿨다. 다시 맨해튼 걸음 0xbf158 · 도착 틱
    // 0xbf01c 로 그 공은 점수식이 3루를 골라 표 6 번 [87, 713, 300, 1] 로 바꿨다)
    const 이어던지기 = (extra: Partial<DefensePlayInput>) =>
      runDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([87, 713, 300, 1]), // 원본 코드 6
        bases: 만루,
        outs: 0,
        runAbility: 500,
        ...extra,
      })
    const 송구들 = (결과: { log: readonly string[] }) => 결과.log.filter((line) => line.includes('송구 —'))

    it('CPU 수비는 받은 야수가 준비 틱(내야 3)이 지난 틱에 점수식으로 이어 던진다', () => {
      const 결과 = 이어던지기({ defenseIsCpu: true })
      const [첫, 둘] = 송구들(결과)

      // 받는 점 (홈 목표 x, 1000, z) 를 점[T − 1] 에 끼워 넣어(b2f9c) 포수가 13틱에 받는다
      expect(첫).toBe('10틱 0루로 송구 — 13틱 도착 (CPU 결정) (0번 야수)')
      expect(결과.log).toContain('13틱 3번 주자 루 아웃 (0xb36d0 결과 2)')
      // 13틱에 받아(+0xc8 = 3) 준비 틱이 지난 16틱에 0xafa60 이 1루를 고른다 — 포수(홈 커버)가 쥔 공으로는 1루로 뛰는 타자주자의
      // 협살이 안 선다(0xb3fa8 은 달려가는 루 1루의 커버가 쥐어야 한다)
      expect(둘).toMatch(/^16틱 1루로 송구 — \d+틱 도착 \(CPU 결정\) \(1번 야수\)$/)
      expect(결과.log.some((line) => line.includes('0번 주자 루 아웃'))).toBe(true)
      expect(결과.advance.outsAdded).toBe(2)
      // 결과의 송구 칸은 첫 송구다
      expect(결과.throwBase).toBe(0)
    })

    it('받는 것도 포구 틱 갈래다 — 펌블 굴림 b4228 을 먹고, 움직이는 송구공을 놓치면 0xb3148 로 튕긴다 (b307c → 포구 틱)', () => {
      // 씨앗 95 — 공을 바꾸며(r176) 7 로, 레이저 굴림을 외야수만 돌리며(0x523e6, r201 — 투수가 줍는 이 공은 이제 굴림이 없다) 다시 골랐다
      const 결과 = 이어던지기({ defenseIsCpu: true, random: createSeededRandom(95) })

      expect(결과.log).toContain('10틱 0루로 송구 — 13틱 도착 (CPU 결정) (0번 야수)')
      expect(결과.log).toContain('13틱 1번 야수 펌블 (0xbc2)')
      expect(결과.log).toContain('13틱 공 튕김 (0xb3148) — 속도 568 · v0 37 · 각 104 · 1번 야수가 30틱에 줍는다')
      expect(결과.log).toContain('30틱 1번 야수가 잡았다 (종류 0)')
      expect(결과.fumbled).toBe(true)
    })

    it('송구 설정이 자동이면 사람 수비도 같은 점수식으로 이어 던진다 — 0xae6c8 의 뒤 항', () => {
      const 사람 = 송구들(이어던지기({ throwMode: '자동' }))
      const CPU = 송구들(이어던지기({ defenseIsCpu: true }))
      expect(사람[0]).toBe(CPU[0])
      // 둘째 송구도 같다 — 예전 웹은 포수가 쥔 공으로 타자주자 0↔1루 협살을 세워 CPU 수비만 한 틱 늦게(15틱) 던졌다
      expect(사람[1]).toMatch(/^16틱 1루로 송구 — \d+틱 도착 \(CPU 결정\) \(1번 야수\)$/)
      expect(CPU[1]).toBe(사람[1])
    })

    it('사람 수비·수동 송구는 이어 던지지 않는다 — 받는 틱의 아웃은 준비 틱이 막고, 그 뒤 0xafa60 을 부르는 곳이 없다', () => {
      // 키를 홈으로 한 번 누르면 투수가 던지고, 받은 포수는 공을 들고 있다 — 받는 틱의 포스 아웃(결과 코드 13)에 0x51d40 이
      // 0xafa60 을 한 번 부르지만 쥐기가 막 넣은 준비 틱 때문에 못 던지고, 그 뒤로는 부르는 곳이 없다
      const 결과 = 이어던지기({
        throwMode: '수동',
        controls: { side: '수비', keyAt: (tick) => (tick === 0 ? { key: '8', isRepeat: false } : null) },
      })

      expect(송구들(결과)).toHaveLength(1)
      expect(결과.log.some((line) => line.includes('0번 주자 루 아웃'))).toBe(false)
    })

    it('송구가 날아가는 동안은 아무도 공을 쥐지 않는다 — b2f80 야수+0xe0 = 0 · b3070 +0x12c = 0', () => {
      const state = startDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([87, 713, 300, 1]),
        bases: 만루,
        outs: 0,
        runAbility: 500,
        defenseIsCpu: true,
      })
      while (state.tick <= 11) stepDefensePlay(state)

      expect(state.play.held).toBe(false)
      expect(state.fielders.some((fielder) => fielder.holdingBall)).toBe(false)
      // 0xb3b38 의 "잡을 야수"(+0x170)·"받는 틱"(+0x174)은 받을 포수 · 송구공 예보의 포구 틱이다 (vt24(0) 다시 예보)
      expect(state.play.catchFielderSlot).toBe(1)
      expect(state.play.catchTick).toBe(13)
    })
  })

  it('수비가 CPU 면 설정이 수동이어도 점수식이 돈다 — 0xae6c8 의 앞 항', () => {
    expect(만루단타({ throwMode: '수동', defenseIsCpu: true }).throwBase).toBe(만루단타({ throwMode: '자동' }).throwBase)
  })

  it('수동이어도 사람이 송구 키를 누르면 그 루가 먼저다 — 0xb1c90 의 사람 가지(+0x160)', () => {
    const 눌렀다 = 만루단타({ throwMode: '수동', controls: 계속누름('수비', '6') })

    expect(눌렀다.throwBase).toBe(1)
    expect(눌렀다.log.some((line) => line.includes('사람이 1루로 송구 지시'))).toBe(true)
  })

  it('키 없는 수동은 송구가 없어 악송구 굴림(0xa1828)이 빠진다', () => {
    const 굴림수 = (mode: '수동' | '자동') => {
      let calls = 0
      let seed = 20100901
      const 하나 = () => {
        calls += 1
        seed = (seed * 1664525 + 1013904223) >>> 0
        return (seed >>> 8) / 0x1000000
      }
      const random: RandomPort = createFractionRandom(하나)
      만루단타({ throwMode: mode, random })
      return calls
    }

    expect(굴림수('수동')).toBeLessThan(굴림수('자동'))
  })
})

describe('CPU 홈 송구 20% 특수 송구 — 0xafa60 → 0xb2c90 → 0xb3444 → 0xa1620', () => {
  // 만루 단타를 투수가 잡아 CPU 가 홈을 고르는 타구 (웹 근사 궤적 기준).
  // 0xafb24 후보표를 원본대로 +0x7c 칸으로 읽은 뒤로(throwTargetBase) 2루 주자 단타는 타자주자를 잡으러
  // 1루로 던진다 — 홈이 포스인 만루로 바꿨다.
  const 홈송구 = (value: number) =>
    runDefensePlay({
      outcome: 단타,
      // 원본 코드 3 [113, 500, 300] — 예전 [90, 900, 350, 1] 은 맨해튼 도착 틱(0xbf01c) 뒤로 점수식이 3루를 고른다
      trajectory: battedBallTrajectory([113, 500, 300, 0]),
      bases: { first: true, second: true, third: true },
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: 고정난수(value),
    })

  it('홈을 고르면 rand(0,100) ≤ 19 일 때 특수 송구다', () => {
    expect(홈송구(0.1).throwBase).toBe(0)
    expect(홈송구(0.1).log.some((line) => line.includes('0루로 특수 송구'))).toBe(true)
    expect(홈송구(0.5).log.some((line) => line.includes('특수'))).toBe(false)
  })

  it('내야수의 홈 송구는 맞혀도 효과가 없다 — 계획 [1] 은 외야수만 선다 (b368a)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(cpuSpecialThrowOf(야수, 5, 1).special).toBe(false)
    expect(cpuSpecialThrowOf(야수, 0, 1).special).toBe(false)
  })

  it('받을 야수가 없으면(+0xf0[홈] = −1) 던지지 않고 들고 뛴다 — 특수가 버려진다 (b2cc4)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(cpuSpecialThrowOf(야수, 8, -1).special).toBe(false)
  })

  it('외야수가 17틱 넘게 던지면 송구 속도가 +0xd8 = 130% 가 된다 (a16dc · 0xa0fc4)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(throwTicksToFielder(야수[8], 야수[1])).toBeGreaterThan(17)
    const 특수 = cpuSpecialThrowOf(야수, 8, 1)
    expect(특수.special).toBe(true)
    if (!특수.special) return
    expect(특수.thrower.throwSpeed).toBe(Math.trunc((야수[8].throwSpeed * 130) / 100))
    expect(throwTicksToFielder(특수.thrower, 야수[1])).toBeLessThan(throwTicksToFielder(야수[8], 야수[1]))
  })
})

describe('슬라이딩 효과음 10 — 사람 키 0x5199c · 자동 0x5268c', () => {
  const 땅볼1루: DefensePlayInput = {
    outcome: 땅볼아웃,
    // 원본 코드 3 — 투수가 바운드 뒤 6틱에 줍고 2루로 던진다. (예전 손-패턴 [113, 500, 300] 은 결과를 먼저 정하던
    // 다리 없이 돌리면 투수가 뜬 채로 잡는 공이다)
    trajectory: battedBallTrajectory([81, 897, 290, 1]),
    bases: 주자1루,
    outs: 0,
    runAbility: 500,
    throwMode: '자동',
  }
  const 소리틱 = (input: DefensePlayInput) => {
    let state = startDefensePlay(input)
    const ticks: number[] = []
    while (!isDefensePlayFinished(state)) {
      const tick = state.tick
      state = stepDefensePlay(state)
      if (state.slidingSoundThisTick) ticks.push(tick)
    }
    return { ticks, log: state.log }
  }

  it('송구가 향하는 루로 6틱 안에 닿는 주자는 키 없이 슬라이딩하고 그 틱에 소리가 난다 (0xb030c)', () => {
    const { ticks, log } = 소리틱(땅볼1루)
    const 자동 = log.filter((line) => line.includes('자동 슬라이딩'))
    expect(자동.length).toBeGreaterThan(0)
    expect(ticks).toEqual(자동.map((line) => Number.parseInt(line, 10)))
  })

  it('자동 슬라이딩은 슬라이딩 중인 주자를 다시 세지 않아 주자마다 한 번이다', () => {
    const { log } = 소리틱(땅볼1루)
    const 주자들 = log.filter((line) => line.includes('자동 슬라이딩')).flatMap((line) => line.split('주자 ')[1].split('·'))
    expect(new Set(주자들).size).toBe(주자들.length)
  })
})

describe('송구 0xb2e38 — 중계 b4616 · AI 9 미루기 · 던진 야수 AI 0 · 내야 레이저 지우기 · 결과 코드 9', () => {
  // r214: 사람 키(b4660 → 0xb2c90)로 고른 송구로 바꿨다. CPU 송구 결정 0xafa60 은 성공하면 afb08 에서 0xb0ea0 으로 계획(+0x14c)을
  // 지우므로(직접 뜸) CPU 가 정한 먼 송구는 b4616 이 잇지 않는다 — 예전 시험은 CPU 송구로 이어 던지기를 기대했다(원본과 다름)
  it('외야수의 먼 송구는 중계맨이 받아 준비 틱(내야 3)이 지난 틱에 이어 던진다 (0xb3444 [0]·[4] · b4616)', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([134, 670, 1552, 0]), // 원본 코드 1 — 좌익수가 35틱에 뜬 채로 잡는다
      bases: EMPTY_BASES,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: false,
      throwMode: '수동',
      controls: { side: '수비', keyAt: (tick) => (tick === 36 ? { key: '2' } : null) },
    })
    const [첫, 둘] = 결과.log.filter((line) => line.includes('송구 —'))

    // 좌익수(7)가 2루로 — 거리 ≥ 17000 이라 유격수(5)가 중계한다. 첫 송구의 도착은 중계맨이 받는 틱이다
    expect(첫).toMatch(/^41틱 2루로 송구 — \d+틱 도착 \(5번 야수 중계\) \(7번 야수\)$/)
    const 받는틱 = Number(첫.split('— ')[1].split('틱')[0])
    expect(결과.throwArrivalTick).toBe(받는틱)
    // 쥐기 0xb2710 이 +0xc8 = 3 을 넣고, b4616 의 0xb2e38 은 vtC4 가 참이 되는 틱에 최종 받는 야수에게 던진다
    expect(둘).toMatch(new RegExp(`^${받는틱 + 3}틱 2루로 송구 — \\d+틱 도착 \\(중계 이어 던지기\\) \\(5번 야수\\)$`))
  })

  it('CPU 송구 결정 0xafa60 이 던진 먼 송구는 계획이 지워져(afb08 0xb0ea0) 중계맨이 이어 던지지 않는다 — 쥐기의 +0x128 로 다시 고른다', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([134, 670, 1552, 0]),
      bases: EMPTY_BASES,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
    })
    const 송구 = 결과.log.filter((line) => line.includes('송구 —'))
    expect(송구[0]).toMatch(/^41틱 2루로 송구 — \d+틱 도착 \(5번 야수 중계\) \(CPU 결정\) \(7번 야수\)$/)
    // 주자가 없어 0xafb24 가 고를 루가 없다 — 유격수가 공을 든 채 판이 닫힌다
    expect(송구).toHaveLength(1)
    expect(결과.log.some((line) => line.includes('중계 이어 던지기'))).toBe(false)
  })

  it('던진 야수는 커버·AI 9 가 아니면 AI 0 — 시작 자리 0xd86ec 로 걸어 돌아간다 (b2df8~b2e14 · b476a)', () => {
    const state = startDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([134, 670, 1552, 0]), // 원본 코드 1
      bases: EMPTY_BASES,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
    })
    while (state.tick <= 41) stepDefensePlay(state)
    // b2e14 는 AI 칸(+0x84)만 0 으로 — 목표는 그대로다(r180). 다음 목록 틱이 던진 뒤 워드(+0xb1)를 지우며 vt10 으로 목표 = 위치,
    // 그다음 AI 고리 b476a 가 vtcc 면 시작 자리로 고친다
    expect(state.fielders[7].aiState).toBe(AI_STATE.IDLE)
    let 고친틱 = -1
    for (let step = 0; step < 4 && 고친틱 < 0; step += 1) {
      stepDefensePlay(state)
      if (isSamePointXZ(state.fielders[7].target, FIELDER_START_POSITIONS[7])) 고친틱 = state.tick
    }
    expect(고친틱).toBeGreaterThan(0)
    const 거리 = (point: { x: number; z: number }) => Math.hypot(point.x - FIELDER_START_POSITIONS[7].x, point.z - FIELDER_START_POSITIONS[7].z)
    const 전 = 거리(state.fielders[7].position)
    stepDefensePlay(state)
    expect(거리(state.fielders[7].position)).toBeLessThan(전)
  })

  describe('AI 9 — 받을 야수가 1구간 틱 안에 못 닿으면 미루고, 닿을 때가 되면 0xb2c90 으로 다시 보낸다', () => {
    // 3루 땅볼을 키 '6'(1루)으로 한 번 고르고, 포구 다음 틱에 1루수를 1루에서 6675 떨어진 곳으로 옮긴다
    const 미루기 = (z: number) => {
      let state = startDefensePlay({
        outcome: 땅볼아웃,
        // 원본 코드 3 — 3루수가 바운드 뒤에 줍는다 (예전 [120, 659, 333] 은 다리 없이 돌리면 3루수가 뜬 채로 잡는 공이다)
        trajectory: battedBallTrajectory([124, 907, 330, 1]),
        bases: EMPTY_BASES,
        outs: 0,
        controls: { side: '수비', keyAt: (tick) => (tick === 0 ? { key: '6', isRepeat: false } : null) },
      })
      const 기록: { tick: number; ai: number; target: { x: number; z: number } }[] = []
      while (!isDefensePlayFinished(state)) {
        if (state.tick === state.catchTick + 1) {
          state.fielders = state.fielders.map((fielder) => (fielder.slot === 2 ? { ...fielder, position: { x: 25_946, y: 0, z } } : fielder))
        }
        state = stepDefensePlay(state, state.tick === 0 ? { key: '6', isRepeat: false } : null)
        const holder = state.fielders[4]
        기록.push({ tick: state.tick - 1, ai: holder.aiState, target: holder.target })
      }
      return { state, 기록 }
    }

    it('미룰 때 공 가진 야수는 AI 9 로 그 루를 향해 걷고(vt48), 놓아주는 틱에 던지고 AI 0 이 된다 (b30a2 · b4838 · b48ac)', () => {
      const { state, 기록 } = 미루기(20_500)
      expect(state.log).toContain('16틱 4번 야수가 1루 송구를 미룬다 — 2번 야수가 늦다 (AI 9)')
      const 송구 = state.log.find((line) => line.includes('(AI 9 미룬 송구)'))
      expect(송구).toMatch(/^17틱 1루로 송구 — \d+틱 도착 \(AI 9 미룬 송구\) \(4번 야수\)$/)
      const 미룬동안 = 기록.filter((entry) => entry.tick >= 16 && entry.tick < 17)
      expect(미룬동안.every((entry) => entry.ai === AI_STATE.RECEIVE)).toBe(true)
      expect(미룬동안[0]?.target).toEqual(basePosition(1))
      // b48ac 가 AI 0 으로 놓아준 뒤 — 송구의 vt34 가 받을 1루수를 +0x130 으로 세워 같은 틱 vt4c 끝 0xb1c90(1d 절)이 3루 커버를 그에게 준다
      expect(기록.find((entry) => entry.tick === 17)?.ai).toBe(AI_STATE.COVER_THIRD)
    })

    it('받을 야수가 늦게 닿으면 그때까지 안 던진다 — AI 9 는 0xafa60 도 막고, 판 끝 세기(+0x120) 51틱 안에 닿으면 그때 던진다', () => {
      const { state } = 미루기(17_575)
      expect(state.log.some((line) => line.includes('미룬다'))).toBe(true)
      // 판 진행 관문 0xb0d28 은 공을 쥔 채 주자가 다 선 틱을 51틱 더 돌린다 — 그사이 1루수가 닿아 b4838 이 놓아준다
      const 송구들 = state.log.filter((line) => line.includes('송구 —'))
      // (1루수가 대각선을 맨해튼 걸음 0xbf158 로 걸어 한 틱 이르게(35) 놓아준다)
      expect(송구들).toEqual(['35틱 1루로 송구 — 43틱 도착 (AI 9 미룬 송구) (4번 야수)'])
    })
  })

  it('내야수 → 내야수 송구는 레이저 표시를 지운다 — 확정돼 있어도 보통 송구(악송구 · 흔들림 굴림 포함)로 나간다 (b2ee6)', () => {
    // 레이저 굴림 0x66a8c 는 공 가진 야수가 외야수일 때만 돈다(0x523e6, r201). 그래서 좌익수(7)가 쫓는 공에 굴려 확정한 뒤
    // 그가 펌블해 튕긴 공(0xb3148)을 유격수(5)가 주워 2루수(3)에게 던지는 판으로 본다 — 확정 칸(+0x19ae)은 쥔 야수가 바뀌어도 남는다.
    // 굴림 차례: 필살수비 A · B(0.9, 실패) → 레이저(0, 통과 — 사람 수비라 반짝임, 같은 틱 새 키로 확정) → 펌블(0, 좌익수) →
    // 튕김 rand(−20, 20)(0.5) → 펌블(0.999, 실패) → 그 뒤 0.999 · 0
    let state = startDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([115, 1401, 400, 2]), // 원본 코드 19
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0.9, 0.9, 0, 0, 0.5, 0.999, 0.999, 0]),
      controls: 계속누름('수비', '2'),
    })
    while (!isDefensePlayFinished(state)) state = stepDefensePlay(state, { key: '2', isRepeat: false })

    // 확정(+0x19ae)으로 0x400bc 가 쏘아 +0x1f4 를 세우고 경기를 멈춘다 — 연출 0x4403c 단계 0 이 +0x19ae 를 내린다.
    // 유격수(5)가 2루수(3)에게 던지므로 0xb2e38 이 +0x1f4 를 지워(b2ee6) 보통 송구(0xa1620 — 흔들림 굴림)로 나간다
    // (좌익수 · 유격수 걸음이 맨해튼 0xbf158 이라 틱이 뒤로 밀렸다 — 펌블 57 · 줍기 83 · 발사 86 · 송구 88)
    expect(state.log).toContain('57틱 7번 야수 펌블 (0xbc2)')
    expect(state.log).toContain('83틱 5번 야수가 잡았다 (종류 0)')
    expect(state.log.filter((line) => line.includes('레이저'))).toEqual(['86틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993'])
    expect(state.log).toContain('88틱 2루로 송구 — 108틱 도착 (흔들린 긴 송구 — 3번 야수가 받는다) (5번 야수)')
    expect(state.laserConfirmed).toBe(false)
    expect(state.laserArmed).toBe(false)
    expect(state.laserThrow).toBe(false)
  })

  it('원본 코드 9 [42, 529, 397, 1] 무사 1루 — 1루를 직접 밟으러 간 1루수와 포수가 타자주자를 협살해 태그한다 (r276)', () => {
    // 1루수(2)가 17틱에 잡아 1루를 직접 밟으러 간다(20틱). 협살 고르기 0xb398c 는 뒤 주자부터 보며 루에 아직 안 닿은 주자를 고르므로
    // (주자 +0x14 = 위치 — `legTotalTicksOf`) 2루로 가는 1번 주자가 먼저 걸리고, 그가 2루에 닿은 뒤 26틱에 타자주자가 대상이 된다.
    // 예전 웹(구간 출발점으로 35%)은 21틱에 타자주자를 골라 38틱에 결과 코드 9(b4412 — 공 든 야수가 루에 닿았는데 주자가 서 있음)를 냈다.
    // ⚠️ b4412 결과 코드 9 갈래를 내는 판은 원본 패턴 표 · 주자 · 아웃 · 주력 조합과 단일 · 이중 주루 키에서 다시 못 찾았다(r276)
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([42, 529, 397, 1]), // 원본 코드 9
      bases: 주자1루,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
    })

    expect(결과.log).toContain('20틱 2번 야수가 1루를 직접 밟으러 간다')
    expect(결과.log).toContain('26틱 협살 시작 — 0번 주자 1↔0루 (야수 2·1)')
    expect(결과.log).toContain('29틱 협살 태그 — 0번 주자 아웃')
  })

  it('3아웃이면 그 틱 끝에서 판이 닫힌다 — 판 진행 관문 0xb0d28 의 state[6] > 2 (b0dbe)', () => {
    // 2아웃 2루 땅볼 — 유격수가 1루로 던져 타자주자가 26틱에 1루 포스(0xb36d0 결과 2)로 셋째 아웃이 된다
    // (맨해튼 걸음 0xbf158 로 예전 21틱보다 늦다)
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([113, 1111, 100, 0]), // 원본 코드 3
      bases: { first: false, second: true, third: false },
      outs: 2,
      runAbility: 500,
      defenseIsCpu: true,
    })

    expect(결과.log).toContain('26틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
    // 다음 틱부터는 아무것도 안 돈다
    expect(결과.log.some((line) => line.startsWith('27틱'))).toBe(false)
    expect(결과.ticks).toHaveLength(27)
    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.outcome).toEqual(땅볼아웃)
  })
})

describe('낙구 전에 아무도 못 닿는 타구 — 자르지 않은 예보(0xb12d0 · 0xb3b38 우선순위 6~8)', () => {
  /** 코드 15 패턴 — 내리꽂혀(플래그 비트0) 낙구 전에 아무도 못 닿는다 */
  const 일찍떨어지는공: BattedBallPattern = [90, 1040, 418, 1]

  it('바운드 뒤에 줍는 야수를 골라 판이 끝까지 가지 않는다 (예전엔 포구 틱 240)', () => {
    const trajectory = battedBallTrajectory(일찍떨어지는공)
    const result = play(뜬공아웃, 주자1루, 0, 일찍떨어지는공)
    expect(result.catchTick).toBeGreaterThan(trajectory.landingTick)
    expect(result.catchTick).toBeLessThan(40)
    expect(result.catchFielderSlot).toBe(3)
    // 뜬 채로 잡히지 않았다 — 원본에서 "잡힐 뜬공" 은 예보(vt94 = +0x11c ≤ 낙구 틱)가 정한다
    expect(result.caughtOnTheFly).toBe(false)
    // 2루수가 15틱에 주웠을 때는 늦어 CPU 송구 결정이 아무 데도 안 던진다 — 1루 주자는 바운드 포스로 2루, 타자주자는 1루 · 단타
    expect(result.advance.outsAdded).toBe(0)
    expect(result.advance.bases).toEqual({ first: true, second: true, third: false })
    expect(result.outcome).toEqual(단타)
    // 판 진행 관문 0xb0d28: 주자가 다 서고 공을 쥔 틱부터 +0x120 이 관문 51 번(17틱)을 세고 닫는다 (예전엔 240틱 끝까지 갔다)
    expect(result.ticks.length).toBeLessThan(100)
  })

  it('낙구 전에 잡히는 뜬공은 그대로 뜬공이다', () => {
    const pattern: BattedBallPattern = [129, 802, 500, 0]
    const result = play(뜬공아웃, 주자1루, 0, pattern)
    expect(result.caughtOnTheFly).toBe(true)
    expect(result.catchTick).toBeLessThanOrEqual(battedBallTrajectory(pattern).landingTick)
    expect(result.advance.bases).toEqual(주자1루)
  })
})

describe('판 진행 관문 0xb0d28 · 판 끝 결과 코드 0x9d5bc (b44f6) — playGate', () => {
  /** 원본 코드 18 [107, 879, 1211] — 바운드 뒤 담장 위로 넘는 공(결과 코드 10) */
  const 바운드넘김: BattedBallPattern = [107, 879, 1211, 0]
  /** 끝까지 돌리며 틱마다 상태를 적는다 */
  const 돌리기 = (input: DefensePlayInput) => {
    let state = startDefensePlay(input)
    const 세기: number[] = []
    const 주자: { tick: number; required: number[] }[] = []
    while (!isDefensePlayFinished(state)) {
      state = stepDefensePlay(state, null)
      세기.push(state.endCounter)
      주자.push({ tick: state.tick - 1, required: state.runners.map((runner) => runner.state.requiredBase) })
    }
    return { state, 세기, 주자 }
  }

  it('주자가 다 서고 공을 쥔 뒤 관문을 부를 때마다 +0x120 이 오르고, 52번째 호출에서 닫는다 (b0e46 `old > 50`) — 한 그림에 G3 · G1 · G2 세 번', () => {
    const { state, 세기 } = 돌리기({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
    })
    // 그리기 0x46e3c(G3) · 다음 그림 0x3f0b8(G1) · 슬롯 2 머리 52502(G2) — 틱마다 3 씩. 타자주자가 1루에 닿는 이동(다음 그림의
    // 목록 틱)은 G1 과 G2 사이라, 그 틱 끝 G3 · G1 은 아직 안 선 주자를 보고 0 으로 두고 G2 부터 센다(1).
    // 52번째 호출(old 51)은 18 번째 틱 끝의 G2 다 — G3(old 49) · G1(old 50)은 열려 마지막 그림의 HOMERUN 글자 관문도 열려 있고,
    // G1 이 연 다음 그림(목록 틱 · 카메라만 도는 그림)이 `closingListFrame` 으로 하나 더 찍힌다
    expect(세기.at(-1)).toBe(52)
    const 시작 = 세기.indexOf(1)
    expect(세기.slice(시작)).toEqual(Array.from({ length: 18 }, (_unused, index) => 1 + index * 3))
    expect(state.tick).toBe(시작 + 18)
    expect(state.drawGateOpen).toBe(true)
    expect(state.ticks).toHaveLength(state.tick + 1)
    expect(state.ticks.at(-1)?.closingListFrame).toBe(true)
    expect(state.ticks.at(-1)?.cameraFrozen).toBe(false)
  })

  it('판 시작 · 안 쥔 틱은 0x3f378(G4)까지 네 번 불러도 +0x120 이 0 이다 — 쥐기 전 틱 끝의 세기는 0', () => {
    const { 세기 } = 돌리기({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
    })
    const 시작 = 세기.indexOf(1)
    expect(시작).toBeGreaterThan(0)
    expect(세기.slice(0, 시작).every((value) => value === 0)).toBe(true)
  })

  it('공이 처음 땅에 닿는 틱에 결과 코드 6 을 내고 바운드 포스(0xa95e8)를 세운다 — 쥐기 전이다', () => {
    const trajectory = battedBallTrajectory(fixturePatternFor(땅볼아웃))
    const { state, 주자 } = 돌리기({ outcome: 땅볼아웃, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 6 (0x9d5bc)`)
    expect(state.catchTick).toBeGreaterThan(trajectory.landingTick)
    // 낙구 틱 끝에 1루 주자(목록 1번)의 요구 루가 2루로 선다
    expect(주자.find((entry) => entry.tick === trajectory.landingTick - 1)?.required[1]).toBe(-1)
    expect(주자.find((entry) => entry.tick === trajectory.landingTick)?.required[1]).toBe(2)
    expect(state.lastEventCode).toBe(6)
  })

  it('먼저 쥔 뜬공은 0x9d5bc 를 안 부른다 — 결과는 vt90 의 13 뿐 (b444e `+0x112 ≠ 0 → b4540`)', () => {
    const pattern: BattedBallPattern = [129, 802, 500, 0]
    const { state } = 돌리기({ outcome: 뜬공아웃, trajectory: battedBallTrajectory(pattern), bases: EMPTY_BASES, outs: 0 })
    expect(state.log.some((line) => line.includes('0x9d5bc'))).toBe(false)
    expect(state.ballContacted).toBe(true)
  })

  it('리터치 요구 루를 밟기 전에는 그 너머로 못 간다 (주자 틱 a028c) — 요구 루를 못 푼 채 송구로 잡히던 아웃이 없다', () => {
    // 2루 주자 · CPU 수비 · 깊은 중견수 뜬공: 예전엔 자동 진루가 리터치 틱에 3루로 보내 요구 루 2 가 남아 2루 송구로 죽었다
    const result = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory([90, 810, 1592, 0]),
      bases: { first: false, second: true, third: false },
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: createSeededRandom(31),
    })
    expect(result.caughtOnTheFly).toBe(true)
    expect(result.advance.outsAdded).toBe(1)
    expect(result.log.some((line) => line.includes('루 아웃'))).toBe(false)
  })

  it('바운드 뒤 담장 위로 넘는 공은 낙구 틱에 결과 코드 10 — +0x124 · 종류 7(투구 때 루 + 2 까지 무조건 진루)', () => {
    const 홈 = { x: 20_000, y: 1_000, z: 30_000 }
    // 10틱에 떨어지고(높이 0) 20틱에 높이 2500 으로 담장선을 넘는 궤적 — 웹 궤적 근사에는 없는 모양이라 손으로 만든다.
    // 낙구 전에는 높이 6000 으로 날아 아무도 못 닿는다(예보 0xb12d0 은 자르지 않은 궤적 전체를 본다)
    const pointAt = (tick: number) => {
      const t = Math.max(0, Math.min(20, Math.trunc(tick)))
      const y = t === 10 ? 0 : t < 10 ? 6_000 : (t - 10) * 250
      return { x: 20_000, y, z: 홈.z - t * 1_300 }
    }
    const trajectory = {
      length: 21,
      pointAt,
      landingTick: 10,
      fenceTick: 20,
      poleTick: -1,
      startedAtPlate: true,
    }
    let state = startDefensePlay({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    while (state.tick <= 10) state = stepDefensePlay(state, null)
    expect(state.log).toContain('10틱 낙구 — 판 끝 결과 코드 10 (0x9d5bc)')
    expect(state.groundRuleFlag).toBe(true)
    expect(state.play.kind).toBe(7)
    expect(state.lastEventCode).toBe(10)
  })

  it('담장 면(높이 ≤ 1999)에 맞은 공은 담장선 틱(aa4)이 아니라 aa8 이다 — 낙구 틱의 결과 코드 6', () => {
    // 원본 코드 15 [100, 1000, 700]: 17틱에 떨어져 굴러가 36틱에 가운데 담장 면에 맞는다(0xa2cae) — 담장선(aa4)은 없다.
    // (예전 원본 코드 0 [90, 810, 1592] 는 담장 면에 맞고 떨어지는 공이지만 중견수가 낙구 틱에 뜬 채로 잡는다)
    const pattern: BattedBallPattern = [100, 1000, 700, 0]
    const trajectory = battedBallTrajectory(pattern)
    expect(trajectory.fenceTick).toBe(-1)
    expect(trajectory.wallTick).toBe(36)
    const { state } = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 6 (0x9d5bc)`)
    expect(state.play.kind).toBe(1)
  })

  it('바운드 뒤 담장 위로 넘는 원본 궤적 — 낙구 틱에 0x9d5bc 가 미리 깐 aa4(state[0x20])를 보고 코드 10 (511ea · b44f6)', () => {
    // 원본 코드 18 [107, 879, 1211]: 바운드한 뒤 담장 위로 넘는다 — 원본 표에서 아무도 낙구 전에 못 닿는 단 하나의 그런 공.
    // (예전 원본 코드 0 [92, 781, 1313] 은 중견수가 낙구 틱에 뜬 채로 잡는다)
    const trajectory = battedBallTrajectory(바운드넘김)
    expect(trajectory.fenceTick).toBeGreaterThan(trajectory.landingTick)
    const { state } = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 10 (0x9d5bc)`)
    expect(state.groundRuleFlag).toBe(true)
  })

  it('무조건 진루 갈래(+0x111 · +0x129 · 종류 7 — af964 · af970 · af97a)는 타자주자도 결과 코드 루 너머로 보낸다', () => {
    // 원본 코드 24 [7] [98, 995, 1369]: 속도 < 1100 이라 웹 타석 결과는 2루타지만 29틱에 담장 위로 넘는다(코드 8)
    const 홈런공 = battedBallTrajectory(BATTED_BALL_PATTERNS[24][7])
    expect(홈런공.fenceTick).toBe(29)
    expect(홈런공.landingTick).toBe(32)
    const 홈런 = 돌리기({ outcome: 이루타, trajectory: 홈런공, bases: 주자1루, outs: 0 })
    expect(홈런.state.homeRunFlag).toBe(true)
    // 타자주자까지 홈을 밟아 0xa990c == 0 — 관문 b0e04 가 닫는다(예전엔 타자주자가 2루에 선 채 240틱까지 갔다)
    expect(홈런.state.runners.every((runner) => runner.state.scored)).toBe(true)
    expect(홈런.state.held.scoreboardRuns).toBe(2)
    expect(홈런.state.ticks.length).toBeLessThan(240)
    // 바운드 뒤 담장을 넘는 코드 10(종류 7)은 투구 때 루 + 2 까지 — 단타 결과의 타자주자도 2루까지 간다
    const 바운드 = 돌리기({ outcome: 단타, trajectory: battedBallTrajectory(바운드넘김), bases: EMPTY_BASES, outs: 0 })
    expect(바운드.state.play.kind).toBe(7)
    expect(바운드.state.runners[0].state.startBase).toBe(2)
  })

  it('state[0x19](투구 판정 0.1% 사건)가 서면 낙구 틱의 0x9d5bc 가 0 — 사건 코드가 안 난다 (9d5ce)', () => {
    const trajectory = battedBallTrajectory(바운드넘김)
    const 사건 = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0, specialEvent: true })
    expect(사건.state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 0 (0x9d5bc)`)
    expect(사건.state.groundRuleFlag).toBe(false)
    expect(사건.state.lastEventCode).not.toBe(10)
  })

  it('폴 충돌 굴림 rand(−25, 25)(0xa2c64)는 판 시작에서 필살수비 굴림 뒤에 난수로 다시 깐다 — 굴림이 없던 궤적은 그대로', () => {
    // 원본 코드 24 [45, 1402, 991]: 20틱에 1루 쪽 폴 — 새 각 = 149 + rand(−25, 25)
    const 폴 = battedBallTrajectory([45, 1402, 991, 0])
    const 굴림 = startDefensePlay({ outcome: 단타, trajectory: 폴, bases: EMPTY_BASES, outs: 0, random: 고정난수(0) })
    expect(굴림.trajectory).not.toBe(폴)
    expect(굴림.trajectory.pointDetailAt?.(20).angle).toBe(149 - 25)
    const 그대로 = startDefensePlay({ outcome: 단타, trajectory: 폴, bases: EMPTY_BASES, outs: 0 })
    expect(그대로.trajectory).toBe(폴)
    expect(그대로.trajectory.pointDetailAt?.(20).angle).toBe(149)
  })

  it('협살이 풀린 틱에 날아가던 짝 송구도 짝이 받는다 — 공을 아무도 안 쥔 채 240틱까지 가지 않는다', () => {
    // 원본 코드 3 [86, 899, 400, 1] · 18틱 귀루 · 19틱 진루: 1루수가 19틱에 짝 유격수에게 던진 공이 날아가는 동안 주자가 2루에 붙어
    // 고르기(0xb398c)가 −1 이 되며 협살이 풀린다
    // (예전 [68, 808, 282, 1] · 16/17틱은 맨해튼 걸음 0xbf158 뒤로 협살이 안 선다. 그 전 장면 [87, 1388, 222] 씨앗 26 은 투수 펌블로
    //  튄 공에 기댄 협살이었다 — 투수 칸은 선수가 없어 펌블하지 않는다)
    const keys: Record<number, string> = { 18: '3', 19: '2' }
    const result = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([86, 899, 400, 1]),
      bases: 주자1루,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      controls: { side: '공격', keyAt: (tick) => (keys[tick] === undefined ? null : { key: keys[tick] }) },
    })
    expect(result.rundowns).toBeGreaterThan(0)
    expect(result.log).toContain('19틱 협살 송구 2→5 — 27틱 도착 (5번 야수가 받는다)')
    expect(result.ticks.length).toBeLessThan(240)
  })
})

describe('defenseSkillIdsOf — 수비 칸별 스킬은 능력치와 같은 칸 고르기다 (r214)', () => {
  it('자리 코드 − 1 칸 · 겹치면 앞 선수 · 칸 0 은 니블 1(지명타자) · 빈 칸은 빈 목록', () => {
    const skills = defenseSkillIdsOf([
      { position: 8, skillIds: [21] },
      { position: 8, skillIds: [5] },
      { position: 1, skillIds: [3] },
      { position: 0x24, skillIds: [7] },
    ])
    expect(skills).toHaveLength(9)
    expect(skills[7]).toEqual([21])
    expect(skills[0]).toEqual([3])
    expect(skills[3]).toEqual([7])
    expect(skills[5]).toEqual([])
  })
})

describe('AI 0xb 담장 갈래 — 고르기 0xb3b38 은 +0x90 만 적고 목표는 AI 고리 b4b5c 가 vt14 로 적는다 (r214)', () => {
  it('판 시작에는 목표가 그대로이고 첫 틱 AI 고리가 담장 앞 점(+0x90)을 목표로 적어 그쪽으로 걷는다', () => {
    // 원본 코드 9 [144, 1010, 1250] — 좌익수(7)가 담장 갈래로 간다
    const state = startDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([144, 1010, 1250, 0]),
      bases: EMPTY_BASES,
      outs: 0,
      defenseIsCpu: true,
    })
    const 처음 = state.fielders[7]
    expect(처음.aiState).toBe(AI_STATE.PICK_UP)
    expect(처음.pickUpPoint).toBeDefined()
    // b3e96~b3eba 는 +0x90 만 — 목표(+0x2c)는 아직 시작 자리다
    expect(처음.target).toEqual(FIELDER_START_POSITIONS[7])
    stepDefensePlay(state)
    expect(state.fielders[7].target).toEqual(처음.pickUpPoint)
    const 거리 = (point: { x: number; z: number }) => Math.hypot(point.x - 처음.pickUpPoint!.x, point.z - 처음.pickUpPoint!.z)
    expect(거리(state.fielders[7].position)).toBeLessThan(거리(처음.position))
  })
})

describe('포구 틱 b4292 — 발밑 루에 주자가 서 있는 포구는 결과 코드 9 (쥐기 b42c8 앞)', () => {
  it('2루 위에서 송구를 받는 틱에 2루에 마지막으로 닿은 주자가 서 있으면 9 — 타구 포구뿐 아니라 송구 받기에도 걸린다', () => {
    // 원본 코드 15 [130, 884, 618]: 좌중간에 떨어진 공을 7번 야수가 21틱에 줍고, 사람 키 '2'(22틱)로 2루에 던진 공을 2루 위의
    // 3번 야수가 40틱에 받는다 — 그 사이 1번 주자는 2루에 닿아 서 있다. 굴림을 빼 레이저가 안 선다
    // (r214: CPU 송구는 계획이 지워져 중계가 안 이어지므로(afb08 0xb0ea0) 사람 키로 고른 송구다. 예전 [90, 810, 1592] · 37틱 키는
    //  맨해튼 걸음 0xbf158 뒤로 받는 틱에 1번 주자가 2루에 서 있지 않다)
    const result = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([130, 884, 618, 0]),
      bases: 주자1루,
      outs: 1,
      defenseIsCpu: false,
      throwMode: '수동',
      controls: { side: '수비', keyAt: (tick) => (tick === 22 ? { key: '2' } : null) },
    })
    expect(result.log).toContain('27틱 2루로 송구 — 40틱 도착 (7번 야수)')
    expect(result.log).toContain('40틱 결과 코드 9 — 3번 야수가 2루 위에서 잡았지만 1번 주자가 서 있다 (b4292)')
    // 9 를 내는 틱에도 쥐기는 그대로 돈다(b42c8)
    expect(result.log).toContain('40틱 3번 야수가 잡았다 (종류 0)')
  })
})

describe('필살타법 성공 굴림 0x517e6 — 메시지 0x11(필살수비 · 쏘기) 뒤, 판 시작에서', () => {
  // 코드 15 [49, 802, 799] — 쫓는 야수가 투수·포수가 아니라 필살수비 굴림 둘(점프 · 슬라이딩)이 돈다. 폴에 안 닿는다
  const 쏜공 = (specialSwing?: { number: number; isAceBatter: boolean }) =>
    registerContact(땅볼아웃, { batterHand: 0, pattern: [49, 802, 799, 0], resultCode: 15, ...(specialSwing === undefined ? {} : { specialSwing }) })
  const 시작 = (outcome: AtBatOutcome, values: readonly number[]) =>
    startDefensePlay({
      outcome,
      trajectory: battedBallTrajectory([49, 802, 799, 0]),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수(values),
    })

  it('필살수비 두 굴림(실패) 다음 셋째 굴림이 필살타법이다 — 0 이면 15·10 > 0 이라 성공', () => {
    // 예전 웹은 타석 판정 안에서 먼저 굴려 첫 값(0.999)을 먹고 실패했다
    expect(시작(쏜공({ number: 1, isAceBatter: false }), [0.999, 0.999, 0]).uncatchable).toBe(true)
    expect(시작(쏜공({ number: 1, isAceBatter: false }), [0.999, 0.999, 0.999]).uncatchable).toBe(false)
  })

  it('필살수비는 필살타법 성공 여부와 무관하게 굴린다 — 원본 차례에서는 그때 아직 모른다', () => {
    // 첫 굴림 0 → 점프 창이 열린다(필살타법 타구라도)
    const 열림 = 시작(쏜공({ number: 1, isAceBatter: false }), [0, 0])
    expect(열림.specialDefense.jumpUnlocked).toBe(true)
    expect(열림.uncatchable).toBe(true)
  })

  it('필살 스윙이 아닌 공은 굴리지 않는다', () => {
    expect(시작(쏜공(), [0.999, 0.999, 0]).uncatchable).toBe(false)
  })
})

describe('필살수비가 열리면 표시 패턴으로 바꿔 쏜다 — 5107c 점프 0xb097c · 5112c 슬라이딩 0xb09ac', () => {
  const 쏜패턴: BattedBallPattern = [49, 802, 799, 0]
  /** 장면 덱 섞기 1275 번은 0.5, 그 뒤는 values 차례 */
  const 장면난수 = (values: readonly number[]) => {
    const 섞기 = Object.values(BATTED_BALL_PATTERNS).reduce((sum, patterns) => sum + patterns.length, 0)
    const random = 차례난수([...Array<number>(섞기).fill(0.5), ...values])
    openScenePatternDeck(random)
    return random
  }
  const 시작 = (random: RandomPort) =>
    startDefensePlay({
      outcome: registerContact(땅볼아웃, { batterHand: 0, pattern: 쏜패턴, resultCode: 15 }),
      trajectory: battedBallTrajectory(쏜패턴),
      bases: EMPTY_BASES,
      outs: 0,
      random,
    })

  it('점프 창(첫 굴림 0)이 열리면 rand(0, 개수) 한 장으로 궤적을 바꾼다 — 목록은 장면 덱이 섞인 차례다', () => {
    const random = 장면난수([0, 0])
    const 목록 = displayPatternListOf(scenePatternDeckOf(random)!.deck, 'jump')
    const state = 시작(random)
    expect(state.specialDefense.jumpUnlocked).toBe(true)
    const 바꾼 = 목록[0]
    expect(state.trajectory.pointAt(10)).toEqual(battedBallTrajectory([바꾼[0], 바꾼[1], 바꾼[2], 바꾼[3] & 1]).pointAt(10))
  })

  it('창이 안 열리면 쏜 패턴 그대로다', () => {
    const state = 시작(장면난수([0.999, 0.999]))
    expect(state.trajectory.pointAt(10)).toEqual(battedBallTrajectory(쏜패턴).pointAt(10))
  })
})

describe('맞은 판정 틀에 미리 굴린 메시지 0x11 묶음 — 판 시작이 쏜 공에서 되찾는다 (A-37)', () => {
  // 코드 15 [49, 802, 799] — 필살수비 굴림 둘(점프 · 슬라이딩) · 필살타법 하나가 돈다. 폴에 안 닿는다
  const 입력 = (random: RandomPort): DefensePlayInput => ({
    outcome: registerContact(땅볼아웃, {
      batterHand: 0,
      pattern: [49, 802, 799, 0],
      resultCode: 15,
      specialSwing: { number: 1, isAceBatter: false },
    }),
    trajectory: battedBallTrajectory([49, 802, 799, 0]),
    bases: EMPTY_BASES,
    outs: 0,
    random,
  })

  it('미리 굴리면 판 시작은 그 묶음을 쓰고 더 굴리지 않는다 — 그 사이 굴림(0x13 파티클)은 묶음 뒤다', () => {
    const 값들 = [0.999, 0.999, 0, 0.5, 0.25]
    let 걸음 = 0
    const random = createFractionRandom(() => 값들[Math.min(걸음++, 값들.length - 1)])
    const input = 입력(random)
    const 묶음 = preRollContactMessage(input)
    // 필살수비 둘(실패) · 필살타법(0 → 성공) 세 걸음
    expect(걸음).toBe(3)
    expect(묶음?.uncatchable).toBe(true)
    // 0x13 그림의 파티클 굴림 하나
    random.rand9d(10)
    const state = startDefensePlay(input)
    expect(걸음).toBe(4)
    expect(state.uncatchable).toBe(true)
    expect(state.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
    // 같은 공을 다시 미리 굴려도 굴리지 않는다
    expect(preRollContactMessage(input)).toBe(묶음)
    expect(걸음).toBe(4)
  })

  it('미리 굴린 판은 머리 없는 판(판 시작에서 굴림)과 같은 결과다 — 사이에 굴림이 없으면 차례가 같다', () => {
    const 미리 = createSeededRandom(77)
    const 미리입력 = 입력(미리)
    preRollContactMessage(미리입력)
    const 미리판 = runDefensePlay(미리입력)
    const 바로 = createSeededRandom(77)
    const 바로판 = runDefensePlay(입력(바로))
    expect(미리판.log).toEqual(바로판.log)
    expect(미리판.outcome).toEqual(바로판.outcome)
    expect(미리.rand(0, 1000000)).toBe(바로.rand(0, 1000000))
  })

  it('난수가 없는 입력(예측)은 굴리지 않고 null — 판 시작도 굴리지 않는다', () => {
    const input = { ...입력(createSeededRandom(1)), random: undefined }
    expect(preRollContactMessage(input)).toBeNull()
  })
})

describe('파울 판 — 쏜 공의 파울 각(511b8 state[0x1c])이면 낙구 · 담장선 틱에 0x9d5bc 가 7, 잡히면 13', () => {
  const 쏘기 = (pattern: BattedBallPattern, resultCode: number, strikes: number) =>
    runDefensePlay({
      outcome: registerContact(땅볼아웃, { batterHand: 0, pattern, resultCode }),
      trajectory: battedBallTrajectory(pattern),
      bases: 주자1루,
      outs: 0,
      strikes,
    })

  it('뒤로 튄 파울(코드 9 [311, 273, 247]) — 3틱 낙구에 7, 정산 없이 판 앞 루 그대로 · 스트라이크 ≤ 1 이면 +1', () => {
    const 한스트 = 쏘기([311, 273, 247, 1], 9, 1)
    expect(한스트.log).toContain('3틱 낙구 — 판 끝 결과 코드 7 (0x9d5bc)')
    expect(한스트.foulEnded).toBe(true)
    expect(한스트.outcome).toBeUndefined()
    expect(한스트.advance).toEqual({ bases: 주자1루, runsScored: 0, outsAdded: 0 })
    expect(한스트.foulStrikes).toBe(2)
    expect(쏘기([311, 273, 247, 1], 9, 2).foulStrikes).toBe(2)
  })

  it('파울 각 뜬공을 낙구 전에 잡으면 뜬공 아웃(13) — 파울 판이 아니고 정산은 뜬공 아웃이다', () => {
    const 잡힘 = 쏘기([160, 101, 752, 0], 1, 1)
    expect(잡힘.log).toContain('17틱 0번 주자 뜬공 아웃 (0xb36d0 결과 1)')
    expect(잡힘.foulEnded).toBeUndefined()
    expect(잡힘.outcome).toEqual(뜬공아웃)
    expect(잡힘.advance.outsAdded).toBe(1)
  })

  it('파울 사건(7)이 선 공은 아무도 줍지 않는다 — 포구 틱 갈래가 플레이.vt50 0xb2ac8(+0x110)에 막혀 관문은 공이 멈출 때 닫는다', () => {
    // 예전 웹은 30틱에 투수가 굴러온 파울을 쥐고 그다음 틱에 닫았다 — 원본은 +0x110 이 서면 b4064 가 포구 틱 갈래를 건너뛴다
    const 굴림 = 쏘기([209, 317, 295, 1], 9, 0)
    expect(굴림.log.some((line) => line.includes('잡았다'))).toBe(false)
    expect(굴림.foulEnded).toBe(true)
    expect(굴림.ticks.length).toBe(48)
  })

  it('받는 틱이 지나도 아무도 안 쥔 공은 궤적 점에 그린다 — 0x36dfc 는 공을 늘 0xa25b0(공, 공+0x68) 에 둔다 (36ea6, r313)', () => {
    // 예전 웹은 포구 틱이 지난 안 쥔 공을 공 가진 야수 자리(또는 마지막 송구의 루 자리)에 그렸다
    const 무늬: BattedBallPattern = [209, 317, 295, 1]
    const 굴림 = 쏘기(무늬, 9, 0)
    const 궤적 = battedBallTrajectory(무늬)
    const 지난틱 = 굴림.ticks.map((_, 틱) => 틱).filter((틱) => 틱 >= 굴림.catchTick)
    expect(지난틱.length).toBeGreaterThan(0)
    for (const 틱 of 지난틱) {
      const 공 = 굴림.ticks[틱].ball
      const 점 = 궤적.pointAt(틱)
      expect(공.isHeld).toBe(false)
      expect([공.x, 공.z, 공.height]).toEqual([점.x, 점.z, 점.y])
    }
  })

  it('넓은 페어 각(0x9d640, 35~145) 밖 파울은 state[7] = 0 — 커버 0xb1c90 이 머리(b1cc6)에서 끝나 아무도 루 커버를 안 받는다', () => {
    const 커버받음 = (pattern: BattedBallPattern, resultCode: number) => {
      let state = startDefensePlay({
        outcome: registerContact(땅볼아웃, { batterHand: 0, pattern, resultCode }),
        trajectory: battedBallTrajectory(pattern),
        bases: 주자1루,
        outs: 0,
      })
      let 받음 = false
      for (let step = 0; step < 40 && !isDefensePlayFinished(state); step += 1) {
        받음 ||= state.fielders.some((fielder) => fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD)
        state = stepDefensePlay(state, null)
      }
      return 받음
    }
    // 각 311 · 209 는 넓은 쐐기 밖 — 1루 주자가 있어도 커버 AI(루 + 2)가 하나도 안 선다
    expect(커버받음([311, 273, 247, 1], 9)).toBe(false)
    expect(커버받음([209, 317, 295, 1], 9)).toBe(false)
    // 같은 1루 주자 · 페어 땅볼은 판 시작부터 커버가 선다
    expect(커버받음([51, 435, 315, 1], 1)).toBe(true)
  })
})

describe('희생 [sp+8] · 번트 타구 state[0x13] — 정산 a83e2 · a88e0 이 결과비트 B6(0x40)을 켠다', () => {
  // 1루 주자 · 무사 땅볼 [47, 500, 301, 1] — 타자만 죽고(1루수 태그) 1루 주자가 2루로 간다(득점 · 주자 아웃 없음).
  // (r176: 쥐기가 야수를 옮기지 않아 예전 [51, 435, 315] 는 투수가 포구 지점에 못 닿은 채 쥐어 아무도 태그하지 못한다)
  const 보내기 = (buntKind: number) =>
    runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([47, 500, 301, 1]),
      bases: { first: true, second: false, third: false },
      outs: 0,
      buntKind,
    })

  it('번트로 보내면 희생이고 번트 타구다 — B6 이 선다', () => {
    const 결과 = 보내기(1)
    expect(결과.advance).toEqual({ bases: { first: false, second: true, third: false }, runsScored: 0, outsAdded: 1 })
    expect(결과.sacrifice).toBe(true)
    expect(결과.buntBall).toBe(true)
    const bits = burstResultBitsOf({
      outcome: 결과.outcome!,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      isBunt: 결과.buntBall,
      runnersAdvanced: 결과.sacrifice,
      foulBall: 결과.buntFoulOut,
      runnerInScoringPositionAfter: 결과.scoringBaseRunnerAfter,
    })
    expect(hasBit(bits, BURST_RESULT_BIT.번트진루)).toBe(true)
    // B7 루프 0xa88fc — 판 끝 2루에 1루에서 온 주자(타자주자 아님)가 산 채 서 있다
    expect(결과.scoringBaseRunnerAfter).toBe(true)
    expect(hasBit(bits, BURST_RESULT_BIT.번트득점권)).toBe(true)
  })

  it('스윙 땅볼로 같은 판이면 희생(타수 없음)이지만 번트 타구가 아니라 B6 은 없다', () => {
    const 결과 = 보내기(0)
    expect(결과.sacrifice).toBe(true)
    expect(결과.buntBall).toBeUndefined()
    const bits = burstResultBitsOf({
      outcome: 결과.outcome!,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      isBunt: 결과.buntBall,
      runnersAdvanced: 결과.sacrifice,
    })
    expect(hasBit(bits, BURST_RESULT_BIT.번트진루)).toBe(false)
  })
})

describe('루별 주자 주루 — 주자마다 제 레코드의 속도 (0xa93ac a9462 → 주자+0xa4)', () => {
  it('runAbilities 의 루 값이 그 루에서 출발한 주자 속도가 되고, 없는 루는 runAbility 다', () => {
    const state = startDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([102, 866, 910, 0]),
      bases: 주자1루,
      outs: 0,
      runAbility: 300,
      runAbilities: { 1: 900 },
    })
    expect(state.runners.map((runner) => runner.state.speed)).toEqual([runnerSpeedOf(300), runnerSpeedOf(900)])
  })
})

describe('수비 화면 부착 효과 칸 — 공 가진 야수 고리(0x43cb0) · "!"(+0xb8 · +0xc0) (그림만, 난수 차례 그대로)', () => {
  const 틱 = (결과: DefensePlayResult, tick: number) => 결과.ticks.find((view) => view.tick === tick)
  const 야수 = (결과: DefensePlayResult, tick: number, slot: number) => 틱(결과, tick)?.fielders.find((fielder) => fielder.slot === slot)

  it('쥐기 전에는 고리가 없고, 투수가 쥔 틱(11)부터 공 가진 야수 칸에 뜬다 — 사람 공격이면 애니 3', () => {
    // 대표 땅볼 [113, 500, 300] 은 투수가 11틱에 쥔다
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)
    expect(틱(결과, 10)?.holderMark).toBeNull()
    expect(틱(결과, 11)?.holderMark).toEqual({ slot: 0, anim: 3 })
  })

  it('CPU 공격이면 애니 1, 이름 판 선수는 공 가진 칸의 것을 싣는다', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      defenseIsCpu: true,
      offenseIsCpu: true,
      fielderPlates: [{ name: '선발', pitcherRole: 0 }],
    })
    expect(틱(결과, 11)?.holderMark).toEqual({ slot: 0, anim: 1 })
    expect(틱(결과, 11)?.holderPlate).toEqual({ name: '선발', pitcherRole: 0 })
  })

  it('펌블한 틱의 그림이 +0xb8 = 6 을 보고, 다음 틱부터 야수 틱이 하나씩 줄인다 (b4280 · a12da)', () => {
    // 2루수가 10틱에 펌블한다 (필살수비 A · B 실패 → 펌블 0) — 투수는 선수가 없어 펌블하지 않는다. 레이저는 외야수만(0x523e6, r201)
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(이루수땅볼),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0.9, 0.9, 0, 0.9]),
    })
    expect(야수(결과, 9, 3)?.fumbleTicks).toBe(0)
    expect(야수(결과, 10, 3)?.fumbleTicks).toBe(6)
    expect(야수(결과, 11, 3)?.fumbleTicks).toBe(5)
    expect(야수(결과, 15, 3)?.fumbleTicks).toBe(1)
    expect(야수(결과, 16, 3)?.fumbleTicks).toBe(0)
  })

  it('악송구를 던진 야수는 +0xc0 = 4 (a1908)', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('수비', '8'),
      // 펌블(0.9) → 악송구(0) — 투수가 쫓는 공이라 필살수비는 없고, 레이저는 외야수만 굴린다(0x523e6, r201)
      random: 차례난수([0.9, 0, 0.9]),
    })
    expect(결과.errantThrow).toBe(true)
    // 투수가 11틱에 쥐고 14틱에 던진다
    expect(야수(결과, 14, 0)?.throwErrorTicks).toBe(4)
    expect(야수(결과, 15, 0)?.throwErrorTicks).toBe(3)
  })

  it('부착 효과 칸을 더해도 진행 · 난수 차례는 그대로다 — 같은 판을 두 번 돌리면 로그가 같다', () => {
    const 한번 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0.9, 0, 0.9]),
    })
    const 두번 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0.9, 0, 0.9]),
      fielderPlates: [{ name: 'x', pitcherRole: 0 }],
    })
    expect(두번.log).toEqual(한번.log)
  })
})

describe('마선수 주자 (runnerAces — 0x43aa8 · 0x483a0)', () => {
  it('1루 주자가 마선수면 그 주자 칸(1)에 표시가 붙고, 타자가 아니므로 그 주자의 그림이 실린다', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      runnerAces: { batter: null, first: 3 },
    })
    const 첫그림 = 결과.ticks[0]
    expect(첫그림?.runners.map((runner) => runner.isAce)).toEqual([false, true])
    expect(첫그림?.runnerAceSprite).toBe(3)
  })
})

describe('레이저 잔상 칸 (장면 +0x1991 — 그림 0x37076)', () => {
  it('발사한 그림부터 서고, 받을 야수의 동작 시작 한 틱 전(0xb4c9d)에 내린다 — 송구 뒤에는 송구 첫 점에서 잇는다', () => {
    let state = startDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0, 0, 0.999, 0]),
      controls: 계속누름('수비', '2'),
    })
    while (!isDefensePlayFinished(state)) state = stepDefensePlay(state, { key: '2', isRepeat: false })
    const F = Number(state.log.find((line) => line.includes('레이저 발사 (0x400bc)'))!.split('틱')[0])
    const 잔상 = state.ticks.filter((view) => view.laserTrailFrom != null).map((view) => view.tick)
    expect(잔상[0]).toBe(F)
    // 연속 구간이고, 송구(F + 2) 뒤에 끝난다
    expect(잔상).toEqual(Array.from({ length: 잔상.length }, (_, index) => F + index))
    expect(잔상.at(-1)!).toBeGreaterThan(F + 2)
    const 송구뒤 = state.ticks.find((view) => view.tick === F + 3)!
    expect(송구뒤.laserTrailFrom).not.toEqual(state.ticks.find((view) => view.tick === F)!.laserTrailFrom)
  })
})

describe('카메라 0x3f060 의 키 건너뛰기 부수효과 (3f164~3f192)', () => {
  const 홈런판 = (): DefensePlayInput => ({
    outcome: { kind: '홈런' },
    trajectory: battedBallTrajectory(BATTED_BALL_PATTERNS[24][0]),
    bases: { first: true, second: false, third: false },
    outs: 0,
  })
  /** 공이 멈춘 뒤(건너뛰는 동안은 공+0x68 이 안 올라 멈춘 공이어야 카메라가 푼다) 타자주자가 홈에 닿기 전에 누른다 */
  const 멈춘뒤누름 = (state: DefensePlayState): boolean =>
    state.homeRunFlag && state.trajectory.isStoppedAt?.(state.tick) === true && !state.runners[0]!.state.scored

  it('공이 멈춘 뒤 건너뛰면 타자주자가 홈(+0x7c == +0x8c == 4)에 닿는 틱에 +0xfe7 이 풀리고, 그 1점은 그 틱 메시지 0x13 이다', () => {
    let state = startDefensePlay(홈런판())
    let pressed = false
    let 풀린틱 = -1
    while (!isDefensePlayFinished(state)) {
      const key = !pressed && 멈춘뒤누름(state) ? { key: '5', isRepeat: false } : null
      if (key !== null) pressed = true
      const before = state.fastForward
      state = stepDefensePlay(state, key)
      if ((before || key !== null) && !state.fastForward && 풀린틱 < 0) {
        풀린틱 = state.tick - 1
        expect(state.runInsThisTick).toContain(0)
        expect(state.runners[0].state).toMatchObject({ targetBase: 4, startBase: 4, scored: true })
      }
    }
    expect(pressed).toBe(true)
    expect(풀린틱).toBeGreaterThan(0)
    expect(state.log).toContain(`${풀린틱}틱 카메라 0x3f060 — 타자주자 홈, 건너뛰기 풀림 (+0xfe7 = 0 · 메시지 0x13)`)
    // 1루 주자는 타자주자와 같은 목록 틱에 홈을 밟는다. 원본은 풀린 그림 다음 그림의 목록 틱(52e16)이 +0x3b 를 지워 0xaa0a8 이 못 세고,
    // +0x96 이 안 선 주자가 남아 관문(b0e04 → b0e24)이 늘 열려 판이 안 끝난다(원본 버그).
    // 사용자 결정 2026-10-26: 원본 버그를 고침 — 앞 주자도 세고, 판은 안전망(판 틱 상한)에 닿지 않고 관문으로 끝난다
    expect(state.runners[1]!.state.scored).toBe(true)
    expect(state.play.finished).toBe(true)
    expect(state.tick).toBeLessThanOrEqual(state.maximumTicks)
    expect(defensePlayResultOf(state).advance.runsScored).toBe(runDefensePlay(홈런판()).advance.runsScored)
  })

  it('건너뛰지 않으면 아무것도 안 한다', () => {
    const 결과 = runDefensePlay(홈런판())
    expect(결과.log.some((line) => line.includes('건너뛰기 풀림'))).toBe(false)
  })

  it('건너뛰는 동안은 공+0x68 이 안 오른다(0x3f378 이 없다) — 날던 공은 그 점에 서 있고 카메라가 안 풀어 판 끝까지 건너뛴다', () => {
    let state = startDefensePlay(홈런판())
    let pressed = false
    let 누른틱 = -1
    let 그점: { x: number; y: number; z: number } | null = null
    while (!isDefensePlayFinished(state)) {
      const key = !pressed && state.homeRunFlag ? { key: '5', isRepeat: false } : null
      if (key !== null) {
        pressed = true
        누른틱 = state.tick
        그점 = state.trajectory.pointAt(state.tick)
      }
      state = stepDefensePlay(state, key)
      if (pressed && !isDefensePlayFinished(state)) {
        expect(state.fastForward).toBe(true)
        expect(state.trajectory.pointAt(state.tick)).toEqual(그점)
      }
    }
    expect(누른틱).toBeGreaterThan(0)
    expect(state.log.some((line) => line.includes('건너뛰기 풀림'))).toBe(false)
    expect(defensePlayResultOf(state).advance).toEqual(runDefensePlay(홈런판()).advance)
  })

  it('풀린 그림 다음 그림은 52e16 의 목록 틱이 한 번 더 돈다 — 같은 목록 틱에 홈에 닿은 앞 주자도 다음 판 틱 0xaa0a8 이 센다(원본 버그 고침)', () => {
    // 원본 차례: 52b26 의 0x3f060 = 목록 틱 → 카메라 3f164 가 곧바로 타자주자 메시지 0x13 → 52b36 에서 멈추고 그린다 →
    // 다음 그림 52e16 의 0x3f060 이 목록 틱을 한 번 더(+0x3b 를 머리에서 지움) → 슬롯 2 의 0xaa0a8 은 앞 주자를 못 본다(원본 버그).
    // 사용자 결정 2026-10-26: 원본 버그를 고침 — 홈에 닿은 앞 주자의 +0x3b 는 남아 다음 판 틱에 타자주자 다음으로 센다
    const 풀린틱 = (() => {
      let state = startDefensePlay(홈런판())
      let pressed = false
      while (!isDefensePlayFinished(state)) {
        const key = !pressed && 멈춘뒤누름(state) ? { key: '5', isRepeat: false } : null
        if (key !== null) pressed = true
        const before = state.fastForward || key !== null
        state = stepDefensePlay(state, key)
        if (before && !state.fastForward) return state.tick - 1
      }
      return -1
    })()
    expect(풀린틱).toBeGreaterThan(0)

    let state = startDefensePlay(홈런판())
    let pressed = false
    while (state.tick < 풀린틱) {
      const key = !pressed && 멈춘뒤누름(state) ? { key: '5', isRepeat: false } : null
      if (key !== null) pressed = true
      state = stepDefensePlay(state, key)
    }
    // 1루 주자를 타자주자와 같은 자리 · 같은 걸음으로 홈 앞에 다시 세운다(이미 들어온 1점은 그대로 둔다)
    const 타자 = state.runners[0]
    const 앞주자 = state.runners[1]
    앞주자.state = { ...타자.state, index: 앞주자.state.index, isBatterRunner: false, scored: false, isOut: false }
    앞주자.counted = false
    앞주자.arrivedThisListTick = false
    const 앞점수 = state.held.scoreboardRuns

    state = stepDefensePlay(state, null)
    expect(state.fastForward).toBe(false)
    expect(state.runInsThisTick).toEqual([0])
    expect(앞주자.state.scored).toBe(false)
    expect(state.held.scoreboardRuns).toBe(앞점수 + 1)
    // 원본이면 다음 그림 머리의 목록 틱이 +0x3b 를 지운다 — 웹은 홈에 닿은 앞 주자만 남긴다
    expect(앞주자.arrivedThisListTick).toBe(true)

    state = stepDefensePlay(state, null)
    expect(state.runInsThisTick).toEqual([앞주자.state.index])
    expect(앞주자.state.scored).toBe(true)
    expect(state.held.scoreboardRuns).toBe(앞점수 + 2)
  })
})

describe('공 그리기 0x36dfc 파티클 — 진행기 쪽 조건 (큰 타구 0x36f76 · 튐 0x36fe0)', () => {
  const 입력 = (extra: Partial<DefensePlayInput> = {}): DefensePlayInput => ({
    outcome: 땅볼아웃,
    trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
    bases: EMPTY_BASES,
    outs: 0,
    defenseIsCpu: true,
    ...extra,
  })

  it('공 틱 0 은 조건이 없다 (36e24 `공+0x68 > 0`)', () => {
    const 결과 = runDefensePlay(입력({ bigHitWatch: true }))
    expect(결과.ticks[0]?.tick).toBe(0)
    expect(결과.ticks[0]?.ballParticles).toBeNull()
  })

  it('+0x199a 가 서 있고 판 종류 1 이면 큰 타구 — 안 서 있으면 아니다', () => {
    expect(runDefensePlay(입력({ bigHitWatch: true })).ticks[1]?.ballParticles?.bigHit).toBe(true)
    expect(runDefensePlay(입력({ bigHitWatch: false })).ticks[1]?.ballParticles?.bigHit).toBe(false)
  })

  it('+0x199a 를 안 주면 판 타구로 0x392ac 를 다시 본다 — 땅볼(결과 코드 홈런성 아님)은 꺼져 있다', () => {
    expect(runDefensePlay(입력()).ticks[1]?.ballParticles?.bigHit).toBe(false)
  })

  it('공이 궤적 위에 있는 동안만 다음 점 높이를 싣고, 그 값은 궤적의 공 틱 + 1 점이다', () => {
    const input = 입력()
    const 결과 = runDefensePlay(input)
    // 투수가 6 틱에 쥔다(위 고리 시험) — 그 앞은 궤적 위
    for (let tick = 1; tick < 6; tick += 1) {
      expect(결과.ticks[tick]?.ballParticles?.bounceNextHeight).toBe(input.trajectory.pointAt(tick + 1).y)
    }
    // 쥔 공은 궤적 위가 아니다(그림도 손에 붙인다 — `ballPointAt`)
    const 쥔때 = 결과.ticks.filter((view) => view.ball.isHeld === true)
    expect(쥔때.length).toBeGreaterThan(0)
    for (const view of 쥔때) expect(view.ballParticles?.bounceNextHeight ?? null).toBeNull()
  })
})

describe('야수 자세 워드 +0xb0 · 판을 넘는 플레이 +0xf0 (r171)', () => {
  it('바운드 전 낮은 공(종류 2) 포구 뒤 송구는 준비 틱(내야 3)이 아니라 워드가 지워진 포구 + 4 틱에 나간다', () => {
    // 동작 시작 S = 포구 C − 1 · vt60 의 +0xb3 은 프레임 5(S + 5 = C + 4)의 야수 틱이 지운다 — 그때까지 vtC4 가 거짓
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([73, 1200, 100, 0]),
      bases: { first: true, second: true, third: false },
      outs: 0,
      controls: 계속누름('수비', '6'),
    })
    expect(결과.log).toContain('5틱 0번 야수가 잡았다 (종류 2)')
    expect(결과.log.some((line) => line.startsWith('9틱 1루로 송구'))).toBe(true)
    expect(결과.log.some((line) => line.startsWith('8틱 1루로 송구'))).toBe(false)
  })

  it('가슴 높이(종류 1) 포구는 워드가 C + 3 에 지워져 내야 준비 틱과 같다', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([75, 1732, 371, 0]),
      bases: { first: true, second: true, third: false },
      outs: 0,
      controls: 계속누름('수비', '6'),
    })
    expect(결과.log).toContain('6틱 3번 야수가 잡았다 (종류 1)')
    expect(결과.log.some((line) => line.startsWith('9틱 1루로 송구'))).toBe(true)
  })

  it('넓은 파울 각으로 열린 판(state[7] = 0)은 앞 판이 남긴 +0xf0 을 그대로 두고 끝에 다음 판으로 넘긴다', () => {
    const 남은커버 = [8, 7, 6, 5]
    const 입력 = (pattern: BattedBallPattern, resultCode: number): DefensePlayInput => ({
      outcome: registerContact(땅볼아웃, { batterHand: 0, pattern, resultCode }),
      trajectory: battedBallTrajectory(pattern),
      bases: 주자1루,
      outs: 0,
      scene: { ...DEFENSE_SCENE_START, playCovers: 남은커버 },
    })
    // 각 311 — 넓은 쐐기 밖 파울: 판 시작 vt30 이 머리에서 끝나고 판 도중에도 안 돈다
    expect(startDefensePlay(입력([311, 273, 247, 1], 9)).play.coverOfBase).toEqual(남은커버)
    expect(runDefensePlay(입력([311, 273, 247, 1], 9)).scene.playCovers).toEqual(남은커버)
    // 페어 땅볼은 b1cdc 가 기본 표를 베껴 다시 고른다
    const 페어 = startDefensePlay(입력([51, 435, 315, 1], 1))
    expect(페어.play.coverOfBase).not.toEqual(남은커버)
  })

  it('밀어내기(종류 2)는 +0xf0 을 안 건드린다 — vt1c 0xb0edc 도 안 지운다', () => {
    const 남은커버 = [1, 2, 3, 4]
    const result = runWalkPlay({
      batterHand: 0,
      bases: EMPTY_BASES,
      outs: 0,
      pitchJudgement: 4,
      runAbility: 500,
      scene: { ...DEFENSE_SCENE_START, playCovers: 남은커버 },
    })
    expect(result.scene.playCovers).toEqual(남은커버)
  })
})

describe('타자주자는 타석 자리에서 뛴다 — vt94 0xa0884 (0xa93ac a9446, r324 Q-07)', () => {
  const 시작 = (batterHand?: number) =>
    startDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([100, 1300, 600, 2]),
      bases: EMPTY_BASES,
      outs: 0,
      ...(batterHand === undefined ? {} : { batterHand }),
    }).runners[0].state

  it('좌타(손 1)는 홈 x+700 · 우타(손 0)는 x−700, 둘 다 z−100 — 진행률 분모 자리(legStart)는 홈 그대로', () => {
    expect(시작(1).position).toEqual({ x: 20_700, y: 0, z: 29_345 })
    expect(시작(0).position).toEqual({ x: 19_300, y: 0, z: 29_345 })
    expect(시작(1).legStart).toEqual({ x: 20_000, y: 0, z: 29_445 })
    expect(시작(1).targetBase).toBe(1)
  })

  it('손을 모르는 호출(결과를 넘겨받은 시험 · 옛 길)은 홈에서 뛴다 (웹 근사)', () => {
    expect(시작().position).toEqual({ x: 20_000, y: 0, z: 29_445 })
  })
})
