/**
 * **경기 중 메뉴 '\*'** — 원본 표 `0xcfcfc` 와 동작 점프표 `0xcff84` (I-controls 4c 확정).
 *
 * 원본 흐름: 공용 키 처리 `0x498d4` 가 소프트키1(−6)을 '\*' 로 바꿔 읽고,
 * 경기 상태가 0xd~0x15 일 때만 일시정지 팝업(`0x741a0`) + 메뉴(`0x3c02c`)를 연다.
 * 메뉴 키 `0x3c158` 에서 OK 가 고르고, CLR·'\*' 가 닫는다(= 계속).
 *
 * 행은 **전역 모드**가 고른다 (`0x3c158`):
 *   모드 3·4(나만의리그) → 행 2 · 모드 5~7(미션·홈런더비) → 행 1 · 그 밖(0·1·2·8·9) → 행 0.
 *
 * 칸 수: 0x3c02c 가 `0x6bfe1(메뉴, 1열, 칸수, 숫자키 꼴 2, 0x230)` 을 부르는데 0x3c066~0x3c08a 가 `모드 − 3 ≤ 1`(모드 3·4)이면 4,
 * 아니면 5 를 넘긴다 — 표의 행 2 가 네 칸인 것과 맞는다 (예전 "모드 1 이면 4칸" 읽기는 틀렸다, 2026-10-14 다시 떴다).
 */

/** 동작 번호 → 점프표 `0xcff84`: 0 계속 · 1 조작방법 · 2 설정 · 3 나가기 · 4 자동진행 · 5 다시하기 */
export type InGameMenuAction = '계속' | '조작방법' | '설정' | '나가기' | '자동진행' | '다시하기'

/**
 * 표 `0xcfcfc`[행 × 5 + 칸].
 * "설정" 은 환경설정 작은 판(사운드·속도·진동, I-controls 4c-1 확정)이다 — `0x3c326` 이 StrMAINMENU·ui/slt_frame 을 적재하고 하위 5(`0x5550c`)로 간다.
 * 원본 그림 글자는 `IN_GAME_MENU_LABELS` (계속하기 · 자동진행/재도전 · 게임방법 · 환경설정 · 메인메뉴).
 */
export const IN_GAME_MENU_ROWS: readonly (readonly InGameMenuAction[])[] = [
  ['계속', '자동진행', '조작방법', '설정', '나가기'],
  ['계속', '다시하기', '조작방법', '설정', '나가기'],
  // 나만의리그 행은 네 칸뿐이다 (자동진행·다시하기가 없다)
  ['계속', '조작방법', '설정', '나가기'],
]

/** 모드 → 표의 행 (`0x3c158`) */
export function inGameMenuRowOf(mode: number): number {
  if (mode === 3 || mode === 4) return 2
  if (mode >= 5 && mode <= 7) return 1
  return 0
}

/** 이 모드의 경기 중 메뉴 칸들 */
export function inGameMenuOf(mode: number): readonly InGameMenuAction[] {
  return IN_GAME_MENU_ROWS[inGameMenuRowOf(mode)] ?? IN_GAME_MENU_ROWS[0]
}

/** StrGAME[0] — 모드 1~4·8·9 의 나가기 확인 문구 */
export const QUIT_CONFIRM_WITH_LOSS = '!C!cFFFFFF현재 이닝의 기록과 획득한!N!cFF0000G포인트가 사라집니다!cFFFFFF!N메인메뉴로 나가시겠습니까?'

/** StrGAME[1] — 그 밖(미션 5·6 · 홈런더비 7)의 나가기 확인 문구 (`base/extracted/StrGAME.json` [1] 원문 그대로) */
export const QUIT_CONFIRM_PLAIN = '!C!cFFFFFF진행 중인 게임을 그만하고!N메인메뉴로 나가시겠습니까?'

/**
 * 나가기 확인 문구 (`0x3c504`).
 * 모드 1~4·8·9(0x3c50e~0x3c51a)는 `0x702b5(StrGAME, 0)`, 그 밖(0x3c596)은 `0x702b5(StrGAME, 1)` 을
 * `0x74ef5(창, 글, 종류 2, 0, 0)` 예/아니오 창으로 띄운다. 뒤에 `0x749d5` 가 없어 **처음 커서는 [예]**(R4 3a-1 — 첫 버튼).
 * 답은 하위 1 `0x3c77c` 가 본다: [예](+0x21c == 0) → `0x20094(앱, 5)`(XlsTEAM/PITCHER/BATTER 표 다시 적재 — 저장은 안 건드림)
 * → 경기 상태 0x22 + 밀기(5, 1500). 아니면 일시정지 팝업을 다시 띄운다(메뉴 커서 그대로).
 * 0x22 갱신 `0x40140` 은 밀기가 끝나면 전역 모드 = 장면+0x1104 · 모드 5·6 이면 `0xa5368(미션, 0)` · 0x140006c = 4 ·
 * 장면 0x103 — **모든 모드가 메인 메뉴 처음 단(하위 4)으로 간다**. 저장 쓰기(0x22754)도 +0x3c 쓰기도 없다.
 */
export function quitConfirmTextOf(mode: number): string {
  const withLoss = (mode >= 1 && mode <= 4) || mode === 8 || mode === 9
  return withLoss ? QUIT_CONFIRM_WITH_LOSS : QUIT_CONFIRM_PLAIN
}

/** StrGAME[7] — 다시하기 확인 문구 (`0x3c706`, H-modes 200행에 원문 그대로 있다) */
export const REPLAY_CONFIRM = '!C!cFFFFFF새로운 기록을 위해!N다시 플레이하시겠습니까?'

/**
 * **칸 이름 그림** — 그리기 0x3cdd0 이 `0xcb5d8(sp+0x60, 0xcff9c, 12)` 로 베낀 표 0xcff9c(반말 여섯)[동작 번호] 의 img_text 프레임.
 * 표 = [238, 240, 241, 242, 237, 239] — 웹 동작 이름과 원본 그림 글자는 아래와 같다(그림을 직접 보고 읽었다).
 */
export const IN_GAME_MENU_LABEL_FRAMES: Readonly<Record<InGameMenuAction, number>> = {
  계속: 238,
  조작방법: 240,
  설정: 241,
  나가기: 242,
  자동진행: 237,
  다시하기: 239,
}

/** 칸 그림의 원본 글자 (img_text 238 "계속하기" · 240 "게임방법" · 241 "환경설정" · 242 "메인메뉴" · 237 "자동진행" · 239 "재도전") */
export const IN_GAME_MENU_LABELS: Readonly<Record<InGameMenuAction, string>> = {
  계속: '계속하기',
  조작방법: '게임방법',
  설정: '환경설정',
  나가기: '메인메뉴',
  자동진행: '자동진행',
  다시하기: '재도전',
}

/** 판 머리 그림 — img_text 0x109(265) "MENU", 팔레트 4 (3cead 0x913e5(img_text, 4) → 0xba759(…, 0x109, 1, x + 8, y + 5)) */
export const IN_GAME_MENU_TITLE_FRAME = 0x109

/** 밀려 들어오는 끝 — [장면+0x1954] 상한 0x44 (0x3d0e4) */
export const IN_GAME_MENU_SLIDE_END = 0x44

/**
 * **밀려 들기** — '\*' 로 여는 0x3c02c 가 [장면+0x1954] = 0 · [장면+0x1958](s8 걸음) = 1 로 두고, 그리기 0x3cdd0 끝(0x3d0ca~0x3d0ee)이
 * 그린 **뒤에** 걸음을 두 배로 하고 그만큼 더한다. 0x44 이상이면 0x44 · 걸음 1. 그래서 n 번째 그림(0 부터)의 값은
 * 0 · 2 · 6 · 14 · 30 · 62 · 68 · 68 … 이다. [조작방법]·[설정]·질문 창에서 돌아올 때(0x3ca36 · 0x3cb0e · 0x3c77c)는 0x3c02c 를
 * 안 지나 0x44 그대로다.
 */
export function inGameMenuSlideAt(frame: number): number {
  let offset = 0
  let step = 1
  for (let index = 0; index < frame; index += 1) {
    step *= 2
    offset += step
    if (offset >= IN_GAME_MENU_SLIDE_END) {
      offset = IN_GAME_MENU_SLIDE_END
      step = 1
    }
  }
  return offset
}

/** 원작 화면 높이 — 0x3ce3c 가 부르는 0x14008c8 */
const SCREEN_HEIGHT = 320
/** 줄 간격 — 0x3ce28 `칸수 × 0xe + 0x15` · 0x3cf32 */
const ROW_STEP = 0xe

export interface InGameMenuRowLayout {
  /** 둥근 칠 0x6b7d4(gfx, x, y, 0x41, 0xe, 둥글기 4, 색) */
  readonly pill: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 칸 번호 0xba689(x, y, 0, 칸 + 1, 기준 0, num, 정렬 2) — x 가 가운데 */
  readonly digit: { readonly centerX: number; readonly y: number; readonly value: number }
  /** 칸 이름 img_text 0xba759(…, 그림, 1, x, y) */
  readonly label: { readonly x: number; readonly y: number }
}

export interface InGameMenuLayout {
  /** 둥근 칸 0x5eec5(skin, x, y, 0x46, h, 둥글기 4, 정렬 1, 반사 1, 길이 0x3c, 걸음 2, 0xc8, 칠, 테두리, 0) */
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly title: { readonly x: number; readonly y: number }
  readonly rows: readonly InGameMenuRowLayout[]
}

/**
 * **경기 중 메뉴 판 배치** — 일시정지 팝업 그리기 0x3cdd0 의 하위 0~3 갈래(0x3ce76~0x3d0c8)를 직접 떴다. 하위 4(조작방법 뷰어)·5(설정 판)는
 * 메뉴를 안 그린다.
 * ```
 * 3ce28  h = 칸수([메뉴+0x18]) × 0xe + 0x15 · x = [장면+0x1954] − 0x45 · y = H − h − 0x12
 * 3cea8  0x5eec5(skin, x, y, 0x46, h, 4, 1, 1, 0x3c, 2, 0xc8, 0xc8335fcd, 0xc8000000, 0)       ; 반투명 파란 둥근 칸
 * 3ceb4  0x913e5(img_text, 4) · 0xba759(img_text, 0x109 "MENU", 1, x + 8, y + 5)
 * 칸 i:  ry = y + 0x12 + 0xe·i
 *        고른 칸이면 0x6b7d4(gfx, x + 3, ry, 0x41, 0xe, 4, RGB(255, 216, 0)) · 팔레트 3, 아니면 같은 칸 RGB(0x33, 0x5f, 0xcd) · 팔레트 0
 *        0xba759(img_text, 0xcff9c[동작], 1, x + 0x11, ry + 2)
 *        자동진행 칸이 막혔으면(모드 8·9 이고 [경기+0x6b] > 5) 팔레트 4 · 효과 0xb(단색) RGB(0x80, 0x80, 0x80) 로 이름을 찍는다
 *        0xba689(x + 9, ry + 2, 0, i + 1, 0, num([장면+0x1014]), 정렬 2, 0)                ; ui/num.pzx 0~9
 * ```
 */
export function inGameMenuLayoutOf(rowCount: number, slide: number): InGameMenuLayout {
  const height = rowCount * ROW_STEP + 0x15
  const x = slide - 0x45
  const y = SCREEN_HEIGHT - height - 0x12
  const rows = Array.from({ length: rowCount }, (_, index): InGameMenuRowLayout => {
    const rowY = y + 0x12 + ROW_STEP * index
    return {
      pill: { x: x + 3, y: rowY, width: 0x41, height: ROW_STEP },
      digit: { centerX: x + 9, y: rowY + 2, value: index + 1 },
      label: { x: x + 0x11, y: rowY + 2 },
    }
  })
  return { box: { x, y, width: 0x46, height }, title: { x: x + 8, y: y + 5 }, rows }
}
