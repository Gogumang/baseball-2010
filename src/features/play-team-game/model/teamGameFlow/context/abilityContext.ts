import type { TeamGameAbilityContext } from '@/features/play-team-game/model/teamGameRoster'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { inGameFightingSpiritStateOf, isFightingSpiritSituationOf } from '@/shared/lib/liveGameState/liveGameState'
import { teamRecordMoraleOf, teamRecordMoraleAfterBurst } from '@/entities/team/model/teamMorale'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import { DEFAULT_TEAM_MORALE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 화면이 보는 능력치 ───────────────────────────────────────────────────────── */

export function abilityContextOf(options: TeamGameOptions): TeamGameAbilityContext {
  return {
    mode: options.mode,
    // 내 팀 보정 셋(질병·보직·사기)은 시즌모드에서만 붙는다 (0xb581a).
    // 비교 대상은 [시즌+1] = 시즌 팀 번호다 (0xb5804) — 국가대항전의 대한민국(10)과는 안 맞는다
    seasonTeamId: options.mode === TEAM_GAME_MODE.시즌 ? seasonTeamIdOf(options) : -1,
    season: options.season,
    teamAbilities: options.teamAbilities,
    lineup: options.lineup,
    aceLevels: options.aceLevels,
  }
}

/**
 * 투수 능력치를 낼 때의 문맥 — `abilityContextOf` 에 **스킬 14(투지) 갈래의 경기 상태**(0xb570c b5a4c~b5a66)를 더한다.
 * 경기 장면은 전역 상태 [0x1552d0c] 자체를 굴리므로 지금 판의 이닝(+0x6b) · 측별 팀(+0x28) · 점수(+0x7e)를 본다(A-23).
 */
export function pitcherAbilityContextOf(progress: TeamGameProgress): TeamGameAbilityContext {
  const state = inGameFightingSpiritStateOf(progress.options, progress.game)
  return {
    ...abilityContextOf(progress.options),
    fightingSpiritOf: (teamId) => isFightingSpiritSituationOf(state, teamId),
  }
}

/** 시즌 팀 번호 `[시즌+1]` — 안 넘기면 내 팀이 곧 시즌 팀이다 (정규·포스트시즌) */
function seasonTeamIdOf(options: TeamGameOptions): number {
  return options.seasonTeamId ?? options.ourTeamId
}

/**
 * 스태미나 용량이 보는 **내 팀 사기** — `0x66e44(V, 투수, 첫투수)` 의 `V+2`.
 *
 * `V` 는 소모 `0xaeb08` 이 `0x1f9a9(g, 모드, 팀+0x25)` 로 얻는 **투수 팀의 팀 레코드**다.
 * 팀 번호 비교(`0xb5804`) 같은 건 없고 그냥 그 팀 레코드의 +2 를 읽는다. 모드 2 가지
 * `0x1f570` 은 국가대항전 중(`S+0x12c` ≠ 0)이면 팀 10 을 리그 배열이 아닌 **대표팀 슬롯
 * `base+0x918`** 로 돌린다 (1f58a~1f59c). 그 슬롯은 대회를 시작할 때 `0xb7bf0 → 0x205c0` 이
 * 마스터 팀 데이터(XlsTEAM_DATA)에서 새로 만들어 사기가 **원본 표값 100** 이다 (S6 2-2).
 *
 * 그래서 시즌 팀으로 치는 경기만 시즌 사기(팀 레코드 +2)를 쓰고, 국가대항전의 대한민국은 표값을 쓴다.
 *
 * **일반모드(1)**: `0x1f9d2` → `0x1f874` = `[g+0xb0]+0x5c8+0x1c·칸`(칸 = 팀 ≠ `[g+0xb0]+0x29`). 두 칸은 경기정보 `0x30f20` 이
 * `0x213c0(g, 1, 0)` 뒤 두 팀마다 `0x1f8c0`(마스터 팀 레코드) 을 `0x1fdb0(g, 0x34, …)` 로 걸어 두면 `0x21d30` 이 `0x1fe5c` 로
 * 통째 복사한다 — 경기마다 새 표값이다. 이 칸 +2 에 쓰는 곳은 없다(`0xa3a44` 는 `0x1f988` 이 모드 3·4 칸만, `0x8e3dc` 는 모드 2 만).
 * **대전(8·9)**: `[g+0xc0]`·`[g+0xc4]` 칸은 `0x316dc` 가 통신 버퍼(net+0x2b9)에서 `0x1fe5c` 로 채운다 — 🌐 서버 값. 웹은 표값으로 둔다.
 */
export function ourTeamMoraleOf(options: TeamGameOptions): number {
  if (options.mode === TEAM_GAME_MODE.시즌) {
    if (seasonTeamIdOf(options) !== options.ourTeamId) return teamRecordMoraleOf(options.ourTeamId)
    return options.season?.morale ?? DEFAULT_TEAM_MORALE
  }
  // 일반모드 — 경기마다 마스터에서 복사한 칸이다. 대전은 🌐 서버 값이라 표값으로 둔다
  return options.season?.morale ?? teamRecordMoraleOf(options.ourTeamId)
}

/**
 * 스태미나 용량이 보는 **상대 팀 사기** — 같은 `0x66e44(V, 투수, 첫투수)` 의 `V+2`. `V` 는 소모 `0xaeb08` 이
 * `0x1f9a9(g, 모드, 팀+0x25)` 로 얻는 **던지는 팀의 팀 레코드**라 상대 투수면 상대 팀 레코드다 (P1 3-2, 내 팀과 같은 길).
 *
 * 모드별 레코드(`0x1f9a8` → 점프표 0xcd7e0, 직접 떴다): 1 `0x1f9d2` → `0x1f874`(`[g+0xb0]` 두 칸) · 2 `0x1f570`(리그 배열,
 * 국가대항전 중이면 상대국 슬롯 `base+0x934`) · 8 `0x1f890`(`[g+0xc0]`) · 9 `0x1f8a8`(`[g+0xc4]`).
 * 시즌의 상대(CPU 팀) 레코드 +2 를 바꾸는 곳은 없다 — 사기를 쓰는 곳은 모두 `SR[1]`(내 팀) 레코드다(P4 4a · 6절 "팀 사기
 * 변화 모음"). 상대국 슬롯은 대회마다 마스터 팀 표(XlsTEAM_DATA)에서 새로 복사한다(S6 2-1). 그래서 표값(둘째 u16, 전 팀 100)이다.
 * 일반모드 `[g+0xb0]+0x5c8` 두 칸은 경기정보 `0x30f20` 이 경기마다 마스터 팀 레코드(`0x1f8c0`)를 통째 복사한 것이라 표값이다
 * (`ourTeamMoraleOf` 참고). 대전모드 `[g+0xc0]`·`[g+0xc4]` 는 `0x316dc` 가 통신 버퍼에서 채운다 — 🌐 서버 값이라 표값으로 둔다.
 */
export function opponentTeamMoraleOf(options: TeamGameOptions): number {
  return options.opponentTeamMorale ?? teamRecordMoraleOf(options.opponentTeamId)
}

/**
 * 시즌모드(2) 돌발 보상 · 페널티의 **사기(종류 1)를 경기 중에** 팀 레코드 +2 에 먹인다 — 0x8e34c 모드 2 갈래 8e3c8~8e404 · 8e4ca~8e506
 * (직접 떴다):
 * ```
 * 8e3d2  r0 = 0x1f55d(저장) = SR ; 8e3e8 r0 = 0x1f9a9(저장, [장면+0x22a](모드 2), SR[1])   ; → 0x1f570
 * 8e3f0  v = ldrsh [r0, #2] + 양 ; 0x64 넘으면 0x64 · 0 밑이면 0 ; 8e404 strh [r0, #2]
 * 1f58a  S+0x12c ≠ 0(국가대항전) 이면 팀 == 10 → base+0x918 · 그 밖 → base+0x934 ; 아니면 base+4+0x1c·팀
 * ```
 * SR[1] 은 리그 팀(0~9)이라 정규 · 포스트시즌은 **내 팀 레코드**(`season.morale` — 0xb570c 시즌 갈래의 사기 감소 b58ac 와 내 투수
 * 용량이 읽는 칸), 국가대항전 중은 **그날 상대국 슬롯**(`opponentTeamMorale` — 상대국 투수 용량이 읽는 칸)이다. 다음 공부터 그 값을 본다.
 * 시즌모드가 아니면(나리는 커리어 쪽이 따로 센다) 그대로 둔다.
 */
export function withSeasonBurstMorale(options: TeamGameOptions, deltas: readonly BurstRewardDelta[]): TeamGameOptions {
  if (options.mode !== TEAM_GAME_MODE.시즌 || !deltas.some((delta) => delta.name === '사기')) return options
  if (seasonTeamIdOf(options) !== options.ourTeamId) {
    return { ...options, opponentTeamMorale: teamRecordMoraleAfterBurst(opponentTeamMoraleOf(options), deltas) }
  }
  const season = options.season
  if (season === undefined) return options
  return { ...options, season: { ...season, morale: teamRecordMoraleAfterBurst(season.morale, deltas) } }
}
