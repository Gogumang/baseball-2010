import type { Screen } from '@/app/model/screen'
import type { AceMatchHoldPort } from '@/entities/mode-save/model/modeSave'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { Collection } from '@/entities/collection/model/collection'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import type { GameStartCursor, NariGameReady } from '@/pages/main-menu/model/mainMenu'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'

/** 화면 갈래 하나가 받는 화면 — 그 갈래의 `kind` 로 좁힌 것 */
export type ScreenOf<K extends Screen['kind']> = Extract<Screen, { readonly kind: K }>

export interface EntryRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly collection: Collection
  readonly random: RandomPort
  /** 전역 G 지갑 (원본 `mgr[+0x64]`) — 홈런더비 결과창의 "보유 G" 가 이 값이다 (0x461f2) */
  readonly wallet: GamePointWalletSession
  /** 스페셜 마선수 선택(상태 28)이 쓰는 마선수 오픈·레벨 저장과 두 동작 (앱이 일반모드와 같이 쓴다) */
  readonly aceSelect?: {
    readonly openedAcePitcherIds: readonly number[]
    readonly openedAceBatterIds: readonly number[]
    readonly levels: Readonly<Record<number, number>>
    readonly onOpenAce: (cell: number) => void
    readonly onLevelUp: (cell: number, cost: number) => void
  }
  /** 기록연감 사건 — 홈런더비 결과의 획득 G 통계(0x22c7d)를 남긴다. 안 넘기면 안 남긴다 */
  readonly recordStat?: (event: AnnalsStatEvent) => void
  /** `0x62368(ui, k, 0)` 열기 + 공용 창 알림 — 홈런더비 누적 비거리 히든 39 */
  readonly openHidden?: (id: number, then?: (() => void) | null) => boolean
  /** 스페셜 명예의 전당 "슬롯에서 삭제" — 앱이 기록연감·시즌 명단 정리를 묶어 넘긴다 */
  readonly hallOfFameDeletion?: HallOfFameDeletion
  /**
   * 전부 수집 보상 판정·지급(0x28e98 → 0x292f8) — 줄 것이 있으면 지급까지 마치고 팝업 글을, 없으면 null.
   * 메인 메뉴 처음 단 열 번째 갱신에 부르고, 팝업을 닫으면 곧바로 다시 부른다([this+0x2c] = 9 → 다음 갱신 10).
   */
  readonly claimCollectionReward?: () => string | null
  /** 스페셜 에디트(상태 29)의 이름 저장 0xaa4ad + 파일 저장 0x1f1b9 — 앱의 에디트 이름표 고리. 안 넘기면 에디트 칸이 안 열린다 */
  readonly onRenamePlayer?: (id: number, isPitcher: boolean, name: string) => void
  /** 환경설정 → 모드 초기화 → 에디트 초기화 0x204c1 (이름표 memset) — 앱의 에디트 이름표 고리 */
  readonly onResetEditedNames?: () => void
  /**
   * 환경설정 → 모드 초기화 나리 칸 — 고르기 창 답 → 0x224ec(mgr, 타자편 4 / 투수편 3). 앱이 그 편 저장·+0x4c+m 을 지우고
   * 시즌 내 팀에서 그 편 나리 선수를 뺀다(0x223a8). 안 넘기면 타자편·투수편 모두 타자편 저장 지우기(예전 동작).
   */
  readonly onResetCareerEdition?: (edition: CareerResetEdition) => void
  /** 같은 칸의 시즌 중 막기 — `0xb5054(내 시즌 팀, 편) && +0x4e` 면 그 글([212] / 투수편 [213]) */
  readonly careerResetBlockOf?: (edition: CareerResetEdition) => string | null
  /** 시즌모드 초기화 0x224ec(mgr, 2) */
  readonly onResetSeason?: () => void
  /**
   * 일반모드 진입 창 [13](하위 12 0x296f0)에서 새로하기(상태 18) · 빠른실행(this+0x14c = 1 → 상태 22)을 골랐다.
   * 앱이 빠른실행 여부를 일반모드 화면에 넘긴다. 안 넘기면 새로하기처럼 들어간다.
   */
  readonly onStartGeneralMode?: (isQuickStart: boolean) => void
  /** 전역기록 +0x4d — 일반모드 경기 중간 저장 있음 (메인 메뉴 [13]·[15]·[최근게임]) */
  readonly isGeneralGameInProgress?: boolean
  /** 전역기록 +0x3c — 마지막 모드 ([최근게임] 0x28d54) */
  readonly lastPlayedMode?: number
  /** 모드를 시작했다 — 0x327b8 머리의 +0x3c = 모드 (나리 [14] 3·4 · 시즌 2 · 홈런더비 고르기 7) */
  readonly onLastPlayedMode?: (mode: number) => void
  /** 일반모드 이어하기 — 상태 0x27 → 0x327b8(this, 1) → 0x213c0(앱, 1, 0) → 장면 0x104 */
  readonly onResumeGeneralGame?: () => void
  /** 나리 두 편의 `전역기록 +0x40+m && +0x4c+m` (+0x4f · +0x50) — [14]·[최근게임] 의 모드 3·4 갈래 */
  readonly nariGameReady?: NariGameReady
  /** 그 갈래의 곧장 경기 — 0x213c0(앱, m, 0) 으로 그 편 저장을 올려 장면 0x104 */
  readonly onResumeNariGame?: (edition: '타자편' | '투수편') => void
  /**
   * 나간 마선수 대결 대기 칸(`entities/mode-save` — g[0x11f] · g[0x176] · g[0xf6]). 홈런더비의 타자 게터 0x1fc20 이 g[0x11f] 를 본다
   * (`derbyHallOfFameBatterIndexOf`). 안 넘기면 대기 없음
   */
  readonly aceMatchHold?: AceMatchHoldPort
  /** 게임시작 목록 커서 전역 [0x1552d24] — 앱이 들고 다닌다(메인 메뉴가 다시 마운트돼도 남는다). 안 넘기면 늘 0 칸 */
  readonly gameStartCursor?: GameStartCursor
  /** 켤 때 로고(하위 2) 상태 2 끝의 `0x6ea6d(소리, 0, −1, 0)` — 로고 음성 0. 안 넘기면 소리 없이 */
  readonly onLogoVoice?: () => void
}
