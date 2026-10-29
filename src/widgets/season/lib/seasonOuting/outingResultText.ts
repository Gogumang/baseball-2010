import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 결과 글 한 줄의 재료 — 굴린 값(부호 · 줄 여부)과 서브 아이템 보정 */
interface OutingLine {
  readonly label: number
  readonly rolled: number
  readonly bonus: number
}

/** 0xc9e4~0xca14 — "(" + ("+" | "-") + |보정| + ")" */
const bonusTextOf = (bonus: number, scale: number): string => (bonus === 0 ? '' : `(${bonus > 0 ? '+' : '-'}${Math.abs(bonus * scale)})`)

/** [83] 상승 · [84] 하락 — 굴린 값의 부호로 고른다(보정을 더한 값이 아니다) */
const riseTextOf = (rolled: number): string => ORIGINAL_MODE_TEXT[rolled >= 0 ? 83 : 84] ?? ''

/**
 * 결과 팝업 0x17 글 (0xc9a8~0xcd76, 직접 떴다). 글 상자는 "!C" 로 시작한다(0xc822).
 * ```
 * c9a8  인기도 굴림 ≠ 0:  [22] + " " + |굴림 + 보정| + 보정글 + ([83] | [84]) + "!N"
 * ca40  평판 굴림 ≠ 0:    [23] + " " + |굴림 + 보정| + 보정글 + ([83] | [84]) + "!N"
 * cada  소지금 기본 ≠ 0:  [25] + " " + |기본 + 보정| × 100 + "만" + 보정글(×100) + ([83] | [84]) + "!N"
 * cbd4  사기 m ≠ 0:       [24] + " " + |m + 보정| + 보정글 + ([83] | [84])            ; 끝 "!N" 없음
 * cc6a  p == 2 이고 나았으면: "!N" "!N" + sprintf([206], StrMODE[185 + 질병 SR+5])
 * cd0c  서브 아이템이 있으면: "!N" "!N" "!cFFFF00" + StrITEM[114 + p] + " " + StrMODE[195]
 * ```
 * 줄 여부와 [83]/[84] 는 **굴린 값**을 보고, 숫자는 보정을 더한 절댓값이다 — 서브 아이템 병원의 소지금은
 * 기본 −5 + 5 = 0 이라 "소지금 0만(+500)하락" 이 된다(원본 그대로). "만" 은 보정글 앞에 붙는다.
 */
export function seasonOutingResultTextOf(
  lines: readonly OutingLine[],
  money: OutingLine,
  morale: OutingLine,
  curedIllness: number | null,
  subItemPlace: number | null,
): string {
  return `!C${lines.map(gainLineTextOf).join('')}${moneyLineTextOf(money)}${moraleLineTextOf(morale)}${cureTextOf(curedIllness)}${subItemTextOf(subItemPlace)}`
}

/** c9a8 · ca40 — 인기도 · 평판 줄 (굴림이 0 이면 없음) */
function gainLineTextOf(line: OutingLine): string {
  if (line.rolled === 0) return ''
  return `${ORIGINAL_MODE_TEXT[line.label] ?? ''} ${Math.abs(line.rolled + line.bonus)}${bonusTextOf(line.bonus, 1)}${riseTextOf(line.rolled)}!N`
}

/** cada — 소지금 줄: 100만 단위 × 100 + "만" (기본이 0 이면 없음) */
function moneyLineTextOf(money: OutingLine): string {
  if (money.rolled === 0) return ''
  return `${ORIGINAL_MODE_TEXT[money.label] ?? ''} ${Math.abs(money.rolled + money.bonus) * 100}만${bonusTextOf(money.bonus, 100)}${riseTextOf(money.rolled)}!N`
}

/** cbd4 — 사기 줄, 끝 "!N" 없음 (m 이 0 이면 없음) */
function moraleLineTextOf(morale: OutingLine): string {
  if (morale.rolled === 0) return ''
  return `${ORIGINAL_MODE_TEXT[morale.label] ?? ''} ${Math.abs(morale.rolled + morale.bonus)}${bonusTextOf(morale.bonus, 1)}${riseTextOf(morale.rolled)}`
}

/** cc6a — 입원으로 나은 질병 */
function cureTextOf(curedIllness: number | null): string {
  if (curedIllness === null) return ''
  return `!N!N${(ORIGINAL_MODE_TEXT[206] ?? '').replace('%s', ORIGINAL_MODE_TEXT[185 + curedIllness] ?? '')}`
}

/** cd0c — 서브 아이템 효과 글 (노랑) */
function subItemTextOf(subItemPlace: number | null): string {
  if (subItemPlace === null) return ''
  return `!N!N!cFFFF00${ORIGINAL_ITEMS[114 + subItemPlace] ?? ''} ${ORIGINAL_MODE_TEXT[195] ?? ''}`
}
