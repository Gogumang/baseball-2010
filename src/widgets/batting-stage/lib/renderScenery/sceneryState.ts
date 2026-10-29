/** 타석 배경 그리기(`drawScenery`)의 재료 — 시즌 구장 세 칸과 장면 값 */

/**
 * 시즌 구장 그리기에 들어가는 세 값 — 구장 객체 `+0x88`(관중석 칸) · `+0x89`(관중 단계) ·
 * `+0x8a`(전광판 칸). 경기 시작 준비 `0x353ac~0x353e6` 이 시즌 기록에서 옮겨 담는다 (R6 1절, **확정**).
 *
 * ⚠️ **잔디는 그 세 칸에 없다.** 잔디 칸(`SR[0x1ba]`)은 프레임이 아니라 바닥 그림
 *    (`구장+0x2c` = `stadium/attack`, 그리는 곳 `0x7725c`)의 **팔레트**를 갈아 끼운다
 *    (`0x786c8(구장, 칸 − 1, 1)` → `.mpl` 줄 `2 − 칸`, S3 문서 · `grassPaletteRowOf`).
 *    같은 경기 준비 묶음이 같은 조건(시즌 홈경기)에서 걸므로 `grassPalette` 로 같이 받는다.
 *    `+0x89` 는 잔디가 아니라 **관중 수 그림 단계**다.
 */
export interface SeasonStadium {
  /**
   * 관중석 칸 0~6 (구장+0x88 ← `SR[0x1b8]` = `record.stadiumEquipped[0]`).
   * 0~3 은 `fence_season.pzf` 의 `칸 × 5` 묶음, 4~6 은 히든이라 `hidden_fence_(칸−4)` 로 파일이 갈린다.
   */
  readonly stand: number
  /**
   * 관중 그림 단계 (구장+0x89). 프레임은 `관중석×5 + 값 + 1` 이고 그림 뜻은
   * **0 빈 좌석 · 1 적음 · 2 보통 · 3 만원** 이다 (R6 1절).
   *
   * 원본이 넣는 값은 장면마다 다르다 — 시즌 홈경기 `0x353ca` 는 **만원 판정 `SR[0x65]`(0/1/2) + 1**,
   * 대전 모드 `0x3543c·0x35496` 은 **3** 고정, 구장관리 미리보기 `0x629a` 등은 **0** 이다.
   * 만원 판정은 `관중 ≥ 수용×80% → 2 · > 35% → 1 · 그 밖 0` (J 4-7).
   */
  readonly crowd: number
  /** 전광판 칸 0~6 (구장+0x8a ← `SR[0x1b9]` = `record.stadiumEquipped[1]`). 4~6 은 `hidden_board_(칸−4)` */
  readonly board: number
  /**
   * 바닥 그림 `stadium/attack` 의 `.mpl` 줄 = `2 − 잔디 칸` (`0x786c8`). **null 이면 기본 팔레트**다.
   *
   * 칸 0 거친인조잔디 → 줄 2(누런 올리브) · 1 인조잔디 → 줄 1(청록) ·
   * 2 천연잔디 → 줄 0(짙은 녹색) · 3 특급천연잔디 → null(PZX 기본, 밝은 녹색).
   * 구장 객체 생성자 `0x76ace` 가 `[구장+0xc] = −1` 이라 **시즌 홈경기가 아니면 기본색**이다.
   */
  readonly grassPalette: number | null
}

export interface SceneryState {
  /** 하늘 표 행 (0~5) */
  readonly skyRow: number
  /** 하늘 칸 — 구장 +0x14 = min(경기 상태 +0x6b, 12), 0부터 (`skyColumnOfInning`) */
  readonly skyColumn: number
  /** 타석 화면이 열린 뒤 흐른 틱 — 하늘 조명 애니 · (아래 `scoreboardTick` 이 없으면) 전광판 글자 흐름 */
  readonly tick: number
  /**
   * 전광판 글자 셈 — 이 장면에서 배경을 처음 그린 그림이 0 (`sceneCloudClock.sceneScoreboardTickOf`, 구장 +0x8c 의 시작값 자리).
   * 생략하면 `tick`
   */
  readonly scoreboardTick?: number
  /**
   * 구름 흐르기 0x78448 이 센 부름 수(`cloudScrollAt` 의 `calls`) — 경기 장면 동안 이어지는 셈(`model/sceneCloudClock`).
   * 생략하면 0(구름 칸 처음 자리 — 0x78448 을 안 부르는 미리보기 0xb158 따위)
   */
  readonly cloudCalls?: number
  /**
   * 구장 번호 = 구장 객체 +0x70. 모드 1·8·9 는 장면 셋업 0x39fdc 가 st+0x30 으로(9 보다 크면 rand(0, 10)), 3·4 는 홈 팀 ·
   * 대회 2/8, 7 은 내 팀, 시즌 대회는 0x352e8 이 2/8 로 채운다(`features/play-team-game/model/sceneStadium`).
   * 시즌 정규 · 미션은 생성자 값 0 이다
   */
  readonly stadium: number
  /**
   * 바닥 그림 팔레트 줄 = 구장 객체 +0xc (0x76b6c). `seasonStadium.grassPalette` 가 있으면 그쪽이 먼저다. null · 생략이면 기본색
   */
  readonly fieldPalette?: number | null
  readonly ourTeamId: number | null
  readonly opponentTeamId: number | null
  /** 타자 손 (0 우타 · 1 좌타). 우타면 펜스 묶음이 좌우로 뒤집힌다. 없으면 좌타 배치다 */
  readonly side?: number
  /**
   * 환경설정 전광판(+0x3a) — OFF 면 전광판 흐르는 글자를 그리지 않는다 (0x77726, R2-game-effects.md 6절).
   * `BattingStage` 의 `isScoreboardOn` 이 그대로 내려온다. 생략하면 켠 것으로 본다.
   */
  readonly isScoreboardOn?: boolean
  /**
   * 시즌 구장 전광판 글자 x 이동 = 구장 **+0x8c** 그대로. 있으면 `tick` 대신 이 값을 쓴다 — 구장관리·상점 미리보기는 장면 구장의
   * 칸을 직접 들고 흘린다(`stepSeasonScoreboardX`). 생략하면 `scoreboardScrollX(상자 폭, tick)`.
   */
  readonly scoreboardX?: number
  /**
   * 차 있으면 배경을 **시즌 구장 그리기 0x77494** 로 그린다 (전광판 칸이 여기서 온다).
   *
   * 원본 배경 고르기 `0x40ff0` 은 **모드 2(시즌)이고 내 팀 == 홈팀**이거나 **모드 8·9(대전)** 일 때만
   * 0x77494(하늘+구장+바닥+0x84490) 로 가고, 그 밖에는 0x78578(하늘+0x77974+바닥+0x78490) 로 간다.
   * 그래서 이 칸이 비어 있으면 아래쪽 일반 경기 길(0x77974, fence.pzf 한 벌)로 그린다.
   *
   * 시즌 경기는 `app/ui/SeasonRoute.tsx` 가 `seasonStadiumOf(record)` 를 `TeamGameScreen → BattingStage` 로 내려 준다
   * (홈경기·대전일 때만 — 0x40ff0 의 갈림).
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * 게임 모드(전역 `0x1552d10`). 하늘 조명 0x78490 이 **모드 5·6(미션)·7(홈런더비)** 에서는 안 그린다
   * (0x784a2~0x784b0). 생략하면 그 셋이 아닌 것으로 본다. `BattingStage` 의 `gameMode` 가 그대로 내려온다.
   */
  readonly gameMode?: number
  /**
   * **세로 밀기** — `0x78578(구장, y, 움직임)` 의 둘째 인자. 구장 `0x77974`(위 = 구장+8 + y + 3)와
   * 바닥 `0x7725c`(위 = 구장+8 + y + 0xe2)에만 더해지고 하늘·구름 `0x77fe8` 은 안 움직인다.
   * 하늘 조명 `0x78490` 은 이 값이 0 이 아니면 안 그린다(784b8 `cmp r1,#0`). 타석에서는 늘 0 이다.
   * 결과 창(상태 0x1a, `0x45c18`)이 장면 +0x17e2 를 넘긴다. 생략하면 0.
   */
  readonly offsetY?: number
  /**
   * **0x13 타석 카메라가 옮긴 만큼** (`hitCamera.stageCameraShiftOf`) — 0x41230 이 구장 +0xf10 자리(구장+4 · +8)에 (+0xff4, +0xff8) 을
   * 적으므로 하늘 띠(0x77fe8 이 구장+8 에서) · 구름 · 펜스 묶음 · 바닥이 함께 옮겨진다. 하늘 조명 0x78490 은 화면 오른쪽 위(화면 폭에서
   * 잰다)라 그대로다. 생략하면 (0, 0)
   */
  readonly cameraShift?: { readonly dx: number; readonly dy: number }
}
