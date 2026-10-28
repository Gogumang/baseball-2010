import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { teamBatterAt } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **지금 타자(타자주자)** 의 주루 능력치 — 원본은 주자마다 제 레코드로 `0xb570c(팀, 3, 선수, 90)` 을 불러 속도를 잡는다
 * (I-controls 3a). 루 위 주자는 신원(`GameState.runners`)대로 `ourRunnerRunsOnBaseOf` 가 따로 내고, 진행기 입력은
 * 둘을 합친 `runAbilitiesOnBaseOf` 를 받는다. 이 값은 루별 값이 없는 칸의 기본값(`runAbility`)으로도 쓰인다.
 */
export function runnerRunAbilityOf(progress: GameProgress): number {
  return ourRunnerRunOf(progress, lineupSlotOf(progress.game.battingOrderIndex))
}

/**
 * 우리 타순 칸 주자의 주력 `0xb570d(ctx, 3, 주자, 1, 0x5a, 1)` — 내 칸이면 내 선수 능력치(`myRunAbility`), 그 밖은 명단 칸 선수.
 */
export function ourRunnerRunOf(progress: GameProgress, orderSlot: number): number {
  if (orderSlot === progress.game.playerOrderIndex && progress.myRunAbility !== undefined) return progress.myRunAbility
  return teamBatterAt(progress, true, rosterSlotAt(progress.ourLineup, orderSlot)).run
}

/**
 * 우리 타순 칸의 마선수 번호 — 명단 칸이 마타자 칸(`ACE_BATTER_ROSTER_SLOT`)이면 실린 마타자 번호(0xb63a0), 아니면 null.
 * 내 선수 칸은 마선수가 아니다.
 */
function ourOrderAceOf(progress: GameProgress, orderSlot: number): number | null {
  if (orderSlot === progress.game.playerOrderIndex) return null
  if (rosterSlotAt(progress.ourLineup, orderSlot) !== ACE_BATTER_ROSTER_SLOT) return null
  const ace = progress.aces?.ours.batter
  return ace === undefined || ace < 0 ? null : ace
}

/** 이 타석 타자 · 루 위 주자의 마선수 번호 (`runnerAces`) */
export function ourRunnerAcesOf(progress: GameProgress) {
  const runners = runnersOfGame(progress.game)
  const onBase = (base: 1 | 2 | 3) => {
    const runner = runnerOnBase(runners, base)
    return runner === null ? null : ourOrderAceOf(progress, runner)
  }
  return {
    batter: ourOrderAceOf(progress, progress.game.battingOrderIndex),
    first: onBase(1),
    second: onBase(2),
    third: onBase(3),
  }
}

/** 루별 주자 주력 (루 1~3, 빈 루는 없다) — 0x35b94 상태 0xe 주루 칸 · 주자 판이 읽는다 */
export function ourRunnerRunsOnBaseOf(progress: GameProgress): Partial<Record<1 | 2 | 3, number>> {
  const runners = runnersOfGame(progress.game)
  const runs: Partial<Record<1 | 2 | 3, number>> = {}
  for (const base of [1, 2, 3] as const) {
    const runner = runnerOnBase(runners, base)
    if (runner !== null) runs[base] = ourRunnerRunOf(progress, runner)
  }
  return runs
}

/**
 * 타석 화면 HUD 의 루별 주자 주력 — 0x35b94 상태 0xe 주루 칸(35f74)이 0xb570d(ctx, 3, 주자, 1, 90, 1) 로 읽는다.
 * 루에 선 내가면 내 선수 능력치(`myRunAbility`)다.
 */
export function runnerRunAbilitiesOf(progress: GameProgress): Partial<Record<'first' | 'second' | 'third', number>> {
  const runs = ourRunnerRunsOnBaseOf(progress)
  return {
    ...(runs[1] === undefined ? {} : { first: runs[1] }),
    ...(runs[2] === undefined ? {} : { second: runs[2] }),
    ...(runs[3] === undefined ? {} : { third: runs[3] }),
  }
}

/** 판정 입력(st[0x14 + i])만 거둔다 — 표시(`stealDisplayFrom`)는 0xf 진입 · 타구 판 시작까지 남는다 */
export function withoutSteal(progress: GameProgress): GameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/** 판정 입력과 표시를 함께 지운다 — 0xf 진입 3d966~3d976 · 타구 판(종류 1) 시작 리드 0x3d7b8 3d8c6~3d8d2 */
export function withoutStealDisplay(progress: GameProgress): GameProgress {
  const cleared = withoutSteal(progress)
  if ((cleared.stealDisplayFrom ?? []).length === 0 && (cleared.stealDisplayUntilConfirm ?? null) === null) return cleared
  return { ...cleared, stealDisplayFrom: [], stealDisplayUntilConfirm: null }
}

/**
 * **루에 안 그릴 주자의 루** — 도루 출발 표시 st[0x15 + i] (`stealDisplayFrom`).
 * `confirmedCount` 는 지금 0xe 대기(`sceneConfirm`)가 받은 OK 수다(`confirmedCountOf`) — 새 타석의 0xf 진입은 첫 OK 뒤라
 * 표시가 그 대기에 묶여 있으면(`stealDisplayUntilConfirm`) OK 를 받기 전까지만 숨긴다.
 */
export function hiddenStealBasesOf(progress: GameProgress, confirmedCount: number): readonly StealBase[] {
  const shown = progress.stealDisplayFrom ?? []
  const until = progress.stealDisplayUntilConfirm ?? null
  if (until === null) return shown
  return progress.sceneConfirm === until && confirmedCount === 0 ? shown : []
}

/**
 * 루별 주자 주루 — 루에 선 주자의 신원(`GameState.runners`, 원본 주자 목록)대로 그 주자의 주력. 0 = 지금 타자(나).
 * 신원이 루 상황과 어긋나는 옛 상태만 예전 근사(타순을 거꾸로 센다)로 본다.
 */
export function runAbilitiesOnBaseOf(progress: GameProgress): Partial<Record<0 | 1 | 2 | 3, number>> {
  return { 0: runnerRunAbilityOf(progress), ...ourRunnerRunsOnBaseOf(progress) }
}
