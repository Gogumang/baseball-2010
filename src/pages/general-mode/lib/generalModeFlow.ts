/**
 * **일반모드 준비 흐름** (메인 메뉴 장면 0x103 하위 상태 18 → 19 → 20 → 21 → 22 → 경기 장면 0x104).
 *
 * 흐름 자체는 StrHOWTO[6] 이 그대로 적어 둔 것이고(확정), 화면 사이를 오가는 조건은 R4 3a/3b 가
 * 각 갱신 함수에서 읽어 낸 것이다:
 *
 * ```
 * 18 유저 팀 ──OK──▶ 19 AI 팀 ──OK──▶ 20 선공 ─OK─▶ 20 구장 ─OK─▶ 21 마투수 ─OK─▶ 21 마타자 ─OK─▶ 22 경기정보 ─OK─▶ 경기
 *    ◀──CLR(나감)        ◀──CLR         ◀─CLR        ◀─CLR          ◀─CLR            ◀─CLR            ◀─CLR
 * ```
 *
 * ⚠️ **단계별 화면의 코드 자체는 J 가 "미해결" 로 남긴 자리다.** 여기 옮긴 것은 문구(StrHOWTO[6])와
 *    R4 가 갱신 함수에서 읽어 낸 키 처리뿐이고, 각 단계가 그림을 어떻게 굴리는지는 아직 모른다.
 */
import {
  ACE_PHASE,
  FIRST_BAT_PHASE,
  GENERAL_MODE_STEP,
  INITIAL_SETUP,
  aceIndexOfCell,
  aceRoleOfCell,
} from '@/pages/general-mode/lib/generalModeSetup'
import type {
  AcePhase,
  FirstBatPhase,
  GeneralModeSetup,
  GeneralModeStep,
} from '@/pages/general-mode/lib/generalModeSetup'
import type { PlayerSide } from '@/entities/game/model/gameState'

export interface GeneralModeFlowState {
  readonly step: GeneralModeStep
  readonly setup: GeneralModeSetup
  /** 상태 20 의 하위 단계 `skin+0xcc` */
  readonly firstBatPhase: FirstBatPhase
  /** 상태 21 의 하위 단계 `[skin+0xd0]` */
  readonly acePhase: AcePhase
  /** 빠른실행으로 들어왔는가 (메뉴+0x14c) — 경기정보의 `*` 재굴림과 CLR 이 이것을 본다 */
  readonly isQuickStart: boolean
}

export function createFlowState(
  options: { readonly setup?: GeneralModeSetup; readonly isQuickStart?: boolean } = {},
): GeneralModeFlowState {
  const isQuickStart = options.isQuickStart ?? false
  return {
    // 빠른실행은 1~6 단계를 건너뛰고 곧바로 경기정보(상태 22)로 들어간다 (StrHOWTO[6] · R4 3b)
    step: isQuickStart ? GENERAL_MODE_STEP.경기정보 : GENERAL_MODE_STEP.유저팀,
    setup: options.setup ?? INITIAL_SETUP,
    firstBatPhase: FIRST_BAT_PHASE.선공,
    acePhase: ACE_PHASE.마투수,
    isQuickStart,
  }
}

/* ── 앞으로 (OK) ──────────────────────────────────────────────────────────────── */

/** 상태 18 OK — 유저 팀을 적고 19 로. 잠긴 히든 팀 막기는 부르는 쪽(화면)이 한다 */
export function chooseUserTeam(state: GeneralModeFlowState, teamId: number): GeneralModeFlowState {
  return { ...state, setup: { ...state.setup, userTeamId: teamId }, step: GENERAL_MODE_STEP.AI팀 }
}

/**
 * 상태 19 OK — AI 팀을 적고 20 으로.
 * ⚠️ **유저 팀과 같은 팀인지 보지 않는다** (R4 3a 상태 19). 빠른실행의 "같은 팀끼리 경기" 와
 *    같은 원본 동작이다 — 고치지 않는다.
 */
export function chooseAiTeam(state: GeneralModeFlowState, teamId: number): GeneralModeFlowState {
  return {
    ...state,
    setup: { ...state.setup, aiTeamId: teamId },
    step: GENERAL_MODE_STEP.선공구장,
    firstBatPhase: FIRST_BAT_PHASE.선공,
  }
}

/**
 * 상태 20 단계 0 에서 좌·우 — 선공 커서 `skin+0x74` 만 뒤집는다.
 * 원본은 OK 때 `rec+8 = (skin+0x74 ≠ 0)` 로 옮겨 적지만, 커서와 기록이 같은 값이라 여기서는
 * 기록을 바로 고치고 단계만 안 옮긴다.
 */
export function moveFirstBat(state: GeneralModeFlowState, playerSide: PlayerSide): GeneralModeFlowState {
  return { ...state, setup: { ...state.setup, playerSide } }
}

/** 상태 20 단계 0 OK — `rec+8 = (skin+0x74 ≠ 0)` 을 적고 구장 단계로 */
export function chooseFirstBat(state: GeneralModeFlowState, playerSide: PlayerSide): GeneralModeFlowState {
  return { ...state, setup: { ...state.setup, playerSide }, firstBatPhase: FIRST_BAT_PHASE.구장 }
}

/** 상태 20 단계 1 에서 좌·우 — 구장 커서만 옮긴다 (커서가 곧 `rec+0xc` 다) */
export function moveStadium(state: GeneralModeFlowState, stadiumId: number): GeneralModeFlowState {
  return { ...state, setup: { ...state.setup, stadiumId } }
}

/** 상태 20 단계 1 OK — 구장을 적고 21 로. 마선수는 **마투수 먼저** 고른다 */
export function chooseStadium(state: GeneralModeFlowState, stadiumId: number): GeneralModeFlowState {
  return {
    ...state,
    setup: { ...state.setup, stadiumId },
    step: GENERAL_MODE_STEP.마선수,
    acePhase: ACE_PHASE.마투수,
  }
}

/**
 * 상태 21 OK — 격자 칸 하나.
 * 마투수 단계면 `rec+0xe` 를 적고 커서를 아랫줄(마타자)로, 마타자 단계면 `rec+0xd` 를 적고 22 로.
 * 칸 번호는 윗줄 0~4 마투수 · 아랫줄 5~9 마타자다.
 */
export function chooseAce(state: GeneralModeFlowState, cell: number): GeneralModeFlowState {
  const index = aceIndexOfCell(cell)
  if (aceRoleOfCell(cell) === ACE_PHASE.마투수) {
    return {
      ...state,
      setup: { ...state.setup, acePitcherId: index },
      acePhase: ACE_PHASE.마타자,
    }
  }
  return {
    ...state,
    setup: { ...state.setup, aceBatterId: index },
    step: GENERAL_MODE_STEP.경기정보,
  }
}

/* ── 뒤로 (CLR) ───────────────────────────────────────────────────────────────── */

/**
 * CLR 한 번. 더 뒤가 없으면 `null` 이다 — 원본은 모드 목록(하위 상태 5)으로 돌아간다.
 *
 * - 18 → 나감
 * - 19 → 18
 * - 20 구장 단계 → 선공 단계 (**고른 구장은 그대로 적어 둔다**) · 선공 단계 → 19
 * - 21 마타자 단계 → 마투수 단계 · 마투수 단계 → 20 (진입 함수가 단계를 선공으로 되돌린다)
 * - 22 → 빠른실행이면 나감, 아니면 21 의 **마타자 단계**(`[skin+0xd0] = 0`)
 */
export function stepBack(state: GeneralModeFlowState): GeneralModeFlowState | null {
  switch (state.step) {
    case GENERAL_MODE_STEP.유저팀:
      return null
    case GENERAL_MODE_STEP.AI팀:
      return { ...state, step: GENERAL_MODE_STEP.유저팀 }
    case GENERAL_MODE_STEP.선공구장:
      if (state.firstBatPhase === FIRST_BAT_PHASE.구장) {
        return { ...state, firstBatPhase: FIRST_BAT_PHASE.선공 }
      }
      return { ...state, step: GENERAL_MODE_STEP.AI팀 }
    case GENERAL_MODE_STEP.마선수:
      if (state.acePhase === ACE_PHASE.마타자) {
        return { ...state, acePhase: ACE_PHASE.마투수 }
      }
      // 상태 20 진입 0x23ed0 이 단계를 0(선공)으로 되돌리고 커서는 지난번 구장(rec+0xc)에서 시작한다
      return { ...state, step: GENERAL_MODE_STEP.선공구장, firstBatPhase: FIRST_BAT_PHASE.선공 }
    case GENERAL_MODE_STEP.경기정보:
      if (state.isQuickStart) return null
      return { ...state, step: GENERAL_MODE_STEP.마선수, acePhase: ACE_PHASE.마타자 }
    default:
      return null
  }
}

/** 빠른실행 `*` 재굴림 — 새로 굴린 기록을 끼워 넣는다 (R4 3b) */
export function withSetup(state: GeneralModeFlowState, setup: GeneralModeSetup): GeneralModeFlowState {
  return { ...state, setup }
}
