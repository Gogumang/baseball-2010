import { registerSnapshotSlot } from '@/shared/lib/dev/snapshotSlots'
/**
 * **전역 경기 상태 `[0x1552d0c]` 의 +0x6a · +0x6b** — 모든 모드가 같이 쓰는 경기 상태 한 벌이다 (직접 떴다).
 *
 * ```
 * 앱 시작 0x2ed8(0x3016 만들기 · 0x31be)  → 0xb6814: +0x6a = 6 (0xb681e~0xb6824) · 0xb6798: +0x6b = 0 (0xb67c0)
 * 0xb6814 를 전역 상태로 부르는 곳(곧 +0x6b = 0):
 *   시즌 경기 준비 0x6548(0x6622) · 나리 142 진입 0x1c46c(0x1c47a) · 일반모드 경기정보 0x30be0(0x30d5e) · 0x30f20(0x310a8) ·
 *   경기 장면 셋업 0x39fdc(0x39ff6 · 0x3a200 · 0x3a49c — 모드 갈래) · 미션 0xaa57c(0xaa5fc)
 * +0x6b 를 쓰는 다른 곳: 이닝 넘김 0xb6b6c(0xb6b8a, 경기 장면 — 모든 모드) · 미션 시작 이닝 0xaa698(레코드 바이트3 하위 4비트)
 * CPU 끼리 경기(0xc239c · 0xc2c4c ← 0xc2a48 · 0xc2760 · 0xc2dac)는 0xc0dac 에 **제 스택의 상태**(sp+0x48)를 넘겨 이 칸을 안 건드린다.
 * +0x6a 를 바꾸는 곳은 0xb6814 의 상수 6 뿐이다(`adds #0x6a` + strb 전수 — 나머지는 다른 객체).
 * ```
 * 그래서 장면이 바뀌어도 **마지막으로 돈 경기(모드 불문)의 이닝**이 남고, 앱을 새로 켜면 0 이다. 투수편 116 의 감독 글 38
 * (`+0x6a == +0x6b`, 12ad8~12af0)이 이어하기 때 이 칸의 지금 값을 본다.
 * 웹은 모듈 칸으로 든다 — 새로 고침(= 앱 다시 켜기)이면 0. 각 모드 세션이 위 자리에서 `resetLiveGameState` 를,
 * 경기 끝(· 경기 중 나가기)에 `setLiveGameInningIndex` 를 부른다.
 */

/** +0x6a — 0xb6814 가 넣는 상수 (구원 "등판 기회 없음" 판정의 7회 = 인덱스 6) */
export const LIVE_GAME_STATE_COLD_INNING_INDEX = 6

let inningIndex = 0

/** +0x7e · +0x7f 점수 칸이 오르는 상한 — 득점 0xb6a9c 가 98 이하일 때만 +1 (`cmp #0x62; bgt`) */
const SCORE_LIMIT = 99

/**
 * **+0x28 · +0x29 측별 팀 번호** — `0xb6bd4(상태, 측, 팀)` 가 `상태[0x28 + 측] = 팀` 으로 쓴다(시즌 0x6548 · 일반 0x30be0 · 0x30f20 ·
 * 경기 장면 0x39fdc · 미션 0xaa57c — CPU 끼리 0xc239c · 0xc2c4c 는 제 스택 상태). 0xb6814 는 이 칸을 안 지운다.
 * 측 0 = 1회 초 공격(선공) · 측 1 = 후공. 앱을 켠 뒤 경기가 없었으면 0 (전역 상태를 새로 잡을 때의 0).
 */
let sideTeamIds: readonly [number, number] = [0, 0]
/** **+0x7e · +0x7f 측별 점수** (0xb69b0) — 0xb6814 → 0xb6798 이 memset 0 (b67a8~b67b0), 득점 0xb6a9c 가 99 까지 올린다 */
let sideScores: readonly [number, number] = [0, 0]

/** 0xb6814(전역 상태) — +0x6b = 0 (+0x6a 는 늘 6) · 점수 +0x7e · +0x7f = 0 (0xb6798). +0x28 · +0x29 는 그대로 */
export function resetLiveGameState(): void {
  inningIndex = 0
  sideScores = [0, 0]
}

/** 사람 경기 하나의 측별 팀 · 점수 — 경기 장면이 든 값 (`setLiveGameSides`) */
export interface LiveGameSides {
  readonly ourTeamId: number
  readonly opponentTeamId: number
  readonly ourScore: number
  readonly opponentScore: number
  /** 사람(우리) 팀의 측 — 0 선공 · 1 후공 */
  readonly playerSide: 0 | 1
}

/** 팀 번호 둘(경기 진행 · 설정)과 판(점수 · 사람 측)에서 `LiveGameSides` 를 */
export function liveGameSidesOf(
  teams: { readonly ourTeamId: number; readonly opponentTeamId: number },
  game: { readonly ourScore: number; readonly opponentScore: number; readonly playerSide: 0 | 1 },
): LiveGameSides {
  return {
    ourTeamId: teams.ourTeamId,
    opponentTeamId: teams.opponentTeamId,
    ourScore: game.ourScore,
    opponentScore: game.opponentScore,
    playerSide: game.playerSide,
  }
}

/**
 * 경기 셋업이 쓴 +0x28 · +0x29 와 득점이 올린 +0x7e · +0x7f — 웹은 경기 끝 · 나가기 · 반 이닝 저장 때 `setLiveGameInningIndex` 와 함께 싣는다.
 */
export function setLiveGameSides(sides: LiveGameSides): void {
  const capped = (score: number) => Math.max(0, Math.min(SCORE_LIMIT, Math.trunc(score)))
  const ourSide = sides.playerSide
  sideTeamIds = ourSide === 0 ? [sides.ourTeamId, sides.opponentTeamId] : [sides.opponentTeamId, sides.ourTeamId]
  sideScores = ourSide === 0 ? [capped(sides.ourScore), capped(sides.opponentScore)] : [capped(sides.opponentScore), capped(sides.ourScore)]
}

/**
 * `0xb6a4c(상태) == 0xb6be8(상태, 팀)` — 0xb570c 의 스킬 14 갈래(b5a5a~b5a66)가 보는 "그 팀이 지는 측인가".
 * 0xb6a4c = `+0x7f < +0x7e ? 1 : 0`(지는 측 — **동점이면 측 0**), 0xb6be8 = `(s8 +0x28 ^ 팀) ≠ 0 ? 1 : 0`(+0x28 팀이 아니면 측 1 — 두 측
 * 어느 쪽에도 없는 팀도 측 1). 이닝 검사(+0x6b > 4)는 부르는 쪽 몫이다.
 */
export function isLiveGameLosingTeam(teamId: number): boolean {
  return isLosingTeamOf({ inningIndex, sideTeamIds, sideScores }, teamId)
}

/** 전역 경기 상태 한 벌의 스킬 14 재료 — +0x6b · +0x28 · +0x29 · +0x7e · +0x7f */
export interface FightingSpiritState {
  readonly inningIndex: number
  readonly sideTeamIds: readonly [number, number]
  readonly sideScores: readonly [number, number]
}

/** `0xb6a4c(상태) == 0xb6be8(상태, 팀)` — 상태 한 벌로 (`isLiveGameLosingTeam` 머리말) */
function isLosingTeamOf(state: FightingSpiritState, teamId: number): boolean {
  const losingSide = state.sideScores[1] < state.sideScores[0] ? 1 : 0
  const sideOfTeam = state.sideTeamIds[0] !== teamId ? 1 : 0
  return losingSide === sideOfTeam
}

/** 스킬 14 갈래(b5a4c~b5a66)의 경기 상태 조건 — 상태 한 벌로 (`isLiveGameFightingSpiritSituation` 머리말) */
export function isFightingSpiritSituationOf(state: FightingSpiritState, teamId: number): boolean {
  return state.inningIndex > FIGHTING_SPIRIT_AFTER_INNING_INDEX && isLosingTeamOf(state, teamId)
}

/** 사람 경기 판 하나 — 이닝(1 부터) · 점수 · 사람 측 */
export interface InGameFightingSpiritGame {
  readonly inning: number
  readonly ourScore: number
  readonly opponentScore: number
  /** 사람(우리) 팀의 측 — 0 선공 · 1 후공 */
  readonly playerSide: 0 | 1
}

/**
 * **경기 중**의 전역 경기 상태 — 사람 경기 장면은 [0x1552d0c] 자체를 굴린다: +0x6b 는 이닝 넘김 0xb6b6c 가, +0x7e · +0x7f 는 득점
 * 0xb6a9c 가(99 상한) 그때그때 바꾸고 +0x28 · +0x29 는 셋업 0xb6bd4 가 두 팀으로 적었다. 장면 안 자동진행(간이 엔진)도 같은 상태를 쓴다.
 * 그래서 경기 안 0xb570c 의 스킬 14 갈래는 **지금 판**의 이닝 · 점수를 본다 — `isFightingSpiritSituationOf` 에 넣을 상태 한 벌.
 * `extraRuns` 는 아직 판에 안 실린 이번 반 이닝 득점(간이 엔진이 굴리는 중) — `offenseIsOurs` 쪽 점수에 더한다.
 */
export function inGameFightingSpiritStateOf(
  teams: { readonly ourTeamId: number; readonly opponentTeamId: number },
  game: InGameFightingSpiritGame,
  extraRuns?: { readonly runs: number; readonly offenseIsOurs: boolean },
): FightingSpiritState {
  const capped = (score: number) => Math.max(0, Math.min(SCORE_LIMIT, Math.trunc(score)))
  const ourScore = capped(game.ourScore + (extraRuns !== undefined && extraRuns.offenseIsOurs ? extraRuns.runs : 0))
  const opponentScore = capped(game.opponentScore + (extraRuns !== undefined && !extraRuns.offenseIsOurs ? extraRuns.runs : 0))
  const ourSide = game.playerSide
  return {
    inningIndex: game.inning - 1,
    sideTeamIds: ourSide === 0 ? [teams.ourTeamId, teams.opponentTeamId] : [teams.opponentTeamId, teams.ourTeamId],
    sideScores: ourSide === 0 ? [ourScore, opponentScore] : [opponentScore, ourScore],
  }
}

/** 측 차례로 든 이닝 인덱스 · 팀 · 점수에서 상태 한 벌 — 점수는 득점 0xb6a9c 처럼 0..99 로 자른다 */
export function sideFightingSpiritStateOf(
  inningIndexOfGame: number,
  teams: readonly [number, number],
  scores: readonly [number, number],
): FightingSpiritState {
  const capped = (score: number) => Math.max(0, Math.min(SCORE_LIMIT, Math.trunc(score)))
  return { inningIndex: inningIndexOfGame, sideTeamIds: teams, sideScores: [capped(scores[0]), capped(scores[1])] }
}

/** 지금 전역 상태(마지막 사람 경기) 한 벌 — CPU 끼리 간이 엔진(0xc11f0 · 0xc1818)도 0xb570c 안에서 이 칸을 읽는다 */
export function liveFightingSpiritState(): FightingSpiritState {
  return { inningIndex, sideTeamIds, sideScores }
}

/** 경기 장면이 이닝을 넘길 때(0xb6b6c) · 미션 시작 이닝(0xaa698) — 웹은 경기 끝 · 나가기 때의 이닝 인덱스(0 부터) */
export function setLiveGameInningIndex(index: number): void {
  inningIndex = index
}

/** 지금 +0x6b — 마지막 경기(모드 불문)의 이닝 인덱스, 앱을 켠 뒤 경기가 없었으면 0 */
export function liveGameInningIndex(): number {
  return inningIndex
}

/** 스킬 14 갈래의 이닝 문턱 — `+0x6b > 4`(b5a4c~b5a58 `ldrsb ; cmp #4 ; ble`) = 6회부터 */
const FIGHTING_SPIRIT_AFTER_INNING_INDEX = 4

/**
 * 0xb570c 스킬 14 갈래(b5a4c~b5a66)의 **경기 상태 조건** — 전역 상태 `[0x1552d0c]` 의 +0x6b > 4 이고 `팀`이 지는 측(`isLiveGameLosingTeam`).
 * 관리 화면 상세 창은 경기 밖이라 **마지막으로 돈 사람 경기**(모드 불문)의 값이 남은 것을 본다.
 */
export function isLiveGameFightingSpiritSituation(teamId: number): boolean {
  return isFightingSpiritSituationOf(liveFightingSpiritState(), teamId)
}

// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다): 이닝 · 두 팀 · 점수
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  registerSnapshotSlot('liveGameState', {
    capture: () => ({ inningIndex, sideTeamIds, sideScores }),
    restore: (value) => {
      ;({ inningIndex, sideTeamIds, sideScores } = value as never)
    },
  })
}
