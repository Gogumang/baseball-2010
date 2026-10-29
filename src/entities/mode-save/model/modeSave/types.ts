/**
 * **모드 저장 칸** — 원본 전역기록(`0x1f1d9(저장)`) 의 두 칸과 일반모드(모드 1) 저장 블록 하나를 담는다.
 *
 * ## +0x3c 마지막 모드 (0x28d54 [최근게임] 이 읽는다)
 * 쓰는 곳은 셋뿐이다(전역기록 0x1f1d9/0x1f1d8 뒤 `+0x3c` 쓰기 전수, 2026-10-06):
 * - 0x327b8(this, m) 머리 `327e8 str r1, [기록, #0x3c]` — 메인 메뉴 상태 0x27 의 진입 0x32988 이 부르는 모드 시작.
 *   나만의리그 [14](13 → 3·4) · 시즌(14 → 2) · 홈런더비 고르기(16 → 7) · 미션 고르기(17 → 5·6) · [최근게임] · 일반 [13] 이어하기가 거친다.
 * - 0x328de — 0x327b8 의 모드 7 갈래가 한 번 더 7.
 * - 0x31360 — 일반모드 경기정보(상태 22) OK: `+0x3c = this+0x13c`(= 1, 상태 12 진입 0x23dd0 이 넣는다).
 *
 * ## +0x4c + 모드 = 그 모드 경기 중간 저장 있음 — 일반모드는 +0x4d
 * 1 쓰기: 경기정보 OK 0x3136e · [최근게임]/[13] 이어하기의 0x327b8 모드 1 갈래 0x3282a. 0 쓰기: 경기 끝 정산 진입 0x4ea0c(0x4f3d6).
 * (나리 새 선수 0x112c0 도 0 을 쓰지만 모드 3·4 칸이다.) 경기 중 메뉴 "나가기"는 칸을 안 건드린다 — 그래서 나가도 이어하기가 남는다.
 *
 * ## +0x4f · +0x50 — 나리 투수편(모드 3)·타자편(모드 4) 경기 중간 저장 있음
 * 1 쓰기: 142 확인 0x13cb6(0x13cca, 모드 = 장면+0xcc) · 경기 장면 셋업 0x39fdc 의 모드 3·4 갈래(0x3a342 — 두 팀을 세운 뒤
 * `0x22755(저장, 1)`). 0 쓰기: 104 등록 확정 0x10fb4(0x112c0, +0x40+m = 1 과 함께) · 경기 끝 정산 진입 0x4ea0c(0x4f3d6 —
 * 모드를 가리지 않는다) · 모드 저장 지우기 0x224ec(저장, 3|4)(0x225ca · 0x22602 — +0x43/+0x44 와 함께. 부르는 곳: 모드 초기화
 * 0x2c9bc · 0x2c9c4, 명예의 전당 등록 0x62d7c · 0x62dbe). 경기 중 "메인메뉴로"(경기 상태 0x22 → 장면 0x103)는 안 건드린다.
 * 읽는 곳: 0x327b8 의 모드 3·4 갈래(3289c~328b0) — [14] 편 고르기(0x2464c)와 [최근게임](0x28d54)이 함께 지난다.
 * `(+0x40+m && +0x4c+m)` 이면 `0x213c0(앱, m, 0)` 으로 그 편 저장을 올려 곧장 경기 장면 0x104(0x32904 → 0x2a328(this, 0x104)),
 * 아니면 0x140006c = 0x69 · 장면 0x106(나리 관리 — 셋업 0xf684 → 상태 100 0x1c154 이어하기). 경기 장면 셋업 0x39fdc 의 모드 3·4
 * 갈래는 나리 저장(장면+0xf08 리그)으로 **새 경기**를 세운다 — 나리 경기는 반 이닝 저장(0x4f928, 모드 1·2·8·9 만)이 없어
 * 중간 블록이 없다. 그래서 "곧장 경기" 는 그만둔 그 경기를 처음부터 다시 연다(같은 일정·같은 명부).
 *
 * 그 명부에는 142 진입 0x1c46c 가 굴려 넣은 마선수가 있다 — 0xb88c8 · 0xb8870 이 저장 블록의 나리 팀 레코드에 넣고 142 확인이
 * 저장한다(`pages/management` 의 `nariMatchPrepare` 머리글). 웹은 그 레코드가 없어 142 확인 때 굴린 마선수를 `match` 에 함께
 * 남긴다(⚠️ 웹 전용 그림자 — 모르는 꼴로 담고 읽는 쪽이 가려 낸다).
 *
 * ## 모드 1 저장 블록
 * 경기정보 OK 와 반 이닝 자동 저장 0x4f928 이 파일에 쓰는 그 블록(두 팀 · 경기 상태 · 팀 레코드 · 기록달성 횟수 — 근거는
 * `features/play-team-game` 의 `TEAM_GAME_RESUME_SAVE`). 이 칸은 그 진행을 **모른 채로**(unknown) 담기만 한다 —
 * 읽어서 경기로 세우는 것은 페이지(`pages/general-mode`)의 몫이다.
 *
 * ## +0x12c+0 계열 — 일반모드(m = 0) 경기진행 설정 · +0x11e 설정 창 본 표시
 * 일반모드 경기정보 22 의 설정 창은 열 때 0x5fef4 가 m = 0 칸에서 읽고, 확인 0x60376 이 되쓰고 0x1f1b9 가 파일에 남긴다 —
 * 그래서 다음 판 · 다음 실행에도 남는다. +0x11e 는 22 진입 0x3163c~0x31688 과 시즌 0xdd 진입 0x6548 이 **같은 칸**을 본다:
 * 0 이면 설정 창을 저절로 열고 1 을 쓴 뒤 저장한다 — 두 모드 중 먼저 들어간 쪽에서 한 번만 뜬다.
 * 시즌 칸 m = 1 도 같은 전역기록이다(`seasonMatchSettings` — 시즌 0xdd 의 '0' 창 확인이 되쓰고 0x1f1b9 로 남긴다). 시즌 파일 지움
 * 0x224ec(2) 이 안 건드려 시즌을 새로 해도 남는다.
 */
export interface ModeSave {
  /** 전역기록 +0x3c — 마지막으로 시작한 모드 (새 저장은 1 — 생성자 0x9f26c) */
  readonly lastPlayedMode: number
  /** 전역기록 +0x4d — 일반모드 경기가 중간 저장돼 있다 */
  readonly isGeneralGameInProgress: boolean
  /** 모드 1 저장 블록 — 마지막으로 파일에 쓴 경기 진행. 없으면 null */
  readonly generalGame: unknown
  /** 전역기록 +0x4f(모드 3 나리 투수편) · +0x50(모드 4 나리 타자편) */
  readonly nariGames: Readonly<Record<NariLeagueMode, NariGameSave>>
  /**
   * **나간 마선수 대결의 결과 이벤트 대기** — 모드 4(타자편) g[0xec] · g[0xee](결과 이벤트 이김 · 짐) · g[0x11f](대기) · g[0x144](결과
   * 바이트), 모드 3(투수편) g[0x170] · g[0x172] · g[0x176] · g[0x177]. 없으면 null (`withAceMatchHeld` 머리 주석).
   */
  readonly aceMatchPending: Readonly<Record<NariLeagueMode, readonly number[] | null>>
  /**
   * **결과 바이트** g[0x144](타자편) · g[0x177](투수편) — 이겼는가. SYS 8 이 0(짐)으로 적고, 정산 진입 0x4ea0c 의 4efc6~4f018 이
   * **그 편 대기가 서 있으면 어느 미션이든** 그 판의 성공 여부([미션+0xbc])로 덮어쓴다 — 대기 중 보통 미션을 깨면 이긴 것이 된다
   * (원본 그대로). 140 진입 0x10df8 이 이 값으로 resultEvents[이김 ? 0 : 1] 을 고르고 0 으로 지운다.
   */
  readonly aceMatchWon: Readonly<Record<NariLeagueMode, boolean>>
  /**
   * **g[0xf6]** — SYS 8 이 0x8d836~0x8d846 에서 적는 그때 모드(나리 투수편 3 · 타자편 4), 140 진입 0x10df8 이 0 으로 지운다
   * (10efe 타자편 · 10f56 투수편 갈래 모두). 대기가 서 있는 동안 미션이 사람 칸 팀(0xaa57c aa6e0)과 결과 판 뒤 돌아갈 장면
   * (0x407f0 4090c · 0x4b100 4b344)을 이 값으로 고른다. 없으면 0.
   */
  readonly aceMatchMode: number
  /** 전역기록 +0x12c+0 · +0x146+0 · +0x120 · +0x124 · +0x128 · +0x12a — 일반모드 경기진행 설정 (새 저장은 이닝 · 전체) */
  readonly generalMatchSettings: ModeMatchSettings
  /** 전역기록 +0x11e — 경기진행 설정 창을 한 번 봤는가 (일반 22 · 시즌 0xdd 가 함께 본다) */
  readonly matchSettingsSeen: boolean
  /**
   * 전역기록 +0x12c+1 · +0x146+1 · +0x120+2 · +0x124+2 · +0x128+1 · +0x12a+1 — **시즌모드 경기진행 설정** (m = 1).
   * null 은 웹이 이 칸을 이곳에 두기 전(2026-10-26) 저장이다 — 그때는 시즌 저장 `matchSettings` 가 들었다. 시즌 세션이 그 값을
   * 이리로 옮긴다(`useSeasonSession` 의 이사). 둘 다 없으면 새 저장 값(이닝 · 전체)이다
   */
  readonly seasonMatchSettings: ModeMatchSettings | null
}

/**
 * 경기진행 설정 한 모드 칸 — `features/play-team-game` 의 `MatchProgressSettings` 와 같은 꼴(엔티티는 기능 층을 못 읽어
 * 여기 따로 적는다)
 */
export interface ModeMatchSettings {
  /** +0x12c+m — 0 찬스 · 1 이닝 · 2 상세 */
  readonly kind: number
  /** +0x146+m */
  readonly value: number
  /** +0x120+2m */
  readonly battingOrderBits: number
  /** +0x124+2m */
  readonly pitchingInningBits: number
  /** +0x128+m */
  readonly offenseRunnerBits: number
  /** +0x12a+m */
  readonly defenseRunnerBits: number
}

/**
 * 새 저장의 경기진행 설정 — 생성자 0x9f26c 의 0x9f404~0x9f42c 가 m = 0 · 1 모두 +0x12c+m = 1(이닝) · +0x146+m = 0(전체) ·
 * 상세 비트 0 을 넣는다(직접 떴다)
 */
export const NEW_SAVE_MATCH_SETTINGS: ModeMatchSettings = {
  kind: 1,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

/** 나만의리그 모드 — 3 투수편 · 4 타자편 */
export type NariLeagueMode = 3 | 4

export interface NariGameSave {
  /** 전역기록 +0x4c + 모드 — 그 편 경기가 중간 저장돼 있다 */
  readonly isInProgress: boolean
  /** ⚠️ 웹 전용: 142 확인 때 두 팀 명부에 들어간 것(마선수 · 국가대항전 여부). 원본은 나리 저장의 팀 레코드 안. 없으면 null */
  readonly match: unknown
}

export const NO_NARI_GAME: NariGameSave = { isInProgress: false, match: null }

/**
 * **새 저장의 +0x3c = 1(일반모드)** — 전역기록 생성자 `0x9f26c` 가 `0x9f334 str r5(=1), [this, #0x3c]` 로 넣는다
 * (같은 자리에서 +0x40..+0x4b · +0x4c..+0x57 은 memset 0). 앱 시작 0x20138 이 new(0xe44) → 0x9f26c → [mgr+0xac] 에 두고
 * 0xe44 바이트를 0 으로 민 뒤 `game_o.sav` 를 읽는데(0x202c6 `0x1f0ec`), 파일이 없으면(−1) 0x9f26c 를 **다시** 불러
 * 기본값을 세우고 곧바로 쓴다(0x202ce~0x202dc `0x1f1b8`). 그 뒤 +0x3c 를 쓰는 곳은 0x327e8 · 0x328de · 0x31360 셋뿐이다.
 * 그래서 처음 켠 게임의 [최근게임] 은 모드 1 갈래 — +0x4d 가 0 이라 하위 12 [13](앞 상태 0x27 → 커서 1)이 뜬다.
 */
export const NEW_SAVE_LAST_PLAYED_MODE = 1

/** 새 저장(파일 없음) — 생성자 0x9f26c 의 값 */
export const EMPTY_MODE_SAVE: ModeSave = {
  lastPlayedMode: NEW_SAVE_LAST_PLAYED_MODE,
  isGeneralGameInProgress: false,
  generalGame: null,
  nariGames: { 3: NO_NARI_GAME, 4: NO_NARI_GAME },
  aceMatchPending: { 3: null, 4: null },
  aceMatchWon: { 3: false, 4: false },
  aceMatchMode: 0,
  generalMatchSettings: NEW_SAVE_MATCH_SETTINGS,
  // 생성자 0x9f26c 가 +0x11e 를 건드리지 않고 앞서 0xe44 바이트를 0 으로 민다 — 0
  matchSettingsSeen: false,
  // 생성자는 m = 1 에도 새 저장 값을 넣지만, 웹은 옛 시즌 저장의 값을 옮겨 올 자리로 비워 둔다(읽는 쪽이 새 저장 값으로 본다)
  seasonMatchSettings: null,
}
