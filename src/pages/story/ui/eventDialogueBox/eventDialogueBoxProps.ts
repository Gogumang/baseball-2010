/** 선택지 갈래(0x7fd22) — [창+0xe4] = 갈래 수 ≠ 1 */
export interface DialogueChoiceList {
  /** 상자 글 칸 k = 갈래 k 의 글 (0x8ba2c) */
  readonly lines: readonly string[]
  /** [mgr+0xb9] — 노랑 테두리를 두를 줄 */
  readonly selected: number
}

export interface EventDialogueBoxProps {
  /**
   * 상자 글 칸 0 — say 면 머리말(`speakerPrefixOf`)까지 붙인 원본 마크업, 선택지면 첫 갈래 글. `%s` 는 `replacements` 로 채운다.
   * 빈 글이면 0x7fbc4 가 아무것도 안 그린다(0x7fbe0 — 상자 · 넘김 표시 모두).
   */
  readonly raw: string
  readonly replacements?: readonly string[]
  /** 선택지 갈래로 그린다(갈래 수 ≠ 1). 없으면 say 갈래 — 칸 0 을 찍는다 */
  readonly choices?: DialogueChoiceList | null
  /**
   * 처음 세울 때 상자가 아래에서 올라오는가(높이 0 에서). 거짓이면 다 올라온 높이다.
   * 세운 뒤의 높이는 상자 객체([mgr+0xb4])처럼 이어 간다 — say · 선택지가 바뀌어도 그대로다.
   */
  readonly slideIn: boolean
  /** 바뀌면 글 찍기를 처음으로 — say · 선택지 명령이 돌 때(0x7f7d5). 안 주면 `raw` 가 바뀔 때 */
  readonly textKey?: string
  /**
   * 바뀌면 상자를 내린다 — 높이 0 · 글 찍기 처음으로(이벤트의 첫 say 0x8d1f2 의 0x7f7cc, 화면효과 6 · 7 의 '끝' 0x7f7d4 · 0x7f7cc).
   * 그 그리기에서 곧바로 한 칸(15) 오른다.
   */
  readonly lowerKey?: number
  /** say 갈래의 글 끝(단계 4)에서 확인 — 다음 명령으로 */
  readonly onAdvance: () => void
  /** 키 · 누르기를 받는가 — 위에 다른 창이 떠 있거나 지금 명령이 say · 선택지가 아니면 끈다(0x8b804 는 say · 선택지 명령만 본다) */
  readonly isActive?: boolean
  /**
   * say 중 취소(CLR −16 — 웹 Escape · Backspace). 지금 명령이 say 일 때만 준다 — 0x8b804 는 say(0) 갈래에서만 −16 을
   * 0x8b7b0 으로 넘기고, 상자 단계는 안 본다(올라오는 중에도 먹는다). 선택지 갈래는 −16 을 안 받는다.
   */
  readonly onCancel?: () => void
  /** 선택지 위 · 아래 — 고른 줄을 (고른 줄 ± 1) % 갈래 수 로 */
  readonly onChoiceMove?: (selected: number) => void
  /** 선택지 확인 — 고른 줄의 갈 이벤트로. 상자 단계와 상관없이 곧바로 받는다 */
  readonly onChoiceConfirm?: (selected: number) => void
  /**
   * 0x7fad0 의 장식(mode_ui 프레임 21 "CLR:SKIP")을 그리는가 — 0x7fbc4 의 넷째 인자. 이벤트 재생기 0x8b5ac 는 1, 강판 감독 대사
   * 0x50828 은 0 이다(r334 직접 뜸 — 7fbd6 r2 = 넷째 인자 → 0x7fad0 의 7fb5a 장식 문). 안 주면 참
   */
  readonly showsOrnament?: boolean
  /**
   * 그리기 틀 시계 — 틀마다 `callback` 을 한 번 부르고 끊는 함수를 돌려준다. 안 주면 앱 틀 시계(`setAppTickInterval`).
   * 경기 장면 위 상자(0x23)는 경기 장면 시계를 넘긴다 — 공용 창이 서면 52efe 가 상태 그리기를 건너뛰어 상자도 선다
   */
  readonly tickInterval?: (callback: () => void) => () => void
  /**
   * 확인(say 갈래)을 곧바로 하지 않고 넘겨 미룬다 — 경기 장면의 상태 키는 받은 다음 틀의 키 자리(52da2)에서 그리기보다 먼저 돈다
   * (`sceneKeyLatch`). 안 주면 곧바로
   */
  readonly deferPress?: (run: () => void) => void
}
