import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollTeamSetup } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import { generalMatchInfoStage, rollStadiumNumber } from '@/features/play-team-game/model/sceneStadium'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import { createFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import { rollQuickStart } from '@/pages/general-mode/lib/quickStart'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'
import { readSetupRecord } from '@/pages/general-mode/model/setupRecord'

/**
 * `0x30f20` 의 굴림 넷 — 준비 기록의 마선수(`+0xe`·`+0xd`)가 상대 마선수 굴림의 입력이다.
 * 같은 함수가 0x310a8 에서 0xb6814(전역 상태)를 불러 +0x6b = 0 으로 둔다 (`liveGameState` — 상태 22 진입 3158c · 재굴림 끝 31290)
 */
export function rollsOf(setup: GeneralModeSetup, random: RandomPort): TeamSetupRolls {
  resetLiveGameState()
  return rollTeamSetup(setup.acePitcherId, setup.aceBatterId, random)
}

/**
 * **상태 22 진입 `0x314b0`** (이전 상태가 23 이 아닐 때 — 314c8 `cmp [메뉴+0x28], #0x17`):
 * ```
 * 3158c  모드 1 → 0x30f20 — 굴림 넷(`rollsOf`) · 310ec st+0x30 = (s8)rec+0xc
 * 315a8  옛 무대 [메뉴+0xb8] 버리기 → 315be new(0x94) → 0x76b25 → [메뉴+0xb8]
 * 315e4  0x78664(무대, (s8)st+0x30)            ; 구장 > 9 면 bfa55(0, 10) — 굴림 하나 더
 * 315f0  0xb6bdc(st, 1) · (st, 0) → 무대+0x80 · +0x84 · 3161a 무대+0xc = 표 0xce9d8[st+0x30]
 * 3161e  0x5fd04(스킨, 무대) — 경기정보 구장 미리보기
 * ```
 * 재굴림 끝(31290)은 0x30f20 만 부르고 무대를 새로 안 만든다 — 구장은 그때 안 굴린다(원본 그대로).
 */
/** 전역 모드 [0x1552d10] — 메뉴 하위 12 가 299ac 에서 1 로 적는다 (0x783b0 · 0x78490 이 본다) */
const GENERAL_MODE = 1

export function matchInfoEntryOf(
  setup: GeneralModeSetup,
  random: RandomPort,
): { readonly rolls: TeamSetupRolls; readonly stadium: number; readonly stage: MatchInfoStadiumState } {
  const rolls = rollsOf(setup, random)
  const stadium = rollStadiumNumber(random, setup.stadiumId)
  // 무대+0x80 · +0x84 = 0xb6bdc(st, 1) · (st, 0) — 0x30f20 이 앉힌 측 1 · 측 0 팀
  const side0TeamId = setup.playerSide === 0 ? setup.userTeamId : setup.aiTeamId
  const side1TeamId = setup.playerSide === 0 ? setup.aiTeamId : setup.userTeamId
  const placed = generalMatchInfoStage(stadium, setup.stadiumId)
  return {
    rolls,
    stadium,
    stage: {
      stadium: placed.stadium,
      fieldPalette: placed.paletteRow < 0 ? null : placed.paletteRow,
      // 0x5fd04 의 0x783b0 — 모드 1 은 0xb6bdc(st, 0) = 측 0 팀 mod 6
      skyRow: stadiumSkyRowOf({ mode: GENERAL_MODE, side0TeamId }) ?? 0,
      side0TeamId,
      side1TeamId,
      gameMode: GENERAL_MODE,
    },
  }
}

/** 첫 그림의 세션 값 — 22 로 시작하지 않으면 굴림 · 구장 · 무대가 없다 */
interface InitialGeneralMode {
  readonly flow: GeneralModeFlowState
  readonly rolls: TeamSetupRolls | null
  readonly stadium: number | null
  readonly stage: MatchInfoStadiumState | null
}

/**
 * 상태 22 진입 `0x314b0` — 빠른실행이면 기록을 통째로 굴리고(31500~31546), 모드 1 이면 이어서 **`0x30f20` 으로
 * 경기를 세운다**(3158c): 상대 마선수 둘 → AI 선발 → 사람 선발 굴림 넷 (`rollTeamSetup`). 원본은 경기 장면이
 * 아니라 여기서 굴리므로 경기정보·엔트리 편집(상태 23)이 이미 굴린 팀을 보고, OK 키(0x311a8)는 굴리지 않는다.
 */
export function initialGeneralModeOf(isQuickStart: boolean, random: RandomPort, openState: QuickStartOpenState): InitialGeneralMode {
  const created = createFlowState({
    isQuickStart,
    // 준비 기록 skin+0xbc 는 앱 전역이다 — 새로하기는 지난 판 기록에서 시작한다(`setupRecord`)
    setup: isQuickStart ? rollQuickStart(random, openState) : readSetupRecord(),
  })
  if (created.step !== GENERAL_MODE_STEP.경기정보) return { flow: created, rolls: null, stadium: null, stage: null }
  const entry = matchInfoEntryOf(created.setup, random)
  return { flow: created, rolls: entry.rolls, stadium: entry.stadium, stage: entry.stage }
}
