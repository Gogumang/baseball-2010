import type { RandomPort } from '@/shared/api/random/randomPort'
import type { TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { judgePitcherChange, pitcherAbilitySumOf } from '@/entities/pitching/model/pitcherChange'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { isAcePlayer } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import { type MoundSide, moundSideOf } from '@/features/play-team-game/model/teamGameFlow/roster/moundSide'
import { pitcherAbilitiesAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { substitutionSceneAfter } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { applyPitcherChange, benchIndexesOf } from '@/features/play-team-game/model/teamGameFlow/substitution/pitcherChange'
import { type ReplacementPickInput, replacementPitcherIndexOf } from '@/features/play-team-game/model/teamGameFlow/substitution/replacementPick'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 경기 중 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ───────────────── */

/**
 * **CPU 투수 교체 `0xac428`** 한 번 — 부르는 자리는 둘이다.
 *   - 간이 타석 하나를 돌리기 **전에** (0xc262c 가 타석마다 0xc1ba4 를 부른다, 0xc1ce2) — 양 팀 모두.
 *   - 사람 장면 0xf 진입 `0x3d954` 의 3da3e — **수비 팀이 CPU 일 때**(우리 공격), 공마다 (`enterPitchSelection`).
 *
 * `defendingIsOurs` 가 참이면 우리 팀이 수비(= 우리 투수), 거짓이면 상대 투수를 본다.
 * 사람이 직접 던지는 타석은 우리 투수를 이 길로 바꾸지 않는다 — 그때는 `#` 메뉴(`changePitcher`)뿐이다.
 *
 * 원본 `0xc1ba4` 의 첫 갈래(모드 3 · `0xb6ded`(내 투수 0x1fbd0) == 2 구원 보직 c1bd0 · 수비 팀이 사람 팀 c1bd8~c1bec ·
 * 지금 투수가 내 투수(`0xb6388` = +0xa 비트7 내 육성 선수, 마선수 판정은 0xb633c 비트6)가 아님 c1bf8 → 벤치의 **내 투수**를
 * 0-기준 7 = **8회**에 올림 c1c2e `cmp r3,#7`)는 **투수편 전용**이라 여기 없다 — c1bbe `[state+1]` 이 3 이 아니면 c1bc8 에서 c1c4a 로 건너뛴다.
 */
export function rollAutoPitcherChange(
  progress: TeamGameProgress,
  defendingIsOurs: boolean,
  random: RandomPort,
  /** 사람 경기 장면 `0x3d954` 에서 불렀는가 — 그러면 22 → 교체 연출 0x16 → 0xe 등판음을 지난다 */
  inScene = false,
): TeamGameProgress {
  const mound = moundSideOf(progress, defendingIsOurs)
  const situation = changeSituationOf(progress.game, defendingIsOurs)
  const bench = benchIndexesOf(mound.pitcherIndex, mound.usedPitchers, mound.entries.length)
  const decision = judgePitcherChange({
    ...mound.counters,
    // ac4a0 0xb6ded(마운드 투수) — 명단 칸의 보직(로스터 칸 표), 모르면 선발
    role: mound.entries[mound.pitcherIndex]?.role ?? PITCHER_ROLE.starter,
    // ac4f2 0xb633c(마운드 투수) — 마투수면 특수 문턱(A>2 · B>3 · s≤39)
    isSpecialPitcher: isAcePlayer(mound.entries[mound.pitcherIndex]),
    stamina: mound.stamina,
    benchCount: bench.length,
    // 0xac428 의 일곱째 인자(`[sp+0x58]`)는 0xc1cd8 이 넘기는 `[sp+0x10] = max(r7, 0)` 이다.
    // r7 은 0xc1bbc 에서 −1 로 서고 모드 3(투수편) 갈래(0xc1bc6~0xc1c48)에서만 벤치 번호가 된다 —
    // 팀 경기 모드(1·2·8·9)는 그 갈래를 안 타 늘 −1 → **0** 이다. 곧 벤치가 한 명만 남아도 바꾼다
    // (`judgePitcherChange` 의 기본값 1 은 이 자리와 맞지 않는다).
    minimumBench: TEAM_GAME_MINIMUM_BENCH,
    justChanged: progress.pitcherJustChanged,
    ...situation,
  })
  if (!decision.replace) return progress
  const next = replacementPitcherIndexOf(bench, replacementPickInputOf(progress, mound, situation, decision.saveSituation), random)
  if (next < 0) return progress
  const changed = applyPitcherChange(progress, defendingIsOurs, next, inScene)
  const game = progress.game
  return appendLog(
    inScene ? withScenePitcherChange(progress, changed, mound.entries[next]) : changed,
    `${game.inning}회${game.half} ${defendingIsOurs ? '우리' : '상대'} 투수 교체 — ${mound.pitcherIndex + 1}번 → ${next + 1}번`,
    false,
  )
}

/** 0xac428 의 최소 벤치 `[sp+0x58]` — 팀 경기 모드는 늘 0 (위 주석) */
const TEAM_GAME_MINIMUM_BENCH = 0

/** 교체 판정 · 새 투수 고르기가 함께 보는 경기 상황 — 원본 이닝은 0-기준이다 (state+0x6b) */
function changeSituationOf(game: TeamGameProgress['game'], defendingIsOurs: boolean) {
  const defenseScore = defendingIsOurs ? game.ourScore : game.opponentScore
  const offenseScore = defendingIsOurs ? game.opponentScore : game.ourScore
  return { lead: defenseScore - offenseScore, inningIndex: game.inning - 1, runnerCount: runnerCountOf(game.bases) }
}

function replacementPickInputOf(
  progress: TeamGameProgress,
  mound: MoundSide,
  situation: ReturnType<typeof changeSituationOf>,
  saveSituation: boolean,
): ReplacementPickInput {
  const { entries } = mound
  return {
    saveSituation,
    inningIndex: situation.inningIndex,
    lead: situation.lead,
    runnerCount: situation.runnerCount,
    currentStamina: mound.stamina,
    // 0xabfcc 는 벤치 투수 레코드의 +0x2c 를 견준다 — 경기 사이에 이어진 값이 그대로 들어간다
    benchStaminaOf: (index) => mound.staminas[index] ?? FULL_STAMINA,
    // 0xb8a8d · 0xabfcc 가 보는 마선수(0xb633c) — 명부의 마투수 칸
    benchIsSpecialPitcherAt: (index) => isAcePlayer(entries[index]),
    // 0xabfcc 의 보직 목록 (0xb6dec)
    benchRoleOf: (index) => entries[index]?.role,
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 경기용 능력치(체력 인자 90) 네 칸 합 — 시즌 내 팀 보정·팀 능력치·코치까지
    benchAbilitySumOf: (index) => pitcherAbilitySumOf(pitcherAbilitiesAt(progress, mound.teamId, index)),
  }
}

/** 3da88 "Time!" 22 → 0x16 진입 0x3d458 이 투수 교체 예약(team[+0x290])을 보고 +0x195c 비트1 → 0xe 등판음 */
function withScenePitcherChange(progress: TeamGameProgress, changed: TeamGameProgress, incoming: TeamEntryPitcher | undefined): TeamGameProgress {
  return {
    ...changed,
    scenePitcherChange: { serial: (progress.scenePitcherChange?.serial ?? 0) + 1, incomingIsAce: isAcePlayer(incoming) },
    substitutionScene: substitutionSceneAfter(changed, '투수', incoming?.aceIndex ?? -1),
  }
}
