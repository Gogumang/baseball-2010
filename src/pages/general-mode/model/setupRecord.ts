import { INITIAL_SETUP } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'

/**
 * **준비 기록 `skin+0xbc` 은 앱이 사는 동안 하나다** — 판마다 새로 만들지 않는다.
 *
 * 스킨 객체는 앱 초기화 `0x2ed8` 에서 한 번 선다: `2ff6` new → 생성자 `0x53b25` → 전역 `[0x1552cfc]`.
 * 준비 기록 16바이트는 그 안 `+0xbc` 칸이고, 이 칸을 0 으로 되돌리는 곳이 없다 — 상태 18~22 의 갱신 함수와
 * 빠른실행 진입 `0x314b0`(31500~31556)·`*` 재굴림(31200~)이 적을 뿐이다. 그래서 다음 판(일반모드에 다시 들어와도)
 * 상태 20 진입 `0x23ed0` 의 구장 커서는 **지난 판 rec+0xc** 에서 시작한다(`0x23f36 ldrb [rec+0xc]` → 목록 커서).
 *
 * 빠른실행은 rec+0xc 에 **유저 팀 번호**를 적으므로(3152e) 히든 팀(10~14)이 나온 뒤 새로하기로 들어오면 구장 커서가
 * 10칸 목록(0~9) 밖에서 시작한다 — 원본 그대로 둔다. 목록 창 맞추기 `0x6c2bc` 은 창 시작만 x − 9 로 옮기고,
 * 그리기 `0x640e2` 는 커서가 아니라 rec+0xc 를 직접 읽어(`64654 ldrb [skin+0xc8]`) 열 칸짜리 지역 표를 넘겨 읽는다
 * (웹은 그 칸을 빈칸으로 둔다 — `FirstBatStadiumScreen`). 좌·우 한 칸은 `stadiumCursorAfter` 가 감는다.
 *
 * 저장 파일에는 안 든다(스킨 객체는 bss) — 앱을 새로 열면 생성자의 0 이다(`INITIAL_SETUP`).
 */
let record: GeneralModeSetup = INITIAL_SETUP

/** 지금 준비 기록 — 상태 18 · 빠른실행 진입이 이것에서 시작한다 */
export function readSetupRecord(): GeneralModeSetup {
  return record
}

/** 화면들이 고친 준비 기록을 되쓴다 (갱신 함수 끝의 되쓰기) */
export function writeSetupRecord(setup: GeneralModeSetup): void {
  record = setup
}

/** 앱을 새로 연 것처럼 — 시험이 판 사이를 가를 때 쓴다 */
export function resetSetupRecord(): void {
  record = INITIAL_SETUP
}
