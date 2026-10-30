import type { InGameMenuCloser, InGameMenuOpening } from '@/features/play-team-game/model/useInGameMenuState'

export interface InGameMenuProps {
  /** 전역 게임 모드 — 표 0xcfcfc 의 행을 고른다 */
  readonly mode: number
  /** 메뉴를 닫고 경기로 돌아간다 (칸 "계속하기", CLR·'*' 와 같다) */
  readonly onContinue: () => void
  /** 칸 "메인메뉴"(나가기). 안 넘기면 칸이 잠긴다 */
  readonly onQuit?: () => void
  /** 칸 "게임방법" (`0x3c212` → StrHOWTO 뷰어) */
  readonly onOpenHelp?: () => void
  /** 칸 "환경설정" (`0x3c326` — 경기 중 환경설정 작은 판) */
  readonly onOpenSettings?: () => void
  /**
   * 칸 "자동진행" — **비용을 치를 수 있을 때만** 부른다. 인자는 깎아야 할 G포인트다.
   * 앱은 이 값만큼 저장의 G포인트를 줄이면 된다 (`저장+0x64`, 상한 99999).
   */
  readonly onAutoProgress?: (cost: number) => void
  /** 자동진행 비용 (`autoProgressCostOf`) */
  readonly autoProgressCost?: number
  /**
   * 대전모드 6회 제한을 통과했는가 (`canAutoProgress`). 거짓이면 그리기 0x3cdd0 이 칸 이름을 회색 단색으로 찍고(3cf0a~3cf12 —
   * 모드 8·9 에서 [경기+0x6b] > 5), 고르면 StrGAME[2] 알림만 뜬다(0x3c60c).
   */
  readonly canAutoProgress?: boolean
  /** 지금 가진 G포인트. 안 넘기면 비용을 검사할 수 없어 자동진행 칸이 잠긴다 */
  readonly gamePoint?: number
  /** 칸 "재도전"(다시하기, StrGAME[7], `0x3c706`) — 미션·홈런더비 행에만 있다 */
  readonly onRestart?: () => void
  /**
   * 처음 띄울 커서 칸 (메뉴 객체 +0xf30 의 커서). [조작방법]·[설정]에서 돌아오면 원본은 커서를 그대로 둔다
   * (`useInGameMenuState` 머리말) — 부르는 쪽이 `onCursorChange` 로 받아 둔 값을 다시 넘긴다. 기본 0.
   */
  readonly cursor?: number
  readonly onCursorChange?: (cursor: number) => void
  /**
   * '\*' 로 **새로 연** 메뉴인가 — 0x3c02c 만 [장면+0x1954] 를 0 으로 되돌려 판이 왼쪽에서 밀려 든다(`inGameMenuSlideAt`).
   * [조작방법]·[설정]에서 돌아오면 거짓(0x44 그대로). 기본 거짓.
   */
  readonly slidesIn?: boolean
  /** 창이 어떻게 떴는가(`useInGameMenuState` 의 `opening`) — 펼침 · 닫힘 갱신 수가 갈린다. 기본 '별표' */
  readonly opening?: InGameMenuOpening
  /** 여는 곳의 닫기(CLR · '*' · 계속)를 창에 맡긴다 (`useInGameMenuState` 의 `bindCloser`) */
  readonly bindCloser?: (closer: InGameMenuCloser | null) => void
}

/** 기본값을 채운 칸들 — 비용 0 · 자동진행 됨 · 커서 0 · 밀려 들기 없음 · '별표' 로 연 창 */
export function withMenuDefaults(props: InGameMenuProps) {
  return {
    ...props,
    autoProgressCost: props.autoProgressCost ?? 0,
    canAutoProgress: props.canAutoProgress ?? true,
    cursor: props.cursor ?? 0,
    slidesIn: props.slidesIn ?? false,
    opening: props.opening ?? ('별표' as const),
  }
}
