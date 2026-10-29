import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { PlayerSide } from '@/entities/game/model/gameState'
import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import type { SeasonEntryLists } from '@/entities/season-mode/model/seasonEntry'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'

export interface UseGeneralModeOptions extends QuickStartOpenState {
  readonly random: RandomPort
  /** 메인 메뉴에서 **빠른실행**을 잡고 들어왔는가 (메뉴+0x14c) */
  readonly isQuickStart?: boolean
  /**
   * 전역기록에서 읽어 온 경기진행 설정 (모드 칸 m = **0**, 일반모드 — 창을 열 때 0x5fef4 가 이 칸에서 복사한다).
   * 안 넘기면 `FULL_PLAY_SETTINGS`(이닝 · 전체) — 새 저장의 값이다(생성자 0x9f26c 의 0x9f404~0x9f42c).
   */
  readonly initialSettings?: MatchProgressSettings
  /** 설정 창 확인 0x60376 — 받는 쪽이 전역 m = 0 칸에 되쓰고 저장한다(0x1f1b9). 다음 판 · 이어하기가 이 값을 읽는다 */
  readonly onSettingsConfirm?: (settings: MatchProgressSettings) => void
  /**
   * 전역기록 +0x11e 손잡이 — 22 진입 0x3163c~0x31688: 모드 1 이고 0 이면 설정 창을 저절로 열고(0x5fef5(skin, 1))
   * 1 을 쓴 뒤 저장한다. 시즌 0xdd 진입 0x6548 과 같은 칸이다. 안 넘기면 저절로 열지 않는다
   */
  readonly matchSettingsSeen?: MatchSettingsSeenSlot
  /** 환경설정 "투구 게이지" (설정 +0x2d) — 원본 기본값은 꺼짐 */
  readonly gaugeSettingOn?: boolean
  /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) */
  readonly runningModeManual?: boolean
  /** 환경설정 "송구" 가 수동인가 (설정 +0xf4) — 사람이 수비하는 타석에서만 먹는다 (0xae6c8) */
  readonly throwModeManual?: boolean
  /** 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`) — 경기 옵션 `aceLevels` 로 그대로 넘긴다 */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **모드 1 저장 블록을 새로 세운 경기로 덮어쓴다** (+0x3c · +0x4d 는 안 건드린다) — 경기정보 OK 없이도 쓴다:
   * - 상태 22 들어옴·`*` 재굴림 끝의 `0x30f20` — 30f70 `0x213c0(앱, 1, 0)` → 30f92 `0x1fdec` → 31100~3112c
   *   `0x1fdb0(저장, 0x32, 팀, 0/1)` · `(저장, 0x33, st, 0)` → 31134 `0x22755(저장, 1)`(파일 쓰기) → 3113c `0x1f1b9`
   * - 상태 23 엔트리 편집 나감 `0x2a370` — 2a3d6 두 팀 `0xb8769` → 2a428~2a456 같은 칸 0x32 · 0x33 → 2a45a `0x22755(저장, 1)`
   *
   * +0x4d 를 0 으로 쓰는 곳은 정산 진입(0x4f3d6) 하나라, 이어하기가 살아 있던 채로 새로하기 → 22 → OK 없이 나가면
   * [최근게임]·[13] 이어하기가 방금 세운 1회초 0:0 경기를 연다(원본 버그 B-30 — 고친 길(기본)은 OK 전에는 부르지 않는다).
   */
  readonly onMatchBlockWrite?: (block: TeamGameProgress) => void
}

/** 전역기록 +0x11e 한 칸 — 읽기 · 1 쓰기(저장까지) */
export interface MatchSettingsSeenSlot {
  readonly read: () => boolean
  readonly markSeen: () => void
}

/** 상태 23 엔트리 편집 한 판 (편집 객체 [메뉴+0x120]) */
export interface GeneralModeEntryEdit {
  /** 메뉴+0xec — 1 유저 팀(편집 가능) · 0 CPU 팀(보기 전용) */
  readonly isUserTeam: boolean
  readonly teamId: number
  readonly editor: EntryEditorState
  readonly lists: SeasonEntryLists
  /** 마선수를 고르려 해서 StrTEXT 0xd200c 팝업이 떠 있다 */
  readonly isAceLocked: boolean
}

export interface GeneralModeSession {
  readonly flow: GeneralModeFlowState
  /** 상태 23 엔트리 편집 — 그 화면이 아니면 null */
  readonly entryEdit: GeneralModeEntryEdit | null
  /** 경기정보 "선발" 줄의 유저 팀 값 — 0x30f20 의 0↔k 뒤(엔트리 편집이 고쳤으면 그것)의 투수 0번 (0x5e0e8) */
  readonly userStarterName: string | null
  /** 경기정보 CPU 칸 — 0x30f20 이 세운 AI 팀의 선발·마선수. 상태 22 밖이면 null */
  readonly cpuMatchInfo: CpuMatchInfo | null
  /**
   * 22 진입 `0x314b0` 이 새로 만든 무대(메뉴+0xb8)의 구장 +0x70 — `0x78664(무대, st+0x30)` (`rollStadiumNumber`).
   * 경기정보 구장 미리보기 `0x5fd04` 가 그리는 구장이다 — 웹은 `matchInfoStage` 로 떠 둔 바탕을 `MatchInfoStadiumBackdrop` 이 그린다.
   * 상태 22 에 들어온 적이 없으면 null
   */
  readonly matchInfoStadium: number | null
  /**
   * 그 무대로 0x5fd04 가 떠 둔 경기정보 바탕(`MatchInfoStadiumBackdrop`) — 구장 · 표 0xce9d8[st+0x30] 줄 · 하늘 줄 · 두 팀 아이콘.
   * 22 진입 때 한 번 떠 두므로 재굴림이 팀 · 기록을 바꿔도 그대로다(원본 그대로). 22 에 들어온 적이 없으면 null
   */
  readonly matchInfoStage: MatchInfoStadiumState | null
  readonly settings: MatchProgressSettings
  /** 경기 장면(0x104)으로 넘어갔는가 */
  readonly isPlaying: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) */
  readonly isSettingsOpen: boolean
  /** `*` 재굴림이 도는 중인가 (skin+0xf4) — 그동안 경기정보 키를 안 받고(0x312b6) 바닥이 0x44 다 */
  readonly isRespinning: boolean
  /** 지금 기록으로 만든 경기 옵션 */
  readonly gameOptions: TeamGameOptions
  readonly actions: {
    readonly selectUserTeam: (teamId: number) => void
    readonly selectAiTeam: (teamId: number) => void
    readonly moveFirstBat: (side: PlayerSide) => void
    readonly selectFirstBat: (side: PlayerSide) => void
    readonly moveStadium: (stadiumId: number) => void
    readonly selectStadium: (stadiumId: number) => void
    readonly selectAce: (cell: number) => void
    /** `*` — 빠른실행 결정사항을 다시 굴린다 */
    readonly respin: () => void
    readonly openSettings: () => void
    readonly closeSettings: () => void
    readonly applySettings: (next: MatchProgressSettings) => void
    readonly start: () => void
    /** CLR. 더 뒤가 없으면 `false` 를 돌려준다 — 부르는 쪽이 모드 목록으로 나가면 된다 */
    readonly back: () => boolean
    /** 경기정보 '4'/왼(유저 팀, 메뉴+0xec = 1) · '6'/오른(CPU 팀, 0) → 상태 23 (0x311a8) */
    readonly openEntry: (isUserTeam: boolean) => void
    /** 상태 23 의 키 — 편집기 0x55864, 끝 코드면 22 로 (0x2a370) */
    readonly pressEntryKey: (key: EntryKey) => void
    /** 상태 23 — 웹 전용, 줄을 눌러 커서를 옮긴다 */
    readonly pointEntryCursor: (index: number) => void
    /**
     * 상태 23 의 한 틀 — 메인 메뉴 틀(0x32fa0 → 0x32634)이 갱신 0x2a370 으로 틀마다 0x55864 를 불러 키 셈 [ed+0x40c] 이 오른다
     * (기본 표는 넘기는 열이 셋이라 밀기는 없다)
     */
    readonly frameEntry: () => void
    readonly closeEntryAceLocked: () => void
  }
}
