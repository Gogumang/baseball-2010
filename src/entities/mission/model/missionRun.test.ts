import { describe, expect, it } from 'vitest'
import {
  applyOutcome,
  applyPickoff,
  giveUp,
  isMissionBatterUp,
  missionAdvance,
  missionFirstHalfIsHuman,
  recordSwing,
  runBatterMissionAutoHalves,
  startMission,
  tick,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'

const 첫걸음 = MISSIONS.find((m) => m.name === '명품 타자의 첫 걸음')!

/**
 * 미션 타자 차례까지 — 원본은 미션 타자 타석 뒤 3아웃 전이면 다음 타순 마스터 타자도 사람이 친다(목표 · 타석 칸에 안 든다).
 * 시험은 그 타석을 삼진으로 넘기고, 3아웃이면 0x18 · 자동진행 반 이닝(`runBatterMissionAutoHalves`)을 돌린다.
 */
function 미션타자차례까지(start: MissionRun, random: RandomPort = createSeededRandom(4)): MissionRun {
  let run = runBatterMissionAutoHalves(start, random)
  for (let plate = 0; plate < 200 && run.status === '진행중' && !isMissionBatterUp(run); plate += 1) {
    run = runBatterMissionAutoHalves(applyOutcome(run, { kind: '삼진' }), random)
  }
  return run
}
const 사이클링 = MISSIONS.find((m) => m.name.includes('사이클링'))!
const 치명적인유혹 = MISSIONS.find((m) => m.name === '치명적인 유혹')!
const 추격타 = MISSIONS.find((m) => m.name === '추격타의 주인공')!

describe('타석 제한 — 원본 레코드 값이 설명문과 같다', () => {
  it('"3타석 내에 2안타를 날려라!" 에서 3을 읽는다', () => {
    expect(startMission(치명적인유혹).remainingPlateAppearances).toBe(3)
  })

  it('"2타석 내에 홈런을 날려라!" 에서 2를 읽는다', () => {
    expect(startMission(추격타).remainingPlateAppearances).toBe(2)
  })

  it('제한이 없는 미션은 null이다', () => {
    expect(startMission(첫걸음).remainingPlateAppearances).toBeNull()
  })
})

describe('startMission', () => {
  it('제한 시간이 있는 미션은 남은 시간이 설정된다', () => {
    const run = startMission(사이클링)

    expect(run.remainingSeconds).toBe(사이클링.timeLimitSeconds)
    expect(run.status).toBe('진행중')
  })

  it('제한 시간이 없으면 null이다', () => {
    expect(startMission(첫걸음).remainingSeconds).toBeNull()
  })
})

describe('applyOutcome', () => {
  it('목표를 다 채우면 즉시 성공이다', () => {
    let run = startMission(첫걸음)
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    expect(run.status).toBe('진행중')
    // 다음 타순은 사람 칸 팀 마스터 타자 — 그 타석은 목표에 안 든다
    expect(isMissionBatterUp(run)).toBe(false)
    const before = run.progress
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    expect(run.progress).toBe(before)
    run = 미션타자차례까지(run)

    run = applyOutcome(run, { kind: '안타', bases: 1 })

    expect(run.status).toBe('성공')
  })

  it('타석 제한을 다 쓰고 목표를 못 채우면 실패다', () => {
    let run = startMission(추격타)

    run = applyOutcome(run, { kind: '삼진' })
    expect(run.status).toBe('진행중')
    expect(run.remainingPlateAppearances).toBe(1)
    run = 미션타자차례까지(run)
    expect(run.remainingPlateAppearances).toBe(1)
    run = applyOutcome(run, { kind: '삼진' })

    expect(run.status).toBe('실패')
  })

  it('마지막 타석에 목표를 채우면 실패가 아니라 성공이다', () => {
    let run = startMission(추격타)

    run = applyOutcome(run, { kind: '삼진' })
    run = 미션타자차례까지(run)
    run = applyOutcome(run, { kind: '홈런' })

    expect(run.status).toBe('성공')
  })

  it('끝난 미션은 더 이상 바뀌지 않는다', () => {
    let run = startMission(첫걸음)
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    run = 미션타자차례까지(run)
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    expect(run.status).toBe('성공')

    expect(applyOutcome(run, { kind: '삼진' })).toBe(run)
  })

  it('입력 상태를 변경하지 않는다', () => {
    const before = startMission(첫걸음)

    applyOutcome(before, { kind: '홈런' })

    expect(before.progress.plateAppearances).toBe(0)
  })
})

/**
 * 미션도 사람이 치는 타석이라 원본은 간이 엔진이 아니라 **수비 시뮬레이션**을 돌린다
 * (0xae24c·0xae3e8). 태그업 0xa9620 → 자동 진루 0xaf918("송구보다 2틱 이상 빠를 때만")
 * → 2아웃 득점 보류 순서다 (P2 7절 표 · U-02).
 *
 * 아래 값은 `runDefensePlay` 가 실제로 돌려준 것을 그대로 못 박은 것이다 — 난수를 넘기지
 * 않으므로 결정론이다.
 */
describe('missionAdvance — 미션 주루도 수비 시뮬레이션이 정한다 (P2 7절 · U-02)', () => {
  const 주자 = (first: boolean, second: boolean, third: boolean) => ({ first, second, third })

  it('1루타에 2루 주자는 홈까지 든다 — 고정표가 아니라 자동 진루 0xaf918 가 정한다(판 시작 force 1 한 번 · 매 틱 force 0)', () => {
    // 판 시작 0x46766 의 `0xaf8c0(제어기, 1)` 이 리드 뒤 제 루로 돌아오던 2루 주자를 곧장 3루로 보내고(송구보다 2틱 넘게 먼저),
    // 3루에 서면 매 틱 자동 진루(force 0)의 틱 비교가 홈까지 보낸다. (예전 웹은 판 시작 호출이 없어 2루로 돌아갔다가 3루에서 멈췄다.)
    expect(missionAdvance(주자(false, true, false), 0, { kind: '안타', bases: 1 })).toEqual({
      bases: 주자(true, false, false),
      runsScored: 1,
      outsAdded: 0,
    })
  })

  it('1루타에 1루 주자가 3루까지 간다 (0xaf918 자동 추가 진루)', () => {
    expect(missionAdvance(주자(true, false, false), 0, { kind: '안타', bases: 1 })).toEqual({
      bases: 주자(true, false, true),
      runsScored: 0,
      outsAdded: 0,
    })
  })

  it('3루 주자 뜬공 — 1아웃이면 태그업 득점, 2아웃이면 친 순간 뛴(0xa9e44) 주자가 포구 전에 홈을 밟아 바로 득점(0xaa16e, 원본 그대로)', () => {
    const 뜬공 = { kind: '아웃', detail: '뜬공아웃' } as const
    expect(missionAdvance(주자(false, false, true), 1, 뜬공).runsScored).toBe(1)
    expect(missionAdvance(주자(false, false, true), 2, 뜬공).runsScored).toBe(1)
  })

  it('3루 주자 땅볼 — 리드(0x3d7b8) 뒤 제 루로 돌아와 그대로 남고 타자만 죽는다, 희생플라이 보장 근사는 없다', () => {
    expect(missionAdvance(주자(false, false, true), 0, { kind: '아웃', detail: '땅볼아웃' })).toEqual({
      bases: 주자(false, false, true),
      runsScored: 0,
      outsAdded: 1,
    })
  })

  it('삼진·볼넷·홈런은 수비가 개입할 것이 없어 예전 길 그대로다', () => {
    expect(missionAdvance(주자(false, true, false), 0, { kind: '삼진' })).toEqual({
      bases: 주자(false, true, false),
      runsScored: 0,
      outsAdded: 1,
    })
    expect(missionAdvance(주자(false, true, false), 0, { kind: '홈런' })).toEqual({
      bases: 주자(false, false, false),
      runsScored: 2,
      outsAdded: 0,
    })
  })

  it('미션 진행에도 이어져 있다 — 1루 주자가 단타에 3루까지 간다', () => {
    // 고정 진루표였다면 1루 주자는 2루까지만 갔다
    const 방망이 = MISSIONS.find((m) => m.name === '폭발하는 방망이')!
    const run = applyOutcome(startMission(방망이), { kind: '안타', bases: 1 })

    expect(run.bases).toEqual({ first: true, second: false, third: true })
  })
})

describe('tick — 제한 시간', () => {
  it('시간이 줄어든다', () => {
    const run = tick(startMission(사이클링), 10)

    expect(run.remainingSeconds).toBe(사이클링.timeLimitSeconds - 10)
    expect(run.status).toBe('진행중')
  })

  it('시간이 다 되면 실패다', () => {
    const run = tick(startMission(사이클링), 사이클링.timeLimitSeconds)

    expect(run.remainingSeconds).toBe(0)
    expect(run.status).toBe('실패')
  })

  it('제한 시간이 없는 미션은 시간이 흘러도 그대로다', () => {
    const run = startMission(첫걸음)

    expect(tick(run, 9999)).toBe(run)
  })

  it('이미 성공한 미션은 시간이 지나도 실패로 바뀌지 않는다', () => {
    const run = { ...startMission(사이클링), status: '성공' as const }

    expect(tick(run, 9999).status).toBe('성공')
  })
})

describe('giveUp', () => {
  it('진행 중이면 실패로 바꾼다', () => {
    expect(giveUp(startMission(첫걸음)).status).toBe('실패')
  })

  it('이미 끝났으면 그대로 둔다', () => {
    const 성공 = { ...startMission(첫걸음), status: '성공' as const }

    expect(giveUp(성공)).toBe(성공)
  })
})

describe('applyPickoff — CPU 견제 한 판 (메시지 0x10 → 종류 4 → 0xae3e8)', () => {
  const 번트의달인 = MISSIONS.find((m) => m.side === '타자' && m.id === 2)!

  it('견제사는 아웃만 늘리고 남은 타석·목표는 그대로다 (종류 4 는 타석이 아니다)', () => {
    const run = startMission(번트의달인)
    const next = applyPickoff(run, { bases: { first: false, second: false, third: false }, runsScored: 0, outsAdded: 1 })

    expect(next.outs).toBe(run.outs + 1)
    expect(next.bases.first).toBe(false)
    expect(next.remainingPlateAppearances).toBe(run.remainingPlateAppearances)
    expect(next.progress).toBe(run.progress)
    expect(next.status).toBe('진행중')
  })

  it('세이프면 루가 그대로다', () => {
    const run = startMission(번트의달인)
    expect(applyPickoff(run, { bases: run.bases, runsScored: 0, outsAdded: 0 }).bases).toEqual(run.bases)
  })

  it('3아웃이면 빈 루 · 0아웃으로 0x18 · 자동진행을 기다린다 — 시작 상황은 경기 처음에만 깐다(0xaae7c aaf10)', () => {
    const run = { ...startMission(번트의달인), outs: 2 }
    const next = applyPickoff(run, { bases: { first: false, second: false, third: false }, runsScored: 0, outsAdded: 1 })
    expect(next.outs).toBe(0)
    expect(next.bases).toEqual({ first: false, second: false, third: false })
    expect(next.game.halfEnded).toBe(true)
  })
})

describe('타점은 3아웃으로 끝난 판의 득점도 든다 (0xae3e8 ae554 → 정산 0xa8024 a8994 += 이벤트 0xf 수)', () => {
  const 찬스 = MISSIONS.find((m) => m.name === '찬스를 노려라')!

  it('2아웃 3루 주자 뜬공 — 포구 전에 홈을 밟은 바로 득점이 타점 1 이고, 3아웃이라 빈 루 · 0아웃 · 자동진행 대기', () => {
    const run = startMission(찬스)
    expect(run.outs).toBe(2)
    const next = applyOutcome(run, { kind: '아웃', detail: '뜬공아웃' })
    expect(next.progress.counts['타점']).toBe(1)
    expect(next.outs).toBe(0)
    expect(next.bases).toEqual({ first: false, second: false, third: false })
    expect(next.game.halfEnded).toBe(true)
    // 점수판 득점도 사람 칸(측 1) 점수에 든다
    expect(next.game.scores[1]).toBe(찬스.start.ourScore + 1)
    // 2루타 목표가 남아 아직이다
    expect(next.status).toBe('진행중')
  })

  it('2아웃 3루 주자 땅볼 — 타자주자가 살아 뛰던 때 바로 올린 득점은 타자주자가 죽어 3아웃이어도 타점이다 (원본 그대로)', () => {
    const run = startMission(찬스)
    const 땅볼아웃 = { kind: '아웃', detail: '땅볼아웃' } as const
    const played = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([266, 94, 785, 0]),
      bases: run.bases,
      outs: run.outs,
      runAbility: 500,
    })
    expect(played.runnerFates[0].retired).toBe(true)
    const next = applyOutcome(run, 땅볼아웃, false, undefined, played)
    expect(next.progress.counts['타점']).toBe(1)
  })
})

describe('타자 미션의 이닝 넘김 — 3아웃 → 0x18 → 자동진행 0x21 → 미션 타자 차례 0xd (`runBatterMissionAutoHalves`)', () => {
  it('CPU 공격 반 이닝을 통째로, 사람 칸 반 이닝은 미션 타자 차례 앞까지 간이 엔진이 돈다', () => {
    // 첫 걸음 — 1회말 1사, 사람 칸(홈) 공격, 미션 타자는 타순 3번(레코드 +7 윗 4비트 2)
    let run = startMission(첫걸음)
    run = applyOutcome(run, { kind: '삼진' })
    while (run.outs !== 0 || !run.game.halfEnded) run = applyOutcome(run, { kind: '삼진' })
    expect(run.game).toMatchObject({ inning: 0, offenseSide: 1, halfEnded: true })

    const after = runBatterMissionAutoHalves(run, createSeededRandom(9))
    expect(after.status).toBe('진행중')
    expect(after.game.halfEnded).toBe(false)
    // 말이 끝나 2회 — 초(CPU)는 지났고 지금은 다시 사람 칸의 말
    expect(after.game.inning).toBeGreaterThanOrEqual(1)
    expect(after.game.offenseSide).toBe(1)
    expect(isMissionBatterUp(after)).toBe(true)
    expect(after.outs).toBeLessThan(3)
  })

  it('9회말 2사에 미션 타자가 삼진이면 경기가 끝나 실패다 — 0xaaa6c aad20 (운명의 대결, 4:7)', () => {
    const 운명 = MISSIONS.find((m) => m.side === '타자' && m.id === 12)!
    const run = applyOutcome(startMission(운명), { kind: '삼진' })
    expect(run.status).toBe('실패')
  })

  it('미션 타자가 아닌 타석은 스윙 · 타석 칸에 안 든다 (0xa57f8 a5844)', () => {
    const 빠르게 = MISSIONS.find((m) => m.side === '타자' && m.id === 10)!
    let run = applyOutcome(startMission(빠르게), { kind: '아웃', detail: '땅볼아웃' })
    expect(isMissionBatterUp(run)).toBe(false)
    const swings = run.remainingSwings
    const plates = run.remainingPlateAppearances
    run = applyOutcome(recordSwing(run), { kind: '삼진' })
    expect(run.remainingSwings).toBe(swings)
    expect(run.remainingPlateAppearances).toBe(plates)
  })
})

describe('미션 첫 반 이닝이 사람 몫인가 — 첫 0x18 판의 0xc2198 → 0xc1e04 → !0xc1d38', () => {
  it('모든 타자 미션(모드 6)은 시작 타순 칸에 미션 타자가 서 사람 몫이다 (aa7e8 · aa88c → 0xae944 → 0xae89c)', () => {
    for (const mission of MISSIONS.filter((m) => m.side === '타자')) {
      expect(missionFirstHalfIsHuman(startMission(mission))).toBe(true)
    }
  })

  it('모든 투수 미션(모드 5)은 수비 투수가 사람 투수라 사람 몫이다 (aa81c~aa878 첫 육성 · 명예 투수를 0번에)', () => {
    for (const mission of MISSIONS.filter((m) => m.side === '투수')) {
      expect(missionFirstHalfIsHuman(startPitcherMission(mission))).toBe(true)
    }
  })

  it('마선수 대결(팀 16~20, 두 편)도 같다', () => {
    for (let team = 16; team <= 20; team += 1) {
      const batter = aceMatchMissionOf(team, '타자')
      const pitcher = aceMatchMissionOf(team, '투수')
      if (batter !== null) expect(missionFirstHalfIsHuman(startMission(batter))).toBe(true)
      if (pitcher !== null) expect(missionFirstHalfIsHuman(startPitcherMission(pitcher))).toBe(true)
    }
  })

  it('타자 미션에서 지금 타자가 미션 타자가 아니면 사람 몫이 아니다 (0xc1d38 모드 6 c1dae 거짓)', () => {
    const run = applyOutcome(startMission(첫걸음), { kind: '아웃', detail: '땅볼아웃' })
    expect(isMissionBatterUp(run)).toBe(false)
    expect(missionFirstHalfIsHuman(run)).toBe(false)
  })
})
