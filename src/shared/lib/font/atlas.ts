import atlasData from '@/shared/lib/font/fontAtlas.generated.json'

/**
 * tools/extract_font.py 가 원본 synGak9_11.ft2 · synGulimAsc5_11.ft2 에서 뽑아낸 아틀라스 정보.
 *
 * 다시 뽑는 명령:
 *   python3 tools/extract_font.py
 *
 * JSON 은 생성물이다 — 손으로 고치지 말고 스크립트를 고쳐라.
 */

/** 한글 벌 글꼴 아틀라스. 한 줄이 한 벌이고 칸은 9x11 이다. */
export const HANGUL_ATLAS = atlasData.hangul

/** 영문 1바이트 글꼴 아틀라스. 0x21~0x7E 94자가 16열로 놓여 있다. */
export const ASCII_ATLAS = atlasData.ascii

/**
 * 원본이 그릴 수 있는 KS X 1001 완성형 2350자.
 * 이 밖의 한글(뷁·갂 …)은 원본에서 그려지지도, 자리를 차지하지도 않는다 (R5 5절).
 */
export const DRAWABLE_SYLLABLES: ReadonlySet<string> = new Set([...atlasData.ks2350])

/**
 * 원본 CP949→조합형 표 0xd602e 의 오타 3자 (R5 2절).
 * 원본이 이 글자들을 다른 글자 모양으로 찍으므로 그대로 옮긴다 — 고치지 않는다.
 */
export const TABLE_QUIRKS: Readonly<Record<string, string>> = atlasData.quirks

/** 호환 자모 U+3131~U+3163 51자의 [초성, 중성, 종성] 조각 순번. 없는 자리는 −1. */
export const JAMO_SLOTS: readonly (readonly number[])[] = atlasData.jamoSlots

export const FIRST_COMPAT_JAMO = 0x3131
export const LAST_COMPAT_JAMO = 0x3163
