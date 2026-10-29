export type DialogueAlign = '왼' | '가운데' | '오른'

/** 글 속 표시 — `!N` 줄 바꿈 · `!L` `!C` `!R` 정렬 · `!cRRGGBB` 글색 (흰색 FFFFFF 는 기본색 null) */
export type DialogueMarkup =
  | { readonly kind: '줄'; readonly length: 2 }
  | { readonly kind: '정렬'; readonly length: 2; readonly align: DialogueAlign }
  | { readonly kind: '색'; readonly length: 8; readonly color: string | null }

const ALIGN_OF_CODE: Readonly<Record<string, DialogueAlign>> = { L: '왼', C: '가운데', R: '오른' }
const COLOR_CODE = /^[0-9A-Fa-f]{6}$/

/** `index` 에서 시작하는 표시 — 표시가 아니면 null. 길이(글자 수)가 곧 바이트 수다(모두 ASCII) */
export function markupAt(raw: string, index: number): DialogueMarkup | null {
  if (raw[index] !== '!' || index + 1 >= raw.length) return null
  const next = raw[index + 1]
  if (next === 'N') return { kind: '줄', length: 2 }
  const align = ALIGN_OF_CODE[next]
  if (align !== undefined) return { kind: '정렬', length: 2, align }
  const code = raw.slice(index + 2, index + 8)
  if (next !== 'c' || !COLOR_CODE.test(code)) return null
  const upper = code.toUpperCase()
  return { kind: '색', length: 8, color: upper === 'FFFFFF' ? null : `#${upper}` }
}
