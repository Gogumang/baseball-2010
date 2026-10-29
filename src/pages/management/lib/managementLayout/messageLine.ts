import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import { STATUS_BOXES, type Box } from './statusBoard'

/**
 * 메시지줄 "N년 G/45경기" 의 경기 번호 — 0x7d120 (직접 떴다, 모드 갈림 없음 — 0x7b998 을 부르지만 값을 버린다):
 * ```
 * g = (s8)S+0xb2 (= L+0x32 날짜 카운터)
 * g == 0 && S+0xb4(포스트시즌) ≠ 0 → 45 ; 그 밖 g + 1
 * 0x7d34c 의 둘째 인자 ≠ 0 이고 위 값 > 1 → −1        ; 이벤트 대화창 0x8b5ac 만 [이벤트+0xb] 를 넘긴다(그 밖 0)
 * ```
 * 포스트시즌에는 g 가 그 시리즈에서 치른 경기 수라 "3/45경기" 처럼 시리즈 차례가 나온다 — 원본 그대로.
 * 45 는 자르지 않는다(정규시즌 g == 45 면 46).
 */
export function messageGameNumberOf(dayCounter: number, isPostseason: boolean, isPreviousGame = false): number {
  const game = dayCounter === 0 && isPostseason ? GAMES_PER_SEASON : dayCounter + 1
  return isPreviousGame && game > 1 ? game - 1 : game
}

/**
 * 메시지줄 배치 — 0x7d120 이 박스 10 (0,206,105,15) 오른쪽 끝에서 dx 를 줄여 가며 오른쪽부터 그린다.
 * ```
 * dx = −5 ; "경기"(img_text 335) 0xb9e05(정렬 0x24, ox dx)      ; dx −= 폭 + 2
 * 45      0xba719(자간 1, 기준 20, 정렬 0x24, ox dx)          ; dx −= 2·폭(num 20) + 4
 * "/"     0xb9d35(num 127, 정렬 0x24, ox dx, **oy 1**)        ; dx −= 폭 + 2
 * G       0xba719(…, ox dx)                                   ; dx −= 자리수·폭(num 20) + 7
 * "년"(334) 0xb9e05(정렬 0x24, ox dx)                          ; dx −= 폭 + 2
 * N       0xba719(…, ox dx)
 * ```
 * "/" 는 0xb9c5c 라 세로 가운데가 내림 `trunc((15 − 8)/2) = 3` 에 oy 1 → y = 210.
 */
export interface MessageLineLayout {
  readonly gameLabelLeft: number
  readonly totalRight: number
  readonly slashLeft: number
  readonly slashTop: number
  readonly gameRight: number
  readonly yearLabelLeft: number
  readonly yearRight: number
  /** "경기" · "년" 글 위 — 0xb9e05 정렬 0x24 의 세로 가운데 올림((h − 10) / 2) */
  readonly labelTop: number
}

const MESSAGE_GAME_LABEL_WIDTH = 19
const MESSAGE_YEAR_LABEL_WIDTH = 9
const MESSAGE_SLASH = { width: 5, height: 8, oy: 1 }
const MESSAGE_DIGIT_WIDTH = 6
const MESSAGE_LABEL_HEIGHT = 10

export function messageLineLayoutOf(game: number, box: Box = STATUS_BOXES.message): MessageLineLayout {
  const right = box.x + box.width
  let dx = -5
  const gameLabelLeft = right + dx - MESSAGE_GAME_LABEL_WIDTH
  dx -= MESSAGE_GAME_LABEL_WIDTH + 2
  const totalRight = right + dx
  dx -= 2 * MESSAGE_DIGIT_WIDTH + 4
  const slashLeft = right + dx - MESSAGE_SLASH.width
  const slashTop = box.y + Math.trunc((box.height - MESSAGE_SLASH.height) / 2) + MESSAGE_SLASH.oy
  dx -= MESSAGE_SLASH.width + 2
  const gameRight = right + dx
  dx -= String(game).length * MESSAGE_DIGIT_WIDTH + 7
  const yearLabelLeft = right + dx - MESSAGE_YEAR_LABEL_WIDTH
  dx -= MESSAGE_YEAR_LABEL_WIDTH + 2
  const labelGap = box.height - MESSAGE_LABEL_HEIGHT
  const labelTop = box.y + (labelGap >> 1) + (labelGap % 2)
  return { gameLabelLeft, totalRight, slashLeft, slashTop, gameRight, yearLabelLeft, yearRight: right + dx, labelTop }
}
