import type { RandomPort } from '@/shared/api/random/randomPort'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { type SceneStadium, seasonNationalCupSceneStadium, rollSceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { isVersusMode } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoProgressCost'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { savePointOf } from '@/features/play-team-game/model/teamGameFlow/setup/savePoint'
import { teamGameStartPointOf } from '@/features/play-team-game/model/teamGameFlow/setup/startPoint'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

export function startTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameProgress {
  const initial = teamGameStartPointOf(options, random)
  // 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번 (모든 모드 — 마선수·선발 굴림 0x30f20 뒤, 1회초 판 0x18 보다 앞)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 경기 장면의 패턴 덱을 섞는다(상태 9 의 시뮬 초기화보다 앞)
  openScenePatternDeck(random)
  // 상태 9 의 3f856 0x39fdc — 구장 객체 둘 (모드 1·8·9 갈래 3a076, 시뮬 초기화 3fa0e 앞)
  const scene: TeamGameProgress = { ...initial, sceneStadium: sceneStadiumOf(options, random) }
  rollSimulatorInit(random)
  // 경기정보 OK(0x3136e)가 0x30f20 이 세운 두 팀·st 를 저장 블록에 두고 파일을 쓴다 — 이어하기의 첫 자리다
  return advance({ ...scene, halfInningSave: savePointOf(scene) }, random)
}

/**
 * 장면 셋업 0x39fdc 의 구장 객체 — 모드 1·8·9 갈래(점프표 0xcfef8[1·8·9] = 0x3a076)만 st+0x30 으로 채운다.
 * 다른 모드 갈래(시즌 · 나리 · 미션 · 더비)는 이 칸을 안 쓰므로 웹도 null 로 둔다.
 */
export function sceneStadiumOf(options: TeamGameOptions, random: RandomPort): SceneStadium | null {
  // 시즌 국가대항전 — 0x39fdc 모드 2 갈래는 구장을 안 건드리고 상태 8 경기 준비 0x352e8(35318~3538c)이 2 · 8 로 놓는다.
  // 상수라 굴림이 없어 여기서 같이 채운다(난수열 그대로)
  if (options.mode === TEAM_GAME_MODE.시즌) {
    return options.nationalCupStage === undefined ? null : seasonNationalCupSceneStadium(options.nationalCupStage)
  }
  if (options.stadiumId === undefined) return null
  if (options.mode !== TEAM_GAME_MODE.일반 && !isVersusMode(options.mode)) return null
  return rollSceneStadium(random, options.stadiumId)
}
