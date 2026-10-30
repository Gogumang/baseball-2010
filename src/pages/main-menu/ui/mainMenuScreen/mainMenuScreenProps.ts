import type { ReactNode } from 'react'
import type { GameStartCursor, MainMenuOpenTier, NariGameReady } from '@/pages/main-menu/model/mainMenu'

export type GameMode = '미션' | '홈런더비' | '시즌모드' | '일반모드' | '일반모드빠른실행' | '일반모드경기이어하기'

export interface MainMenuScreenProps {
  readonly hasSavedGame: boolean
  /** 전역기록 +0x4d — 일반모드 경기가 중간 저장돼 있다. [13] 처음 커서·[15] 확인·이어하기가 본다. 안 넘기면 없음 */
  readonly isGeneralGameInProgress?: boolean
  /** 전역기록 +0x3c — 마지막으로 시작한 모드. [최근게임] 이 이 값으로 갈라진다(0x28d54). 안 넘기면 새 저장 기본값 1 */
  readonly lastPlayedMode?: number
  /** 나만의리그 [14] 에서 편을 골랐다 — 원본은 그 편 커리어가 있으면 이어하고 없으면 팀 고르기로 간다(0xf684) */
  readonly onNewGame: (edition: '타자편' | '투수편') => void
  /**
   * 나리 두 편의 `전역기록 +0x40+m && +0x4c+m` — [14]·[최근게임] 의 0x327b8 모드 3·4 갈래가 곧장 경기로 갈지 본다.
   * 안 넘기면 둘 다 거짓(늘 장면 0x106)
   */
  readonly nariGameReady?: NariGameReady
  /** 그 갈래의 곧장 경기 — 0x213c0(앱, m, 0) → 장면 0x104. 안 넘기면 `onNewGame` 으로 간다 */
  readonly onResumeNariGame?: (edition: '타자편' | '투수편') => void
  readonly onSelectMode: (mode: GameMode) => void
  /** 원작 처음 메뉴의 [도움말] (StrMAINMENU[2]) — 하위 7 */
  readonly onHelp: () => void
  /**
   * 원작 처음 메뉴의 [게임문의] (StrMAINMENU[209]) — 하위 10. 진입 0x2668c 가 도움말 뷰어를 장 6 쪽 보기로 열고
   * `[뷰어+0x45c]` = 1 로 장 이동을 잠근다(오프라인). 안 넘기면 OK 해도 아무 일 없다
   */
  readonly onInquiry?: () => void
  /** 원작 처음 메뉴의 [환경설정] (StrMAINMENU[3]) */
  readonly onSettings: () => void
  /** 원작 처음 메뉴의 [스페셜] (StrMAINMENU[1]) */
  readonly onSpecial: () => void
  /**
   * 처음 메뉴(하위 4)에 들어선 지 **열 번째 갱신** — 갱신 0x29454 가 상태 틱 `[this+0x2c] == 10`(0xbc9c8 이 상태가 같으면
   * 1 씩 올리고 바뀌면 0 으로 되돌리는 칸)일 때 전부 수집 보상 판정 0x28e98 을 부른다(0x2951e~0x29536).
   * 아랫단(하위 5)으로 내려가면 틱이 끊기고 돌아오면 다시 센다.
   */
  readonly onTopMenuTenthTick?: () => void
  /** 메뉴 위에 얹는 것 — 전부 수집 보상 팝업 0x292f8 */
  readonly overlay?: ReactNode
  /**
   * 전역 G(`mgr+0x64`) — 두 단 그리기가 다 맨 끝에 머리띠 0x54d95 를 부른다:
   *   윗단(하위 4) 0x2866c = `0x24b1c` → `0x54d95(skin, 0, 1)` · 아랫단(하위 5) 0x2863c = `0x24b1c` → `0x2524c(this, 5, 틱)` → `0x54d95(skin, 0, 5)`.
   * 제목 0 "2010프로야구" 라 G포인트(0x54a60)도 그린다(0x550dc). 바닥 1 은 비트 0x4 가 없어 **뒤로 표시가 없고**(띠·탭만),
   * 바닥 5 는 뒤로 표시가 있다. 안 넘기면 예전처럼 머리띠를 안 그린다.
   */
  readonly gamePoint?: number
  /**
   * 장면을 세울 때의 첫 단 — 전역 `[0x140006c]`(생성자 0x234d4). 5 면 게임시작 목록에서 열고 바탕 띠 연출을 켠다
   * (나리 · 시즌 관리 메뉴 취소가 5 를 넣는다). 안 넘기면 4(처음 메뉴)
   */
  readonly openTier?: MainMenuOpenTier
  /** 게임시작 목록 커서 전역 [0x1552d24] — 루트가 들고 다닌다. 안 넘기면 첫 단 5 도 0 칸에서 열고 적지 않는다 */
  readonly gameStartCursor?: GameStartCursor
  /**
   * 처음 메뉴 바퀴 커서 `[this+0xe8]` — 장면 객체 값이라 같은 장면 안(스페셜·도움말·환경설정·랭킹·게임문의)을 다녀오면
   * 그 칸에 서고, 장면을 새로 세우면(0x104~0x107 을 다녀옴) 0 이다. 루트가 들고 다닌다. 안 넘기면 늘 0 칸
   */
  readonly topMenuCursor?: GameStartCursor
  /**
   * `openTier` 5 로 서되 생성자를 안 지난 것 — 같은 장면의 하위 16·17(홈런더비·미션 선수 고르기)에서 CLR 로 돌아왔다.
   * 띠 `[0xe4]` 는 내려올 때 이미 다 자랐으므로 펼쳐진 채로 선다
   */
  readonly isBandGrown?: boolean
  /**
   * 머리띠가 미끄러져 내려오는가 (`ScreenFrame` 의 `slides`, [skin+0x84]). 메뉴 장면에서 +0x84 = 1 을 쓰는 들어옴은
   * 표 0xcf06c 의 3 · 8(조건) · 15 · 16 · 17 · 25~29 · 32 · 33 · 34(조건) · 37 과 타이틀 갱신 0x245f8 인데, 두 단(하위 4 · 5)을
   * 그리는 것은 0x245f8 → 하위 4 뿐이다 — 하위 4 들어옴 0x24a40 · 5 들어옴 0x25b88 · 생성자 0x234d4 는 +0x84 를 안 쓴다.
   * 그래서 타이틀에서 왔을 때만 참이다. 하위 3 들어옴 0x258fc 가 세운 것은 타이틀 그림 0x2cbac 가 머리띠를 안 그려 0x245f8 까지 남는다.
   * 다른 하위 상태(15 · 16 · 17 …)가 세운 미끄러짐은 그 화면에서 다 내려온 뒤 돌아오므로 메뉴에서는 안 미끄러진다.
   * 그 화면이 미끄러짐을 다 끝내기 전(+0x86 이 30 에 닿기 전, 그림 대여섯 장)에 돌아오면 원본은 남은 미끄러짐을 메뉴에서 잇는다 —
   * +0x84 · +0x86 은 앱에 하나인 전역 스킨 칸이다(메인 메뉴 [this+0x120] = [0x1552cfc], 생성자 0x234d4 의 23620~23634, r166 확인).
   * 웹도 머리띠가 `shared/lib/skinFrameSlide` 의 전역 칸을 그리므로 거짓이면 그 남은 걸음을 잇는다(r168). 안 넘기면 거짓
   */
  readonly headerSlides?: boolean
}
