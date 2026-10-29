import type { SubMenuKind } from '@/pages/management/lib/managementLayout'

/** 커서를 옮긴 뒤 두 번 갱신하는 동안 +1, −1 로 튄다 (카운터 +0x98) */
export const BOUNCE_BY_UPDATE = [1, -1]
/**
 * 관리 메뉴에 **막힌 칸은 없다** — 105 키 0x1261c 는 확인(−5 · '5')이면 켬 표(+0x28)를 보지 않고 커서 칸으로 곧장 간다
 * (12644~12670 점프표 0xcc540 · 칸 3 = 126be → 0x70 = 112). 켬 표가 0 인 칸(행동함이면 트레이닝 · 휴식 · 외출, 첫 해
 * 10경기 전 외출 — 105 진입 0x11910)은 흑백으로 그려지고(`nariMainMenuOffIdsOf` → 커맨드 줄 0x7e418), 확인 키는 켬 표를 안 본다
 * (107 키 0x12d48 · 휴식 1261c 12682 · 113 가드 0x16cf0 모두 S+4 를 안 본다). 대신 **커서가 그 칸에 서지 못한다** — 메뉴 객체
 * (0x6c219, vtable 0xd2ea0)의 이동 vt+8 0x6c445 가 켬 표 0 칸을 건너뛴다(`nariMenuCursorAfterStep`). 그래서 웹도 꺼진 칸은
 * 방향키로 건너뛰고 눌러(터치) 고르지 못하게 한다 — 한 주기에 두 번 행동할 길이 원본처럼 없다
 */
export const NO_DISABLED_IDS: ReadonlySet<string> = new Set()
export const SUB_MENU_KINDS: readonly string[] = ['선수정보', '트레이닝', '아이템']
/** 트레이닝 하위 메뉴 칸 4 — 능력 훈련(칸 0~3)과 흐름이 다르다 */
export const SPECIAL_SWING_MENU_ID = '필살타법'
/** 칸 등장 0x7ff8c 가 다 내려온 뒤의 갱신 수 — 하위 메뉴로 돌아올 때는 펼침(0x7ff55)이 없어 칸이 제자리다 */
export const SETTLED_UPDATES = 1_000
/**
 * 칸이 펼쳐지는 동안 커맨드 줄은 키를 안 받는다 — 105 키 0x1261c 머리 [gfx+0x99] · 106 0x13010 · 107 0x12d48 · 110 0x11478 머리
 * [gfx+0x9a] 가 0 이 아니면 취소까지 통째로 건너뛴다. 105 진입 0x11910(11c26) 의 0x7ff21 이 +0x99 = 1, 105 키가 하위 메뉴를 열며
 * 0x7ff55(126d4)가 +0x9a = 1, 틀(105 0x1aec4 의 1af8a → 0x7ff8d · 하위 0x14690 → 0x8003d)이 상태 틀 수 t 로 칸을 옮기고 여섯 칸이
 * 다 제자리면(t ≥ 7 — 16t 가 110 에 닿는다, 0x80026 · 0x80212) 0 으로 내린다. 한 틀은 키(1d06a~) 다음 틀 함수(1d1b2~)라 t = 7 인
 * 틀의 키까지 막힌다 — 그려진 갱신 수가 7 미만이면 다음 키는 버려진다(A-50)
 */
export const SLIDE_KEY_LOCK_UPDATES = 7

export type MenuKind = 'main' | SubMenuKind

/**
 * 관리 화면을 덮는 창.
 * 필살타법 창은 그림(0x803d4)이 하나인데 상태가 둘이다 — 선수정보 칸 3 → 상태 0x7b(`'필살타법'`, 고르기) ·
 * 트레이닝 칸 4 → 상태 0x6c(`'필살타법훈련'`, 배우기) (R7 4절).
 */
export type ManagementOverlay = '기록실' | '필살타법' | '필살타법훈련' | '칭호' | '아이템/스킬'

/** 예/아니오 질문 (StrMODE[85] 훈련 · [90] 휴식) */
export interface MenuQuestion {
  readonly text: string
  readonly onYes: () => void
}
