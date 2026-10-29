import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, createFielders, createRunner, initialPlayView, type FielderState } from '@/entities/fielding/model/fieldingState'
import { withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { canFireLaserNow, isOutfieldSlot, laserWindowTick, NO_LASER_FLAGS } from '@/features/defense-play/model/laserTick'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { runRunnerPlay, runnerPlayCallSoundIdOf } from '@/features/defense-play/model/runnerPlayEngine'
import { stealStartThrowDecision } from '@/features/defense-play/model/stealPlay'
import { openPitchArrivalPlay, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { DEFENSE_SCENE_START, type DefenseScene } from '@/features/defense-play/model/defenseScene'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/** 굴림을 적어 두는 난수 — 값은 `pick` 이 고른다 */
function 적는난수(pick: (lo: number, hi: number) => number): RandomPort & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    rand: (lo, hi) => {
      calls.push(`${lo},${hi}`)
      return pick(lo, hi)
    },
    rand9d: () => 0,
  }
}

const 야수 = (slot: number): FielderState => {
  const fielder = createFielders(Array.from({ length: 9 }, () => 500))[slot]
  if (fielder === undefined) throw new Error('칸 없음')
  return { ...fielder, holdingBall: true }
}

describe('레이저 굴림 0x523bc — 공 가진 야수가 외야수일 때만 (523e6 0xb8da8, r201)', () => {
  const 창안 = {
    flags: NO_LASER_FLAGS,
    effectStep: -1,
    ticksSinceCatch: -10,
    hasChosenThrowTarget: false,
    isBallHeld: false,
    holderAbility: 500,
    holderSkillIds: [],
    defenseIsCpu: true,
    press: null,
  }

  it('0xb8da8 은 수비 칸 6~8 만 참이다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(isOutfieldSlot)).toEqual([false, false, false, false, false, false, true, true, true])
  })

  it('내야수가 공 가진 야수면 창이 열려도 굴리지 않는다 — 난수를 안 먹는다', () => {
    const random = 적는난수(() => 0)
    for (const slot of [0, 1, 2, 3, 4, 5]) {
      const result = laserWindowTick({ ...창안, random, holder: 야수(slot) })
      expect(result.rolledThisTick).toBe(false)
      expect(result.flags.rolled).toBe(false)
    }
    expect(random.calls).toEqual([])
  })

  it('외야수면 창 첫 틱(포구 10 틱 전)에 한 번 굴린다 — CPU 는 곧바로 확정(+0x19ae), 사람은 반짝임(+0x19ad)', () => {
    const random = 적는난수(() => 0)
    const cpu = laserWindowTick({ ...창안, random, holder: 야수(7) })
    expect(random.calls).toEqual(['0,1000'])
    expect(cpu.flags).toEqual({ shining: false, confirmed: true, rolled: true })
    const 사람 = laserWindowTick({ ...창안, random, holder: 야수(6), defenseIsCpu: false })
    expect(사람.flags).toEqual({ shining: true, confirmed: false, rolled: true })
    // 한 판 한 번(+0x19af)
    const 두번째 = laserWindowTick({ ...창안, random, holder: 야수(6), flags: 사람.flags, ticksSinceCatch: -9 })
    expect(두번째.rolledThisTick).toBe(false)
    expect(random.calls).toHaveLength(2)
  })

  it('공 가진 야수가 없는 판(+0x130 = −1)은 굴리지 않는다 — 원본은 앞 판의 +0x174 와 빈 야수를 읽는다(미해결)', () => {
    const random = 적는난수(() => 0)
    expect(laserWindowTick({ ...창안, random, holder: undefined }).rolledThisTick).toBe(false)
    expect(random.calls).toEqual([])
  })

  it('발사 0x400bc 는 확정 · +0x160 · 쥠 · 준비 · 연출 단계 −1 · 머리에서 안 멈춤을 모두 본다', () => {
    const 기본 = {
      effectStep: -1,
      pausedAtHead: false,
      confirmed: true,
      hasChosenThrowTarget: true,
      isBallHeld: true,
      holder: 야수(7),
    }
    expect(canFireLaserNow(기본)).toBe(true)
    expect(canFireLaserNow({ ...기본, effectStep: 0 })).toBe(false)
    expect(canFireLaserNow({ ...기본, pausedAtHead: true })).toBe(false)
    expect(canFireLaserNow({ ...기본, hasChosenThrowTarget: false })).toBe(false)
    expect(canFireLaserNow({ ...기본, holder: { ...야수(7), actionRemainingTicks: 1 } })).toBe(false)
  })
})

describe('견제 · 주루 판의 레이저 송구 — 타구 진행기와 같은 0x523bc · 0x4e858 · 0x400bc · +0x1993 · b2f06 (GAP 5, r201)', () => {
  it('악송구를 외야수가 주워 반짝임 창 안에 새 키가 오면 발사하고, 경기를 두 그림 멈춘 뒤 레이저로 던진다', () => {
    // 늘 lo 를 돌리는 난수 — 악송구 · 펌블이 다 걸려 공이 튀다가 좌익수(7)가 쫓게 된다. 레이저 굴림(0, 1000) 뒤로는 펌블을 안 낸다
    let rolledLaser = false
    const random = 적는난수((lo, hi) => {
      if (lo === 0 && hi === 1000) rolledLaser = true
      return rolledLaser && lo === 0 && hi === 10000 ? hi - 1 : lo
    })
    const result = runPickoffPlay({
      targetBase: 1,
      bases: { ...EMPTY_BASES, first: true },
      outs: 0,
      random,
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: false }) },
    })
    // 내야수(2루수 3 · 유격수 5)가 쫓는 동안은 굴리지 않고, 좌익수가 쫓을 때 한 번
    expect(random.calls.filter((call) => call === '0,1000')).toHaveLength(1)
    // 야수 걸음 · 공 튕김 뒤 줍기가 맨해튼 걸음(0xbf158 → 0xbfa2c)이라 예전보다 7틱 늦게 쥔다
    expect(result.log).toContain('64틱 7번 야수가 공을 쥐었다')
    expect(result.log).toContain('70틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993')
    // 발사한 그림 F 의 슬롯 2 와 F+1 이 빠지고, F+2 의 플레이 틱(사람 목표 b4660)이 +0x1f4 로 던진다 — 2루수에게(외야 → 내야라 b2ee6 이 안 지운다)
    expect(result.log).toContain('72틱 7번 야수가 2루로 레이저 송구 — 76틱 도착 (사람 송구 키)')
    expect(result.laserThrow).toBe(true)
    // 반짝임은 쥔 좌익수에게 · 머리에서 멈춘 그림(F+1)은 카메라가 선다 · 잔상은 발사부터
    expect(result.ticks.find((view) => view.tick === 67)?.laserShiningSlot).toBe(7)
    expect(result.ticks.find((view) => view.tick === 71)?.cameraFrozen).toBe(true)
    expect(result.ticks.find((view) => view.tick === 70)?.cameraFrozen).toBe(false)
    expect(result.ticks.find((view) => view.tick === 70)?.laserTrailFrom).not.toBeNull()
  })
})

describe('판정음 0x87 의 나머지 절반 — b42ee 갈래 b4312 (GAP 14, r201)', () => {
  it('공을 든 야수가 루에 막 닿은 목록 틱 뒤의 포스 아웃(결과 2)은 state[0x87] = 1 — 콜 62 (주자 판도 타구 진행기와 같다)', () => {
    // 1루수(2)가 공을 들고 1루 100 앞에서 1루로 걷는다(AI 6 들고 뛰기). 타자주자(0)는 홈을 막 떠나 1루로 밀려 있다
    const fielders = createFielders(Array.from({ length: 9 }, () => 500)).map((fielder) =>
      fielder.slot === 2
        ? {
            ...fielder,
            position: { x: basePosition(1).x - 100, y: 0, z: basePosition(1).z },
            target: basePosition(1),
            holdingBall: true,
            aiState: AI_STATE.CARRY,
          }
        : fielder,
    )
    const runner = createRunner(0, 0, 300, { targetBase: 1, isBatterRunner: true })
    const result = runRunnerPlay({
      kind: 9,
      fielders,
      play: { ...initialPlayView(9), ballHolderSlot: 2, catchFielderSlot: 2, held: true, everHeld: true },
      runners: [runner],
      abilities: Array.from({ length: 9 }, () => 500),
      outs: 0,
      ballOnGround: true,
    })
    expect(result.log).toContain('1틱 0번 주자 아웃 (0xb36d0 결과 2)')
    expect(result.tagOut).toBe(true)
    expect(runnerPlayCallSoundIdOf(13, result.tagOut)).toBe(62)
  })
})

describe('AI 2~5 b4818 의 vt14(루 좌표) — 관문(잠금 · vtc8)이 막으면 목표를 안 받는다 (r201)', () => {
  it('+0xcc 가 남은 커버 야수는 루 좌표를 목표로 안 받고, 풀린 야수는 받는다', () => {
    const fielders = createFielders(Array.from({ length: 9 }, () => 500)).map((fielder) =>
      fielder.slot === 3 ? { ...fielder, aiState: AI_STATE.COVER_HOME + 2, arrivalSlackTicks: 1 } : fielder,
    )
    const 막힘 = withCoverBaseTarget(fielders, 3, 2)
    expect(막힘[3]?.target).toEqual(fielders[3]?.target)
    const 풀림 = withCoverBaseTarget(
      fielders.map((fielder) => (fielder.slot === 3 ? { ...fielder, arrivalSlackTicks: 0 } : fielder)),
      3,
      2,
    )
    expect(풀림[3]?.target).toEqual(basePosition(2))
    expect(풀림[3]?.targetBase).toBe(2)
  })
})

describe('도루 키 0x583 끝의 0xafa60 한 번 — 앞 판이 끝난 그대로의 플레이 · 야수 (GAP 7, 52222, r201)', () => {
  /** 앞 판 — 원본 표 코드 1 의 첫 공 [160, 101, 752, 0]: 포수(1)가 17틱 뜬공을 잡고 끝난다. 사람 수동 송구라 +0x128 = 1 이 남는다 */
  const 앞판 = () => {
    const pattern: BattedBallPattern = [160, 101, 752, 0]
    return runDefensePlay({
      outcome: registerContact({ kind: '아웃', detail: '땅볼아웃' }, { batterHand: 0, pattern, resultCode: 1 }),
      trajectory: battedBallTrajectory(pattern),
      bases: EMPTY_BASES,
      outs: 0,
      random: createSeededRandom(1),
    }).scene
  }
  const 던지는난수 = () => 적는난수((lo, hi) => (lo === 0 && hi === 10000 ? hi - 1 : lo))

  it('판이 끝난 그대로의 플레이 · 야수가 장면에 남는다 — 공 쥔 포수 · +0x128 = 1', () => {
    const scene = 앞판()
    expect(scene.playEnd?.play.ballHolderSlot).toBe(1)
    expect(scene.playEnd?.play.wantsThrow).toBe(true)
    expect(scene.playEnd?.fielders[1]?.holdingBall).toBe(true)
  })

  it('+0x128 이 꺼져 있거나 앞 판이 없으면 아무것도 안 굴린다', () => {
    const random = 적는난수(() => 0)
    const 없음 = stealStartThrowDecision({ scene: DEFENSE_SCENE_START, bases: { ...EMPTY_BASES, second: true }, stealingFrom: [2], outs: 0, random })
    expect(없음.log).toEqual([])
    const scene = 앞판()
    const playEnd = scene.playEnd!
    const 꺼짐 = stealStartThrowDecision({
      scene: { ...scene, playEnd: { ...playEnd, play: { ...playEnd.play, wantsThrow: false } } },
      bases: { ...EMPTY_BASES, second: true },
      stealingFrom: [2],
      outs: 0,
      random,
    })
    expect(꺼짐.log).toEqual([])
    expect(random.calls).toEqual([])
  })

  it('공 쥔 야수가 준비됐으면 막 출발한 주자로 점수식 0xafb24 를 돌려 0xb2c90 · 0xb2e38 로 던진다(악송구 굴림) — 성공하면 +0x128 = 0', () => {
    const random = 던지는난수()
    const 결과 = stealStartThrowDecision({ scene: 앞판(), bases: { ...EMPTY_BASES, second: true }, stealingFrom: [2], outs: 0, random })
    // 2루 주자가 3루로 막 출발했다 — 홈 근처의 포수가 3루로 던진다(그 공은 다음 판 시작이 지운다)
    expect(결과.log).toEqual(['도루 키 0x583 · 0틱 1번 야수가 3루로 송구 — 7틱 도착 (CPU 결정)'])
    expect(random.calls).toEqual(['0,10000'])
    expect(결과.scene?.playEnd?.play.wantsThrow).toBe(false)
    // 같은 투구의 다음 도루 키는 더 안 던진다(+0x128 = 0)
    const 다시 = stealStartThrowDecision({ scene: 결과.scene, bases: { ...EMPTY_BASES, second: true }, stealingFrom: [2], outs: 0, random })
    expect(다시.log).toEqual([])
    expect(random.calls).toHaveLength(1)
  })

  it('고르기 0xb3b38 은 줍는 야수를 AI 1 로만 두고 목표는 안 적는다 — 포구점은 AI 고리 b4aca 몫 (r201)', () => {
    // 악송구(0xa1828 → 0)라 공+0xaac = 1 — 줍는 야수는 움직임 허용이 서도 AI 고리가 돌아야 목표를 고친다. 0x583 의 한 번은 틱이 없어
    // 고리가 안 돈다 — 예전 웹은 고르기에서 바로 포구점을 적었다
    const scene = 앞판()
    const 결과 = stealStartThrowDecision({ scene, bases: { ...EMPTY_BASES, second: true }, stealingFrom: [2], outs: 0, random: 적는난수((lo) => lo) })
    expect(결과.log[0]).toContain('(악송구)')
    const picker = 결과.scene!.playEnd!.play.ballHolderSlot
    expect(결과.scene!.playEnd!.fielders[picker]?.aiState).toBe(AI_STATE.CHASE)
    expect(결과.scene!.playEnd!.fielders[picker]?.target).toEqual(scene.playEnd!.fielders[picker]?.target)
  })

  // r214: 굴림 자리를 공 도착 판 맨 앞에서 출발한 그 자리(`stealStartSceneOf`)로 옮겼다 — 예전 시험은 공 도착 판이 굴리기를 기대했다
  it('도루 출발 자리에서 굴리고(stealStartSceneOf) 공 도착 판은 그 결정을 다시 안 굴린다', () => {
    const random = 던지는난수()
    const 출발뒤 = stealStartSceneOf({ scene: 앞판(), bases: { ...EMPTY_BASES, second: true }, outs: 0 }, [2], random)
    expect(random.calls).toEqual(['0,10000'])
    expect(출발뒤?.playEnd?.play.wantsThrow).toBe(false)
    const 기록 = (scene: DefenseScene | undefined) => {
      const arrival = 던지는난수()
      openPitchArrivalPlay(
        { batterHand: 0, gameMode: 1, pitchJudgement: 2, stealingFrom: [2], bases: { ...EMPTY_BASES, second: true }, outs: 0, scene },
        arrival,
      )
      return arrival.calls
    }
    expect(기록(출발뒤)).toEqual(기록(undefined))
    // 출발이 없으면 굴리지 않는다
    const 없음 = 적는난수(() => 0)
    expect(stealStartSceneOf({ scene: 앞판(), bases: { ...EMPTY_BASES, second: true }, outs: 0 }, [], 없음)).toBeDefined()
    expect(없음.calls).toEqual([])
  })
})
