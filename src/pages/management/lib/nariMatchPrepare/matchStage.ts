import type { RandomPort } from '@/shared/api/random/randomPort'
import { placedMatchInfoStadium } from '@/features/play-team-game/model/sceneStadium'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'

/** 구장 번호가 그대로인 팀의 끝 — 기본 열 팀 0~9 (0x78664 의 `cmp r1, #9`) */
const LAST_HOME_STADIUM_TEAM = 9
/** 히든 팀 홈이면 고르는 구장 수 — `bfa55(0, 10)` */
const STADIUM_COUNT = 10

/**
 * 142 진입의 구장 `0x78664(무대, 홈 팀)` (1c7c6, 이전 상태가 143 이 아니면 — 장면+0x288 과 상관없이 들어올 때마다):
 * ```
 * 78664  홈 팀 ≤ 9 → 무대+0x70 = 홈 팀  /  그 밖 → 무대+0x70 = bfa55(0, 10)
 * ```
 * 나리 정규·포스트시즌 팀은 0~9 라 굴리지 않고, 국가대항전(10~13)만 한 번 굴린다. 웹은 구장 그림이 없어 값은 버린다.
 */
export function rollNariMatchStadium(random: RandomPort, homeTeamId: number): number {
  if (homeTeamId <= LAST_HOME_STADIUM_TEAM) return homeTeamId
  return random.rand(0, STADIUM_COUNT)
}

/**
 * **142 경기정보 바탕의 무대** — 142 진입 0x1c46c(1c7ae~1c87c, 이전 상태가 143 이 아니면):
 * 무대 new · `0x78664(무대, 홈 팀)`(`rollNariMatchStadium`) · +0x80/+0x84 = 측 1 · 측 0 팀 · `0x78688(무대, 홈 팀, 1)`(표 0xd377c 줄) ·
 * `0x5fd04(스킨, 무대)` — 하늘 줄은 0x783b0 모드 3·4 = 나리 저장 +0xb2(리그 날짜 · 대회 중엔 대회 날짜) mod 6.
 * 그리기는 나리 틀 0x16928 이 142~144 면 `0x581dc(스킨, 0, 0)` 으로 떠 둔 그림을 찍는다(`MatchInfoStadiumBackdrop`).
 */
export function rollNariMatchInfoStage(
  random: RandomPort,
  match: {
    readonly mode: number
    readonly myTeamId: number
    readonly opponentTeamId: number
    /** 내 팀의 측 — 1 이면 홈(후공) */
    readonly mySide: number
    /** 나리 저장 +0xb2 */
    readonly dayCounter: number
  },
): MatchInfoStadiumState {
  const side1TeamId = match.mySide === 1 ? match.myTeamId : match.opponentTeamId
  const side0TeamId = match.mySide === 1 ? match.opponentTeamId : match.myTeamId
  const placed = placedMatchInfoStadium(rollNariMatchStadium(random, side1TeamId))
  return {
    stadium: placed.stadium,
    fieldPalette: placed.paletteRow < 0 ? null : placed.paletteRow,
    skyRow: stadiumSkyRowOf({ mode: match.mode, dayCounter: match.dayCounter }) ?? 0,
    side0TeamId,
    side1TeamId,
    gameMode: match.mode,
  }
}
