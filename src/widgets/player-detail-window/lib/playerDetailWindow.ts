import { abilityRadarAxesOf } from '@/pages/create-player/lib/abilityRadarPanel'
import type { AbilityRadarAxis } from '@/pages/create-player/lib/abilityRadarPanel'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'

/**
 * **선수 정보 창 0x5b798(skin, 종류, rec)** — '0' INFO. 종류 3 투수 · 2 타자. 부르는 곳 둘(`xref 0x5b798`):
 * - 교체 창 0x384b8 → 0x381e8(리터럴 0x384b4) — 창 자리는 '0' 키 0x49712 가 세운다.
 * - 엔트리 목록 창 0x5c984 끝 0x5cfc8 — `0x5b798(ed, 투수 탭 [ed+0x33f] ? 3 : 2, [[ed+0x420] + (투수 ? 0x14 : 0x18)] + 커서·0x30)`
 *   (커서 = [목록+0x10]×[목록+0x14]+[목록+0xc], 0x5cf90~0x5cfc8). 창 자리는 편집기 키 0x55864 의 '0' 갈래 0x55920 이 세운다.
 *
 * 창 상태는 skin(편집기) 칸 [+0x424] 켜짐 · [+0x425] 다 열림 · [+0x426] 걸음 · [+0x428] 끝 x − W/2 + 0x60 · [+0x42c..+0x432] (x, y, w, h).
 * ```
 * '0' 키   x = W/2 + a · y = H/2 − b · w = 7 · h = 203 · [+0x428] = x − W/2 · 걸음 1 · [+0x425] = 0
 *          교체 창 0x49712: a = 0x52, b = 0x65 → (202, 59)   엔트리 창 0x55920: a = 0x5c, b = 0x60 → (212, 64)
 * 0x5c8aa  (창을 다 그린 뒤) 걸음 ×= 2 · x −= 걸음 · w += 걸음, w > 105 면 w = 106 · x = W/2 + [+0x428] − 0x60 · [+0x425] = 1
 * ```
 * 창 안의 칸은 모두 [+0x42c] · [+0x42e] 에서 잰다 — 2026-10-16 r99 unicorn 으로 0x5b798 을 (116, 64) · (106, 59) 두 자리에서 돌려
 * 같은 상대값을 받았다(칸 x + 9 · 값 x + 39 · 줄 y + 9 / + 27 / … · 도형 가운데 (x + w/2, y + h/2 − 16 · − 6)).
 */
export interface DetailWindowOrigin {
  /** '0' 키가 세운 첫 x */
  readonly startX: number
  readonly y: number
}

/** 교체 창 '0' 0x49712 — (W/2 + 0x52, H/2 − 0x65) */
export const SUBSTITUTION_DETAIL_ORIGIN: DetailWindowOrigin = { startX: 202, y: 59 }
/** 엔트리 목록 창 '0' 0x55920 — (W/2 + 0x5c, H/2 − 0x60) */
export const ENTRY_DETAIL_ORIGIN: DetailWindowOrigin = { startX: 212, y: 64 }

export const DETAIL_WINDOW = { startWidth: 7, finalWidth: 106, height: 203, finalDx: -0x60 } as const

export interface DetailWindowFrame {
  readonly x: number
  readonly width: number
  readonly isOpen: boolean
}

/** 연 뒤 `draw` 번째(0 부터) 그림의 창 (0x5c8aa) */
export function detailWindowFrameAt(draw: number, origin: DetailWindowOrigin = SUBSTITUTION_DETAIL_ORIGIN): DetailWindowFrame {
  let x: number = origin.startX
  let width: number = DETAIL_WINDOW.startWidth
  let step = 1
  for (let index = 0; index < draw; index += 1) {
    step *= 2
    x -= step
    width += step
    if (width > 105) return { x: origin.startX + DETAIL_WINDOW.finalDx, width: DETAIL_WINDOW.finalWidth, isOpen: true }
  }
  return { x, width, isOpen: false }
}

/**
 * 창 틀 0x5476c → 0x5461c(skin, x, y, w, h) — 둥근 칠(x, y, w, h, 1, #081C4A) · 둥근 테두리(x+1, y+1, w−2, h−2, #335FCD) ·
 * 점 넷(x+2 · x+w−2, y+2 · y+h−2, #335FCD) · 둥근 칠(x+2, y+2, w−4, h−4, #FFFFFF) · 둥근 칠(x+4, y+4, w−8, h−8, #335FCD).
 * 안쪽은 0xbae25(x + 5, y + 5, w − 10, h − 10) 로 자른다.
 */
export const DETAIL_COLORS = { outer: '#081C4A', edge: '#335FCD', white: '#FFFFFF' } as const

/**
 * 줄 — 칸 x = 창 x + 9 (game_ui 23, 25×15) · 값 칸 창 x + 39 (game_ui 28, 54×15). y 는 창 y 에서 잰 값(에뮬레이션으로 받았다).
 * 이름 글은 0xb9d74(글, 창 x + 9, 창 y + `labelDy`, 25, 15, 0x22, …, dy [sp+0x14] = 1) — 0x5b90c~0x5b916 이 dy 1 을 넘기므로
 * 글 칸은 결국 y = `labelDy` + 1 이다(`DETAIL_LABEL_DY`).
 */
export interface DetailRow {
  readonly labelFrame: number
  readonly cellDy: number
  readonly labelDy: number
  readonly textDy: number
}

export const DETAIL_LABEL_DX = 9
export const DETAIL_VALUE_DX = 39
export const DETAIL_LABEL_CELL = 23
export const DETAIL_VALUE_CELL = 28
/** 0xb9d74 의 dy [sp+0x14] = 1 (0x5b90c `movs r5, #1` · 0x5b916 `str r5, [sp, #0x14]`) */
export const DETAIL_LABEL_DY = 1

/** 투수(종류 3): 29 타입 · 30 손 · 34 구질(흐르는 글) · 33 스킬 · 32 마구 · 86 연봉 */
export const PITCHER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellDy: 9, labelDy: 8, textDy: 9 },
  { labelFrame: 30, cellDy: 27, labelDy: 26, textDy: 27 },
  { labelFrame: 34, cellDy: 125, labelDy: 124, textDy: 125 },
  { labelFrame: 33, cellDy: 143, labelDy: 142, textDy: 143 },
  { labelFrame: 32, cellDy: 160, labelDy: 160, textDy: 161 },
  { labelFrame: 86, cellDy: 179, labelDy: 178, textDy: 179 },
]

/** 타자(종류 2): 29 타입 · 30 손 · 33 스킬 · 35 필살 · 86 연봉 */
export const BATTER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellDy: 9, labelDy: 8, textDy: 9 },
  { labelFrame: 30, cellDy: 27, labelDy: 26, textDy: 27 },
  { labelFrame: 33, cellDy: 143, labelDy: 142, textDy: 143 },
  { labelFrame: 35, cellDy: 161, labelDy: 160, textDy: 161 },
  { labelFrame: 86, cellDy: 179, labelDy: 178, textDy: 179 },
]

/** 능력치 도형 0x5aefc(…, 가운데 x = 창 x + w/2, y = 창 y + h/2 − 16(투수) · − 6(타자), 종류, rec, 0, 반지름 22) */
export const DETAIL_RADAR = { dx: 53, pitcherDy: 85, batterDy: 95, radius: 22 } as const

/** 다 열린 창의 도형 가운데 */
export function detailRadarCenterOf(origin: DetailWindowOrigin, isPitcher: boolean): { readonly x: number; readonly y: number } {
  return {
    x: origin.startX + DETAIL_WINDOW.finalDx + DETAIL_RADAR.dx,
    y: origin.y + (isPitcher ? DETAIL_RADAR.pitcherDy : DETAIL_RADAR.batterDy),
  }
}

/**
 * 도형 축 칸 (0x5aefc 0x5b412 루프, 반지름 22) — 축 끝(선 0x6a905 #6B92F4 → 지금 꼭짓점) · 이름 상자 slt_frame 17(26×29) ·
 * 이름 img_text 상자 + 3 · 숫자 0x6aff8(상자 x + 0x12, 상자 y + 0x11, 앵커 4). 가운데 기준 상대값.
 * 상자 자리는 ABILITY 판과 같은 식 `abilityRadarAxesOf`(0x5b48c~0x5b532)로 돌린다 — 반지름 22 라 d = |30 − 22| = 8 을
 * x 는 안쪽으로(왼쪽 축 +8 · 오른쪽 축 −8), y 는 각도 ≤ 180(아래 축) 이면 +8 · 그 밖(위 축) −8 옮긴다:
 * 상자 = (−45, −38) · (19, −38) · (19, 9) · (−45, 9).
 */
export const DETAIL_RADAR_AXES: readonly AbilityRadarAxis[] = abilityRadarAxesOf({ x: 0, y: 0 }, DETAIL_RADAR.radius)

/** 축 이름 img_text — 0xd1b14: 투수 37 제구 · 38 구속 · 39 변화 · 40 체력 / 타자 41 히트 · 42 파워 · 43 수비 · 44 주루 */
export const DETAIL_RADAR_LABELS = { pitcher: [37, 38, 39, 40], batter: [41, 42, 43, 44] } as const

/* ── 값 ─────────────────────────────────────────────────────────────────────────────── */

/** 연봉 0x55cf4 — v ≤ 9999 "%d" · 그 밖 "%d억"(나머지 0) · "%d억%03d" */
export function salaryTextOf(value: number): string {
  if (value <= 9999) return String(value)
  const eok = Math.trunc(value / 10000)
  const rest = value % 10000
  return rest === 0 ? `${eok}억` : `${eok}억${String(rest).padStart(3, '0')}`
}

/** 손 글 — 표 0xd2084 · 0xd208c(우타 · 좌타) / 0xd2094 · 0xd209c(우완 · 좌완) */
const HAND_TEXT = { batter: ['우타', '좌타'], pitcher: ['우완', '좌완'] } as const
/** 타입 글 표 0x1400124 — 타자 +0xb >> 5 (타격형 · 장타형) · 투수 (폼 >> 1) + 2 (오버핸드 · 사이드암 · 언더스로) */
const BATTER_TYPE_TEXT = ['타격형', '장타형'] as const
const PITCHER_TYPE_TEXT = ['오버핸드', '사이드암', '언더스로'] as const
/** 마선수 타입 — StrCOMMON[0x69 + 순번](타자) · [0x6e + 순번](투수) */
const ACE_BATTER_TYPE_TEXT = ['백의천사', '무에타이', '새침부끄', '헤비메탈', '프로레슬링'] as const
const ACE_PITCHER_TYPE_TEXT = ['싸이킥커', '사자왕류', 'MK-II', '뱀파이어', '용인족'] as const
/** 마구 StrCOMMON[0x1e + n](1~3) · n = 4 면 [0x22 + 폼 >> 1] */
const MAGIC_TEXT = ['파이어 볼', '웨이브 볼', '썬더 볼'] as const
const FORM_MAGIC_TEXT = ['샤이닝 볼', '캐넌 볼', '미라지 볼'] as const
/** 필살 StrCOMMON[0x18 + n] · 장타형이고 n = 4 면 [0x1d] 메테오 스윙 */
const SPECIAL_SWING_TEXT = ['파워 스윙', '플레임 스윙', '토네이도스윙', '미라지 스윙'] as const
const METEOR_SWING_TEXT = '메테오 스윙'
/** 없음 글 0xcc274 · 이어 붙이기 0xcc298 */
export const DETAIL_NONE_TEXT = '-'
const JOIN_TEXT = ' / '

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
function skillNamesOf(bits: number, isPitcher: boolean): string[] {
  const names: string[] = []
  for (let k = 0; k <= 0x17; k += 1) {
    if (((bits >>> k) & 1) === 0) continue
    const id = isPitcher && k > 7 ? k + 16 : k
    names.push(ORIGINAL_SKILLS[id]?.name ?? '')
  }
  return names
}

const textValue = (text: string): DetailRowValue => ({ kind: 'text', text })
const tickerOrNone = (names: readonly string[]): DetailRowValue =>
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
 * 레코드 한 장의 상세 창 값 (0x5b798 의 투수 갈래 0x5bf64~ · 타자 갈래 0x5b81e~).
 * 연봉 = 레코드 +0x1b × 10 × 100 (5c848~5c886: 모드 [0x1552d10] 3 · 4 이고 육성 0xb6389 면 저장 0x1f8d5(모드)+0x1c8 u16, 아니면 +0x1b).
 * 마선수는 육성이 아니라 +0x1b — 행 값(`ACE_*_GRADES`)이다.
 * 원본 레코드엔 +0x1b 가 늘 있다 — 웹 옛 저장의 빈 칸은 불러올 때 0 으로 이사하므로(r278 `migrateHallOfFamer` · `withRecordSalaryGrades`)
 * `grade` null 은 표 찾기 실패(앱 길에서는 닿지 않는다)뿐이고 그때는 0 으로 둔다.
 */
export function playerDetailOf(source: PlayerDetailSource): PlayerDetail {
  const isAce = source.aceIndex >= 0
  const aceGrade = isAce ? (source.isPitcher ? ACE_PITCHER_GRADES : ACE_BATTER_GRADES)[source.aceIndex] : undefined
  // 5c848~5c886 — 모드 3 · 4 의 육성 선수는 저장 +0x1c8 × 100, 그 밖은 +0x1b × 10 × 100
  const salary = textValue(source.nurturedSalary !== undefined
    ? salaryTextOf(source.nurturedSalary * 100)
    : salaryTextOf((source.grade ?? aceGrade ?? 0) * 1000))
  if (source.isPitcher) {
    const { form, magicNumber, pitchMask } = source.repertoire ?? { form: 0, magicNumber: 0, pitchMask: 0 }
    const pitches: string[] = []
    // 5c2b0 — k = 1..22, 레코드 +0x1c & 표 0xd17a8[k](= 1 << (k − 1)) 이면 이름 표 0x14000c8[k]
    for (let k = 1; k <= 0x16; k += 1) if ((pitchMask & (1 << (k - 1))) !== 0) pitches.push(PITCH_TYPES[k - 1]?.name ?? '')
    const magic = magicNumber <= 0
      ? textValue(DETAIL_NONE_TEXT)
      : isAce
        ? { kind: 'ticker' as const, text: ACE_PLAYERS[5 + source.aceIndex]?.burst ?? '' }
        : { kind: 'ticker' as const, text: magicNumber === 4 ? (FORM_MAGIC_TEXT[form >> 1] ?? '') : (MAGIC_TEXT[magicNumber - 1] ?? '') }
    return {
      kind: '투수',
      abilities: source.abilities,
      values: [
        textValue(isAce ? (ACE_PITCHER_TYPE_TEXT[source.aceIndex] ?? '') : (PITCHER_TYPE_TEXT[form >> 1] ?? '')),
        textValue(HAND_TEXT.pitcher[pitcherHandOf(form, isAce)] ?? ''),
        { kind: 'ticker', text: pitches.join(JOIN_TEXT) },
        tickerOrNone(skillNamesOf(source.skillBits, true)),
        magic,
        salary,
      ],
    }
  }
  const battingType = source.profile >> 5
  const special = isAce
    ? { kind: 'ticker' as const, text: ACE_PLAYERS[source.aceIndex]?.burst ?? '' }
    : (source.specialNumber ?? 0) > 0
      ? { kind: 'ticker' as const, text: specialSwingTextOf(source.specialNumber ?? 0, battingType) }
      : textValue(DETAIL_NONE_TEXT)
  return {
    kind: '타자',
    abilities: source.abilities,
    values: [
      textValue(isAce ? (ACE_BATTER_TYPE_TEXT[source.aceIndex] ?? '') : (BATTER_TYPE_TEXT[battingType] ?? '')),
      // 손 0xb63c0 타자 갈래 — 마타자는 표 0xd88b0, 그 밖은 +0xb 비트 4
      textValue(HAND_TEXT.batter[batterHandOf(source.profile, source.aceIndex)] ?? ''),
      tickerOrNone(skillNamesOf(source.skillBits, false)),
      special,
      salary,
    ],
  }
}

/** 둥근 테두리 0x6aa64(둥글기 ≤ 3) — 선 넷 (`commonPanel` 의 roundEdge 와 같은 식) */
export function roundEdgeRectsOf(x: number, y: number, w: number, h: number): { x: number; y: number; width: number; height: number }[] {
  return [
    { x: x + 1, y, width: w - 1, height: 1 },
    { x: x + 1, y: y + h, width: w - 1, height: 1 },
    { x, y: y + 1, width: 1, height: h - 1 },
    { x: x + w, y: y + 1, width: 1, height: h - 1 },
  ]
}
