import type { BaseState } from '@/entities/game/model/baseState'
import {
  EMPTY_BASE_RUNNERS,
  effectiveRunnersOf,
  runnerOnBase,
  runnersAfterPlay,
  runnersBehindCursor,
  survivorsWithoutPlayOf,
} from '@/entities/game/model/baseRunners'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { skillIdsOfBits, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { defenseFielderPlatesOf } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { MISSION_ACE_ROSTER_SLOT, masterGameAbilityOf, missionRecordNibbleRowOf } from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import type { MissionGame } from '@/entities/mission/model/missionGame'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { RosterPlayer } from '@/shared/config/original/roster'

/**
 * **미션 경기의 주자 신원** — 미션도 모드 5 · 6 짜리 보통 경기(장면 0x104)라 주자 목록(sim+0x80)이 선수 레코드를 든다
 * (`entities/game/model/baseRunners` 머리말). 웹은 루별 신원을 **사람이 맡은 반 이닝의 공격 팀 타순 칸**(0~8)으로 든다:
 * - 타자 미션(모드 6) — 공격 = 사람 칸 팀(`game.humanBatting`, 미션 타자 칸 `MISSION_NARI_RECORD` 포함)
 * - 투수 미션(모드 5, 투수편 마선수 대결 포함) — 공격 = CPU 팀(`cpu.batting`, 마타자 칸 `MISSION_ACE_ROSTER_SLOT` 포함)
 *
 * 시작 주자는 0xd 의 `0xaae7c(…, 0xd, 0x18, 0)` aafbc 가 `0xa9a9c(장면+0x18 주자관리, 팀[st[9]] 공격, 팀[st[0xa]] 수비,
 * 레코드 +5 의 1 · 2 · 3루 비트)` → `0xa9a10` 으로 세운다 — 앞선 찬 루부터 공격 팀 지금 타자 칸(team+0x32)에서 거꾸로 1 · 2 · 3 번째
 * 타순 칸(`runnersBehindCursor`). 그 0xd 앞 48c86 의 `0xaae7c(…, 1)` 이 마타자를 지금 타순 칸에 끼운 뒤라 주자는 마타자가 아니다.
 * 그 뒤 신원은 판마다 주자 운명(`survivorsFromBase`)으로 민다 — 다른 경기 모드(`GameState.runners`)와 같은 규칙이다.
 * 3아웃이면 빈 루다. 홈런더비(모드 7)는 0x46418 이 0xa9250 으로 주자를 비우고 타자주자를 안 만들어(464d8) 주자가 없다.
 */
export interface MissionRunnerSituation {
  readonly mission: Pick<OriginalMission, 'side'>
  readonly bases: BaseState
  /** 루에 선 주자의 신원(공격 팀 타순 칸). 없거나 루와 어긋나면 예전 근사(지금 타순에서 거꾸로 센다) */
  readonly runners?: BaseRunners
  readonly game: Pick<MissionGame, 'humanBatting'>
  readonly cpu: Pick<MissionCpuTeam, 'batting'>
}

/** 사람이 맡은 반 이닝의 공격 타선 — 명단 · 레코드 칸 · 지금 타순 칸 */
interface MissionOffense {
  readonly teamId: number
  readonly lineup: QuickLineup
  readonly records: readonly number[]
  readonly order: number
}

function offenseOf(run: MissionRunnerSituation): MissionOffense | null {
  return run.mission.side === '타자' ? run.game.humanBatting : run.cpu.batting
}

/** 지금 타석 타자의 타순 칸 (0~8) — 공격 팀 `team+0x32` */
export function missionBatterSlotOf(run: MissionRunnerSituation): number {
  return lineupSlotOf(offenseOf(run)?.order ?? 0)
}

/** **시작 주자** — 0xaae7c aafbc → 0xa9a10 (`runnersBehindCursor`) */
export function missionStartRunnersOf(run: Omit<MissionRunnerSituation, 'runners'>): BaseRunners {
  return runnersBehindCursor(run.bases, missionBatterSlotOf(run))
}

/** 지금 루에 선 주자의 신원 — 들고 있는 신원이 루와 맞으면 그것, 아니면 예전 근사(지금 타순 칸에서 거꾸로 b 번째가 b 루) */
export function missionRunnersOf(run: MissionRunnerSituation): BaseRunners {
  const order = offenseOf(run)?.order ?? 0
  return effectiveRunnersOf(run.bases, run.runners, (ordersBack) => lineupSlotOf(order - ordersBack))
}

/**
 * 플레이 하나 뒤의 신원 — 지금 타석 타자 칸(판 앞 타순)과 판의 살아남은 주자(`survivorsFromBase` — 주자 운명의 득점도 처리 끝도
 * 아닌 주자, 0 = 타자주자)로 앉힌다. 운명이 없으면 진행기를 안 도는 결과의 정산 목록(`survivorsWithoutPlayOf`)으로.
 * 3아웃이면 빈 루.
 */
export function missionRunnersAfterPlay(
  before: MissionRunnerSituation,
  next: { readonly bases: BaseState; readonly inningOver: boolean },
  change: {
    readonly batterReached: boolean
    readonly runsScored: number
    readonly survivorsFromBase?: readonly number[]
    readonly outcomeKind?: string
  },
): BaseRunners {
  if (next.inningOver) return EMPTY_BASE_RUNNERS
  const survivors =
    change.survivorsFromBase ??
    (change.outcomeKind === undefined ? null : survivorsWithoutPlayOf(before.bases, change.outcomeKind))
  return runnersAfterPlay(missionRunnersOf(before), next.bases, {
    batter: missionBatterSlotOf(before),
    batterReached: change.batterReached,
    runsScored: change.runsScored,
    ...(survivors === null ? {} : { survivorsFromBase: survivors }),
  })
}

/** 그 타순 칸에 선 사람 · 마선수 밖 선수의 경기용 주력 바깥 값 — 미션 타자 · 마타자는 부르는 쪽이 안다 */
export interface MissionSpecialRunners {
  /** 미션 타자(나리 타자편 저장 · 명예 타자)의 경기용 주력 */
  readonly missionBatterRun?: number
  /** 투수 미션 마타자의 경기용 주력 (마선수 레코드 레벨 배율) */
  readonly aceBatterRun?: number
}

/** 진행기 기본 주루(등급 3 = 500) — 미션 타자 · 마타자 값을 모르면 */
const DEFAULT_RUN_ABILITY = 500

/**
 * **그 타순 칸 선수의 경기용 주력** `0xb570d(ctx, 3, 선수, 1, 90, 1)` — 마스터 줄은 0xb570c 첫머리 b5728 의 `0xb6415(선수, 3, 1)`
 * (장비 니블 · 장착 스킬 보정, 모드 5 · 6 은 모드 갈래 · 팀 능력치 마스크를 안 타고 체력 인자 90 은 피로 감소가 없다 —
 * `masterGameAbilityOf`). 미션 타자 · 마타자 칸이면 부르는 쪽이 넘긴 값.
 */
export function missionRunnerRunAt(run: MissionRunnerSituation, slot: number, special: MissionSpecialRunners = {}): number {
  const offense = offenseOf(run)
  if (offense === null) return DEFAULT_RUN_ABILITY
  const record = rosterSlotAt(offense.lineup, slot)
  const row = offense.records[record] ?? record
  if (row === MISSION_NARI_RECORD) return special.missionBatterRun ?? DEFAULT_RUN_ABILITY
  if (row === MISSION_ACE_ROSTER_SLOT) return special.aceBatterRun ?? DEFAULT_RUN_ABILITY
  const player = teamBatters(offense.teamId)[row]
  return player === undefined ? DEFAULT_RUN_ABILITY : masterGameAbilityOf(player, false, RUN_SLOT)
}

/** 경기용 칸 3 = 주력 */
const RUN_SLOT = 3

/** 루별 주자 주력 (0 = 지금 타자 — 낫아웃 타자주자) — 공 도착 판(도루 · 폭투) · CPU 도루 출발이 읽는다 */
export function missionRunAbilitiesOnBaseOf(
  run: MissionRunnerSituation,
  special: MissionSpecialRunners = {},
): Partial<Record<0 | 1 | 2 | 3, number>> {
  const runners = missionRunnersOf(run)
  const runs: Partial<Record<0 | 1 | 2 | 3, number>> = { 0: missionRunnerRunAt(run, missionBatterSlotOf(run), special) }
  for (const base of [1, 2, 3] as const) {
    const runner = runnerOnBase(runners, base)
    if (runner !== null) runs[base] = missionRunnerRunAt(run, runner, special)
  }
  return runs
}

/** 타석 화면 HUD 의 루별 주자 주력 — 0x35b94 상태 0xe 주루 칸(35f74 `0xb570d(ctx, 3, 주자, 1, 90, 1)`) */
export function missionRunnerRunAbilitiesOf(
  run: MissionRunnerSituation,
  special: MissionSpecialRunners = {},
): Partial<Record<'first' | 'second' | 'third', number>> {
  const runs = missionRunAbilitiesOnBaseOf(run, special)
  return {
    ...(runs[1] === undefined ? {} : { first: runs[1] }),
    ...(runs[2] === undefined ? {} : { second: runs[2] }),
    ...(runs[3] === undefined ? {} : { third: runs[3] }),
  }
}

/** 수비 아홉 칸 (0 투수 … 8 중견) */
const FIELDER_COUNT = 9
/** 경기용 칸 2 = 수비 */
const DEFENSE_SLOT = 2

/** 미션 경기에서 수비 판이 보는 두 팀 — 사람 칸 팀 타선과 (타자 미션이면) CPU 팀 타선 */
export interface MissionDefenseSituation {
  readonly mission: Pick<OriginalMission, 'side'>
  readonly game: Pick<MissionGame, 'humanBatting' | 'cpuAutoBatting'>
  /**
   * **야수 칸 0 의 +0xec** — 미션 시작 첫 0x18 판의 0x3fac4 가 적은 수비 팀 레코드(`records` 칸, 그때 자리 니블 1 = 지명타자 —
   * `missionBoardFielderZeroOf`). 첫 반 이닝이 사람 몫이 아니라 판이 안 섰으면 null(+0xec = 0). 미션은 3아웃 뒤 0x18 이 늘 0x21 이라
   * 판이 다시 안 서므로 미션 내내 이 레코드다 — 자동진행 반 이닝의 대타(0xc1ba4 → 0xaebe4)가 지명 자리를 다른 레코드로 옮겨도 그대로다.
   * 안 주면(옛 입구) 지금 지명타자로 본다
   */
  readonly fielderZeroRecord?: number | null
}

/**
 * **수비 판의 아홉 칸 수비 능력치** — 플레이 vt20 `0xb0fb4` (상태 0x17 판 시작, 직접 재역어셈):
 * ```
 * b1018  칸 i = 0..8:
 * b1032    i == 0 → 선수 찾기를 건너뛴다(r5 = 0)
 * b103e    j = 0..팀+0x10 − 1:  레코드 = 0xb8a35(수비 팀, j) ; (레코드+0x1c & 0xf) − 1 == i 인 **첫** 레코드 (b1184 → 야수+0xec)
 * b106a    g = 선수 있으면 0xbbe98(0xb570d(ctx, 2, 선수, 90, 1)) + 1, 없으면 2
 * b10d0    팀 보너스는 전역 모드 1 · 2 · 8 · 9 만 — 미션(5 · 6)은 없다
 * ```
 * 수비 팀은 `팀[st[0xa]]` — 타자 미션(모드 6)은 CPU 팀(`game.cpuAutoBatting`), 투수 미션(모드 5)은 사람 칸 팀(`game.humanBatting`,
 * 0xaa57c 의 aa7f2 갈래라 미션 선수를 타자 명부에 안 넣는다). 두 팀 다 레코드 배열은 마스터 줄 그대로다.
 * 능력치는 `0xb570c` 첫머리 b5728 의 `0xb6415(선수, 2, 1)`(장비 니블 · 장착 스킬) — 모드 5 · 6 은 모드 갈래 · 팀 능력치 마스크를 안 타고
 * 체력 인자 90 은 피로 감소가 없다(`masterGameAbilityOf`, `missionRunnerRunAt` 과 같은 길).
 *
 * 레코드의 자리 니블은 대타 확정 0xaebe4(aecac~, R4 1c)가 **새 타자 ↔ 옛 타자** 로 맞바꾼다 — 벤치 줄은 니블이 0 이라
 * 지금 타순 칸 s 에 선 레코드가 시작 때 칸 s 레코드의 자리를 갖고, 타순 밖 레코드는 0(어느 칸에도 안 맞는다)이 된다.
 * 대타는 명단(`lineup`)만 바꾸므로 명단에서 그대로 읽는다.
 *
 * **칸 0(투수)**: 판 시작은 선수를 찾지 않아 g = 2 · 악송구 보정 8 고정이다(송구 쪽은 이 칸을 안 읽는다 — `fielderAbilityOf`).
 * 공수 교대 판 0x3fac4 가 칸 0 의 +0xec 에 니블 1(지명타자)을 넣어 펌블 · 레이저가 그 수비를 보므로 칸 0 에는 **첫 0x18 판이 적은**
 * 지명타자 레코드(`fielderZeroRecord`) 값을, 판이 안 섰으면 null 을 넣는다(`recordPlayerAbilityOf` · `entities/fielding/model/fielderRecords`).
 * ⚠️ 찾는 레코드가 미션 타자 · 마타자 표지면(수비 팀에는 안 생긴다) 진행기 기본값이다.
 */
export function missionDefenseAbilitiesOf(run: MissionDefenseSituation): (number | null)[] {
  const abilities: (number | null)[] = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_RUN_ABILITY)
  // 칸 0 의 +0xec 가 0(판이 안 섰다) — 펌블 표 대신 0 · 레이저 굴림 없음 (`recordPlayerAbilityOf`)
  if (run.fielderZeroRecord === null) abilities[0] = null
  for (const { slot, player } of missionDefenseFieldersOf(run, true)) {
    if (player !== undefined) abilities[slot] = masterGameAbilityOf(player, false, DEFENSE_SLOT)
  }
  return abilities
}

/**
 * 수비 아홉 칸의 **스킬 번호** — `missionDefenseAbilitiesOf` 와 같은 레코드(칸 0 은 지명타자). 레이저 0x66a8c · 필살수비 0x66b30 이
 * 야수 +0xec 에 `0xb62b4(선수, 0x15)`(초감각)를 묻는다 — 레코드 +0x14 는 마스터 줄 Xls 행 그대로다. 표지 레코드 · 빈 칸은 빈 목록.
 */
export function missionFielderSkillIdsOf(run: MissionDefenseSituation): (readonly number[])[] {
  const skills: (readonly number[])[] = Array.from({ length: FIELDER_COUNT }, () => [])
  for (const { slot, player } of missionDefenseFieldersOf(run, true)) {
    if (player !== undefined) skills[slot] = skillIdsOfBits(player.skillBits, false)
  }
  return skills
}

/**
 * 판 시작 0xb0fb4 가 칸 1~8 에 앉히는 **야수 레코드** — 레코드 차례로 자리 니블 − 1 칸에 첫 레코드(겹치면 앞 레코드).
 * 미션 타자 · 마타자 표지면 `player` 가 없다(수비 팀에는 안 생긴다). 자리 니블은 `missionDefenseAbilitiesOf` 머리말대로 대타가 맞바꾼 값.
 */
function missionDefenseFieldersOf(
  run: MissionDefenseSituation,
  withDesignated = false,
): { readonly slot: number; readonly positionCode: number; readonly player: RosterPlayer | undefined }[] {
  const defense = run.mission.side === '타자' ? run.game.cpuAutoBatting : run.game.humanBatting
  if (defense === null) return []
  const roster = teamBatters(defense.teamId)
  const rowOf = (record: number) => defense.records[record] ?? record
  const positionOfRow = (row: number) => (roster[row]?.position ?? 0) & 0xf
  // 레코드 → 자리 니블 — 타순 칸 s 에 선 레코드는 시작 때 칸 s 레코드(= 레코드 s)의 자리, 나머지는 0
  const positions = new Map<number, number>()
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) {
    positions.set(rosterSlotAt(defense.lineup, order), positionOfRow(rowOf(order)))
  }
  // 칸 0 은 판 시작이 안 찾지만 공수 교대 판 0x3fac4 는 니블 1(지명타자)을 칸 0 의 +0xec 에 넣는다 — 능력치(펌블 · 레이저)만 본다.
  // 그 판이 적은 레코드(`fielderZeroRecord`)를 알면 그것이다(그 뒤 대타로 지명 자리가 옮겨도 +0xec 는 그대로)
  const seatedZero = withDesignated ? run.fielderZeroRecord : null
  const filled = Array.from({ length: FIELDER_COUNT }, (_unused, slot) => slot === 0 && (!withDesignated || seatedZero !== undefined))
  const fielders: { slot: number; positionCode: number; player: RosterPlayer | undefined }[] = []
  if (seatedZero != null) fielders.push({ slot: 0, positionCode: 1, player: playerOfRow(rowOf(seatedZero)) })
  for (let record = 0; record < defense.records.length; record += 1) {
    const positionCode = positions.get(record) ?? 0
    const slot = positionCode - 1
    if (slot < 0 || slot >= FIELDER_COUNT || filled[slot]) continue
    filled[slot] = true
    fielders.push({ slot, positionCode, player: playerOfRow(rowOf(record)) })
  }
  return fielders

  function playerOfRow(row: number): RosterPlayer | undefined {
    return row === MISSION_NARI_RECORD || row === MISSION_ACE_ROSTER_SLOT ? undefined : roster[row]
  }
}

/**
 * 미션 시작 첫 0x18 판의 0x3fac4 3fe0a~3fe4c 가 칸 0 의 +0xec 에 적는 레코드 — 수비 팀 레코드 차례에서 그때 자리 니블이 1(지명)인
 * 첫 레코드(`missionDefenseFieldersOf` 와 같은 니블 셈). 없으면 null(안 덮어 장면 직후 값 0 이 남는다)
 */
export function missionBoardFielderZeroOf(run: MissionDefenseSituation): number | null {
  const defense = run.mission.side === '타자' ? run.game.cpuAutoBatting : run.game.humanBatting
  if (defense === null) return null
  const roster = teamBatters(defense.teamId)
  const rowOf = (record: number) => defense.records[record] ?? record
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) {
    if (((roster[rowOf(order)]?.position ?? 0) & 0xf) === 1) return rosterSlotAt(defense.lineup, order)
  }
  return null
}

/** 타순 아홉 칸 */
const QUICK_LINEUP_SLOTS = 9

/** 미션 수비 판에 먹이는 능력치 — 아홉 칸 수비와 루별 주루(0 = 타자주자), 그리고 그림 전용 이름 판 · 마선수 주자 */
export interface MissionPlayAbilities {
  readonly defenseAbilities: readonly (number | null)[]
  readonly runAbilities: Partial<Record<0 | 1 | 2 | 3, number>>
  /** 수비 칸별 스킬 번호 — 레이저 0x66a8c · 필살수비의 초감각(21) (`missionFielderSkillIdsOf`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `missionFielderPlatesOf`). 안 주면 고리만 그린다 */
  readonly fielderPlates?: ReturnType<typeof defenseFielderPlatesOf>
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (주자 그림 0x79d10 · 적재 0x483a0 — `missionRunnerAcesOf`) */
  readonly runnerAces?: RunnerAces
  /**
   * 야수 · 주자 그림 팔레트 — 수비 · 공격 팀 번호 (defender.mpl 15벌 = 팀 번호, C-1). 미션은 경기[0x28 + 칸]의 두 팀
   * (`missionTeamIdsOf` — 사람 칸 · CPU 칸)에서 수비측 st[0xa] 로 고른다: 타자 미션은 CPU 수비, 투수 미션은 사람 칸 수비
   * (`missionDefenseFieldersOf` 와 같은 갈래). 그림 전용이라 난수와 무관하다
   */
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

/**
 * 수비 판(타구 · 견제 · 공 도착 · 밀어내기)이 읽는 능력치 한 벌 — `missionDefenseAbilitiesOf` + `missionRunAbilitiesOnBaseOf`.
 * `plates` 를 주면 그림 전용 이름 판(`missionFielderPlatesOf`) · 마선수 주자(`missionRunnerAcesOf`)도 싣는다 — 난수와 무관하다.
 */
export function missionPlayAbilitiesOf(
  run: MissionRunnerSituation & MissionDefenseSituation,
  special: MissionSpecialRunners = {},
  plates?: MissionPlateSituation,
): MissionPlayAbilities {
  return {
    defenseAbilities: missionDefenseAbilitiesOf(run),
    fielderSkillIds: missionFielderSkillIdsOf(run),
    runAbilities: missionRunAbilitiesOnBaseOf(run, special),
    ...(plates === undefined
      ? {}
      : { fielderPlates: missionFielderPlatesOf(plates), runnerAces: missionRunnerAcesOf(plates) }),
  }
}

/** 이름 판 · 마선수 주자를 고르는 데 쓰는 미션 경기 — 수비 팀 마운드(`cpu.pitching`) · 미션 투수 · 마선수 순번 */
export type MissionPlateSituation = MissionRunnerSituation & MissionDefenseSituation & {
  readonly mission: Pick<OriginalMission, 'side' | 'opponentAce'>
  readonly cpu: Pick<MissionCpuTeam, 'batting' | 'pitching'>
  /**
   * 투수 미션(모드 5)의 미션 투수 — 이름 0xb62c0 · 보직 0xb6dec(레코드 +0xb & 3). 선수 게터 0x1fbd0 의 기록(나리 투수 · 명예 투수).
   * 안 주면(대체 투수) 칸 0 판이 없다
   */
  readonly missionPitcher?: { readonly name: string; readonly role?: number }
}

/**
 * **수비 아홉 칸의 이름 판 선수** (0x43cb0 — `defenseFielderPlatesOf`). 칸 1~8 은 판 시작 0xb0fb4 가 앉힌 야수 레코드(`missionDefenseFieldersOf`,
 * 이름 0xb62c0 · 자리 +0x1c & 0xf 0x54590). 칸 0 은 0x43cb0 이 야수 +0xec 를 안 보고 `0xae83c(팀[st[0xa]])` = 수비 팀 팀[0] 투수(43e48~43e60)
 * 를 다시 찾고 보직은 `0xb6dec`(43e6a) 다:
 * - 타자 미션(모드 6) — CPU 팀 지금 마운드(`cpu.pitching.mound`). 마스터 줄이면 이름 + 보직(+0xb & 3 = `profile & 3`, 0xaa8a0 맞바꿈은
 *   줄째라 보직이 따라간다), 마투수 칸이면 이름만(보직 없음 → 판 없음, 타자편 `gameFlow` · 팀 경기와 같다).
 * - 투수 미션(모드 5) — 사람 칸 팀 0번 투수 = 미션 투수: aa826 `0xb8820` 이 0x1fbd0 기록을 투수 명부에 베끼고 aa81c~aa878 이
 *   0xb6389 · 0xb6349(육성 · 명예) 줄을 찾아 0xb5e98 로 0번에 앉힌다. 미션은 투수가 안 바뀐다.
 */
export function missionFielderPlatesOf(run: MissionPlateSituation): ReturnType<typeof defenseFielderPlatesOf> {
  const lineup = missionDefenseFieldersOf(run)
    .filter((fielder) => fielder.player !== undefined)
    .map((fielder) => ({ name: fielder.player?.name ?? '', position: fielder.positionCode }))
  return defenseFielderPlatesOf(lineup, missionMoundPitcherOf(run))
}

function missionMoundPitcherOf(run: MissionPlateSituation): { readonly name: string; readonly role?: number } | undefined {
  if (run.mission.side === '투수') return run.missionPitcher
  const pitching = run.cpu.pitching
  if (pitching === null) return undefined
  const row = pitching.roster[pitching.mound.pitcherSlot] ?? pitching.mound.pitcherSlot
  if (row === MISSION_ACE_ROSTER_SLOT) {
    const ace = missionOpponentOf('투수', run.mission.opponentAce)
    return ace === null ? undefined : { name: ace.name }
  }
  const pitcher = teamPitchers(pitching.teamId)[row]
  return pitcher === undefined ? undefined : { name: pitcher.name, role: pitcher.profile & 3 }
}

/**
 * **공격 팀 타자 · 루 위 주자의 마선수 번호** (`runnerAces` — 주자 그림 0x79d10 · 적재 0x483a0). 주자 +0x9c 는 0xa94ca 가 적는
 * 0xb63a0 마선수 번호라 마선수 레코드만 선다 — 미션에서는 투수 미션 CPU 타선의 마타자 칸(0xaae7c 가 레코드 9 에 베낀 마선수,
 * 번호 = 0xb63a1 = 순번 − 1)뿐이다. 타자 미션의 사람 칸 팀은 마스터 줄 · 미션 타자(육성 · 명예, 0x40 비트 아님)라 늘 null 이다.
 */
export function missionRunnerAcesOf(run: MissionPlateSituation): RunnerAces {
  const offense = offenseOf(run)
  const aceNumber = run.mission.opponentAce - 1
  const aceOf = (slot: number | null): number | null => {
    if (slot === null || offense === null || aceNumber < 0) return null
    const record = rosterSlotAt(offense.lineup, slot)
    return (offense.records[record] ?? record) === MISSION_ACE_ROSTER_SLOT ? aceNumber : null
  }
  const runners = missionRunnersOf(run)
  return {
    batter: aceOf(missionBatterSlotOf(run)),
    first: aceOf(runnerOnBase(runners, 1)),
    second: aceOf(runnerOnBase(runners, 2)),
    third: aceOf(runnerOnBase(runners, 3)),
  }
}

/** 운동장 전경 · 벤치 클리어링의 한 줄 팀 재료 — 지금 투수 마투수 번호(0x79b48 a)와 레코드 타자 배열 차례(자리 니블 · 마타자 번호) */
export interface MissionWalkTeam {
  readonly pitcherAce: number | null
  readonly records: readonly { readonly position: number; readonly ace: number | null }[]
}

/**
 * **미션 경기 한 줄 팀의 레코드 차례** (`0xb8a34(팀, k)` — 0x3fac4 · 0xb0fb4 · 0x3a5f0 이 훑는 그 배열). 공격 팀은 `offenseOf`(투수 미션 =
 * CPU 타선, 타자 미션 = 사람 칸), 수비 팀은 `missionDefenseFieldersOf` 와 같은 고름(타자 미션 = CPU `cpuAutoBatting`, 투수 미션 = 사람 칸).
 * 레코드 k 의 자리 니블:
 * - 타순 칸 s 에 선 레코드 = 레코드 s 줄의 니블 — 대타 0xaebe4 가 시작 칸 니블을 들어온 레코드에 넘긴다(`missionDefenseFieldersOf` 머리말).
 *   마타자는 0xb53f0 의 0x40 갈래가 XlsACE_BAT 행 0x30 바이트를 통째 베껴 +0x1c 가 0(다섯 행 모두 행 바이트 28 = 0)이고, 0xaae7c 의
 *   `0xb8cb8(팀, team+0x32, 9)` → 0xb5e98(r3 = 0)은 한쪽 자리가 0 이면 자리를 칸에 되쓰므로(b5f10~b5f4a) 마타자가 선 칸은
 *   **옛 그 칸 선수의 니블**이다(`missionRecordNibbleRowOf`).
 * - 타순 밖 레코드 = 그 레코드 칸의 니블(붙박이 벤치는 0, 마타자에게 밀려 9번으로 간 붙박이는 **0** — 같은 되쓰기).
 * 마타자 번호 = 미션 마선수 순번 − 1 (`missionRunnerAcesOf` 와 같다). 지금 투수 마투수 = CPU 팀 마운드가 마투수 칸일 때(타자 미션).
 * ⚠️ 근사(남김 — 결과 같음): 미션 타자 레코드(`MISSION_NARI_RECORD`)의 니블을 웹은 0 으로 둔다. 원본(r276 다시 뜸): 0xb53f0 의 0x80 갈래가
 * 레코드 k 에 옛 [k] 줄 니블을 남기고(b54b6 · b5520), 이어 aa7e8 0xb8cb8(팀, 시작 타순 s, k) → 0xb5e98(r3 = 0)이 두 줄을 맞바꾼다 —
 * 두 니블이 다 0 이 아니면 니블이 선수를 따라가고(b5f32~b5f4a), 한쪽이 0 이면 칸에 되쓴다(b5f1a~b5f30). 그래서 미션 타자의 니블은 k ≤ 8 이면
 * 마스터 줄 k 의 것, k ≥ 9(벤치 · 끝 칸 12)면 마스터 줄 s 의 것이고, 그때 k 칸으로 밀린 마스터 줄 s 는 0 이다. 사람 칸 팀은 타자 미션에서
 * 공격만 하므로 이 니블을 읽는 수비 줄 이름표에 서지 않아 그림 · 결과가 같다.
 */
export function missionWalkTeamOf(run: MissionPlateSituation, isDefense: boolean): MissionWalkTeam | null {
  const team = isDefense
    ? run.mission.side === '타자'
      ? run.game.cpuAutoBatting
      : run.game.humanBatting
    : offenseOf(run)
  if (team === null) return null
  const isCpuTeam = run.mission.side === '타자' ? isDefense : !isDefense
  const aceNumber = run.mission.opponentAce - 1
  const roster = teamBatters(team.teamId)
  const rowOf = (record: number) => team.records[record] ?? record
  const nibbleOfRow = (row: number | null) =>
    row === null || row === MISSION_ACE_ROSTER_SLOT || row === MISSION_NARI_RECORD ? 0 : (roster[row]?.position ?? 0) & 0xf
  const nibbleOfRecord = (record: number) => nibbleOfRow(missionRecordNibbleRowOf(team.records, record))
  const inLineup = new Map<number, number>()
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) inLineup.set(rosterSlotAt(team.lineup, order), order)
  const recordCount = Math.max(team.records.length, ...[...inLineup.keys()].map((record) => record + 1))
  const records = Array.from({ length: recordCount }, (_unused, record) => {
    const row = rowOf(record)
    const order = inLineup.get(record)
    return {
      position: nibbleOfRecord(order ?? record),
      ace: isCpuTeam && row === MISSION_ACE_ROSTER_SLOT && aceNumber >= 0 ? aceNumber : null,
    }
  })
  const pitching = isCpuTeam ? run.cpu.pitching : null
  const moundRow = pitching === null ? null : pitching.roster[pitching.mound.pitcherSlot] ?? pitching.mound.pitcherSlot
  return { pitcherAce: moundRow === MISSION_ACE_ROSTER_SLOT && aceNumber >= 0 ? aceNumber : null, records }
}
