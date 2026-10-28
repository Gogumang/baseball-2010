import type { RandomPort } from '@/shared/api/random/randomPort'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { rollStartingPitcherIndex } from '@/entities/team/model/teamRoster'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import { isBugFixed } from '@/shared/config/bugfixes'
import { NO_ACE_BATTER, type TeamEntryPitcher, rosterEntryPitchersOf, entryPitchersOfOrder } from '@/features/play-team-game/model/teamGameRoster'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

/**
 * 이 경기의 양 팀 선발 칸 — **모드마다 원본이 다르다**.
 *
 *   - 모드 1 일반 · 8·9 대전 (`0x30f20`·`0x30be0`): 경기를 세울 때 `0xb8c94(팀, 0, bfa54(0,4))`
 *     로 **로스터 앞 4명 중 무작위** (S13 1-4b 확정). AI 팀 → 사람 팀 차례로 뽑는다.
 *   - 모드 2 시즌: 경기 직전 화면 `0x6548` 이 `0xb8c80` → `0xb5ca8` 로 **양 팀 4인 로테이션**을
 *     한 칸 돌린다 (R13 4절 · P1 1-1 과 같은 규칙). 무작위가 아니다.
 *
 * 로테이션 쪽은 붙박이 로스터를 섞을 수 없어 칸 번호로 셈한다 — `rotationSlotOf` 주석(**근사다**).
 */
export function startingPitcherSlotsOf(options: TeamGameOptions, random: RandomPort): { readonly opponent: number; readonly ours: number } {
  if (options.mode === TEAM_GAME_MODE.시즌) {
    const day = options.dayCounter ?? 0
    // 리그 차례를 받았으면 상대 명단이 그 차례라 선발은 명단 0번이다 (`opponentPitcherEntryOf`)
    if (options.opponentPitcherOrder !== undefined) return { opponent: 0, ours: rotationSlotOf(day) }
    // 상대 칸만 다른 날짜를 받을 수 있다 — 국가대항전 상대국 슬롯은 매일 새로 복사된다 (`opponentDayCounter`)
    return { opponent: rotationSlotOf(options.opponentDayCounter ?? day), ours: rotationSlotOf(day) }
  }
  // 일반모드는 상태 22 진입(0x30f20)에서 이미 굴렸다 — `rollTeamSetup`
  if (options.startingPitcherSlots !== undefined) return options.startingPitcherSlots
  // 원본은 AI 팀 → 사람 팀 차례로 뽑는다 (0x31088 → 0x3109e)
  const opponent = rollStartingPitcherIndex(random)
  return { opponent, ours: rollStartingPitcherIndex(random) }
}

/** AI 팀 마선수 없음 — 시즌 국가대항전 · 굴리지 않는 길과 같은 값 */
const NO_OPPONENT_ACE = -1

/**
 * **AI 팀 마선수 번호 둘**을 굴린다 — 마투수 `0x66968` → 마타자 `0x66994` 차례 (난수 2).
 * 인자는 사람이 고른 마선수(준비 기록 `+0xe`·`+0xd`)다 — 겹치지 않는 번호가 나온다(`rollOpponentAceIndex`).
 *
 * 부르는 자리 (둘 다 경기 장면 **전**이다):
 *   - 일반모드 경기 세우기 `0x30f20` (31058 → 31064 `0xb88c8(AI팀, v)` · 3106c → 31076 `0xb8870(AI팀, w)`)
 *     — 상태 22 진입 `0x314b0`(이전 상태가 23 이 아니고 모드 1 일 때, 3158c)과 `*` 재굴림 끝(31290)이 부른다.
 *   - 시즌 0xdd 진입 `0x6548` (국가대항전이 아닐 때 66ee → 66f8 · 6700 → 670a, 상대 팀 `[sp+4]`).
 */
export function rollOpponentAces(
  acePitcherId: number,
  aceBatterId: number,
  random: RandomPort,
): { readonly pitcher: number; readonly batter: number } {
  const pitcher = rollOpponentAceIndex(acePitcherId, random)
  const batter = rollOpponentAceIndex(aceBatterId, random)
  // B-03 — 원본은 사람이 "없음"(−1)을 골라도 AI 가 늘 하나씩 받는다(`rollOpponentAceIndex` 의 ldrb). 고친 길(기본)은 사람이 안 고른
  // 역할은 AI 도 없음(−1)으로 둔다. 굴림 둘은 그대로 먹어 뒤의 선발 굴림 차례가 원본과 같다
  if (!isBugFixed('B-03')) return { pitcher, batter }
  return {
    pitcher: acePitcherId < 0 ? NO_OPPONENT_ACE : pitcher,
    batter: aceBatterId < 0 ? NO_OPPONENT_ACE : batter,
  }
}

/** 일반모드 `0x30f20` 이 굴리는 넷 — 상대 마선수 둘과 선발 둘 */
export interface TeamSetupRolls {
  readonly opponentAces: { readonly pitcher: number; readonly batter: number }
  readonly startingPitcherSlots: { readonly opponent: number; readonly ours: number }
}

/**
 * **일반모드 경기 세우기 `0x30f20` 의 굴림 넷** — 마투수(31058) → 마타자(3106c) → AI 선발(3107a) →
 * 사람 선발(31090). 원본은 이것을 **상태 22 진입**(`0x314b0` 3158c · 재굴림 끝 31290)에서 한다 — 그래서
 * 경기정보·엔트리 편집(상태 23)이 이미 굴린 팀을 본다. 결과는 옵션 `opponentAces` · `startingPitcherSlots` 로 넘긴다.
 */
export function rollTeamSetup(acePitcherId: number, aceBatterId: number, random: RandomPort): TeamSetupRolls {
  const opponentAces = rollOpponentAces(acePitcherId, aceBatterId, random)
  // 3107a: 0xb8c94(AI팀, 0, rand(0,4)) → 31090: 0xb8c94(사람팀, 0, rand(0,4))
  const opponent = rollStartingPitcherIndex(random)
  return { opponentAces, startingPitcherSlots: { opponent, ours: rollStartingPitcherIndex(random) } }
}

/**
 * 이 경기의 **AI 팀 마선수 번호 둘** — 미리 굴린 것(`opponentAces`)이 있으면 그것, 없으면 여기서 굴린다.
 *
 * ⚠️ **굴림 차례가 원본과 같아야 한다** — `0x30f20` 은 마투수(`31058`) → 마타자(`3106c`) →
 * AI 선발(`3107a`) → 사람 선발(`31090`) 차례로 넉 장을 뽑는다. 그래서 여기가
 * `startingPitcherSlotsOf` 보다 **먼저** 돌아야 한다.
 *
 * 시즌(모드 2)은 `0x30f20` 을 타지 않는다 — `seasonOpponentAces` 가 서 있을 때만 0xdd 진입 `0x6548` 의
 * 굴림 둘을 여기서 한다 (국가대항전은 안 굴린다).
 */
export function opponentAceIndexesOf(options: TeamGameOptions, random: RandomPort): { readonly pitcher: number; readonly batter: number } {
  if (options.opponentAces !== undefined) return options.opponentAces
  if (options.mode === TEAM_GAME_MODE.시즌 && options.seasonOpponentAces !== true) return { pitcher: -1, batter: -1 }
  return rollOpponentAces(options.acePitcherId ?? NO_ACE_BATTER, options.aceBatterId ?? NO_ACE_BATTER, random)
}

/**
 * 상대 팀 투수 명단 — 시즌에 리그 차례(`opponentPitcherOrder`)를 받았으면 그 차례로 표 칸을 늘어세운다(칸마다 제 표 칸
 * `orderIndex` · 보직을 그대로 든다 — 로테이션 0xb5ca8 은 레코드째 옮긴다). 그 밖은 표 차례 그대로.
 */
export function opponentPitcherEntryOf(options: TeamGameOptions): readonly TeamEntryPitcher[] {
  const table =
    options.opponentEntryOrder === undefined
      ? rosterEntryPitchersOf(options.opponentTeamId)
      : entryPitchersOfOrder(options.opponentTeamId, options.opponentEntryOrder)
  const order = options.mode === TEAM_GAME_MODE.시즌 ? options.opponentPitcherOrder : undefined
  if (order === undefined) return table
  return order.flatMap((slot) => {
    const pitcher = table[slot]
    return pitcher === undefined ? [] : [pitcher]
  })
}

/** 시작 스태미나 배열을 명단 칸으로 — 명단 차례(`orderIndex`)로 찾고, 없는 칸·마투수는 10000 */
export function pitcherStaminasOf(entry: readonly TeamEntryPitcher[], given: readonly number[] | undefined): readonly number[] {
  return entry.map((pitcher) => {
    const value = pitcher.orderIndex >= 0 ? given?.[pitcher.orderIndex] : undefined
    return value === undefined ? FULL_STAMINA : Math.max(0, Math.min(FULL_STAMINA, value))
  })
}
