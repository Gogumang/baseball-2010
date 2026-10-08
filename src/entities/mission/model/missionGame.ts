import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { quickBatterOf, teamBatters } from '@/entities/team/model/teamRoster'
import { rosterLineupOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import { isGameOverAt } from '@/entities/game/model/gameState'
import {
  missionPitchingDefenseOf,
  startMissionCpuPitching,
} from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **미션 경기의 이닝 · 공수 · 점수** — 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라 3아웃이면 공수가 바뀌고 이닝이 넘어간다
 * (직접 재역어셈 — 0x50c94 · 0x3ac90 · 0xb6b6c · 0x4f928 · 0xc2198 · 0xc1e04 · 0x48480 · 0xaaa6c · 0xaae7c · 0x48d50 · 0xb68fc).
 *
 * ```
 * 3아웃      메시지 3 → 0x18 진입 0x3ac90: 0xb68fc(경기 끝) 거짓이면 0xb6b6c — st[9] ↔ st[0xa], 말이 끝났으면 st[0x6b](이닝)++,
 *            주자 지움 0xa9250 · 0xa5b00. (0xaae7c 는 이때 시작 상황을 다시 깔지 않는다 — 아래)
 * 0x18 갱신  0x4f928 틱 0: 0xaebe4 두 팀 → 0xc2198(sim, 1) 참이면 상태 0x21(자동진행)
 * 0xc2198    c21d6 0xb68fc 참이면 0 (자동 끝) · 3아웃이면 0xb6b6c 뒤 모드 5·6 은 c2248 미션 판정 0xaaa6c ·
 *            그리고 0xc1e04(모드 − 1 점프표 0xd90c0): 모드 5 c1e3e · 6 c1e6a — [ctx+0xa8] ≠ 0(모든 미션)이면 `!0xc1d38` =
 *            모드 5: 수비 투수가 육성(0xb6389)·명예(0xb6349) 선수가 아니면 자동 · 모드 6: 공격 타자가 그렇지 않으면 자동
 * 0x21       0x48480 틱마다 0xc2198 참이면 간이 타석 0xc262c 하나, 거짓이면 0x18 (이전 0x21 이라 +0x1784 = 1 → 판 없이 곧장 0xd)
 * ```
 * 그래서 **사람 선수가 안 나서는 반 이닝은 간이 엔진이 돈다** — 투수 미션은 사람 칸 팀이 치는 반 이닝 통째로,
 * 타자 미션은 CPU 가 치는 반 이닝과 사람 칸 팀 타선이 미션 타자 차례에 닿기 전까지. 경기 끝(0xb68fc, 9회 · 콜드)이 나면 0x19 로 간다.
 * 미션 판정 0xaaa6c 는 aad20 에서 경기 끝이고 아직 진행(1)이면 실패(2)로 — 자동진행 중 경기가 끝나면 판정이 안 돌아(c21d6 가 먼저)
 * 미션 객체 +0xbc 가 안 서 결과도 실패다.
 *
 * 시작 상황(레코드 +4 · +5)은 0xd 메시지 0xaae7c 의 aaf10 갈래가 **이전 상태 0x18 이고 st[0x6b] == 시작 이닝(+3 아래 4비트)** 일 때만
 * 깐다 — 경기 처음(0x48658 48c8c 의 aae7c(…, 0xd, 0x18, 0/1))뿐이다. 3아웃 뒤 다음 사람 반 이닝은 늘 다른 이닝이라(사람이 안 치는 반
 * 이닝이 하나는 끼고, 그 사이 말이 끝나 이닝이 오른다) 빈 루 · 0아웃 · 0-0 에서 이어진다.
 */
export interface MissionGame {
  /** `st[0x6b]` — 0부터 센 이닝 (0xaa57c 가 레코드 +3 아래 4비트로) */
  readonly inning: number
  /** `st[9]` — 지금 공격 측 (0 초 · 1 말) */
  readonly offenseSide: 0 | 1
  /** `st[0x7e]` · `st[0x7f]` — 측 0 · 측 1 점수 (0xb69b0) */
  readonly scores: readonly [number, number]
  /** 미션 객체 `+0x24` — 0xaae7c 마선수 다시 끼우기가 마지막으로 본 이닝 (0xaa57c aa8b6 이 −1) */
  readonly aceCheckedInning: number
  /** 사람 칸 팀의 타선 — 투수 미션의 자동진행 반 이닝이 친다 (레코드 +7 윗 4비트 타순) */
  readonly humanBatting: MissionTeamBatting
  /** 투수 미션의 CPU 수비 — 사람 칸 팀이 치는 자동진행 반 이닝에 던진다 (선발 = 레코드 +6 아래 4비트, 0xb8c94) */
  readonly cpuAutoPitching: MissionCpuPitching | null
  /** 사람이 맡은 반 이닝이 3아웃으로 끝나 0x18 · 자동진행을 기다린다 (부르는 쪽이 난수로 `runMissionAutoHalves` 류를 돌린다) */
  readonly halfEnded: boolean
}

export interface MissionTeamBatting {
  readonly teamId: number
  /** `team+0xe` 명단 — 칸마다 레코드 번호(= 마스터 줄, 사람 칸 팀은 마선수가 없다) */
  readonly lineup: QuickLineup
  /** `team+0x32` */
  readonly order: number
}

/** 마스터 팀 타자 12 줄 */
const BATTERS_PER_TEAM = 12

/**
 * 레코드 +7 의 **윗 4비트** — 사람 칸 팀의 시작 타순(aa87c~aa88c `팀[사람 칸]+0x32`). 원본 표(`base/extracted/Xls*_MISSION.json`
 * 줄 바이트 7)에서 옮겨 적었다 — 생성기가 싣지 않는 칸. 열쇠는 `missionKeyOf`.
 */
export const MISSION_HUMAN_START_ORDER: Readonly<Record<string, number>> = {
  '타자:1': 2, '타자:2': 1, '타자:3': 3, '타자:4': 3, '타자:5': 1, '타자:6': 3, '타자:7': 1, '타자:8': 3, '타자:9': 3,
  '타자:10': 3, '타자:11': 0, '타자:12': 3, '타자:13': 4, '타자:14': 3,
  '타자:16': 3, '타자:17': 3, '타자:18': 3, '타자:19': 3, '타자:20': 3,
  '투수:1': 3, '투수:2': 0, '투수:3': 0, '투수:4': 0, '투수:5': 0, '투수:6': 0, '투수:7': 0, '투수:8': 0, '투수:9': 0,
  '투수:10': 2, '투수:11': 0, '투수:12': 0, '투수:13': 0, '투수:14': 0,
  '투수:16': 3, '투수:17': 3, '투수:18': 3, '투수:19': 3, '투수:20': 3,
}

export function humanSideOf(mission: OriginalMission): 0 | 1 {
  return mission.humanSide === 0 ? 0 : 1
}

export function cpuSideOf(mission: OriginalMission): 0 | 1 {
  return mission.humanSide === 0 ? 1 : 0
}

/** 경기 세우기 0xaa57c — 이닝 · 공격 측(aa6ac: 모드 5 는 다른 칸, 6 은 사람 칸) · 점수판(사람 칸 = 우리 점수) */
export function startMissionGame(mission: OriginalMission): MissionGame {
  const human = humanSideOf(mission)
  const cpu = cpuSideOf(mission)
  const scores: [number, number] = [0, 0]
  scores[human] = mission.start.ourScore
  scores[cpu] = mission.start.opponentScore
  const humanTeamId = mission.sideTeams[human]
  return {
    inning: mission.start.inning - 1,
    offenseSide: mission.side === '투수' ? cpu : human,
    scores,
    aceCheckedInning: -1,
    humanBatting: {
      teamId: humanTeamId,
      lineup: rosterLineupOf(BATTERS_PER_TEAM),
      order: MISSION_HUMAN_START_ORDER[missionKeyOf(mission)] ?? 0,
    },
    cpuAutoPitching: mission.side === '투수' ? startMissionCpuPitching(mission) : null,
    halfEnded: false,
  }
}

/** 점수판 득점 (0xa5c34) — 그 측 점수에 더한다 */
export function withMissionScore(game: MissionGame, side: 0 | 1, runs: number): MissionGame {
  if (runs <= 0) return game
  const scores: [number, number] = [game.scores[0], game.scores[1]]
  scores[side] += runs
  return { ...game, scores }
}

/** **경기 끝 판정 0xb68fc** — 지금 반 이닝 · 주어진 아웃(3아웃 판 끝이면 3)으로 */
export function isMissionGameOver(game: MissionGame, outs: number, scores: readonly [number, number] = game.scores): boolean {
  return isGameOverAt({
    inning: game.inning + 1,
    half: game.offenseSide === 0 ? '초' : '말',
    outs,
    awayScore: scores[0],
    homeScore: scores[1],
  })
}

/** **반 이닝 넘김 0xb6b6c** — 말이 끝났으면 이닝 +1, 공격 측을 뒤집는다 (주자 · 아웃은 부르는 쪽이 비운다) */
export function flipMissionHalf(game: MissionGame): MissionGame {
  return {
    ...game,
    inning: game.offenseSide === 1 ? game.inning + 1 : game.inning,
    offenseSide: game.offenseSide === 0 ? 1 : 0,
  }
}

/**
 * **사람 칸 팀이 치는 자동진행 반 이닝** (투수 미션) — 0x21 의 간이 타석 0xc262c 고리. 공격 = 사람 칸 팀 마스터 타선(`humanBatting`),
 * 수비 = CPU 팀(`cpuAutoPitching`, 투수 교체 0xac428 · 대타 0xac228 은 간이 엔진 0xc1ba4 그대로). 타석마다 c21d6 경기 끝(끝내기 · 콜드)을 본다.
 * 사람 칸 팀 마스터 타자는 육성·명예 선수가 아니라(0xb6389 · 0xb6349 거짓) 0xc1e04 가 반 이닝 내내 자동이다.
 */
export function simulateHumanTeamAutoHalf(
  game: MissionGame,
  random: RandomPort,
): { readonly game: MissionGame; readonly gameEnded: boolean } {
  const pitching = game.cpuAutoPitching
  if (pitching === null) return { game, gameEnded: false }
  const humanSide = game.offenseSide
  const cpuSide = humanSide === 0 ? 1 : 0
  const batting = game.humanBatting
  const rows = teamBatters(batting.teamId)
  const batterOf = (recordIndex: number) => quickBatterOf(rows[recordIndex % rows.length])
  const defense = missionPitchingDefenseOf(pitching, game.scores[cpuSide] - game.scores[humanSide])
  const result = simulateHalfInning(
    batting.order,
    (cursor) => batterOf(rosterSlotAt(batting.lineup, cursor)),
    defense.pitcherAt(pitching.mound.pitcherSlot),
    game.inning + 1,
    random,
    undefined,
    {
      endsGame: ({ runs, outs }) => {
        const scores: [number, number] = [game.scores[0], game.scores[1]]
        scores[humanSide] += runs
        return isMissionGameOver(game, outs, scores)
      },
    },
    defense,
    { lineup: batting.lineup, batterOf, pinchHitUsed: false },
  )
  const scored = withMissionScore(game, humanSide, result.runs)
  return {
    game: {
      ...scored,
      humanBatting: {
        ...batting,
        lineup: result.lineup ?? batting.lineup,
        order: result.nextBattingOrderIndex,
      },
      cpuAutoPitching: {
        ...pitching,
        // 이닝 교대 0xa5b00 이 A 를 0 으로 — 다음 자동진행 반 이닝은 0 에서 선다
        mound: result.mound ?? pitching.mound,
        inningRunsAllowed: 0,
      },
    },
    gameEnded: result.gameEnded === true || isMissionGameOver(scored, result.outs),
  }
}
