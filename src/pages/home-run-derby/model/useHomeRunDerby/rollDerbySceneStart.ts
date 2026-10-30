import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { DERBY_NO_BATTER_SAVE_TEAM_ID } from '@/entities/home-run-derby/model/derbyRules'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { rollDerbySceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { SKY_ROW_COUNT } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * **홈런더비 경기 시작 굴림** — 상태 7 진입 0x39f88 의 로딩 팁 rand(0, 73)(`rollSceneLoadingTip`) · 상태 7 갱신 0x3e340 의 덱 1275 ·
 * 효과 객체 1202(`openScenePatternDeck`) 뒤, 상태 9 갱신 0x3f584 의 공통 꼬리 차례 그대로:
 * ```
 * 3f856  0x39fdc(scene, 7)  → 모드 7 갈래 3a43e:
 *          3a44e  r7 = (s8) 0x1f8d5(저장, 4)+1          ; 내 타자편 팀 — 저장이 없으면 0 (`DERBY_NO_BATTER_SAVE_TEAM_ID`)
 *          3a454  v = rand(0, 9) → sp+0x18 ; v == r7 이면 9   ; 상대 팀 — 0xb6bd5(ctx, 1, v) · 팀 객체 0xb891c
 *          3a476  0x78664(타석 구장, r7) · 3a496 0x788d4(수비 구장, r7) ; r7 > 9 면 rand(0, 10) 둘 (`rollDerbySceneStadium`)
 * 3fa0e  0xc0dac 시뮬 초기화 → c0df6 rand(0, 2)          ; `rollSimulatorInit` (dcfcef7)
 * ```
 * 그 **뒤** 상태 8 경기 적재(0x48658 의 48774 → 구장 준비 0x352e8(354d2) → 0x783b0)가 하늘 줄 rand(0, 6) 을 굴린다 — 모드 7 은 0x783b0 의
 * 그 밖 갈래다(`stadiumSkyRowOf`). 돌려주는 값이 이 장면의 하늘 줄(구장 +0x10 = 값 mod 6)이다.
 * 차례: 갱신 표 0x52e2a 7 → 0x3e340 · 0x52e3a 9 → 0x3f584 · 0x52e32 8 → 0x48658, 예약 3efe6(상태 7 끝) → 9 · 3fa5e(상태 9 끝) → 8.
 * 뽑은 상대 팀 v(`opponentTeamId`)는 수비 팀이다 — 단계 0 투수가 그 마스터 팀의 투수 줄 2 다(`derbyPitcherOf` · `DERBY_ORDINARY_PITCHER_ROW`).
 * 돌려주는 `loadingTipIndex` 는 로딩 판이 그릴 팁 칸(`LOADING_TIPS` — StrTIP[1 + +0x315]), `skyRow` 는 하늘 줄이다.
 * `stadium` 은 두 구장 객체다 — 타석 +0x70 이 펜스 프레임, +0xc 가 바닥 팔레트 줄(0x352e8 모드 7 은 그 밖 갈래라 안 덮는다).
 */
export function rollDerbySceneStart(
  random: RandomPort,
  myTeamId: number = DERBY_NO_BATTER_SAVE_TEAM_ID,
): {
  readonly loadingTipIndex: number
  readonly skyRow: number
  readonly opponentTeamId: number
  readonly stadium: SceneStadium
} {
  // 상태 7 진입 0x39f88 → 0x53dbc — 로딩 팁 rand(0, 73). 모드를 안 가려 더비도 장면마다 맨 앞에 한 번 (`rollSceneLoadingTip`)
  const loadingTipIndex = rollSceneLoadingTip(random)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 장면의 패턴 덱을 섞는다(상태 9 의 3a454 보다 앞)
  openScenePatternDeck(random)
  // 3a454 v = rand(0, 9) (0~8) — 3a45a `cmp r7, r0` 내 팀과 같으면 9
  const rolledTeam = random.rand(0, 9)
  const opponentTeamId = rolledTeam === myTeamId ? 9 : rolledTeam
  // 3a476 · 3a496 — 내 팀 r7 로 두 구장 (팀 > 9 면 rand(0, 10) 둘, 0~9 면 굴림 없음)
  const stadium = rollDerbySceneStadium(random, myTeamId)
  rollSimulatorInit(random)
  // 상태 9 끝 3fa5e 가 예약한 상태 8 경기 적재 — 하늘 줄 rand(0, 6)
  return { loadingTipIndex, skyRow: random.rand(0, SKY_ROW_COUNT), opponentTeamId, stadium }
}
