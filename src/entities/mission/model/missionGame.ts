import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { quickBatterOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterLineupOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { simulateHalfInningTicks } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningPlateAppearance, HalfInningTick } from '@/entities/game/model/simulateHalfInning'
import { isGameOverAt } from '@/entities/game/model/gameState'
import {
  MISSION_ACE_ROSTER_SLOT,
  MISSION_CPU_START,
  missionPitchingDefenseOf,
  startMissionCpuPitching,
} from '@/entities/mission/model/missionCpuTeam'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { MissionAcePitcher, MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { drainMissionAutoTicks, missionAutoRelayStepOfTick } from '@/entities/mission/model/missionAutoRelay'
import type { MissionAutoRelay, MissionAutoRelayCards, MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'

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
  /** 타자 미션의 CPU 타선 — CPU 가 치는 자동진행 반 이닝 (타순 = 레코드 +7 아래 4비트) */
  readonly cpuAutoBatting: MissionTeamBatting | null
  /** 타자 미션의 사람 칸 팀 투수진 — CPU 가 치는 자동진행 반 이닝에 던진다 (명부 차례 그대로 — 0xaa57c 는 모드 6 에서 안 바꾼다) */
  readonly humanPitching: MissionCpuPitching | null
  /** 사람이 맡은 반 이닝이 3아웃으로 끝나 0x18 · 자동진행을 기다린다 (부르는 쪽이 난수로 `runMissionAutoHalves` 류를 돌린다) */
  readonly halfEnded: boolean
  /**
   * 마지막 자동진행(0x18 → 0x21 → 0x18)의 중계 틱 — 사람 반 이닝이 3아웃으로 끝날 때마다 새로 쌓는다(`withMissionAutoRelay`).
   * 화면이 `serial` 이 바뀔 때마다 한 번 튼다(틱마다 한 칸). 아직 안 돌았으면 null.
   */
  readonly autoRelay: MissionAutoRelay | null
}

export interface MissionTeamBatting {
  readonly teamId: number
  /** `team+0xe` 명단 — 칸마다 레코드 번호 */
  readonly lineup: QuickLineup
  /** 레코드 칸마다 든 선수 — 마스터 줄(팀 안 0~11) 또는 미션 타자(`MISSION_NARI_RECORD`) */
  readonly records: readonly number[]
  /** `team+0x32` */
  readonly order: number
}

/**
 * 타자 미션의 **미션 타자** 레코드 표지 — 0xaa57c aa7b0(모드 6)이 `0xb87cc(사람 칸 팀)`으로 미션 타자(선수 게터 0x1fc20 — 나리 타자편
 * 저장 선수 또는 명예 타자)를 명부에 넣고 `0xb8cb8(팀, 레코드 +7 윗 4비트, k)` 로 시작 타순 레코드와 맞바꾼다 (`humanRecordsOf`).
 */
export const MISSION_NARI_RECORD = -2

/**
 * **미션 타자가 처음 드는 레코드 k** 를 모를 때 쓰는 값 — 명부 끝(레코드 12). 그 자리면 0xb53f0 의 "옛 k 를 끝으로" 가 빈 칸을 옮겨
 * 예전 근사(레코드 12 에 넣고 시작 타순 ↔ 12)와 같아진다. ⚠️ 원본은 k = 선수 +0xa & 0x1f 다 — 부르는 쪽이 알면 넘긴다.
 */
export const MISSION_NARI_RECORD_FALLBACK = 12

/**
 * **사람 칸 팀 타자 레코드** — 0xaa57c aa7b0~aa7ee (모드 6) · 0xb87cc · 0xb53f0 · 0xb8768 · 0xb6394 (직접 재역어셈):
 * ```
 * aa7b8  0xb87cc(팀[사람 칸]):
 *          b87dc  P = 0x1fc20(저장)                   ; 미션 타자 (명예 0x1f640 또는 나리 타자편 저장 선수)
 *          b87e8  k = 0xb53f0(명부, P, 1)             ; −1 이 아니면 b8768(목록 다시 매김) · 팀 +0x27 ++ · +0x28c(벤치) ++
 *            b53f0: P+0xa 의 0x40(마선수) → 아님 · 0x80(내 선수) → k = P+0xa & 0x1f (0xb6720):
 *              b54a2 0xb4e34(명부, 0) — 타자 배열 한 칸 늘림(12 → 13)
 *              b54b6 pos = 레코드[k]+0x1c & 0xf · 0xb8e84(레코드[k], 0, 0)
 *              b54da 0xb6604(레코드[k], 수 − 1) · b54fa 레코드[수 − 1] ← 레코드[k] (0x30 바이트) — **옛 k 를 맨 끝으로**
 *              b550c 레코드[k] ← P (0x30 바이트) · b5520 0xb8e84(레코드[k], pos, 0) — 수비 위치는 옛 선수 것
 * aa7c2  r1 = 0xb6394(0x1fc20(저장)) = P+0xa & 0x1f = k     ; 저장 쪽 선수를 다시 읽는다 — 고친 것은 명부 사본뿐이라 같은 k
 * aa7d2  레코드 +1 비트 0 이면(원본 표는 모두 꺼짐) aa7e8 0xb8cb8(팀, 레코드 +7 윗 4비트, k) — 레코드 [시작 타순] ↔ [k]
 * ```
 * 그래서 k 가 시작 타순과 다르면 마스터 줄 `시작 타순` 이 k 칸으로 가고 마스터 줄 k 는 레코드 12(벤치)로 밀린다 — k 가 타순(0~8)이면
 * 자동진행 반 이닝의 타선이 바뀐다. k 는 그 선수가 자기 나리 팀에서 앉은 칸이다(경기 장면 0xb8768 이 배열 첨자로 다시 매긴 값,
 * `app/ui/EntryRoutes` 더비 타순과 같은 칸). k > 12 는 0xb53d0 이 배열 밖을 읽어 옮길 수 없다 — 끝 칸 12 로 둔다(⚠️ 미해결).
 */
export function humanRecordsOf(startOrder: number, nariRecordSlot: number = MISSION_NARI_RECORD_FALLBACK): number[] {
  const records = Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record)
  const k = Number.isInteger(nariRecordSlot) && nariRecordSlot >= 0 && nariRecordSlot <= BATTERS_PER_TEAM
    ? nariRecordSlot
    : MISSION_NARI_RECORD_FALLBACK
  // b54a2 · b54fa — 한 칸 늘리고 옛 k 를 맨 끝으로 (k = 12 면 늘린 빈 칸이 제자리로)
  records.push(records[k] ?? k)
  // b550c — k 에 미션 타자
  records[k] = MISSION_NARI_RECORD
  // aa7e8 0xb8cb8 — 레코드 [시작 타순] ↔ [k]
  const atOrder = records[startOrder]
  records[startOrder] = records[k]
  records[k] = atOrder
  return records
}

/** 타순 아홉 칸 — 0x42364 의 0xae914 가 (팀[+0x32] + i) mod 9 */
const LINEUP_SLOTS = 9

/** 마스터 팀 타자 12 줄 */
const BATTERS_PER_TEAM = 12
/** 마스터 팀 투수 8 줄 */
const PITCHERS_PER_TEAM = 8

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

/**
 * **마선수 대결이 연 미션** — 이벤트 SYS 8(0x8d734 → 0x8d764)이 미션 장면으로 나가기 전에 적는 칸 (직접 재역어셈 0x8d782~0x8d846).
 * 타자편(0x7b971 참)은 g[0xf7] = team − 1 · **g[0x11f] = 1**, 투수편(0x7b985 참)은 g[0x175] = team − 1 · **g[0x176] = 1** 을 적고,
 * 두 갈래 모두 8d836~8d846 에서 **g[0xf6] = 그때 모드**(0x1552d10)를 적는다 — 나리 이벤트면 3(투수편) · 4(타자편).
 */
export interface MissionAceMatchOrigin {
  /** g[0xf6] — SYS 8 이 적은 그때 모드 (2 시즌 · 3 나리 투수편 · 4 나리 타자편) */
  readonly originalMode: number
  /**
   * 그 모드 저장 레코드(+0x11c 꼴) **+1 = 팀** — 모드 2 면 `0x1f55c(저장)` = [저장+0xb4]+0x11c(시즌 레코드 SR, SR[1] = 고른 팀),
   * 3·4 면 `0x1f8d4(저장, 모드)` = [저장+0xb8 · +0xbc]+0x11c(나리 투수편 · 타자편 레코드, 시즌 레코드와 같은 꼴 — H2 2-1a).
   * 웹은 그 편 나리 커리어의 `teamId` 다.
   */
  readonly savedTeamId: number
}

/**
 * **사람 칸 팀** — 0xaa57c aa6c2~aa734 (직접 재역어셈):
 * ```
 * aa6ca  r7 = 레코드 +2 아래 4비트 (다른 칸) · r5 = 윗 4비트 (사람 칸)
 * aa6d8  g = 0x1f1d8(저장)
 * aa6e0  g[0x11f] ≠ 0 || g[0x176] ≠ 0 (마선수 대결 중) 이면:
 * aa702    m = (s8) g[0xf6]
 * aa704    m == 2       → r5 = (s8) 0x1f55c(저장)[1]          ; aa712~aa728
 * aa70c    m ∈ {3, 4}   → r5 = (s8) 0x1f8d4(저장, m)[1]       ; aa71c~aa728
 *          그 밖        → r5 그대로
 * aa72a  0xb6bd4(st, 사람 칸, r5) · 0xb6bd4(st, 다른 칸, r7)   ; 경기[0x28 + 칸]
 * aa744  0xb891c(팀객체[사람 칸], 모드, r5, −1) · (팀객체[다른 칸], 모드, r7, −1)
 * ```
 * 그래서 마선수 대결은 **사람 칸에 그 편 나리 저장의 팀**이 선다 — 자동진행 반 이닝의 사람 칸 타선 · 투수진과 점수판 팀이 그 팀이다.
 * 다른 칸(CPU 팀)은 레코드 그대로다. 두 칸이 같은 팀이 되어도 거르지 않는다(원본 그대로).
 * 보통 미션(대결이 아님)이면 `aceMatch` 를 안 준다 — 레코드 팀(`sideTeams[사람 칸]`)이다.
 */
export function missionHumanTeamIdOf(mission: OriginalMission, aceMatch?: MissionAceMatchOrigin): number {
  const recordTeam = mission.sideTeams[humanSideOf(mission)]
  if (aceMatch === undefined) return recordTeam
  const mode = aceMatch.originalMode
  return mode >= 2 && mode <= 4 ? aceMatch.savedTeamId : recordTeam
}

/** 경기 세우기 0xaa57c 의 바깥 재료 — 마선수 대결의 사람 칸 팀 · 미션 타자의 레코드 칸 */
export interface MissionGameSetup {
  readonly aceMatch?: MissionAceMatchOrigin
  /**
   * 타자 미션 — 미션 타자(0x1fc20) +0xa & 0x1f (`humanRecordsOf`). 나리 타자편 저장 선수면 자기 나리 팀 타자 칸,
   * 명예 타자면 0 (등록 0x1f680 이 +0xa = 0x20 을 적고 0xb53f0 b5532 의 0x20 갈래가 같은 0xb6720 으로 꺼낸다 — `useMissionSession`).
   * 안 주면 `MISSION_NARI_RECORD_FALLBACK`(12).
   */
  readonly nariRecordSlot?: number
}

/** 경기 세우기 0xaa57c — 이닝 · 공격 측(aa6ac: 모드 5 는 다른 칸, 6 은 사람 칸) · 점수판(사람 칸 = 우리 점수) */
export function startMissionGame(mission: OriginalMission, setup: MissionGameSetup = {}): MissionGame {
  const human = humanSideOf(mission)
  const cpu = cpuSideOf(mission)
  const scores: [number, number] = [0, 0]
  scores[human] = mission.start.ourScore
  scores[cpu] = mission.start.opponentScore
  const humanTeamId = missionHumanTeamIdOf(mission, setup.aceMatch)
  const humanOrder = MISSION_HUMAN_START_ORDER[missionKeyOf(mission)] ?? 0
  const isBatterMission = mission.side === '타자'
  // 투수 미션(모드 5)은 aa7f2 갈래 — 사람 칸 타선에 아무도 안 넣는다
  const humanRecords = isBatterMission
    ? humanRecordsOf(humanOrder, setup.nariRecordSlot)
    : Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record)
  return {
    inning: mission.start.inning - 1,
    offenseSide: mission.side === '투수' ? cpu : human,
    scores,
    aceCheckedInning: -1,
    humanBatting: {
      teamId: humanTeamId,
      lineup: rosterLineupOf(humanRecords.length),
      records: humanRecords,
      order: humanOrder,
    },
    cpuAutoPitching: isBatterMission ? null : startMissionCpuPitching(mission),
    cpuAutoBatting: isBatterMission
      ? {
          teamId: mission.sideTeams[cpu],
          lineup: rosterLineupOf(BATTERS_PER_TEAM),
          records: Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record),
          order: MISSION_CPU_START[missionKeyOf(mission)]?.battingOrder ?? 0,
        }
      : null,
    humanPitching: isBatterMission
      ? {
          teamId: humanTeamId,
          roster: Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot),
          mound: { pitcherSlot: 0, stamina: FULL_STAMINA, runsAllowed: 0, pitches: 0, usedSlots: [], justChanged: false },
          inningRunsAllowed: 0,
          ourRuns: 0,
        }
      : null,
    halfEnded: false,
    autoRelay: null,
  }
}

/** 한 번의 자동진행이 끝났다 — 그 동안의 중계 틱을 새 `serial` 로 싣는다 */
export function withMissionAutoRelay(game: MissionGame, steps: readonly MissionAutoRelayStep[]): MissionGame {
  return { ...game, autoRelay: { serial: (game.autoRelay?.serial ?? 0) + 1, steps } }
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

/** 그 타선의 지금 타순 칸에 선 레코드 (마스터 줄 · 미션 타자 표지) */
export function battingRecordAt(batting: MissionTeamBatting, order: number = batting.order): number {
  const record = rosterSlotAt(batting.lineup, order)
  return batting.records[record] ?? record
}

/** 자동진행 반 이닝 하나의 끝 */
export interface MissionAutoHalf {
  readonly batting: MissionTeamBatting
  readonly pitching: MissionCpuPitching
  /** 이 반 이닝(멈춘 자리까지)의 득점 */
  readonly runs: number
  readonly outs: number
  readonly bases: BaseState
  /** c21d6 — 경기 끝(끝내기 · 콜드 · 9회 3아웃) */
  readonly gameEnded: boolean
  /** 미션 타자 차례라 멈췄다 (타자 미션의 사람 칸 팀 공격만) */
  readonly stoppedBeforeNari: boolean
}

/**
 * **자동진행 반 이닝** — 0x21 의 간이 타석 0xc262c 고리 (공격 `batting` · 수비 `pitching`, 투수 교체 0xac428 · 대타 0xac228 은
 * 간이 엔진 0xc1ba4 그대로). 타석마다 c21d6 경기 끝을 보고, 타자 미션은 0xc1e04 가 미션 타자 차례에서 사람에게 넘긴다(`stopBeforeNari`).
 * `start` 는 이어서 도는 반 이닝의 루 · 아웃 · 득점(새 반 이닝이면 빈 루 · 0) — 간이 엔진은 반 이닝 첫머리부터만 돌므로 이어 돌 일은 없다.
 * 끝까지 한꺼번에 굴린다 — 틱마다 굴리는 꼴은 `simulateMissionAutoHalfTicks`.
 */
export function simulateMissionAutoHalf(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  random: RandomPort,
  stopBeforeNari: boolean,
  /** 수비 재료 갈래 — 마투수 칸의 레코드 · 0x66864 교체 막음 (`missionPitchingDefenseOf`) */
  defenseOptions: { readonly ace?: MissionAcePitcher; readonly pitcherChangeBlocked?: boolean } = {},
): MissionAutoHalf {
  return drainMissionAutoTicks(simulateMissionAutoHalfTicks(game, batting, pitching, random, stopBeforeNari, defenseOptions)).result
}

/**
 * `simulateMissionAutoHalf` 의 **틱 단위** 꼴 — 0x48480 갱신 한 번(= 0xc262c 한 번)마다 그 틱의 중계 칸을 내고 멈춘다
 * (`simulateHalfInningTicks`). 다음 틱을 안 부르면 남은 타석은 굴리지 않는다 — 중계 도중 제한 시간이 다 되면 원본도 그 틱에서 끊긴다.
 */
export function* simulateMissionAutoHalfTicks(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  random: RandomPort,
  stopBeforeNari: boolean,
  defenseOptions: { readonly ace?: MissionAcePitcher; readonly pitcherChangeBlocked?: boolean } = {},
): Generator<MissionAutoRelayStep, MissionAutoHalf, void> {
  const offenseSide = game.offenseSide
  const defenseSide = offenseSide === 0 ? 1 : 0
  const rows = teamBatters(batting.teamId)
  // 미션 타자 표지는 멈춤 갈래가 먼저 걸러 여기 안 온다
  const batterOf = (record: number) => {
    const row = batting.records[record] ?? record
    return quickBatterOf(rows[Math.max(0, row) % rows.length])
  }
  const defense = missionPitchingDefenseOf(pitching, game.scores[defenseSide] - game.scores[offenseSide], defenseOptions)
  const ticks = simulateHalfInningTicks(
    batting.order,
    (cursor) => batterOf(rosterSlotAt(batting.lineup, cursor)),
    defense.pitcherAt(pitching.mound.pitcherSlot),
    game.inning + 1,
    random,
    undefined,
    {
      endsGame: ({ runs, outs }) => {
        const scores: [number, number] = [game.scores[0], game.scores[1]]
        scores[offenseSide] += runs
        return isMissionGameOver(game, outs, scores)
      },
      ...(stopBeforeNari
        ? {
            stopsBefore: ({ battingOrderIndex, lineup }: { readonly battingOrderIndex: number; readonly lineup?: QuickLineup }) =>
              battingRecordAt({ ...batting, lineup: lineup ?? batting.lineup }, battingOrderIndex) === MISSION_NARI_RECORD,
          }
        : {}),
    },
    defense,
    { lineup: batting.lineup, batterOf, pinchHitUsed: false },
  )
  // 0xc25e4 — 그 타석에 선 레코드 칸(대타 포함)의 이름 0xb62c0. 미션 타자 표지는 멈춤 갈래가 먼저 걸러 여기 안 온다
  const nameOf = (appearance: HalfInningPlateAppearance) => {
    const record = appearance.rosterSlot ?? rosterSlotAt(batting.lineup, appearance.battingOrderIndex)
    const row = batting.records[record] ?? record
    return rows[Math.max(0, row) % rows.length]?.name ?? ''
  }
  // 0x21 두 팀 판 — 수비 팀 지금 투수 이름 · 공격 팀 타순 칸 세 줄 (`MissionAutoRelayCards`)
  const pitcherRows = teamPitchers(pitching.teamId)
  const pitcherNameOf = (slot: number | undefined): string | null => {
    if (slot === undefined) return null
    const row = pitching.roster[slot] ?? slot
    if (row === MISSION_ACE_ROSTER_SLOT) return defenseOptions.ace?.name ?? null
    return pitcherRows[row]?.name ?? null
  }
  const batterNameAt = (lineup: QuickLineup, lineupSlot: number): string | null => {
    const record = rosterSlotAt(lineup, lineupSlot)
    const row = batting.records[record] ?? record
    // ⚠️ 미해결: 미션 타자 칸은 그 선수(0x1fc20) 이름인데 이 판은 선수 이름을 들고 있지 않다 — 글을 안 쓴다
    if (row === MISSION_NARI_RECORD) return null
    return rows[Math.max(0, row) % rows.length]?.name ?? null
  }
  const cardsOf = (tick: HalfInningTick, scores: readonly [number, number]): MissionAutoRelayCards => {
    const currentOrder = tick.battingOrderIndex % LINEUP_SLOTS
    const lineup = tick.lineup ?? batting.lineup
    return {
      pitcherName: pitcherNameOf(tick.pitcherSlot),
      strikes: tick.kind === 'plateAppearance' ? tick.strikes : 0,
      balls: tick.kind === 'plateAppearance' ? tick.balls : 0,
      outs: tick.outs,
      currentOrder,
      dueUpNames: [0, 1, 2].map((row) => batterNameAt(lineup, (currentOrder + row) % LINEUP_SLOTS)),
      gameOver: isMissionGameOver({ ...game, scores: [scores[0], scores[1]] }, tick.outs),
    }
  }
  let relayScores: readonly [number, number] = game.scores
  let next = ticks.next()
  while (next.done !== true) {
    const step = missionAutoRelayStepOfTick({ inning: game.inning, offenseSide }, relayScores, next.value, nameOf, cardsOf)
    relayScores = step.scores
    yield step
    next = ticks.next()
  }
  const result = next.value
  // A(+0x284) — 멈춘 반 이닝이면 마지막 교체 뒤 이 반 이닝 실점이 남는다
  const lastChange = result.pitcherChanges?.[result.pitcherChanges.length - 1]
  const inningRunsAllowed = result.runs - (lastChange?.runsBefore ?? 0)
  const scores: [number, number] = [game.scores[0], game.scores[1]]
  scores[offenseSide] += result.runs
  return {
    batting: { ...batting, lineup: result.lineup ?? batting.lineup, order: result.nextBattingOrderIndex },
    pitching: { ...pitching, mound: result.mound ?? pitching.mound, inningRunsAllowed },
    runs: result.runs,
    outs: result.outs,
    bases: result.bases ?? EMPTY_BASES,
    gameEnded: result.gameEnded === true || isMissionGameOver({ ...game, scores }, result.outs),
    stoppedBeforeNari: result.stoppedBeforeBatter === true,
  }
}

/**
 * **사람 칸 팀이 치는 자동진행 반 이닝** (투수 미션) — 공격 = 사람 칸 마스터 타선(`humanBatting`), 수비 = CPU 팀(`cpuAutoPitching`).
 * 사람 칸 팀 마스터 타자는 육성·명예 선수가 아니라(0xb6389 · 0xb6349 거짓) 0xc1e04 모드 5 가 반 이닝 내내 자동이다.
 * 틱마다 중계 칸을 내고 멈춘다(`simulateMissionAutoHalfTicks`).
 */
export function* simulateHumanTeamAutoHalfTicks(
  game: MissionGame,
  random: RandomPort,
): Generator<MissionAutoRelayStep, { readonly game: MissionGame; readonly gameEnded: boolean }, void> {
  const pitching = game.cpuAutoPitching
  if (pitching === null) return { game, gameEnded: false }
  const half = yield* simulateMissionAutoHalfTicks(game, game.humanBatting, pitching, random, false)
  return {
    game: {
      ...withMissionScore(game, game.offenseSide, half.runs),
      humanBatting: half.batting,
      // 이닝 교대 0xa5b00 이 A 를 0 으로 — 다음 자동진행 반 이닝은 0 에서 선다
      cpuAutoPitching: { ...half.pitching, inningRunsAllowed: 0 },
    },
    gameEnded: half.gameEnded,
  }
}

/** `simulateHumanTeamAutoHalfTicks` 를 끝까지 — 중계 칸들(`relay`)과 함께 */
export function simulateHumanTeamAutoHalf(
  game: MissionGame,
  random: RandomPort,
): { readonly game: MissionGame; readonly gameEnded: boolean; readonly relay: readonly MissionAutoRelayStep[] } {
  const { steps, result } = drainMissionAutoTicks(simulateHumanTeamAutoHalfTicks(game, random))
  return { ...result, relay: steps }
}
