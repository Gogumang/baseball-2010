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
 * ⚠️ 해독 문서 안의 **충돌 하나**: I-controls 4c 는 메뉴 칸 수를 `0x3c02c` 의
 * `0x6bfe1(1, 칸수)` 에서 "모드 1 이면 4칸, 그 밖 5칸" 으로 읽었는데, 같은 절의 표 0xcfcfc 는
 * 행 0(모드 0·1·2·8·9)에 다섯 칸을 준다. 둘 중 **표 쪽이 칸 이름까지 확정**이라 표를 따랐다.
 * (표를 따르지 않으면 일반모드는 "나가기" 칸이 사라진다.)
 */

/** 동작 번호 → 점프표 `0xcff84`: 0 계속 · 1 조작방법 · 2 설정(유력) · 3 나가기 · 4 자동진행 · 5 다시하기 */
export type InGameMenuAction = '계속' | '조작방법' | '설정' | '나가기' | '자동진행' | '다시하기'

/**
 * 표 `0xcfcfc`[행 × 5 + 칸].
 * 칸 2 "설정" 은 **유력**이다 — `0x3c326` 이 StrMAINMENU·ui/slt_frame 을 적재하고 하위 5(`0x5550c`)로 간다.
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
export const QUIT_CONFIRM_WITH_LOSS =
  '!C!cFFFFFF현재 이닝의 기록과 획득한!N!cFF0000G포인트가 사라집니다!cFFFFFF!N메인메뉴로 나가시겠습니까?'

/**
 * StrGAME[1] — 그 밖(미션·홈런더비)의 나가기 확인 문구.
 * ⚠️ **원본 문구 미해독 — 근사**. I-controls 4c 는 "모드 1~4·8·9 는 StrGAME[0], 그 밖은 StrGAME[1]" 만 적는다.
 */
export const QUIT_CONFIRM_PLAIN = '!C!cFFFFFF메인메뉴로 나가시겠습니까?'

/** 나가기 확인 문구 (`0x3c504`) */
export function quitConfirmTextOf(mode: number): string {
  const withLoss = (mode >= 1 && mode <= 4) || mode === 8 || mode === 9
  return withLoss ? QUIT_CONFIRM_WITH_LOSS : QUIT_CONFIRM_PLAIN
}

/** StrGAME[7] — 다시하기 확인 문구 (`0x3c706`, H-modes 200행에 원문 그대로 있다) */
export const REPLAY_CONFIRM = '!C!cFFFFFF새로운 기록을 위해!N다시 플레이하시겠습니까?'
