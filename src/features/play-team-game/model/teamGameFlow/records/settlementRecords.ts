import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { type AtBatOutcome, isHit } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { SEASON_RECORD_CODE } from '@/entities/season-mode/model/seasonReputation'
import { battingSideOf, isAcePlayer } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 사이클 판정 `0xa7610` — 그 타순 칸의 루타 목록에 1·2·3·4 가 다 들어 있는가 */
function hasCycle(hitBases: readonly number[]): boolean {
  return [1, 2, 3, 4].every((bases) => hitBases.includes(bases))
}

/**
 * **우리 타석 하나**가 올리는 코드들 — `0xa8024` 의 안타 가지 차례 그대로다.
 *
 * ```
 * a8490: [sp+0x14](안타인가) == 0 이면 안타 가지를 통째로 건너뛴다
 * a8518:   k=7  안타 — **루타를 가르기 전이라 홈런·2루타·3루타도 함께 오른다**
 * a856e:   k=8  [sp+0x10] == 2
 * a85b8:   k=9  [sp+0x10] == 3
 * a85be:   [sp+0x24](이 플레이 홈런 수) > 0 이면
 * a8648~:   k=0xa/0xb/0xc/0xd — [sp+0x28](이 플레이 득점) 1/2/3/4
 * a86e0:   루타 값을 타순 칸 기록 목록에 민다
 * a878a:   k=0xe 사이클 — 플레이 **전** 판정 [sp+0x1c] 이 거짓인데 지금 참이면
 * a8a46:  k=6  삼진 (수비가 CPU 인 쪽 — 내 타자가 당한 삼진)
 * ```
 */
/**
 * **정산 타자 게이트 [sp+0x34]** = `0xa56dc(ctx, 지금 타자, 0)`(a8070, 직접 떴다):
 * ```
 * a56ea  모드 − 2 > 4 → 거짓                      ; 팀 경기 모드 1 · 7 · 8 은 늘 거짓
 * a56fa  모드 2: SR(0x1f55d)+0x12c(국가대항전) || SR+0xb4(포스트시즌) → 거짓
 * a5744  0xb633d(타자) (마선수) → 거짓, 아니면 참
 * ```
 * 장내 홈런 state[0x25] 는 a84d6 이 이 게이트가 참일 때만 홈런 수 [sp+0x24] 에 더한다 (`homeRunCountedOf`).
 */
function settlementBatterGateOf(progress: TeamGameProgress, ourOffense: boolean): boolean {
  const { options } = progress
  if (options.mode !== TEAM_GAME_MODE.시즌) return false
  if (options.isPostseason === true || options.nationalCupStage !== undefined) return false
  const side = battingSideOf(progress, ourOffense)
  return !isAcePlayer(side.entry[side.slot])
}

/**
 * **정산 홈런 수 [sp+0x24] > 0 인가** — 담장을 넘긴 사건 8 은 게이트 없이 센다(a80a8). 장내 홈런은 타자 게이트가 거짓이면
 * 루타 4 안타로만 적혀 홈런 갈래 a85be~a86b4(기록 1~4 · 백투백 0xa794c · 시즌 코드 · B0)와 a8728 의 타순 칸 홈런 +0x13 ·
 * 0xa7b00(12~14) · a8764 대타 홈런(5)을 건너뛰고, a86b4 가 ctx+0x162 를 0 으로 둔다. 결과 링은 루타 4(a8704) 그대로다.
 */
export function homeRunCountedOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  ourOffense: boolean,
): boolean {
  return outcome.kind === '홈런' && !(defensePlay?.groundHomeRun === true && !settlementBatterGateOf(progress, ourOffense))
}

export function offenseRecordOf(
  outcome: AtBatOutcome,
  runsBattedIn: number,
  hitBasesBefore: readonly number[],
  /** 정산 [sp+0x24] > 0 — 홈런 갈래의 시즌 코드 (`homeRunCountedOf`). 안 넘기면 홈런이면 참 */
  homeRunCounted = outcome.kind === '홈런',
): { readonly codes: readonly number[]; readonly hitBases: readonly number[] } {
  // a8490 — 안타가 아니면 안타 가지를 통째로 건너뛴다. 남는 것은 a8a46 의 삼진(6)뿐이다
  if (!isHit(outcome)) {
    return { codes: outcome.kind === '삼진' ? [SEASON_RECORD_CODE.내타자삼진] : [], hitBases: hitBasesBefore }
  }
  const bases = hitBasesOf(outcome)
  // a86e0 — 루타 값을 타순 칸 기록 목록에 민다
  const hitBases = [...hitBasesBefore, bases]
  const codes = [
    SEASON_RECORD_CODE.안타,
    ...extraBaseHitCodesOf(bases),
    ...(homeRunCounted ? homeRunCodesOf(runsBattedIn) : []),
    // a878a — 플레이 **전** 판정이 거짓인데 지금 참이면
    ...(!hasCycle(hitBasesBefore) && hasCycle(hitBases) ? [SEASON_RECORD_CODE.사이클] : []),
  ]
  return { codes, hitBases }
}

/** 안타의 루타 — 홈런은 4 */
function hitBasesOf(outcome: AtBatOutcome): number {
  return outcome.kind === '안타' ? outcome.bases : 4
}

/** a856e · a85b8 — 루타를 가르기 전의 k=7 뒤에 붙는 2루타(8) · 3루타(9) */
const EXTRA_BASE_HIT_CODES: Readonly<Record<number, readonly number[]>> = {
  2: [SEASON_RECORD_CODE.이루타],
  3: [SEASON_RECORD_CODE.삼루타],
}

function extraBaseHitCodesOf(bases: number): readonly number[] {
  return EXTRA_BASE_HIT_CODES[bases] ?? []
}

/** a8648~ — 홈런 네 칸은 **타점**이 가른다. 원본도 득점이 1~4 가 아니면 아무 칸도 안 올린다 */
function homeRunCodesOf(runsBattedIn: number): readonly number[] {
  if (runsBattedIn < 1 || runsBattedIn > 4) return []
  return [SEASON_RECORD_CODE.솔로홈런 + runsBattedIn - 1]
}

/**
 * **내가 던진 타석 하나**가 올리는 코드들 — `0xa8024` 의 공통 꼬리다.
 *
 * ```
 * a8a40: k=4  [sp+0x20](삼진 수) > 0 이고 **수비가 사람**이면 4 (아니면 6)
 *             ⚠️ 값 인자가 없어 삼진이 둘이어도 +1 이다
 * a8d6e: k=2  [sp+0x14](안타) — 피안타
 * a8e76: k=5  [sp+0x30](이 플레이 아웃 수) == 2 이고 state[0x1a] 가 0 일 때 — 병살
 * a8e8a: k=0  [sp+0x30] == 3 — 삼중살 (state[0x1a] 가 막지 않는다)
 * ```
 * ⚠️ `state[0x1a]` 는 "삼진 뒤 주자가 움직여 두 번째 아웃이 난 플레이" 표시다 (P7 F절).
 * 웹에는 그 플레이(삼진 + 주자 아웃)가 없어 아웃 둘이 나는 타석은 늘 병살이다.
 */
export function defenseRecordCodesOf(
  outcome: AtBatOutcome | null,
  outsAdded: number,
  /** 종류 4·5 정산 — 삼진 코드(a8a40)는 범타·삼진 갈래 안이라 안 선다. 병살 · 삼중살(a8e58)은 거르지 않는다 */
  runnerPlay = false,
  /** state[0x1a] 낫아웃 — a8e5e 가 [sp+0x30] == 2 의 병살 갈래(26 · 코드 5)를 막는다. 삼중살은 막지 않는다 */
  strikeoutWhileRunning = false,
): readonly number[] {
  // outcome null = 삼진 없는 도루 판의 정산 — 아웃 칸만 본다
  const strikeout = outcome?.kind === '삼진' && !runnerPlay
  const hit = outcome !== null && isHit(outcome)
  return [
    ...(strikeout ? [SEASON_RECORD_CODE.탈삼진] : []),
    ...(hit ? [SEASON_RECORD_CODE.피안타] : []),
    ...multiOutPlayCodesOf(outsAdded, strikeoutWhileRunning),
  ]
}

/** a8e58 — 이 플레이 아웃 [sp+0x30] 이 2 면 병살(낫아웃이면 막힌다), 3 이면 삼중살 */
function multiOutPlayCodesOf(outsAdded: number, strikeoutWhileRunning: boolean): readonly number[] {
  if (outsAdded === 3) return [SEASON_RECORD_CODE.삼중살]
  if (outsAdded === 2 && !strikeoutWhileRunning) return [SEASON_RECORD_CODE.병살]
  return []
}
