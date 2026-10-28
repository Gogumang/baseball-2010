import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { runnerAcesFor } from '@/features/play-team-game/model/teamGameFlow'
import { loadedRunnerAceOf } from '@/features/defense-play/model/runnerAces'
import { lineScoreSlotsOf, PLAYER_SIDE_FIRST_BAT, type GameState } from '@/entities/game/model/gameState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { relayCodeOf, relayLineOf, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import { teamBatterHandOf } from '@/pages/team-game/lib/teamMatchupCards'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3

/**
 * 그 틱 그림의 경기 — 3아웃 넘김 0xb6b6c 는 **다음** 틱의 0xc2198(c21fc)이라 3아웃을 낸 타석 틱은 앞 반 이닝 그대로(아웃 3) 그린다.
 * 웹 간이 타석은 반 이닝 넘김을 그 타석 안에서 하므로 앞 경기의 이닝 · 초말로 되돌린다. 경기가 끝났으면 넘김이 없다.
 */
function drawnGameOf(after: GameState, before: GameState): GameState {
  if (after.isFinished || (after.inning === before.inning && after.half === before.half)) return after
  return { ...after, inning: before.inning, half: before.half, outs: 3 }
}

/** 그 팀 타순 칸의 타자 이름 (대타가 선 칸은 대타 이름) — 모르면 null */
function batterNameAt(progress: TeamGameProgress, ours: boolean, orderIndex: number): string | null {
  const entries = ours ? progress.ourEntry : progress.opponentEntry
  return entries[lineupSlotOf(orderIndex)]?.name ?? null
}

/** 수비 팀 지금 투수 이름 (0xae83c → 0xb62c0) */
function moundPitcherNameOf(progress: TeamGameProgress, ours: boolean): string | null {
  const pitcher = ours ? progress.ourPitcherEntry[progress.ourPitcherIndex] : progress.opponentPitcherEntry[progress.opponentPitcherIndex]
  return pitcher?.name ?? null
}

/**
 * **팀경기(모드 1 · 2 · 8 · 9) 0x21 중계 칸** — 그리기 0x4258c 의 미션과 같은 몫(점수판 · 두 팀 판 · 공격팀 띠 · 중계 글).
 * - 중계 글 0xc25e4: 타석 틱이면 친 타자 이름 + 결과 낱말(`relayCodeOf`), 교체 틱은 글이 없다(c2630 sim+0xc4 = 0).
 * - 두 팀 판: PITCHER = 수비 팀 지금 투수, 카운트 = 타석 끝 st[4] · st[5](교체 틱은 0xc0ee8 이 지운 0), 아웃 = 그 틱 그림의 st[6];
 *   DUE UP = 공격 팀 팀[+0x32](타석 틱이면 방금 친 타자) 부터 세 칸.
 * - 점수판 0x41c18: 그 틱 그림 경기의 이닝별 칸(`lineScoreSlotsOf`).
 */
export function teamAutoRelayStepOf(tick: Pick<TeamAutoRelayTick, 'progress' | 'before' | 'atBat'>): MissionAutoRelayStep {
  const progress = tick.progress
  const game = drawnGameOf(progress.game, tick.before)
  const slots = lineScoreSlotsOf(game)
  const ourHalf = game.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
  const offenseOurs = game.half === ourHalf
  const atBat = tick.atBat
  const currentOrder = lineupSlotOf(atBat !== null ? atBat.orderIndex : offenseOurs ? progress.game.battingOrderIndex : progress.opponentOrderIndex)
  const line =
    atBat === null
      ? null
      : relayLineOf(
          batterNameAt(progress, atBat.ours, atBat.orderIndex) ?? '',
          relayCodeOf(atBat.outcome, atBat.fouled, atBat.swingingStrikeOutLost === true),
        )
  return {
    inning: slots.inning,
    offenseSide: slots.offenseSide,
    scores: slots.totals,
    line,
    inningRuns: slots.inningRuns,
    cards: {
      pitcherName: moundPitcherNameOf(progress, !offenseOurs),
      strikes: atBat?.strikes ?? 0,
      balls: atBat?.balls ?? 0,
      outs: game.outs,
      currentOrder,
      dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) => batterNameAt(progress, offenseOurs, dueUpLineupSlotOf(currentOrder, row))),
      gameOver: game.isFinished,
    },
  }
}

/** 중계에 막 들어선 그림 — 아직 0xc262c 를 안 돌려 글이 없고 카운트는 지금 경기 그대로다 */
export function teamAutoRelayEntryStepOf(progress: TeamGameProgress): MissionAutoRelayStep {
  return teamAutoRelayStepOf({ progress, before: progress.game, atBat: null })
}

/** 수비 위치 코드 2 = 포수 (레코드 `+0x1c & 0xf`) — 수비 9명 배열 칸 1 = [장면+0x1120] */
const CATCHER_POSITION = 2

/**
 * **팀경기 0x21 운동장 그림의 값** — 그리기 0x4258c 머리(425bc~42812, 모드 ∈ {1, 2, 8, 9} · 속도 ≠ 2 일 때만)가 보는 것.
 * - 주자: 주자 관리 [장면+0x20c] 의 1 · 2 · 3루(0xa97a0). 3아웃 타석 틱은 넘김(0xb6b6c)이 다음 틱이라 주자가 아직 루에 있다 —
 *   간이 엔진은 아웃에 주자를 안 움직이므로(E 3f — 코드 0 · 삼진, 땅볼 · 번트 진루는 플레이 전 아웃 ≤ 1 일 때만) 타석 앞 루에
 *   그 타석 공마다의 도루(0xc1982~)만 더한 루다 (`basesAtEnd`).
 * - 투수: 수비 팀 지금 투수 0xae83c — 마선수(0xb633c)면 투수 마선수 그림.
 * - 포수: 수비 9명 칸 1([장면+0x1120])의 선수 +0xec — 마선수면 타자 마선수 그림.
 * - 타자: 공격 팀 지금 타자 0xae89c(= 두 팀 판 DUE UP 의 첫 칸 — 타석 틱이면 방금 친 타자) · 손 0xb63c0.
 * 팀 색은 그림 객체의 팀 — 주자 객체 [장면+0xf24] = 공격 팀 0xb6bf8, 야수 객체 [장면+0xf20] = 수비 팀 0xb6c08 (적재 0x47cc8).
 */
export interface TeamRelayFigures {
  readonly offenseTeam: number
  readonly defenseTeam: number
  /** 1 · 2 · 3루 */
  readonly bases: readonly [boolean, boolean, boolean]
  /** 수비 팀 지금 투수 — 마선수면 칸 0~4, 아니면 −1. 투수가 없으면 null (투수 · 포수를 안 그린다) */
  readonly pitcherAce: number | null
  /** 포수 — 마선수면 칸 0~4, 아니면 −1 */
  readonly catcherAce: number
  /** 공격 팀 지금 타자 — 없으면 null */
  readonly batter: { readonly aceIndex: number; readonly isLeft: boolean } | null
  /** 1 · 2 · 3루 주자가 마선수인가 — 주자 +0x9c ≠ −1 이면 0x79d10 이 실린 마선수 그림(+0x1c)으로 그린다 */
  readonly aceRunners: readonly [boolean, boolean, boolean]
  /**
   * 주자 그림판 [장면+0xf24] +0x1c 에 실린 마선수 그림 번호(0~4) — 없으면 null. 장면에 한 장뿐이라 틱을 넘어 이어진다
   * (`teamRelayFiguresOf` 의 `loadedBefore` · `teamRelayEntryFiguresOf`).
   */
  readonly loadedRunnerAce: number | null
}

/**
 * **타석 교대 0x47cc8 이 주자 그림판에 싣는 마선수 그림** — 그 안 483a0~48400(직접 뜸, r215): 483a0 `0xb633d([sp+0x28])` —
 * [sp+0x28] 은 47d36 의 `0xae89d(팀[st[9]])` = 공격 팀 팀[+0x32] 칸 — 가 참이면 그 그림, 아니면 주자 목록을 뒤 → 앞으로 덮어써
 * 가장 앞선 마선수 주자 그림(`loadedRunnerAceOf`). 마선수가 하나도 없으면 아무것도 안 싣는다(null — 그때는 마선수 주자도 없다).
 */
export function teamLoadedRunnerAceOf(progress: TeamGameProgress): number | null {
  const ourHalf = progress.game.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
  return loadedRunnerAceOf(runnerAcesFor(progress, progress.game.half === ourHalf), progress.game.bases)
}

/**
 * **중계 진입의 실린 마선수 그림** — 두 길이 있다.
 * - 0x18 → 0x21: 갱신 0x4f928 틱 0 이 4f972 `0xaebe4`(두 팀 예약 확정)를 먼저 하고 4facc `0xc2198` 참이면 4faf8 에서 0x47cc8 을
 *   부른다(R10 5절 1 · 4, 직접 뜸 r215). 그래서 0x47cc8 이 보는 팀[+0x32] 는 확정 뒤 = 다음에 칠 타자다 — 웹 타순 칸
 *   (`battingOrderIndex` · `opponentOrderIndex`)과 같다(`teamLoadedRunnerAceOf`).
 * - 경기 중 메뉴 자동진행(0x3c8da → 0x21): 0x47cc8 을 안 거친다(부르는 곳은 48526 · 48ca0 · 48e90 · 4faf8 넷뿐 — xref). 그래서 그
 *   타석의 마지막 0xd 진입 0x48d50(48ddc 예약 확정 → 48e90 0x47cc8)이 실은 그림이 남는다 — 타석 사이 도루 · 견제 · 폭투로 주자가
 *   바뀌었어도 그때 주자로 실은 그림이다. 부르는 쪽이 그 값을 `loadedAtAtBatStart` 로 준다(`TeamGameScreen` 이 0xd 마다 떠 둔다).
 */
export function teamRelayEntryFiguresOf(progress: TeamGameProgress, loadedAtAtBatStart?: number | null): TeamRelayFigures {
  const loaded = loadedAtAtBatStart === undefined ? teamLoadedRunnerAceOf(progress) : loadedAtAtBatStart
  return teamRelayFiguresOf({ progress, before: progress.game, atBat: null }, loaded)
}

/**
 * 한 틱 그림의 값. `loadedBefore` 는 앞 그림까지 주자 그림판에 실린 마선수 그림 번호다 — 갱신 0x48480 485a0~485a6 이
 * 모드 ∉ {3, 4, 5, 6} 이면(속도와 상관없이) sim+0xa4 ≥ 0 일 때 0x76a09 · 0x79cbd([장면+0xf24], sim+0xa4) 로 다시 싣는다.
 * sim+0xa4 는 간이 타석 머리 0xc0ee8 이 c0f2a~c0f7a 에서 **지금 타자가 바뀌었을 때만**(0xae89d 와 예약 0xae945 의 +0xa 가 다르면)
 * 0xaebe5 로 새 타자를 세우고 0xb633d(마선수)면 0xb63a1(번호), 아니면 −1 로 쓴다 — 곧 이 틱의 타자가 마선수면 그 그림, 아니면 앞 그림 그대로다.
 * 3아웃 넘김 틱(c21fc)의 0x47cc8 다시 적재는 루가 비어 있어 타자만 보므로 같은 결과다. 실린 그림이 없으면 원본 0x79d10 은
 * 빈 그림(+0x1c = 0)을 79d68 에서 읽는다 — `ldr r3, [r5, #0xc]` 가 r5 = 0 으로 주소 0xc 를 읽는 널 포인터 읽기라(직접 뜬 것, r180)
 * 기기 메모리에 달린다. ⚠️ 미확인(남김 — 기기 메모리 주소 0xc 의 값이라 웹에 옮길 수 없다. 웹은 타석 화면 `aceRunnerFramesOf` 처럼 보통 그림으로 그린다).
 */
export function teamRelayFiguresOf(
  tick: Pick<TeamAutoRelayTick, 'progress' | 'before' | 'atBat'>,
  loadedBefore: number | null = null,
): TeamRelayFigures {
  const progress = tick.progress
  const after = progress.game
  const flipped = !after.isFinished && (after.inning !== tick.before.inning || after.half !== tick.before.half)
  const half = flipped ? tick.before.half : after.half
  const ourHalf = after.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
  const offenseOurs = half === ourHalf
  const { options } = progress
  const offenseTeam = offenseOurs ? options.ourTeamId : options.opponentTeamId
  const defenseTeam = offenseOurs ? options.opponentTeamId : options.ourTeamId
  // 원본은 3아웃 타석 틱에도 주자 관리 [장면+0x20c](= sim+0x80)가 그 타석 끝 그대로다 — 지우기 0xa9250 은 다음 틱 0xc2198 의
  // c21fc 3아웃 넘김 뒤 c2222. 웹 간이 타석은 3아웃이면 그 자리에서 루를 비우므로 타석 끝 루(도루로 민 루 포함)를 따로 받는다
  const bases = flipped ? (tick.atBat?.basesAtEnd ?? tick.before.bases) : after.bases
  const pitcher = offenseOurs ? progress.opponentPitcherEntry[progress.opponentPitcherIndex] : progress.ourPitcherEntry[progress.ourPitcherIndex]
  const defenseEntries = offenseOurs ? progress.opponentEntry : progress.ourEntry
  const catcher = defenseEntries.find((entry) => entry.position === CATCHER_POSITION)
  const atBat = tick.atBat
  const order = atBat !== null ? atBat.orderIndex : offenseOurs ? after.battingOrderIndex : progress.opponentOrderIndex
  const batter = (offenseOurs ? progress.ourEntry : progress.opponentEntry)[lineupSlotOf(order)]
  // 루 위 주자 신원 — 3아웃 틱은 웹이 지운 루 대신 타석 끝 루 · 신원(`basesAtEnd` · `runnersAtEnd`)
  const runnerSource =
    flipped && tick.atBat !== null ? { ...progress, game: { ...after, bases: tick.atBat.basesAtEnd, runners: tick.atBat.runnersAtEnd } } : progress
  const aces = runnerAcesFor(runnerSource, offenseOurs)
  const batterAce = batter !== undefined && batter.aceIndex >= 0 ? batter.aceIndex : null
  return {
    offenseTeam,
    defenseTeam,
    bases: [bases.first, bases.second, bases.third],
    pitcherAce: pitcher === undefined ? null : pitcher.aceIndex,
    catcherAce: catcher?.aceIndex ?? -1,
    batter: batter === undefined ? null : { aceIndex: batter.aceIndex, isLeft: teamBatterHandOf(offenseTeam, batter) === 1 },
    aceRunners: [bases.first && aces.first != null, bases.second && aces.second != null, bases.third && aces.third != null],
    loadedRunnerAce: batterAce ?? loadedBefore,
  }
}
