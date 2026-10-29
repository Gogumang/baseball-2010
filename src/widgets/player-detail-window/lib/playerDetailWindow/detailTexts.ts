import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'

/** 연봉 0x55cf4 — v ≤ 9999 "%d" · 그 밖 "%d억"(나머지 0) · "%d억%03d" */
export function salaryTextOf(value: number): string {
  if (value <= 9999) return String(value)
  const eok = Math.trunc(value / 10000)
  const rest = value % 10000
  return rest === 0 ? `${eok}억` : `${eok}억${String(rest).padStart(3, '0')}`
}

/** 손 글 — 표 0xd2084 · 0xd208c(우타 · 좌타) / 0xd2094 · 0xd209c(우완 · 좌완) */
export const HAND_TEXT = { batter: ['우타', '좌타'], pitcher: ['우완', '좌완'] } as const

/** 타입 글 표 0x1400124 — 타자 +0xb >> 5 (타격형 · 장타형) · 투수 (폼 >> 1) + 2 (오버핸드 · 사이드암 · 언더스로) */
export const BATTER_TYPE_TEXT = ['타격형', '장타형'] as const

export const PITCHER_TYPE_TEXT = ['오버핸드', '사이드암', '언더스로'] as const

/** 마선수 타입 — StrCOMMON[0x69 + 순번](타자) · [0x6e + 순번](투수) */
export const ACE_BATTER_TYPE_TEXT = ['백의천사', '무에타이', '새침부끄', '헤비메탈', '프로레슬링'] as const

export const ACE_PITCHER_TYPE_TEXT = ['싸이킥커', '사자왕류', 'MK-II', '뱀파이어', '용인족'] as const

/** 마구 StrCOMMON[0x1e + n](1~3) · n = 4 면 [0x22 + 폼 >> 1] */
export const MAGIC_TEXT = ['파이어 볼', '웨이브 볼', '썬더 볼'] as const

export const FORM_MAGIC_TEXT = ['샤이닝 볼', '캐넌 볼', '미라지 볼'] as const

/** 필살 StrCOMMON[0x18 + n] · 장타형이고 n = 4 면 [0x1d] 메테오 스윙 */
const SPECIAL_SWING_TEXT = ['파워 스윙', '플레임 스윙', '토네이도스윙', '미라지 스윙'] as const

const METEOR_SWING_TEXT = '메테오 스윙'

/** 없음 글 0xcc274 · 이어 붙이기 0xcc298 */
export const DETAIL_NONE_TEXT = '-'

export const JOIN_TEXT = ' / '

export interface DetailRowValue {
  /** 흐르는 글(0x5a8c8 — 창이 다 열린 뒤에만)인가, 가운데 글(0xba411)인가 */
  readonly kind: 'text' | 'ticker'
  readonly text: string
}

export interface PlayerDetail {
  readonly kind: '투수' | '타자'
  readonly values: readonly DetailRowValue[]
  /** 도형 값 `0xb6414(rec, k, 1)` */
  readonly abilities: readonly number[]
}

/** 스킬 이름 — 투수 갈래(5c49c)는 k > 7 이면 StrCOMMON[0x47 + k], 타자 갈래는 늘 [0x37 + k] (직접 돌려 확인) */
export function skillNamesOf(bits: number, isPitcher: boolean): string[] {
  const names: string[] = []
  for (let k = 0; k <= 0x17; k += 1) {
    if (((bits >>> k) & 1) === 0) continue
    const id = isPitcher && k > 7 ? k + 16 : k
    names.push(ORIGINAL_SKILLS[id]?.name ?? '')
  }
  return names
}

export const textValue = (text: string): DetailRowValue => ({ kind: 'text', text })

export const tickerOrNone = (names: readonly string[]): DetailRowValue =>
  names.length === 0 ? textValue(DETAIL_NONE_TEXT) : { kind: 'ticker', text: names.join(JOIN_TEXT) }

/** 필살 이름 — 일반 레코드 +0x18 이 있을 때의 갈래(5bd90~5be0e) */
export function specialSwingTextOf(number: number, battingType: number): string {
  if (battingType === 1 && number === 4) return METEOR_SWING_TEXT
  return SPECIAL_SWING_TEXT[number - 1] ?? ''
}

/**
 * 마선수 레코드 +0x1b — XlsACE_PIT_DATA · XlsACE_BAT_DATA 행 바이트 0x1b (base/extracted 행을 직접 읽었다, 행 차례 = 순번).
 * 마선수 레코드는 행을 0x30 바이트 통째로 베낀 것이라(0x20094 · 0x1f824 · 0xb53f0 0x40 갈래 · 0x48d50) 이 칸을 고치는 곳이 없다.
 */
const ACE_PITCHER_GRADES: readonly number[] = [50, 40, 30, 20, 10]

const ACE_BATTER_GRADES: readonly number[] = [20, 30, 40, 50, 40]

/**
 * 연봉 칸 — 5c848~5c886: 모드 3 · 4 의 육성 선수는 저장 +0x1c8 × 100, 그 밖은 레코드 +0x1b × 10 × 100.
 * 마선수는 행 값(`ACE_*_GRADES`), 표 찾기 실패(`grade` null)는 0 으로 둔다.
 */
export function detailSalaryOf(source: PlayerDetailSource): DetailRowValue {
  if (source.nurturedSalary !== undefined) return textValue(salaryTextOf(source.nurturedSalary * 100))
  return textValue(salaryTextOf((source.grade ?? aceGradeOf(source) ?? 0) * 1000))
}

/** 마선수 레코드 +0x1b — 마선수가 아니면 undefined */
function aceGradeOf(source: PlayerDetailSource): number | undefined {
  if (source.aceIndex < 0) return undefined
  return (source.isPitcher ? ACE_PITCHER_GRADES : ACE_BATTER_GRADES)[source.aceIndex]
}
