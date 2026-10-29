import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { nariSceneStadium, sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'

/**
 * 구장 · 점수판 두 측 — 점수판 틀 0x41440 의 두 측은 내 팀 PLAYER · 상대 COM.
 * 구장 객체 — 셋업 0x39fdc 모드 3 갈래: 홈(측 1) 팀, 국가대항전이면 풀리그 2 · 결승 8. 굴림 없음.
 * 수비 재생 · 중계 바탕(0x35218)은 수비 구장 +0xc 줄, 정산 결과 배경은 타석 구장 +0x70 · +0xc 로 그린다
 */
export function pitcherBackdropOf(options: PitcherGameOptions) {
  const scoreboardSides = humanVsComputerSidesOf(options.playerSide, options.ourTeamId, options.opponentTeamId)
  const homeTeam = options.playerSide === PLAYER_SIDE_FIRST_BAT ? options.opponentTeamId : options.ourTeamId
  const sceneStadium = nariSceneStadium(homeTeam, options.nationalCupStage ?? null)
  const grassPalette = sceneFieldPaletteOf(sceneStadium)
  return { scoreboardSides, sceneStadium, grassPalette }
}

/** 하늘 줄 = 구장 +0x10 — 0x783b0 모드 3: 나리 저장 +0xb2(리그 날짜 g) mod 6, 굴림 없음 */
export const pitcherSkyRowOf = (options: PitcherGameOptions) => stadiumSkyRowOf({ mode: PITCHER_CAREER_MODE, dayCounter: options.dayCounter }) ?? 0
