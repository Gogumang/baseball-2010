import type { Screen } from '@/app/model/screen'

/**
 * 메인 메뉴(장면 0x103)에 들어설 때 배경음 1 을 **처음부터** 다시 트는가 — 같은 1 이 돌고 있어도 끊고 다시 튼다
 * (0x6ea6c 는 같은 번호도 0x6e9d4 가 울리던 것을 끊고 새로 튼다).
 * - 상태 4(처음 메뉴) 진입 0x24a40 의 24a8c~24aa2: 이전 상태가 0(타이틀) 또는 8(환경설정)이면 `0x6ea6d(소리, 1, −1, 1)`.
 *   타이틀에서는 울리던 것이 없어 들리는 것이 같으니 **환경설정에서 돌아올 때**만 갈린다.
 * - 상태 5(게임시작 목록) 진입 0x25b88 의 25c24~25c38: 이전 상태 ≠ 4 면 0x6e418 로 끊고 1 — 웹은 `openTier` 5 로
 *   장면을 새로 세울 때(나리 105 취소 0x126e6 · 시즌 0xc9 취소 0x8f5a)다. 메뉴 안에서 4 → 5 로 내려갈 때는 안 다시 튼다.
 */
export function restartsMenuBgm(previousKind: Screen['kind'] | null, screen: Screen): boolean {
  if (screen.kind !== '메인메뉴' || previousKind === '메인메뉴') return false
  return previousKind === '환경설정' || screen.openTier === 5
}

/**
 * 나리 등록(102)에서 팀 고르기(101)로 물러날 때 배경음 3 을 **처음부터** 다시 트는가 — 102 키 0x16f28 의 취소(171dc~17202)가
 * `0xbcb49(0x65)` 로 101 에 다시 들어오고, 진입 0x10790 은 조건 없이 `0x6ea6d(소리, 3, −1, 1)`(107a2)라 울리던 3 을 끊고 새로 튼다.
 * 투수편은 같은 두 상태가 '등록' 한 장면 안이라 `PitcherCreateFlow` 가 스스로 튼다.
 */
export function restartsTeamSelectBgm(previousKind: string | null, kind: string): boolean {
  return kind === '팀선택' && previousKind === '선수등록'
}

/**
 * 외출 지도(112)에서 관리 화면(105)으로 돌아올 때 배경음 4 를 **처음부터** 다시 트는가 — 105 처리 0x1aec4 의 첫 틀
 * (+0x2c == 2)이 이전 상태 ∈ {100, 116, 132, 125, 126, 114, 134, 1, 112} 면 `0x6ea6d(소리, 4, −1, 1)`(1aef4~1af02)를 부르고,
 * 0x6ea6c 는 번호를 견주지 않아 112 동안 이어지던 4 를 끊고 새로 튼다. 웹 '외출' 에서 곧장 '관리' 로 오는 길은 지도 취소
 * (112 → 105)와 외출 효과 팝업 [확인](126 → 105, 틀 0x1575c — 웹은 지도 화면 위 팝업)이다 — 장소(113)는 이벤트 114 를 지나
 * 40 → 4 로 번호가 바뀌어 저절로 튼다. 상점(111 → 110)은 105 진입이 아니다.
 * 화면이 '관리' 인 채 105 에 다시 드는 길(`reenterManagement`)은 화면 표가 앞 상태를 못 보므로 세션이 그 앞 상태를 넘겨
 * `restartsManagementBgmFrom` 이 참이면 다시 틀기 표를 올린다 — 훈련 결과 창 · 필살타법 · 마구 · 구질 훈련 알림(125 → 105, 0x1b5b8 ·
 * 0x18dd8)이 그 길이다. 휴식(127 → 105, 0x1b466) · 하위 메뉴 취소(106 · 107 · 110)는 목록 밖이라 안 튼다.
 */
export function restartsManagementBgm(previousKind: string | null, kind: string): boolean {
  return kind === '관리' && previousKind === '외출'
}

/**
 * 142 경기 준비의 취소(−16, 키 0x13c72 → `0xbcb49(0x6d)`)로 109 순위표에 돌아올 때 배경음 4 를 **처음부터** 다시 트는가 — 109 진입
 * 0x10d8c 의 10d8e~10da4 가 이전 상태 ≠ 105 면 `0x6ea6d(소리, 4, −1, 1)` 을 부르고, 0x6ea6c 는 번호를 견주지 않아(0x6e9d4 가 울리던
 * 소리를 멈추고 새로 튼다) 105 → 109 → 142(0x1c46c 는 소리를 안 건드린다) 동안 이어지던 4 를 끊고 새로 튼다(r332 직접 뜸).
 * 다른 길(경기 뒤 116 → 114 · 이어하기 1)은 앞 배경음이 4 가 아니라 번호가 바뀌어 저절로 튼다. 타자편 · 투수편(모드 갈림 없음) 같다.
 */
export function restartsNextGameStandingsBgm(previousKind: string | null, kind: string): boolean {
  return kind === '다음경기순위' && previousKind === '경기준비'
}

/** 105 처리 0x1aec4 의 배경음 4 목록 (1aece~1aef2) — 이전 상태가 이 가운데 하나면 105 의 첫 틀(+0x2c == 2)이 4 를 처음부터 튼다 */
const MANAGEMENT_BGM_FROM: ReadonlySet<number> = new Set([0x64, 0x74, 0x84, 0x7d, 0x7e, 0x72, 0x86, 1, 0x70])

/** 화면이 '관리' 인 채 105 로 돌아오는 결과 상태 — 125 훈련 결과(0x18dd8 · 0x1b5b8) · 127 휴식(0x1b466) */
export const NARI_STATE = { 훈련결과: 0x7d, 휴식: 0x7f } as const

/** 원본 상태 `from` 에서 105 로 다시 들어오면 배경음 4 를 처음부터 다시 트는가 (`MANAGEMENT_BGM_FROM`) */
export function restartsManagementBgmFrom(from: number): boolean {
  return MANAGEMENT_BGM_FROM.has(from)
}

/**
 * **137 "N년차" 표지 뒤 이어지는 배경음** — 137 진입 0x1055c · 틀 0x12190 · 그리기 0x1cc4c 는 소리를 안 건드리고, 105 처리 0x1aec4 의
 * 첫 틀 배경음 4 는 이전 상태가 {0x64, 0x74, 0x84, 0x7d, 0x7e, 0x72, 0x86, 1, 0x70} 일 때만이라(1aece~1aef2, r148 직접 뜸) 0x89 는
 * 빠진다. 곧 137 → 105 는 앞의 배경음(연말 114 의 40 · 141 방출 이어하기의 4 · 대회 경기 뒤 끊긴 채)을 그대로 잇고, 105 에서 들어가
 * 소리를 안 건드리는 109(이전 105) · 110/111 상점 · 112 외출 지도에서도 이어진다. 112 · 126 → 105(`restartsManagementBgm`),
 * 화면이 '관리' 인 채 125 → 105(`restartsManagementBgmFrom` — 훈련 결과 창 · 훈련 알림을 닫을 때) 나 그 밖 화면으로 가면 끝나고
 * 4 가 처음부터 운다. 127 휴식 → 105 · 하위 메뉴 취소는 목록 밖이라 잇는다.
 */
const YEAR_COVER_CARRY_KINDS: ReadonlySet<string> = new Set(['관리', '다음경기순위', '아이템', '상점', '외출'])

/** 화면이 `previous` → `kind` 로 바뀔 때 137 뒤 배경음을 이어 가나 */
export function carriesYearCoverBgm(isCarrying: boolean, previous: string | null, kind: string): boolean {
  if (previous === '연차표지') return kind === '관리'
  if (!isCarrying || !YEAR_COVER_CARRY_KINDS.has(kind)) return false
  return !restartsManagementBgm(previous, kind)
}
