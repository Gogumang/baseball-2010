/**
 * **일반모드(원본 게임 모드 1) 준비 기록과 단계 상태기계** — R4 3a/3b 확정 · J-2.
 *
 * 원본은 메인 메뉴 장면 `0x103` 의 하위 상태 18~22 로 준비를 돌린다. 다섯 화면이 고친 값은
 * 모두 한 덩어리 **준비 기록** `skin([0x1552cfc]) + 0xbc` 16바이트에 들어간다:
 *
 * ```
 * +0    u32  유저 팀
 * +4    u32  AI 팀
 * +8    u32  선공 커서 (0 유저 선공 · 1 유저 후공)   ← 경기 옵션의 playerSide 와 같은 칸이다
 * +0xc  u8   구장
 * +0xd  u8   마타자 (0..4)
 * +0xe  u8   마투수 (0..4)
 * ```
 *
 * 갱신 함수들은 하나같이 첫머리에서 이 기록을 지역으로 복사하고 끝에서 되쓴다 — 그래서
 * 여기서도 **한 덩어리를 통째로 갈아 끼우는** 모양으로 둔다.
 */
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'

/** 준비 기록 = skin+0xbc 16바이트 (R4 3a) */
export interface GeneralModeSetup {
  /** +0 */
  readonly userTeamId: number
  /** +4 */
  readonly aiTeamId: number
  /** +8 — 0 유저 선공 · 1 유저 후공 */
  readonly playerSide: PlayerSide
  /** +0xc — 구장 번호 0..9 */
  readonly stadiumId: number
  /** +0xd — 마타자 0..4, 고른 것이 없으면 `NO_ACE` */
  readonly aceBatterId: number
  /** +0xe — 마투수 0..4, 고른 것이 없으면 `NO_ACE` */
  readonly acePitcherId: number
}

/**
 * 마선수 "없음". 빠른실행이 열린 마선수를 하나도 못 찾으면 표 `0xd7638[0] = −1` 을 넣는다
 * (J 1-2). 준비 화면은 u8 칸이라 원본에서는 0xff 로 들어가 있을 것이다.
 */
export const NO_ACE = -1

/** 구장은 0~9 열 칸뿐이다 — 상태 20 의 목록이 **10열 × 1줄**이고 히든 구장이 없다 (R4 3a) */
export const STADIUM_COUNT = 10

/** 마투수 5 · 마타자 5 (저장 +0x30..0x34 · +0x35..0x39) */
export const ACE_PER_ROLE = 5

/**
 * 새 저장에서 이미 열려 있는 마선수 — **웹판 저장에는 아직 마선수 오픈 플래그 칸이 없다**
 * (`mgr[0x30+idx]`, 전역 기록. `docs/re/S9-widgets.md` 1-4절 · `K-bursts-special.md` K-3:
 * "해금 id: 0~7 마선수 (…) **싸이커·메디카는 기본 개방**"). 나머지 8명은 기록 누계나 G 로 여는
 * 대상이라 그 저장 칸이 생기기 전에는 열 수 없다. 그동안은 원본과 같이 이 둘만 기본으로 튼다.
 *
 * 마투수 로컬 0 = 싸이커(전역 idx 0). `AceSelectScreen`/`GeneralModeScreen` 이 이 배열을
 * `openedAcePitcherIds` 기본값으로 받는다.
 */
export const DEFAULT_OPENED_ACE_PITCHER_IDS: readonly number[] = [0]

/**
 * 마타자 로컬 0 = 메디카(전역 idx 5). `DEFAULT_OPENED_ACE_PITCHER_IDS` 와 같은 근거다.
 */
export const DEFAULT_OPENED_ACE_BATTER_IDS: readonly number[] = [0]

/** 처음 열었을 때의 기록 — 저장이 0 으로 초기화되므로 전부 0 이다 */
export const INITIAL_SETUP: GeneralModeSetup = {
  userTeamId: 0,
  aiTeamId: 0,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  stadiumId: 0,
  aceBatterId: NO_ACE,
  acePitcherId: NO_ACE,
}

/* ── 단계 (메인 메뉴 하위 상태) ─────────────────────────────────────────────────── */

/** 메인 메뉴 장면 0x103 의 하위 상태 번호를 그대로 쓴다 (P6 1-2) */
export const GENERAL_MODE_STEP = {
  유저팀: 18,
  AI팀: 19,
  선공구장: 20,
  마선수: 21,
  경기정보: 22,
} as const

export type GeneralModeStep = (typeof GENERAL_MODE_STEP)[keyof typeof GENERAL_MODE_STEP]

/** 상태 20 의 하위 단계 `skin+0xcc` — 선공을 먼저 고르고 구장으로 넘어간다 */
export const FIRST_BAT_PHASE = { 선공: 0, 구장: 1 } as const
export type FirstBatPhase = (typeof FIRST_BAT_PHASE)[keyof typeof FIRST_BAT_PHASE]

/**
 * 상태 21 의 하위 단계 `[skin+0xd0]` — **마투수를 먼저** 고르고 마타자로 넘어간다.
 * 값이 거꾸로(마투수 = 1)인 것은 원본 그대로다: 이 칸은 A 딱지 그림도 고른다
 * (img_text 51 "마투수" / 50 "마타자", P6 2a-5).
 */
export const ACE_PHASE = { 마타자: 0, 마투수: 1 } as const
export type AcePhase = (typeof ACE_PHASE)[keyof typeof ACE_PHASE]

/** 마선수 화면 격자는 10칸이다 — 윗줄 0..4 마투수 · 아랫줄 5..9 마타자 (P6 2a-5) */
export function aceRoleOfCell(cell: number): AcePhase {
  return cell < ACE_PER_ROLE ? ACE_PHASE.마투수 : ACE_PHASE.마타자
}

/** 격자 칸 → 그 보직 안에서의 번호 0..4 */
export function aceIndexOfCell(cell: number): number {
  return cell < ACE_PER_ROLE ? cell : cell - ACE_PER_ROLE
}

/* ── 경기 옵션 만들기 ──────────────────────────────────────────────────────────── */

/**
 * 준비 기록 → `startTeamGame` 이 받는 옵션.
 *
 * - **모드 1** 이라 팀 능력치 보정은 탄다 (마스크 0x306 — `gameAbilities.isTeamAbilityMode`).
 * - `lineup` 을 넘기지 않는다: **일반모드에는 보직 벌점이 없다**. 설명서 StrHOWTO[8] 은
 *   "일반, 시즌, 대전모드 : 있음" 이라지만 코드에서 −20% 를 거는 곳은 시즌(0xb5844) 하나뿐이고
 *   일반·대전 쪽은 찾지 못했다 (J-4 · J 3절 "미해결"). **코드 쪽을 따른다**.
 * - `season` 도 없다 — 팀 질병·사기·코치는 모드 2 전용이다.
 *
 * - **마타자**(`+0xd`)는 경기 옵션으로 넘긴다 — 원본 경기 세우기 `0x30f20` 이 같은 칸으로
 *   `0xb8870(팀, k)` 를 불러 **벤치 첫 칸**에 넣는다 (`31046`). 타석에 서는 길은 대타뿐이다.
 *
 * ⚠️ 원본이 준비 화면에서 정하는 것 중 **구장**은 `TeamGameOptions` 에 받을 칸이 아직 없다.
 * 준비 기록에는 그대로 들고 있으니(화면에도 나온다) 옵션에 칸이 생기면 여기서 넘기면 된다.
 * - **마투수**(`+0xe`)도 같은 자리에서 `0xb88c8(팀, k)` 로 **투수 명단 8번 칸**에 들어간다
 *   (`31042`). 마타자의 9번과 칸이 다르다 — 마운드에 서는 길은 `#` 투수 교체뿐이다.
 */
export function teamGameOptionsOf(
  setup: GeneralModeSetup,
  extra: {
    readonly settings?: MatchProgressSettings
    readonly gaugeSettingOn?: boolean
    /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) — 사람이 공격일 때만 먹는다 (0xae690) */
    readonly runningModeManual?: boolean
    /** 환경설정 "송구" 가 수동인가 (설정 +0xf4) — 사람이 수비일 때만 먹는다 (0xae6c8) */
    readonly throwModeManual?: boolean
  } = {},
): TeamGameOptions {
  return {
    mode: TEAM_GAME_MODE.일반,
    ourTeamId: setup.userTeamId,
    opponentTeamId: setup.aiTeamId,
    playerSide: setup.playerSide,
    // 고른 마타자는 벤치 첫 칸으로 들어간다 (0xb8870). NO_ACE(−1)면 아무도 안 들어간다
    aceBatterId: setup.aceBatterId,
    // 고른 마투수는 투수 명단 8번 칸으로 들어간다 (0xb88c8). AI 팀 마투수(0x66968)의 입력이기도 하다
    acePitcherId: setup.acePitcherId,
    ...(extra.settings === undefined ? {} : { settings: extra.settings }),
    ...(extra.gaugeSettingOn === undefined ? {} : { gaugeSettingOn: extra.gaugeSettingOn }),
    ...(extra.runningModeManual === undefined ? {} : { runningModeManual: extra.runningModeManual }),
    ...(extra.throwModeManual === undefined ? {} : { throwModeManual: extra.throwModeManual }),
  }
}
