import type { MissionRun } from '@/entities/mission/model/missionRun'
import { isMissionBatterUp } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { battingRecordAt, MISSION_NARI_RECORD_FALLBACK } from '@/entities/mission/model/missionGame'
import {
  MISSION_ACE_ROSTER_SLOT,
  masterGameAbilityOf,
  missionAcePitcherOf,
  missionCpuBatterOf,
} from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import {
  batterCardStatsOf,
  batterHandOf,
  batterLineOfRecord,
  pitcherCardStatsOf,
  pitcherLineOfRecord,
  staminaGaugeOf,
  sumBatterLines,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterLine, MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/*
 * **미션(모드 5 · 6) 상태 0xe 의 투수 · 타자 소개 판 값** (0x44944 — 0x4d9ec 하나가 부르고 모드 검사가 없다, R10 10-3).
 *
 * 판은 투수 `0xae83c([장면+0x228+4·st[0xa]])` · 타자 `0xae89c([장면+0x220])` 의 선수 레코드(0x30 바이트)를 그대로 읽는다
 * (0x449ce~0x44a22). 미션의 두 팀은 이렇게 선다 (직접 뜸):
 * ```
 * 0x1ff98   마스터 팀 15개 — 팀마다 Xls 행을 투수 8 × 0x30 · 타자 12 × 0x30 바이트 통째 memcpy(2001a~2004e). 지우는 칸 없음
 *           → 레코드 +0x20~+0x2b 시즌 줄 = **Xls 행 바이트 32~43** (`RosterPlayer.recordLine`)
 * 0xb8680   모드 5 · 6(점프표 0xd8a30 → b86e2): (g[0x11f] || g[0x176]) && g[0xf6] == 2 && 팀 ≤ 9 면 시즌 0x1f571, 아니면
 *           마스터 0x1f8c1(team+0x25) — 웹 대결은 나리(3 · 4)뿐이라 늘 마스터 팀 레코드(+2 사기 = XlsTEAM_DATA 표값)
 * 0xa56dc   기록 게이트 — 점프표 0xd8204[모드 − 2] 의 5 · 6 갈래 0xa5764: [ctx+0xa8](= 1 & ~레코드[1], 모든 미션 1)이 서 있으면
 *           a576e 0xb6389(+0xa 비트 7 육성) || a577e 0xb6349(명예 번호) 일 때만 참
 *           → **미션 선수(나리 · 명예)만** 정산 0xa8024 가 경기 중에 줄을 올리고, 마스터 줄 · 마선수는 표의 줄 그대로다
 * 마선수     0x20094 6번 갈래가 XlsACE_* 행을 그대로 부은 저장 레코드를 0xb521c / 0xb53f0 로 통째 베낀다(`AcePlayer.recordLine`)
 * ```
 * - 타자 미션(모드 6): 투수 = CPU 마운드(마스터 줄 · 마투수), 타자 = 사람 칸 팀 지금 타순 — 미션 타자 차례면 선수 게터 0x1fc20 의 기록
 *   (0xb87cc 가 통째 넣어 줄이 따라온다) + 이 경기 줄, 마스터 타순 차례면 그 줄의 표값.
 * - 투수 미션(모드 5): 투수 = 미션 투수(0xb8820 이 0x1fbd0 기록을 통째 넣는다) + 이 경기 줄, 타자 = CPU 타선 지금 타순(마스터 줄 · 마타자).
 * - 팀 글자 0xb6c20: 사람 칸 PLAYER · 다른 칸 COM. 손 0xb63c0 · 보직 +0xb & 3 · 수비 +0x1c & 0xf · 타순 팀+0x32 · 오늘 타석 링(타순 칸).
 * - 체력 막대 길이 0x66e44(0xb8680(수비 팀), 투수, f) — 사기 = 수비 팀 마스터 레코드 +2, f = 팀[+0x26] − [+0x33] == 1(교체 전).
 */

/** 미션 타자 — 선수 게터 0x1fc20 (나리 타자편 저장 선수 · 명예 타자) */
export interface MissionCardBatter {
  readonly name: string | null
  /** 0xb63c0 — 폼 & 1 (1 좌타) */
  readonly hand: number
  /** 레코드 +0x20~+0x2b (`ModeBatter.recordLine`) — 모르면 판의 줄 칸을 비운다 */
  readonly recordLine?: readonly number[]
}

/** 미션 투수 — 선수 게터 0x1fbd0 (나리 투수편 저장 선수 · 명예 투수) */
export interface MissionCardPitcher {
  readonly name: string | null
  /** 보직 +0xb & 3 — 모르면 칸 0 */
  readonly role?: number
  /** 폼 rec[0xb] >> 4 (0xb6e24) */
  readonly form: number
  /** 체력 실효 능력치 `0xb6415(P, 3, 1)` */
  readonly staminaAbility: number
  /** 지금 레코드 +0x2c */
  readonly stamina: number
  readonly recordLine?: readonly number[]
}

export interface MissionMatchupCards {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/** 타순 칸 기록 링 — 0x53100(칸, i) 의 오래된 차례 */
function ringOf(records: readonly { readonly results?: readonly number[] }[], slot: number): readonly number[] {
  return records[slot]?.results ?? []
}

/** 이 경기 미션 타자 줄 — 게이트 0xa5764 가 연 타석의 +0x20 타수 · +0x22 안타 · +0x28 홈런 · +0x2a 타점 (사건 0xa57f8 칸과 같은 판) */
function missionBatterGameLineOf(run: MissionRun): MatchupBatterLine {
  const { counts } = run.progress
  return {
    atBats: run.progress.atBats ?? 0,
    hits: counts['안타'] ?? 0,
    homeRuns: counts['홈런'] ?? 0,
    runsBattedIn: counts['타점'] ?? 0,
  }
}

/**
 * 이 경기 미션 투수 줄 — +0x20 잡은 아웃(정산 a8cca 의 결과 코드 5 · 0xd 수 = R+0x13c 와 같은 콜) · +0x22 실점(a8ef4, R+0x128 과 같은
 * 주자 루프 — 미션 투수는 0xb6388 도 참) · +0x26 탈삼진(R+0x134 와 같은 판)
 */
function missionPitcherGameLineOf(run: PitcherRun): MatchupPitcherLine {
  return {
    outs: run.progress.counts['아웃'] ?? 0,
    runsAllowed: run.allowed.runs,
    strikeouts: run.progress.counts['탈삼진'] ?? 0,
  }
}

/** 타자 미션의 CPU 마운드 판 — 마스터 줄이면 그 행, 마투수면 XlsACE_PIT 행 */
function cpuMoundCardOf(
  run: MissionRun,
  aceLevels: Readonly<Record<number, number>> | undefined,
): MatchupPitcherCard {
  const pitching = run.cpu.pitching
  if (pitching === null) return { isComputer: true }
  const { mound } = pitching
  const row = pitching.roster[mound.pitcherSlot] ?? mound.pitcherSlot
  const teamMorale = teamRecordMoraleOf(pitching.teamId)
  const isFirstPitcher = mound.usedSlots.length === 0
  if (row === MISSION_ACE_ROSTER_SLOT) {
    const ace = missionOpponentOf('투수', run.mission.opponentAce)
    if (ace === null) return { isComputer: true }
    const acePitcher = missionAcePitcherOf(run.mission, aceLevels)
    return {
      isComputer: true,
      name: ace.name,
      role: ace.profile & 3,
      throwsLeft: pitcherHandOf(ace.profile >> 4, true) === 1,
      ...pitcherCardStatsOf(pitcherLineOfRecord(ace.recordLine)),
      stamina: staminaGaugeOf({
        staminaAbility: acePitcher?.staminaAbility ?? ace.ability.run,
        teamMorale,
        isFirstPitcher,
        stamina: mound.stamina,
      }),
    }
  }
  const player = teamPitchers(pitching.teamId)[row]
  if (player === undefined) return { isComputer: true }
  return {
    isComputer: true,
    name: player.name,
    role: player.profile & 3,
    throwsLeft: pitcherHandOf(player.profile >> 4, false) === 1,
    ...pitcherCardStatsOf(pitcherLineOfRecord(player.recordLine)),
    stamina: staminaGaugeOf({
      staminaAbility: masterGameAbilityOf(player, true, 3),
      teamMorale,
      isFirstPitcher,
      stamina: mound.stamina,
    }),
  }
}

/**
 * **타자 미션의 소개 판** — 지금 사람 칸 타순이 미션 타자면 그 선수(이 경기 줄을 더한다), 아니면 사람 칸 팀 마스터 줄(표값).
 * 미션 타자의 수비 칸은 0xb53f0 b54b6~b5520 이 넣기 전 레코드[k] 의 +0x1c 를 옮긴 것(k = `humanRecordSlot`) — 마스터 줄 k 의 수비다.
 */
export function missionBatterMatchupCardsOf(
  run: MissionRun,
  missionBatter: MissionCardBatter,
  aceLevels?: Readonly<Record<number, number>>,
): MissionMatchupCards {
  const batting = run.game.humanBatting
  const slot = lineupSlotOf(batting.order)
  const common = { isComputer: false, battingOrder: slot, recentResults: ringOf(batting.lineup.records, slot) }
  const pitcher = cpuMoundCardOf(run, aceLevels)
  if (isMissionBatterUp(run)) {
    const k = run.game.humanRecordSlot
    // ⚠️ 미확인: k 를 모르거나 끝 칸(12 — 0xb4e34 가 늘린 빈 칸)이면 옛 레코드[k] 의 수비를 알 수 없어 비운다
    const position = k === undefined || k >= MISSION_NARI_RECORD_FALLBACK ? undefined : teamBatters(batting.teamId)[k]?.position
    const line = missionBatter.recordLine === undefined
      ? null
      : sumBatterLines(batterLineOfRecord(missionBatter.recordLine), missionBatterGameLineOf(run))
    return {
      batterHand: missionBatter.hand,
      pitcher,
      batter: {
        ...common,
        ...(missionBatter.name === null ? {} : { name: missionBatter.name }),
        ...(position === undefined ? {} : { position }),
        ...(line === null ? {} : batterCardStatsOf(line)),
      },
    }
  }
  const player = teamBatters(batting.teamId)[battingRecordAt(batting)]
  const hand = player === undefined ? 0 : batterHandOf(player.profile)
  return {
    batterHand: hand,
    pitcher,
    batter: player === undefined
      ? common
      : {
          ...common,
          name: player.name,
          ...(player.position === undefined ? {} : { position: player.position }),
          ...batterCardStatsOf(batterLineOfRecord(player.recordLine)),
        },
  }
}

/** 투수 미션의 소개 판 — 미션 투수(이 경기 줄을 더한다)와 CPU 타선 지금 타자(마스터 줄 · 마타자, 표값) */
export function missionPitcherMatchupCardsOf(run: PitcherRun, missionPitcher: MissionCardPitcher): MissionMatchupCards {
  const line = missionPitcher.recordLine === undefined
    ? null
    : sumPitcherLines(pitcherLineOfRecord(missionPitcher.recordLine), missionPitcherGameLineOf(run))
  const pitcher: MatchupPitcherCard = {
    isComputer: false,
    ...(missionPitcher.name === null ? {} : { name: missionPitcher.name }),
    ...(missionPitcher.role === undefined ? {} : { role: missionPitcher.role }),
    throwsLeft: pitcherHandOf(missionPitcher.form, false) === 1,
    ...(line === null ? {} : pitcherCardStatsOf(line)),
    // 0xb8820 이 team+0x26 · +0x33 을 함께 +1 해 f = 1 — 미션은 '#' 교체가 막혀(0x38984) 내내 첫 투수다
    stamina: staminaGaugeOf({
      staminaAbility: missionPitcher.staminaAbility,
      teamMorale: teamRecordMoraleOf(run.game.humanBatting.teamId),
      isFirstPitcher: true,
      stamina: missionPitcher.stamina,
    }),
  }
  const batting = run.cpu.batting
  const cpuBatter = missionCpuBatterOf(run.cpu)
  if (batting === null || cpuBatter === null) return { batterHand: 0, pitcher, batter: { isComputer: true } }
  const slot = lineupSlotOf(batting.order)
  const common = { isComputer: true, battingOrder: slot, recentResults: ringOf(batting.lineup.records, slot) }
  if (cpuBatter.isAce) {
    const aceIndex = run.mission.opponentAce - 1
    const ace = missionOpponentOf('타자', run.mission.opponentAce)
    const hand = batterHandOf(0, aceIndex)
    return {
      batterHand: hand,
      pitcher,
      batter: ace === null
        ? common
        : {
            ...common,
            name: ace.name,
            // XlsACE_BAT 행 +0x1c — 다섯 줄 모두 0. ⚠️ 미확인: 0xaae7c 의 0xb53f0(명부, 마타자, 0)(마선수 0x40 갈래)이 +0x1c 를
            // 고치는지는 안 읽었다 — 행 값 그대로 둔다
            position: 0,
            ...batterCardStatsOf(batterLineOfRecord(ace.recordLine)),
          },
    }
  }
  const player = cpuBatter.row
  return {
    batterHand: player === null ? 0 : batterHandOf(player.profile),
    pitcher,
    batter: player === null
      ? common
      : {
          ...common,
          name: player.name,
          ...(player.position === undefined ? {} : { position: player.position }),
          ...batterCardStatsOf(batterLineOfRecord(player.recordLine)),
        },
  }
}
