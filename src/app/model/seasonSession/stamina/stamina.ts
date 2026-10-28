import { teamPitchers } from '@/entities/team/model/teamRoster'
import { FULL_STAMINA, recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { rotatedPitchersOf, unrotatedPitchersOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/*
 * ## 시즌 투수 스태미나 `+0x2c` — 경기 사이에 이어지는 값 (직접 떴다)
 * ```
 * 0x6548 0xdd 진입 6850  SR+0xb2 == 0(시즌 첫날)이면 i = 0..9: 0xb6190(0x1f9a9(저장, 모드, i))  ; 열 팀 전원 10000
 * 0x4ea0c 경기 끝        정규: 내 경기 → 4f296 CPU 경기 0xc2a48 → 4f29a 하루 끝 0xb818c
 *                        포스트시즌(L+0x34)·국가대항전(L+0xac): 4f268/4f230 → 곧장 4f29a 0xb818c
 *                        → 모드 2 면 4f2bc: i = 0..9: 0xb617c(0x1f570(저장, i))  ; 열 팀 모두 +20% (0xb60e0)
 * 0xb818c 하루 끝        L+0xac(국가대항전) 갈래만 b81e0 0xb6190(팀 10) = 대한민국 10000.
 *                        L+0x34(포스트시즌)는 b8228 에서 곧장 끝 — **내 팀을 10000 으로 채우지 않는다**.
 * ```
 * - 그래서 정규시즌·포스트시즌 모두 하루 끝은 "열 팀 +20%" 하나다. a583fe0 의 "포스트시즌은 하루 끝 0xb818c 가 내 팀만
 *   10000" 은 P1 의 유력을 옮긴 것인데, 그 10000 은 대회 갈래(L+0xac) 안에 있다 — P5 가 이미 대한민국으로 고쳐 읽었다.
 * - 국가대항전 중에는 0x1f570 이 팀 10 을 +0x918, 나머지를 상대국 슬롯 +0x934 로 돌리므로 리그 열 팀 레코드는 안
 *   움직인다. 대한민국은 매일 10000 이라 웹 팀 경기 기본값(늘 10000)과 같다 — 넘기지도 받지도 않는다.
 * - 회복량 0x66ed0 은 모드 3 이 아니면 늘 20%다 (`staminaRecoveryPercentOf`).
 */

/** 리그 열 팀 0..9 — 6850 · 4f2bc 의 `cmp #9` 고리 */
export const LEAGUE_TEAM_COUNT = 10

export const SEASON_STAMINA_RECOVERY = { mode: 2, isMine: false, isStarterRole: false } as const

/** `0xb6190` — 다른 아홉 팀 투수 전원 10000 */
export function fullCpuPitcherStaminas(myTeamId: number): Record<number, readonly number[]> {
  const table: Record<number, readonly number[]> = {}
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    if (team !== myTeamId) table[team] = teamPitchers(team).map(() => FULL_STAMINA)
  }
  return table
}

/** `0xb6190` — 내 팀 투수 전원 10000 */
export function withFullRosterStamina(roster: SeasonTeamRoster): SeasonTeamRoster {
  return { ...roster, pitchers: roster.pitchers.map((player) => ({ ...player, stamina: FULL_STAMINA })) }
}

/** 시즌 첫날 6850 — 열 팀 모두 0xb6190 */
export function withSeasonFirstDayStamina(save: SeasonSave): SeasonSave {
  return {
    ...save,
    roster: withFullRosterStamina(save.roster),
    cpuPitcherStaminas: fullCpuPitcherStaminas(save.state.record.teamId),
  }
}

/**
 * 내 팀 명단을 **원본 저장 레코드 모양**으로 — 웹 시즌 명단(`roster`·`cupRoster`)은 로테이션을 돌기 전 모양이고 돈 칸 수
 * k(경기 옵션 `dayCounter` 의 `rotationSlotOf`)를 따로 셈한다(`seasonEntry` 머리 주석). 원본 `0x6548` 은 저장 레코드를
 * `0xb5ca8` 로 제자리에서 돌린 뒤 경기용 팀 객체 `0xb891c`(`team[i] = i`)를 세우므로 0번 레코드가 선발이고 **나머지가 그
 * 차례대로 교체 `0xabfcc` 의 벤치 차례**다. 진행기는 넘긴 명단 차례를 벤치 차례로 쓰므로, 명단 투수 0~3 을 k 칸 돌려
 * 넘기고(시작 스태미나도 같이) 선발 칸은 0(`dayCounter: 0`)으로 둔다. 끝 스태미나는 `withGameEndStamina` 가 되돌린다.
 */
export function withOwnRecordRotation(options: TeamGameOptions): { readonly options: TeamGameOptions; readonly shift: number } {
  const shift = rotationSlotOf(options.dayCounter ?? 0)
  const order = options.ourEntryOrder
  const staminas = options.ourPitcherStaminas
  return {
    shift,
    options: {
      ...options,
      dayCounter: 0,
      // 상대 칸은 리그 차례(`opponentPitcherOrder`)로 서지만, 안 넘긴 길이 날짜 칸을 따라 바뀌지 않게 남겨 둔다
      opponentDayCounter: options.opponentDayCounter ?? options.dayCounter ?? 0,
      ...(order === undefined ? {} : { ourEntryOrder: { ...order, pitchers: rotatedPitchersOf(order.pitchers, shift) } }),
      ...(staminas === undefined ? {} : { ourPitcherStaminas: rotatedPitchersOf(staminas, shift) }),
    },
  }
}

export function withGameEndStamina(save: SeasonSave, summary: TeamGameSummary, ownRotationShift: number): SeasonSave {
  // 진행기에는 0x6548 이 돌린 레코드 차례로 넘겼다(`withOwnRecordRotation`) — 웹 명단 차례로 되돌린다
  const ours = summary.ourPitcherStaminas === undefined ? undefined : unrotatedPitchersOf(summary.ourPitcherStaminas, ownRotationShift)
  const theirs = summary.opponentPitcherStaminas
  return {
    ...save,
    roster:
      ours === undefined
        ? save.roster
        : {
            ...save.roster,
            pitchers: save.roster.pitchers.map((player, index) => {
              const stamina = ours[index]
              return stamina === undefined ? player : { ...player, stamina }
            }),
          },
    cpuPitcherStaminas: theirs === undefined ? save.cpuPitcherStaminas : { ...save.cpuPitcherStaminas, [summary.opponentTeamId]: theirs },
  }
}

/** 하루 끝 4f2bc — 열 팀 모두 `0xb617c` (투수마다 +20%, 10000 에서 자름) */
export function withDayEndRecovery(save: SeasonSave): SeasonSave {
  const recover = (stamina: number) => recoverStaminaAfterGameDay(stamina, SEASON_STAMINA_RECOVERY)
  const table: Record<number, readonly number[]> = {}
  for (const [team, staminas] of Object.entries(save.cpuPitcherStaminas ?? {})) {
    table[Number(team)] = staminas.map(recover)
  }
  return {
    ...save,
    roster: {
      ...save.roster,
      pitchers: save.roster.pitchers.map((player) => ({ ...player, stamina: recover(player.stamina) })),
    },
    cpuPitcherStaminas: table,
  }
}

/** 팀 경기 옵션의 시작 스태미나 — 내 팀은 명단 차례, 상대는 표 칸 차례 (정규·포스트시즌만) */
export function staminaOptionsOf(save: SeasonSave, opponentTeamId: number): Partial<TeamGameOptions> {
  const opponent = save.cpuPitcherStaminas?.[opponentTeamId]
  return {
    ourPitcherStaminas: save.roster.pitchers.map((player) => player.stamina),
    ...(opponent === undefined ? {} : { opponentPitcherStaminas: opponent }),
  }
}
