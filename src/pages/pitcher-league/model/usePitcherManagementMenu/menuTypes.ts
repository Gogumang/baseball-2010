import type { MenuItem } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherTrainingPresentation } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import type { DetailRow } from './otherSlices'

/**
 * 투수편 관리 화면 상태 기계의 공개 모양 — 원본 장면 0x106 의 상태 **105(허브) · 106(선수정보) · 107(트레이닝)**
 * 과 그 아래 창들(119·121·122·123·124·108). 동작은 `usePitcherManagementMenu` 머리말을 본다.
 */
export type PitcherMenuKind = '관리' | '선수정보' | '트레이닝' | '아이템'
/**
 * 하위 창 — 원본 상태 119 · 123 · 108 · 124 · 122(아이템/스킬) 자리. 108 은 탭으로 둘이다 — 1 마구(`'마구훈련'`) · 2 구질(`'구질훈련'`).
 */
export type PitcherMenuWindow = '기본정보' | '구질목록' | '구질훈련' | '마구훈련' | '기록실' | '아이템/스킬' | null

export interface PitcherMenuQuestion {
  readonly text: string
  readonly onYes: () => void
}

/** 팝업 0x78(구질/마구)처럼 두 갈래를 고르는 상자 */
export interface PitcherMenuChoice {
  readonly text: string
  readonly labels: readonly [string, string]
  readonly onChoose: (index: number) => void
}

/**
 * 상세 결과 창(0x872a1) — 능력치 훈련·휴식 뒤에 뜬다. 닫을 때 할 일은 원본 콜백 그대로:
 * 훈련 0x1d63c → 부상 0x1b4c4 · 휴식 0x1d671 → 회복 0x1b308.
 */
export interface PitcherMenuDetail {
  readonly rows: readonly DetailRow[]
  readonly messages: readonly string[]
  readonly afterClose: () => void
}

export interface UsePitcherManagementMenuInput {
  readonly career: PitcherCareer
  readonly random: RandomPort
  /** 훈련·휴식·구질훈련으로 바뀐 커리어를 저장한다 */
  readonly onSave: (career: PitcherCareer) => void
  /** [다음경기] — 원본 109 → 142 → 144 → 경기 장면 0x104 */
  readonly onNextGame: () => void
  /** [외출] 상태 112 */
  readonly onOuting: () => void
  /**
   * 111 상점('장착' 장비 · '서브' · 'GP') · 121 장비착용('착용') 을 연다.
   * [아이템] 은 먼저 110 하위 메뉴를 띄우고, 거기서 고른 칸이 창 종류가 된다 (키 0x11478, 모드 갈림 없음).
   */
  readonly onOpenShop: (tab: PitcherShopTab) => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
  /**
   * 화면이 '관리' 인 채 **105 에 다시 들어온다** — 하위 메뉴 106 · 107 · 110 취소, 훈련 결과 창(125 → 0x1b5b8) · 휴식(127 →
   * 0x1b466) · 마구 훈련(125) 뒤. 세션이 진입 0x11910 곁가지와 자동 훑기 0x1cf9c 를 돈다(상태가 바뀐 틀에만 — 0x1cdec 1ce02).
   * `from` 은 그 앞 상태(125 · 127, 하위 메뉴 취소는 없음) — 0x1aec4 가 앞 상태로 배경음 4 를 다시 틀지 가른다(125 만 든다)
   */
  readonly onReenter?: (from?: number) => void
  /**
   * 결과 상태(훈련 125 · 휴식 127)의 창이 떠 있는가 — 원본은 그동안 105 가 아니라서 105 갱신 0x1aec4 끝의 칭호 판정 0x1a1c0 이
   * 돌지 않는다. 세션이 이 값으로 칭호 팝업을 멈춘다(`usePitcherLeagueSession` 의 `pendingTitle`).
   */
  readonly onResultWindowChange?: (isOpen: boolean) => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
  /**
   * 처음 설 하위 메뉴 — 111 상점 취소는 110(0x13460 의 13b1e) · 121 장비착용 취소는 106(0x17ad0 의 17aee)으로 돌아온다
   * (`nariReturnSubMenuOf`). 없으면 105.
   */
  readonly initialKind?: PitcherMenuKind
}

export interface PitcherManagementMenu {
  readonly kind: PitcherMenuKind
  readonly subWindow: PitcherMenuWindow
  /** 구질/마구 창의 탭 (1 마구 · 2 구질 — 팝업 0x78 의 `+0x166 ? 2 : 1`) */
  readonly pitchWindowTab: number
  /** 123 창 탭 1 — 마구 칸 i(0~3) 고르기 */
  readonly selectMagicCell: (cellIndex: number) => void
  /** 123 창 탭 2 — 구질 칸(행, 열) 고르기 */
  readonly selectPitchCell: (row: number, column: number) => void
  /** 기본정보(119) 위에 띄운 칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1) */
  readonly isTitleWindowOpen: boolean
  readonly closeTitleWindow: () => void
  /** 능력치 상세 창(120)의 글 첫 줄 (창 +0x380) — 창이 없으면 null */
  readonly abilityDetailOffset: number | null
  readonly closeAbilityDetail: () => void
  /** 129 확인 — 선수 +0x1c4 에 고른 번호를 넣고 저장한다 (0x11f78) */
  readonly equipTitle: (title: string) => void
  readonly items: readonly MenuItem[]
  readonly notice: string
  /** 상세 결과 창 — 떠 있으면 화면이 `DetailWindow` 를 그린다 */
  readonly detail: PitcherMenuDetail | null
  /** 상세 결과 창을 닫는다 — 훈련은 부상(0x1b4c4), 휴식은 회복(0x1b308)을 이때 굴린다 */
  readonly closeDetail: () => void
  /** 127 휴식 — 'playing' 연출(0x85230) · 'result' 연출 뒤 결과 창. 둘 다 가운데 판 0x7f814 를 안 그린다(0x19da4) */
  readonly restPhase: 'playing' | 'result' | null
  /** 127 틀 0x19080 — 연출 끝(0x84e58)을 본 틀에 0x18e3c(사기 굴림 · 결과 창 · 저장) */
  readonly finishRest: () => void
  readonly question: PitcherMenuQuestion | null
  readonly choice: PitcherMenuChoice | null
  /** 두 갈래 팝업의 커서 (원본 `장면+0x166`) — 좌우 키가 옮긴다 */
  readonly choiceIndex: number
  /** 팝업 커서를 옮긴다 (마우스로 칸에 올렸을 때) */
  readonly moveChoice: (index: number) => void
  readonly select: (id: string) => void
  /** 취소(−16) */
  readonly back: () => void
  readonly dismissNotice: () => void
  readonly answerQuestion: (isYes: boolean) => void
  readonly chooseOption: (index: number) => void
  readonly closeWindow: () => void
  /** 구질 훈련 창(108 탭 2)에서 확인 [예] — 125 의 훈련 한 번(0x17f5c 탭 2 갈래) 뒤 알림을 띄우고 105 로 */
  readonly trainPitch: (row: number, column: number) => void
  /** 108 마구 창(탭 1)의 격자 커서 — 진입 0x17730 이 `min(L, 3)` 에 둔다 */
  readonly magicTrainingCursor: number
  readonly moveMagicTrainingCursor: (cell: number) => void
  /** 108 마구 창의 확인 키 0x17828 — 칸 하나를 확인한다 */
  readonly confirmMagicTrainingCell: (cell: number) => void
  /** 스킬 창(122) 대화 번호 4(장착)·3(해제) — 0x1483c `0xa4b04(P, s, on)` */
  readonly equipSkill: (skillId: number, on: boolean) => void
  /** 스킬 창(122) 대화 번호 6 — 슬롯 확장 0x1484c. G 가 모자라면 아무것도 안 바뀐다 */
  readonly expandSkillSlots: () => void
  /**
   * 125 훈련 연출이 도는 중이면 그 연출(0x84664 모드 3 갈래) — 게이지가 차면 `finishTraining` 이 훈련 0x17f5c 를 굴린다.
   * 연출이 끝나 결과 창이 떠 있는 동안은 null 이다(0x84e58 이 애니를 지워 0x848d0 이 안 그린다).
   */
  readonly trainingPresentation: PitcherTrainingPresentation | null
  /** 상태 125 인가(연출 · 결과 창) — 그림 0x19da4 가 가운데 판 0x7f814 를 빼고, 커맨드 줄 키는 안 받는다 */
  readonly isTrainingState: boolean
  /**
   * 이 화면 안에서 105 에 다시 들어온 수 — 하위 메뉴 106 · 107 · 110 취소, 125 훈련 결과 · 127 휴식 결과 창이 닫힘.
   * 105 진입 0x11910 은 늘 11c26 에서 0x7ff21 을 불러 칸을 처음 자리(표 0xd4740, y 0xaa)로 되돌리고 [gfx+0x99] = 1 —
   * 커맨드 줄은 이 수가 바뀌면 다시 펼친다(그동안 키를 버린다, A-50). 하위 메뉴가 그대로인 휴식 뒤에도 그렇다
   */
  readonly entryCount: number
  /** 게이지 끝 — 틀 0x18dd8 의 `0x84e58 → 0x17f5c` */
  readonly finishTraining: () => void
}
