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
import { teamBatters } from '@/entities/team/model/teamRoster'
import { MISSION_ACE_ROSTER_SLOT, masterGameAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import type { MissionGame } from '@/entities/mission/model/missionGame'
import type { OriginalMission } from '@/shared/config/original/missions'

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
 * **칸 0(투수)**: 원본은 선수를 찾지 않아 g = 2 고정 · 야수+0xec 가 비어 있다(펌블 표 b41e4 는 선수가 없으면 0). 진행기가 이 칸을
 * 선수 없는 칸으로 다루므로(`fielderAbilityOf` — 입력을 읽지 않는다) 자리만 기본값으로 채운다. 모든 모드가 같다(`defenseAbilitiesOf`).
 * ⚠️ 찾는 레코드가 미션 타자 · 마타자 표지면(수비 팀에는 안 생긴다) 진행기 기본값이다.
 */
export function missionDefenseAbilitiesOf(run: MissionDefenseSituation): number[] {
  const abilities = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_RUN_ABILITY)
  const defense = run.mission.side === '타자' ? run.game.cpuAutoBatting : run.game.humanBatting
  if (defense === null) return abilities
  const roster = teamBatters(defense.teamId)
  const rowOf = (record: number) => defense.records[record] ?? record
  const positionOfRow = (row: number) => (roster[row]?.position ?? 0) & 0xf
  // 레코드 → 자리 니블 — 타순 칸 s 에 선 레코드는 시작 때 칸 s 레코드(= 레코드 s)의 자리, 나머지는 0
  const positions = new Map<number, number>()
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) {
    positions.set(rosterSlotAt(defense.lineup, order), positionOfRow(rowOf(order)))
  }
  const filled = Array.from({ length: FIELDER_COUNT }, (_unused, slot) => slot === 0)
  for (let record = 0; record < defense.records.length; record += 1) {
    const slot = (positions.get(record) ?? 0) - 1
    if (slot < 1 || slot >= FIELDER_COUNT || filled[slot]) continue
    filled[slot] = true
    const row = rowOf(record)
    const player = row === MISSION_NARI_RECORD || row === MISSION_ACE_ROSTER_SLOT ? undefined : roster[row]
    if (player !== undefined) abilities[slot] = masterGameAbilityOf(player, false, DEFENSE_SLOT)
  }
  return abilities
}

/** 타순 아홉 칸 */
const QUICK_LINEUP_SLOTS = 9

/** 미션 수비 판에 먹이는 능력치 — 아홉 칸 수비와 루별 주루(0 = 타자주자) */
export interface MissionPlayAbilities {
  readonly defenseAbilities: readonly number[]
  readonly runAbilities: Partial<Record<0 | 1 | 2 | 3, number>>
}

/** 수비 판(타구 · 견제 · 공 도착 · 밀어내기)이 읽는 능력치 한 벌 — `missionDefenseAbilitiesOf` + `missionRunAbilitiesOnBaseOf` */
export function missionPlayAbilitiesOf(
  run: MissionRunnerSituation & MissionDefenseSituation,
  special: MissionSpecialRunners = {},
): MissionPlayAbilities {
  return { defenseAbilities: missionDefenseAbilitiesOf(run), runAbilities: missionRunAbilitiesOnBaseOf(run, special) }
}
