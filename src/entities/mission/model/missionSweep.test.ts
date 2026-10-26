import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { registerContact } from '@/entities/batting/model/battedContact'
import { BATTER_MISSIONS, PITCHER_MISSIONS, judgedGoalsOf, missionKeyOf } from '@/entities/mission/model/missionGoal'
import { MISSION_CPU_START } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_HUMAN_START_ORDER, cpuSideOf, humanSideOf } from '@/entities/mission/model/missionGame'
import { missionRewardOf } from '@/entities/mission/model/missionReward'
import {
  applyOutcome,
  applySteal,
  checkSwingsExhausted,
  isMissionBatterUp,
  recordSwing,
  runBatterMissionAutoHalves,
  startMission,
  tick,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  recordPitch,
  runPitcherMissionAutoHalves,
  startPitcherMission,
} from '@/entities/mission/model/pitcherRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { OriginalMission } from '@/shared/config/original/missions'

/**
 * **미션모드 전수 대조** — 타자편 · 투수편 목록 칸 0~13(미션 1~14). 칸 14(이벤트 · 서버 다운로드)는 뺀다.
 *
 * 1. 원본 레코드 바이트를 **생성기와 따로** 판정 · 준비 함수가 읽는 자리대로 풀어 `MISSIONS` · 시작 상태 · CPU 표 · 보상과 견준다.
 *    - 레코드 = 0xa5268(타자) / 0xa5294(투수), 목표 행 = 0xa5485 / 0xa54b5 = 레코드 +0xa0.
 *    - 판정 0xaaa6c 모드 6(aaade~aab9a): 안타 합 ↔ g[6] · 단타 ↔ g[1] 아래 · 2루타 ↔ g[0] 위 · 3루타 ↔ g[0] 아래 · 홈런 ↔ g[3] 아래 ·
 *      만루홈런 ↔ g[2] 위 · 그라운드홈런 ↔ g[2] 아래 · 번트 ↔ g[4] 위 · 타점 ↔ g[5] · 도루 ↔ g[4] 아래 · 타석 ↔ rec[0xa] 아래 · 스윙 ↔ rec[9] 위.
 *    - 모드 5(aabc6~aad1c): 탈삼진 ↔ g[0] 위 · 삼진콤보 ↔ g[0] 아래 · MAX게이지 ↔ g[1] 위 · 실점 한도 ↔ g[1] 아래 · 볼넷 한도 ↔ g[2] 위 ·
 *      피안타 한도 ↔ g[2] 아래 · 출루 허용 한도 ↔ s8 g[3] · 아웃 ↔ g[4] · 타석 ↔ rec[0xa] 아래 · 투구 ↔ rec[9] 아래.
 *    - 시작 상황 0xaae7c(aaf24~aaf8a · aafbc): 이닝 rec[3] 아래 + 1 · 아웃 rec[4] 비트 0~1 · 볼 2~3 · 스트라이크 4~5 · 주자 rec[5] 4/2/1.
 *      사람 칸 rec[3] 위 · 두 팀 rec[2](위 사람 칸) · 점수판 +0x8e 앞 9칸 측 0 · 뒤 9칸 측 1(aa608). 시간 rec[0xb] u16(0x3f706).
 *      CPU 선발 rec[6] 아래 · CPU 타순 rec[7] 아래 · 사람 칸 타순 rec[7] 위(aa87c~aa8ac) · 마선수 rec[8] 위(aafca) · 흔들림 rec[0xd](0xaa57c).
 *    - 보상 0xa52b0: d = (rec[1] >> 1) & 7, 첫 클리어 (d·5 & 0x1f)·100.
 * 2. 칸마다 원본 해석대로 시작 상태에서 성공 길 · 실패 길을 굴려 판정이 원본 조건대로 갈리는지 본다.
 */

/** [편, rec[0..13], 목표 행 g[0..], 점수판 +0x8e..+0x9f] — base/extracted/Xls{BATTER,PITCHER}_MISSION.json 줄 0~13 그대로 */
const RAW: readonly (readonly ['타자' | '투수', string, string, string])[] = [
  ['타자', '0102051001010320000000000000', '0000000000010200', '000000000000000000000000000000000000'],
  ['타자', '0202161008040310000003000000', '0000000010000000', '000000000000000000000000000000000000'],
  ['타자', '0302271302010332000000000000', '1000000000010000', '020001000000000000000101000000000000'],
  ['타자', '04043e1400001231240002000000', '0000000000000100', '000000030001000000000000000102000000'],
  ['타자', '0504511008046110000000000000', '0000000011000000', '000104000000000000020002000000000000'],
  ['타자', '0604891401001732000002000000', '0000000100000000', '000000000000000000000000000000000000'],
  ['타자', '0706621008046110000000000000', '1000000100000000', '000000000000000000000000000000000000'],
  ['타자', '08067e1011007231400003000000', '0000000000000200', '000000000000000000000000000000000000'],
  ['타자', '0906480001038331000000000000', '0000000000040000', '000000000000000000000000000000000000'],
  ['타자', '0a08951111019431003000000000', '0000000000010300', '000000000000000000000000000000000000'],
  ['타자', '0b08ab0011000000000003000000', '0000010000000000', '000000000000000000000000000000000000'],
  ['타자', '0c081e1802070033583001000000', '0000100000000000', '000201000001000300000001000200000100'],
  ['타자', '0d0aad1001010040000003000000', '0000000300000000', '000000000000000000000000000000000000'],
  ['타자', '0e0a8e0000000030000000780000', '1101000100010200', '000000000000000000000000000000000000'],
  ['투수', '0102821810006636000000000000', '1002000003', '000000010000000000010000000000020000'],
  ['투수', '0202260300004408000000780000', '0060000002', '000100000000000000000000000000000000'],
  ['투수', '0302931300001204000a00000000', '2000000000', '000002010200000000010101000100000000'],
  ['투수', '0404150404043300340601000001', '1001110000', '000106000000000000000302000000000000'],
  ['투수', '05043712140222000000005a0001', '0001000003', '000000000000000000000000000000000000'],
  ['투수', '06040405140422000000005a0000', '0200000000', '000000000000000000000000000000000000'],
  ['투수', '070661150c000002000000f00000', '3001000000', '000102000000000000000000020000000000'],
  ['투수', '0806041304020000430501000002', '1001110000', '000400000000000000000004000000000000'],
  ['투수', '09067c1014000000000000b40000', '40a0000001', '000000000000000000000300000000000000'],
  ['투수', '0a08ab17080020220000005a0003', '0001010003', '000000000000000000000000000000000000'],
  ['투수', '0b08480410000001000000780000', '0300000000', '000003000000000000010100000000000000'],
  ['투수', '0c08451809050000580401000002', '1000000000', '000102000300020000000400000002000000'],
  ['투수', '0d0aad14080000020000002c0100', '0001010100', '000000000000000000000100010000000000'],
  ['투수', '0e0a8e130c0000020000002c0100', '0001110100', '000000000000000000000001000000000000'],
]

const bytesOf = (hex: string): number[] => Array.from({ length: hex.length / 2 }, (_unused, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16))
const high = (byte: number) => byte >> 4
const low = (byte: number) => byte & 0xf
const s8 = (byte: number) => (byte > 0x7f ? byte - 0x100 : byte)
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

interface DecodedRecord {
  readonly side: '타자' | '투수'
  readonly id: number
  readonly tier: number
  readonly humanSide: 0 | 1
  readonly sideTeams: readonly [number, number]
  readonly start: OriginalMission['start']
  readonly cpuPitcherSlot: number
  readonly cpuBattingOrder: number
  readonly humanBattingOrder: number
  readonly opponentAce: number
  readonly plateAppearanceLimit: number
  readonly swingLimit: number
  readonly pitchLimit: number
  readonly timeLimitSeconds: number
  readonly aimShake: number
  /** 판정이 견주는 목표 칸 (0 은 뺌) */
  readonly goals: Readonly<Record<string, number>>
  readonly failLimits: OriginalMission['failLimits']
}

function decode([side, head, goalRow, board]: (typeof RAW)[number]): DecodedRecord {
  const rec = bytesOf(head)
  const g = bytesOf(goalRow)
  const scoreboard = bytesOf(board)
  const human = high(rec[3]) === 0 ? 0 : 1
  const other = human === 0 ? 1 : 0
  const teams: [number, number] = [0, 0]
  teams[human] = high(rec[2])
  teams[other] = low(rec[2])
  const sideScores = [sum(scoreboard.slice(0, 9)), sum(scoreboard.slice(9, 18))]
  const goals: Record<string, number> =
    side === '타자'
      ? {
          안타: g[6], 단타: low(g[1]), '2루타': high(g[0]), '3루타': low(g[0]), 홈런: low(g[3]),
          만루홈런: high(g[2]), 그라운드홈런: low(g[2]), 번트: high(g[4]), 타점: g[5], 도루: low(g[4]),
        }
      : { 탈삼진: high(g[0]), 삼진콤보: low(g[0]), MAX게이지: high(g[1]), 아웃: g[4] }
  return {
    side,
    id: rec[0],
    tier: (rec[1] >> 1) & 7,
    humanSide: human,
    sideTeams: teams,
    start: {
      inning: low(rec[3]) + 1,
      outs: rec[4] & 3,
      balls: (rec[4] >> 2) & 3,
      strikes: (rec[4] >> 4) & 3,
      runners: { first: (rec[5] & 4) !== 0, second: (rec[5] & 2) !== 0, third: (rec[5] & 1) !== 0 },
      ourScore: sideScores[human],
      opponentScore: sideScores[other],
    },
    cpuPitcherSlot: low(rec[6]),
    cpuBattingOrder: low(rec[7]),
    humanBattingOrder: high(rec[7]),
    opponentAce: high(rec[8]),
    plateAppearanceLimit: low(rec[0xa]),
    swingLimit: side === '타자' ? high(rec[9]) : 0,
    pitchLimit: side === '투수' ? low(rec[9]) : 0,
    timeLimitSeconds: rec[0xb] | (rec[0xc] << 8),
    aimShake: rec[0xd],
    goals: Object.fromEntries(Object.entries(goals).filter(([, count]) => count > 0)),
    failLimits:
      side === '투수'
        ? { runs: low(g[1]), walks: high(g[2]), hits: low(g[2]), baserunners: s8(g[3]) }
        : { runs: 0, walks: 0, hits: 0, baserunners: 0 },
  }
}

const DECODED = RAW.map(decode)
const LISTED = [...BATTER_MISSIONS, ...PITCHER_MISSIONS]
const findMission = (side: '타자' | '투수', id: number): OriginalMission => {
  const mission = LISTED.find((candidate) => candidate.side === side && candidate.id === id)
  if (mission === undefined) throw new Error(`미션 없음: ${side} ${id}`)
  return mission
}

describe('미션 레코드 28칸 — 원본 바이트를 판정 · 준비 함수 자리대로 푼 값과 웹 정의가 같다', () => {
  it('목록은 편마다 14칸(미션 1~14)이고 원본 레코드 줄 0~13 과 차례가 같다', () => {
    expect(BATTER_MISSIONS.map((mission) => mission.id)).toEqual(DECODED.filter((row) => row.side === '타자').map((row) => row.id))
    expect(PITCHER_MISSIONS.map((mission) => mission.id)).toEqual(DECODED.filter((row) => row.side === '투수').map((row) => row.id))
  })

  it.each(DECODED.map((row) => [row.side, row.id, row] as const))('%s %i', (side, id, row) => {
    const mission = findMission(side, id)
    const key = missionKeyOf(mission)

    expect(mission).toMatchObject({
      humanSide: row.humanSide,
      sideTeams: row.sideTeams,
      start: row.start,
      opponentAce: row.opponentAce,
      plateAppearanceLimit: row.plateAppearanceLimit,
      swingLimit: row.swingLimit,
      pitchLimit: row.pitchLimit,
      timeLimitSeconds: row.timeLimitSeconds,
      conditionCode: row.aimShake,
      failLimits: row.failLimits,
    })
    // 판정이 견주는 목표 칸 = 웹 판정 목표(글 목표 + 글에 없는 칸) — 사이클링히트는 단타 · 2루타 · 3루타 · 홈런 칸을 묶은 글이다
    expect(mission.goalCounts).toEqual(row.goals)
    expect(MISSION_CPU_START[key]).toEqual({ pitcherSlot: row.cpuPitcherSlot, battingOrder: row.cpuBattingOrder })
    expect(MISSION_HUMAN_START_ORDER[key]).toBe(row.humanBattingOrder)
    // 보상 0xa52b0 — 첫 클리어 (d·5 & 0x1f)·100, 두 번째 (d·3 & 0xf)·100
    expect(missionRewardOf(mission.stage, 0)).toBe(((row.tier * 5) & 0x1f) * 100)
    expect(missionRewardOf(mission.stage, 1)).toBe(((row.tier * 3) & 0xf) * 100)
  })

  it.each(DECODED.map((row) => [row.side, row.id, row] as const))('%s %i 의 시작 판', (side, id, row) => {
    const mission = findMission(side, id)
    const run: MissionRun | PitcherRun = side === '타자' ? startMission(mission) : startPitcherMission(mission)
    const human = humanSideOf(mission)
    const cpu = cpuSideOf(mission)

    expect(run.status).toBe('진행중')
    expect(run.outs).toBe(row.start.outs)
    expect(run.bases).toEqual(row.start.runners)
    expect(run.game.inning).toBe(row.start.inning - 1)
    // 공격 측 st[9] — 모드 5 는 다른 칸, 6 은 사람 칸(aa6ac)
    expect(run.game.offenseSide).toBe(side === '타자' ? human : cpu)
    expect(run.game.scores[human]).toBe(row.start.ourScore)
    expect(run.game.scores[cpu]).toBe(row.start.opponentScore)
    expect(run.remainingSeconds).toBe(row.timeLimitSeconds > 0 ? row.timeLimitSeconds : null)
    expect(run.remainingPlateAppearances).toBe(row.plateAppearanceLimit > 0 ? row.plateAppearanceLimit : null)
    if (side === '투수') expect((run as PitcherRun).remainingPitches).toBe(row.pitchLimit > 0 ? row.pitchLimit : null)
    else expect(run.remainingSwings).toBe(row.swingLimit > 0 ? row.swingLimit : null)
    // 시작에 다 찬 개수 목표는 없다
    expect(judgedGoalsOf(mission, run.progress).filter((goal) => !goal.name.startsWith('무') && goal.achieved >= goal.required)).toEqual([])
  })
})

const SINGLE: AtBatOutcome = { kind: '안타', bases: 1 }
const DOUBLE: AtBatOutcome = { kind: '안타', bases: 2 }
const TRIPLE: AtBatOutcome = { kind: '안타', bases: 3 }
const HOME_RUN: AtBatOutcome = { kind: '홈런' }
const STRIKEOUT: AtBatOutcome = { kind: '삼진' }
const WALK: AtBatOutcome = { kind: '볼넷' }
const HIT_BY_PITCH: AtBatOutcome = { kind: '사구' }
/** 내야 뒤에 겨우 뜬 공 — 사람 수비가 키 없이도 뜬 채로 잡는다(주자는 태그업으로 못 들어온다, `pitcherRun.test` 와 같은 원본 코드 0 패턴) */
const FLY_OUT = registerContact({ kind: '아웃', detail: '뜬공아웃' }, { pattern: [90, 250, 700, 0], resultCode: 0 })
/** 원본 패턴 표 코드 20 칸 2 — 1사 빈 루에서 판 안 그라운드 홈런(state[0x25]) */
const INSIDE_THE_PARK_HOME_RUN = registerContact(HOME_RUN, { pattern: [67, 1150, 600, 2], resultCode: 20 })
const LOOP_GUARD = 3000

// ── 타자편 ────────────────────────────────────────────────────────────────

/** 미션 타자 차례까지 — 사람 칸 마스터 타자는 삼진으로 넘기고, 3아웃이면 자동진행 반 이닝(c2198) */
function toMissionBatter(run: MissionRun, random: RandomPort): MissionRun {
  let next = run
  for (let guard = 0; guard < LOOP_GUARD && next.status === '진행중' && !isMissionBatterUp(next); guard += 1) {
    next = runBatterMissionAutoHalves(applyOutcome(next, STRIKEOUT), random)
  }
  return next
}

/** 미션 타자 타석 하나 — 스윙 칸(코드 9)은 미션 타자의 스윙만 센다 */
function bat(run: MissionRun, outcome: AtBatOutcome, random: RandomPort, options: { readonly bunt?: boolean; readonly swings?: number } = {}): MissionRun {
  let next = toMissionBatter(run, random)
  if (next.status !== '진행중') return next
  for (let swing = 0; swing < (options.swings ?? 1); swing += 1) next = recordSwing(next)
  return runBatterMissionAutoHalves(applyOutcome(next, outcome, options.bunt === true), random)
}

/** 미션 타자가 삼진만 당한다 — 타석 · 스윙 한도가 없으면 경기 끝(0xb68fc → aad20)까지 */
function strikeOutUntilDone(run: MissionRun, random: RandomPort): MissionRun {
  let next = run
  for (let guard = 0; guard < LOOP_GUARD && next.status === '진행중'; guard += 1) next = bat(next, STRIKEOUT, random)
  return next
}

describe('타자편 칸마다 — 성공 길과 실패 길 (판정 0xaaa6c 모드 6)', () => {
  const random = () => createSeededRandom(7)

  it('1 명품 타자의 첫 걸음 — 1사 3루 · 안타 2 + 타점 1, 한도 없음', () => {
    const mission = findMission('타자', 1)
    const rng = random()
    const first = bat(startMission(mission), SINGLE, rng)
    expect(first.progress.counts['타점']).toBe(1)
    expect(first.status).toBe('진행중')
    expect(bat(first, SINGLE, rng).status).toBe('성공')
    // 한도가 없으면 경기 끝(aad20)에서만 실패
    const failed = strikeOutUntilDone(startMission(mission), random())
    expect(failed.status).toBe('실패')
    expect(failed.game.inning).toBeGreaterThanOrEqual(8)
  })

  it('2 번트의 달인 — 무사 1루 · 번트 안타 1, 3타석', () => {
    const mission = findMission('타자', 2)
    expect(bat(startMission(mission), SINGLE, random(), { bunt: true }).status).toBe('성공')
    // 희생번트(아웃 번트)는 R+0xf4 에 안 든다(a8506) — 보통 안타도 번트 목표가 아니다
    expect(bat(startMission(mission), SINGLE, random()).status).toBe('진행중')
    const rng = random()
    let run = startMission(mission)
    run = bat(run, STRIKEOUT, rng)
    run = bat(run, STRIKEOUT, rng)
    expect(run.status).toBe('진행중')
    expect(run.remainingPlateAppearances).toBe(1)
    expect(bat(run, STRIKEOUT, rng).status).toBe('실패')
  })

  it('3 찬스를 노려라 — 2사 3루 · 2루타 1 + 타점 1', () => {
    const mission = findMission('타자', 3)
    expect(bat(startMission(mission), DOUBLE, random()).status).toBe('성공')
    const single = bat(startMission(mission), SINGLE, random())
    expect(single.progress.counts['타점']).toBe(1)
    expect(single.status).toBe('진행중')
    expect(strikeOutUntilDone(startMission(mission), random()).status).toBe('실패')
  })

  it('4 밀림의 공주 레오니 — 안타 1, 2타석', () => {
    const mission = findMission('타자', 4)
    expect(bat(startMission(mission), SINGLE, random()).status).toBe('성공')
    const rng = random()
    const once = bat(startMission(mission), STRIKEOUT, rng)
    expect(once.status).toBe('진행중')
    expect(bat(once, STRIKEOUT, rng).status).toBe('실패')
  })

  it('5 기동력은 나의 힘 — 무사 1루 · 번트 안타 1 + 도루 1 (도루 판에서도 판정, 0xae3e8 → 0xaaa6c)', () => {
    const mission = findMission('타자', 5)
    const stolen = applySteal(startMission(mission))
    expect(stolen.status).toBe('진행중')
    expect(bat(stolen, SINGLE, random(), { bunt: true }).status).toBe('성공')
    // 번트 안타 먼저 — 1루에 타자주자가 서면 도루로 끝난다
    const bunted = bat(startMission(mission), SINGLE, random(), { bunt: true })
    expect(bunted.status).toBe('진행중')
    expect(strikeOutUntilDone(startMission(mission), random()).status).toBe('실패')
  })

  it('6 추격타의 주인공 — 홈런 1, 2타석', () => {
    const mission = findMission('타자', 6)
    expect(bat(startMission(mission), HOME_RUN, random()).status).toBe('성공')
    const rng = random()
    const once = bat(startMission(mission), DOUBLE, rng)
    expect(once.status).toBe('진행중')
    expect(bat(once, TRIPLE, rng).status).toBe('실패')
  })

  it('7 폭발하는 방망이 — 홈런 1 + 2루타 1', () => {
    const mission = findMission('타자', 7)
    const rng = random()
    const homer = bat(startMission(mission), HOME_RUN, rng)
    expect(homer.status).toBe('진행중')
    expect(bat(homer, DOUBLE, rng).status).toBe('성공')
    expect(strikeOutUntilDone(startMission(mission), random()).status).toBe('실패')
  })

  it('8 치명적인 유혹 — 안타 2, 3타석 · 두 번째 타석 삼진이면 남은 1타석으로 못 채워 그 자리에서 실패(0xaa958)', () => {
    const mission = findMission('타자', 8)
    const rng = random()
    const hit = bat(startMission(mission), SINGLE, rng)
    expect(hit.status).toBe('진행중')
    expect(bat(hit, SINGLE, rng).status).toBe('성공')
    const rng2 = random()
    const once = bat(startMission(mission), STRIKEOUT, rng2)
    expect(once.status).toBe('진행중')
    const twice = bat(once, STRIKEOUT, rng2)
    expect(twice.remainingPlateAppearances).toBe(1)
    expect(twice.status).toBe('실패')
  })

  it('9 미스터 타점왕 — 1사 2·3루 · 타점 4 (3아웃 판의 득점도 든다)', () => {
    const mission = findMission('타자', 9)
    const rng = random()
    const homer = bat(startMission(mission), HOME_RUN, rng)
    expect(homer.progress.counts['타점']).toBe(3)
    expect(homer.status).toBe('진행중')
    expect(bat(homer, HOME_RUN, rng).status).toBe('성공')
    expect(strikeOutUntilDone(startMission(mission), random()).status).toBe('실패')
  })

  it('10 빠르게 제압하라 — 1사 3루 · 안타 3 + 타점 1, 스윙 3 · 헛스윙 하나면 그 자리에서 실패(0xaa958)', () => {
    const mission = findMission('타자', 10)
    const rng = random()
    let run = bat(startMission(mission), SINGLE, rng)
    expect(run.progress.counts['타점']).toBe(1)
    run = bat(run, SINGLE, rng)
    expect(run.status).toBe('진행중')
    expect(run.remainingSwings).toBe(1)
    expect(bat(run, SINGLE, rng).status).toBe('성공')
    expect(checkSwingsExhausted(recordSwing(startMission(mission))).status).toBe('실패')
  })

  it('11 도전! 그라운드 홈런 — 판 안 홈런 1, 3타석 · 담장 홈런은 안 든다', () => {
    const mission = findMission('타자', 11)
    expect(bat(startMission(mission), INSIDE_THE_PARK_HOME_RUN, random()).status).toBe('성공')
    const rng = random()
    let run = bat(startMission(mission), HOME_RUN, rng)
    expect(run.status).toBe('진행중')
    run = bat(run, HOME_RUN, rng)
    expect(run.status).toBe('진행중')
    expect(bat(run, HOME_RUN, rng).status).toBe('실패')
  })

  it('12 운명의 대결 — 9회말 2사 만루 4:7 · 만루홈런 1, 1타석 · 스윙 3', () => {
    const mission = findMission('타자', 12)
    const slam = bat(startMission(mission), HOME_RUN, random())
    expect(slam.progress.counts['타점']).toBe(4)
    expect(slam.status).toBe('성공')
    // 홈런이 아닌 안타는 타석 한도 1 에서 실패 (끝내기 판이어도 aad20 은 진행 중을 실패로)
    expect(bat(startMission(mission), SINGLE, random()).status).toBe('실패')
    // 스윙 셋을 다 헛치면 타석 도중이라도 실패
    let run = startMission(mission)
    run = checkSwingsExhausted(recordSwing(run))
    run = checkSwingsExhausted(recordSwing(run))
    expect(run.status).toBe('진행중')
    expect(checkSwingsExhausted(recordSwing(run)).status).toBe('실패')
  })

  it('13 미라클 홈런왕 — 1사 3루 · 홈런 3, 3타석 · 하나라도 홈런이 아니면 그 자리에서 실패(0xaa958)', () => {
    const mission = findMission('타자', 13)
    const rng = random()
    let run = bat(startMission(mission), HOME_RUN, rng)
    run = bat(run, HOME_RUN, rng)
    expect(run.status).toBe('진행중')
    expect(bat(run, HOME_RUN, rng).status).toBe('성공')
    expect(bat(startMission(mission), SINGLE, random()).status).toBe('실패')
  })

  it('14 폭주!! 사이클링 히트 — 단타 · 2루타 · 3루타 · 홈런(+ 글에 없는 타점 1 · 안타 2), 120초 · 남은 초 1 에서 실패', () => {
    const mission = findMission('타자', 14)
    const rng = random()
    let run = startMission(mission)
    for (const outcome of [SINGLE, DOUBLE, TRIPLE]) {
      run = bat(run, outcome, rng)
      expect(run.status).toBe('진행중')
    }
    expect(bat(run, HOME_RUN, rng).status).toBe('성공')
    const clock = tick(startMission(mission), 118)
    expect(clock.status).toBe('진행중')
    expect(tick(clock, 1).status).toBe('실패')
  })
})

// ── 투수편 ────────────────────────────────────────────────────────────────

/** 투수 타석 하나 — 공을 던지고(MAX게이지 `perfect` 개) 결과를 먹인 뒤, 3아웃이면 사람 칸 공격 반 이닝은 자동(c1e3e) */
function pitch(
  run: PitcherRun,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: { readonly pitches?: number; readonly perfect?: number } = {},
): PitcherRun {
  let next = run
  const pitches = options.pitches ?? 1
  for (let thrown = 0; thrown < pitches; thrown += 1) {
    next = recordPitch(next, thrown < (options.perfect ?? 0))
    // 타석이 안 끝난 공도 판정 A(ae382)가 판정한다
    if (thrown < pitches - 1) next = checkPitchExhausted(next)
    if (next.status !== '진행중') return next
  }
  return runPitcherMissionAutoHalves(applyPitcherOutcome(next, outcome), random)
}

function pitchStrikeoutsUntilDone(run: PitcherRun, random: RandomPort, perfect = 0): PitcherRun {
  let next = run
  for (let guard = 0; guard < LOOP_GUARD && next.status === '진행중'; guard += 1) next = pitch(next, STRIKEOUT, random, { pitches: 3, perfect })
  return next
}

describe('투수편 칸마다 — 성공 길과 실패 길 (판정 0xaaa6c 모드 5)', () => {
  const random = () => createSeededRandom(7)

  it('1 깔끔한 마무리 — 9회초 3:1 · 탈삼진 1 + 아웃 3, 실점 한도 2', () => {
    const mission = findMission('투수', 1)
    const rng = random()
    let run = pitch(startPitcherMission(mission), STRIKEOUT, rng)
    run = pitch(run, FLY_OUT, rng)
    expect(run.status).toBe('진행중')
    expect(pitch(run, FLY_OUT, rng).status).toBe('성공')
    // 아웃 셋이어도 탈삼진이 없으면 9회초 3아웃 = 경기 끝(aad20) → 실패
    const rng2 = random()
    let noStrikeout = startPitcherMission(mission)
    for (let out = 0; out < 3; out += 1) noStrikeout = pitch(noStrikeout, FLY_OUT, rng2)
    expect(noStrikeout.status).toBe('실패')
    const rng3 = random()
    const oneRun = pitch(startPitcherMission(mission), HOME_RUN, rng3)
    expect(oneRun.status).toBe('진행중')
    expect(pitch(oneRun, HOME_RUN, rng3).status).toBe('실패')
  })

  it('2 최고의 집중력 — MAX게이지 6 + 아웃 2, 120초 · 여섯째 MAX 공에서 타석 도중이라도 성공', () => {
    const mission = findMission('투수', 2)
    const rng = random()
    let run = pitch(startPitcherMission(mission), FLY_OUT, rng, { pitches: 3, perfect: 3 })
    run = pitch(run, FLY_OUT, rng, { pitches: 2, perfect: 2 })
    expect(run.progress.counts['MAX게이지']).toBe(5)
    expect(run.status).toBe('진행중')
    run = checkPitchExhausted(recordPitch(run, true))
    expect(run.progress.counts['MAX게이지']).toBe(6)
    expect(run.status).toBe('성공')
    expect(tick(startPitcherMission(mission), 119).status).toBe('실패')
  })

  it('3 혼이 실린 스트라이크 — 탈삼진 2, 투구 10', () => {
    const mission = findMission('투수', 3)
    const rng = random()
    const once = pitch(startPitcherMission(mission), STRIKEOUT, rng, { pitches: 3 })
    expect(once.status).toBe('진행중')
    expect(pitch(once, STRIKEOUT, rng, { pitches: 3 }).status).toBe('성공')
    let run = startPitcherMission(mission)
    for (let thrown = 0; thrown < 9; thrown += 1) run = checkPitchExhausted(recordPitch(run, false))
    expect(run.status).toBe('진행중')
    expect(checkPitchExhausted(recordPitch(run, false)).status).toBe('실패')
  })

  it.each([4, 8])('%i 마타자 — 탈삼진 1, 1타석 · 투구 한도 · 볼넷 · 피안타 · 실점 한도 1', (id) => {
    const mission = findMission('투수', id)
    expect(pitch(startPitcherMission(mission), STRIKEOUT, random(), { pitches: 3 }).status).toBe('성공')
    expect(pitch(startPitcherMission(mission), FLY_OUT, random()).status).toBe('실패')
    const walked = pitch(startPitcherMission(mission), WALK, random())
    expect(walked.progress.brokenConditions).toContain('무사사구')
    expect(walked.status).toBe('실패')
    let run = startPitcherMission(mission)
    for (let thrown = 1; thrown < mission.pitchLimit; thrown += 1) run = checkPitchExhausted(recordPitch(run, false))
    expect(run.status).toBe('진행중')
    expect(checkPitchExhausted(recordPitch(run, false)).status).toBe('실패')
  })

  it('5 흔들리지 않는 마음 — 3회 2루 · 아웃 3, 90초 · 실점 한도 1', () => {
    const mission = findMission('투수', 5)
    expect(pitchStrikeoutsUntilDone(startPitcherMission(mission), random()).status).toBe('성공')
    expect(pitch(startPitcherMission(mission), HOME_RUN, random()).status).toBe('실패')
    expect(tick(startPitcherMission(mission), 89).status).toBe('실패')
  })

  it('6 연속 삼진 쇼 — 삼진콤보 2 · 사이에 볼넷이 끼면 콤보가 0 으로', () => {
    const mission = findMission('투수', 6)
    const rng = random()
    let run = pitch(startPitcherMission(mission), STRIKEOUT, rng)
    run = pitch(run, WALK, rng)
    expect(run.progress.counts['삼진콤보']).toBe(0)
    run = pitch(run, STRIKEOUT, rng)
    expect(run.status).toBe('진행중')
    expect(pitch(run, STRIKEOUT, rng).status).toBe('성공')
    expect(tick(startPitcherMission(mission), 89).status).toBe('실패')
  })

  it('7 에이스 투수의 기량 — 탈삼진 3 + 무실점(실점 한도 1), 240초', () => {
    const mission = findMission('투수', 7)
    expect(pitchStrikeoutsUntilDone(startPitcherMission(mission), random()).status).toBe('성공')
    expect(pitch(startPitcherMission(mission), HOME_RUN, random()).status).toBe('실패')
  })

  it('9 투혼의 삼진 행진 — 탈삼진 4 + MAX게이지 10 + 글에 없는 아웃 1, 180초', () => {
    const mission = findMission('투수', 9)
    const rng = random()
    let run = startPitcherMission(mission)
    for (let strikeout = 0; strikeout < 3; strikeout += 1) run = pitch(run, STRIKEOUT, rng, { pitches: 3, perfect: 3 })
    expect(run.progress.counts['MAX게이지']).toBe(9)
    expect(run.status).toBe('진행중')
    expect(pitch(run, STRIKEOUT, rng, { pitches: 3, perfect: 1 }).status).toBe('성공')
    // MAX 가 모자라면 탈삼진 넷으로도 아직
    expect(pitchStrikeoutsUntilDone(startPitcherMission(mission), random()).status).not.toBe('성공')
  })

  it('10 난공불락의 철벽마무리 — 8회 · 아웃 3, 90초 · 피안타 · 실점 한도 1', () => {
    const mission = findMission('투수', 10)
    expect(pitchStrikeoutsUntilDone(startPitcherMission(mission), random()).status).toBe('성공')
    expect(pitch(startPitcherMission(mission), SINGLE, random()).status).toBe('실패')
    // 볼넷은 한도가 없다
    expect(pitch(startPitcherMission(mission), WALK, random()).status).toBe('진행중')
  })

  it('11 불꽃같은 투구 — 삼진콤보 3, 120초', () => {
    const mission = findMission('투수', 11)
    const rng = random()
    let run = pitch(startPitcherMission(mission), STRIKEOUT, rng)
    run = pitch(run, STRIKEOUT, rng)
    expect(run.status).toBe('진행중')
    expect(pitch(run, STRIKEOUT, rng).status).toBe('성공')
  })

  it('12 최강의 챔피언 — 9회 1사 1·3루 · 탈삼진 1, 1타석 · 투구 4 (한도 없는 실점은 안 본다)', () => {
    const mission = findMission('투수', 12)
    expect(pitch(startPitcherMission(mission), STRIKEOUT, random(), { pitches: 3 }).status).toBe('성공')
    expect(pitch(startPitcherMission(mission), WALK, random()).status).toBe('실패')
    let run = startPitcherMission(mission)
    for (let thrown = 0; thrown < 3; thrown += 1) run = checkPitchExhausted(recordPitch(run, false))
    expect(run.status).toBe('진행중')
    expect(checkPitchExhausted(recordPitch(run, false)).status).toBe('실패')
  })

  it.each([13, 14])('%i 노히트 · 퍼펙트 — 한도 셋이 다 서 경기 끝까지 막으면 성공(aac48), 볼넷 · 사구 하나로 실패(출루 허용 R+0x130)', (id) => {
    const mission = findMission('투수', id)
    const done = pitchStrikeoutsUntilDone(startPitcherMission(mission), random())
    expect(done.status).toBe('성공')
    // 9회초 3아웃에 사람 칸(홈)이 앞서 끝난다
    expect(done.game.inning).toBe(8)
    expect(pitch(startPitcherMission(mission), WALK, random()).status).toBe('실패')
    expect(pitch(startPitcherMission(mission), HIT_BY_PITCH, random()).status).toBe('실패')
    expect(pitch(startPitcherMission(mission), SINGLE, random()).status).toBe('실패')
    expect(tick(startPitcherMission(mission), 299).status).toBe('실패')
  })
})
