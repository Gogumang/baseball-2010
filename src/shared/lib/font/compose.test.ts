import { describe, expect, it } from 'vitest'
import {
  DRAWABLE_SYLLABLES,
  HANGUL_ATLAS,
  TABLE_QUIRKS,
} from '@/shared/lib/font/atlas'
import { chooseSets, composePieces, decomposeSyllable, glyphOf } from '@/shared/lib/font/compose'

/**
 * 원본 벌 고르기 0x9bb28 을 옮긴 것이 맞는지 본다.
 *
 * 정답은 해독 문서 R5-font-particles.md 3·6 절과, 그 문서가 unicorn 으로 원본 함수를 돌려
 * 2401자 전부 비트 단위 일치를 확인한 파이썬 구현이다. tools/extract_font.py 가 같은 식을
 * 다시 구현하고 있으므로, 아래 지문은 그 파이썬으로 뽑은 값이다.
 */
describe('글꼴 조각 고르기', () => {
  it('글꼴 파일 끝의 획 복잡도 표가 문서와 같다', () => {
    expect(HANGUL_ATLAS.jungStroke).toEqual(
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    )
    expect(HANGUL_ATLAS.choStroke).toEqual([1, 1, 1, 1, 1, 3, 1, 2, 2, 1, 1, 1, 1, 1, 2, 2, 3, 1, 3])
    expect(HANGUL_ATLAS.jongStroke).toEqual(
      [1, 1, 1, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 2, 2, 3, 1, 3],
    )
  })

  it('아틀라스 칸 수가 483조각 = 12x19 + 7x21 + 4x27 이다', () => {
    const { choSets, choCount, jungSets, jungCount, jongSets, jongCount } = HANGUL_ATLAS
    expect(choSets * choCount + jungSets * jungCount + jongSets * jongCount).toBe(483)
    expect(HANGUL_ATLAS.jungRow).toBe(choSets)
    expect(HANGUL_ATLAS.jongRow).toBe(choSets + jungSets)
  })

  it('완성형 음절을 초·중·종성 순번으로 나눈다', () => {
    expect(decomposeSyllable('가')).toEqual({ cho: 0, jung: 0, jong: -1 })
    expect(decomposeSyllable('강')).toEqual({ cho: 0, jung: 0, jong: 20 })
    expect(decomposeSyllable('넓')).toEqual({ cho: 2, jung: 4, jong: 10 })
  })

  it('호환 자모는 제 자리에 홀로 놓인다', () => {
    expect(decomposeSyllable('ㄱ')).toEqual({ cho: 0, jung: -1, jong: -1 })
    expect(decomposeSyllable('ㅏ')).toEqual({ cho: -1, jung: 0, jong: -1 })
    // 초성으로 못 쓰는 겹자음은 종성 자리에만 들어간다
    expect(decomposeSyllable('ㄳ')).toEqual({ cho: -1, jung: -1, jong: 2 })
  })

  it('2350자 밖 한글은 나누지 못한다 (원본에서 사라지는 글자)', () => {
    expect(DRAWABLE_SYLLABLES.has('뷁')).toBe(false)
    expect(decomposeSyllable('뷁')).toBeNull()
    expect(decomposeSyllable('갂')).toBeNull()
    expect(glyphOf('뷁')).toEqual({ kind: 'skip' })
  })

  it('원본 표의 오타 3자를 그대로 옮긴다', () => {
    expect(TABLE_QUIRKS).toEqual({ 괩: '괨', 닒: '닖', 쏀: '쎙' })
    // 쏀 은 원본에서 쎙(ㅆ+ㅔ+ㅇ) 으로 찍힌다
    expect(decomposeSyllable('쏀')).toEqual({ cho: 10, jung: 5, jong: 20 })
    expect(decomposeSyllable('괩')).toEqual({ cho: 0, jung: 10, jong: 15 })
    expect(decomposeSyllable('닒')).toEqual({ cho: 2, jung: 20, jong: 13 })
  })

  it('받침이 없으면 중성 모양(SHAPE)이 초성 벌을 정한다', () => {
    // 가: 세로 모음 → 초성 벌 0, 중성 벌 0
    expect(chooseSets({ cho: 0, jung: 0, jong: -1 })).toEqual({ choSet: 0, jungSet: 0, jongSet: 0 })
    // 고(ㅗ): SHAPE[8]=2 → 2−1 = 1
    expect(chooseSets({ cho: 0, jung: 8, jong: -1 })).toEqual({ choSet: 1, jungSet: 0, jongSet: 0 })
    // 과(ㅘ): SHAPE[9]=4 → 3
    expect(chooseSets({ cho: 0, jung: 9, jong: -1 })).toEqual({ choSet: 3, jungSet: 0, jongSet: 0 })
  })

  it('세로 모음 + 받침은 표 마지막 행을 쓴다', () => {
    expect(chooseSets({ cho: 0, jung: 0, jong: 20 })).toEqual({ choSet: 5, jungSet: 1, jongSet: 0 })
  })

  it('가로 모음 + 받침은 획 복잡도로 표 행을 고른다', () => {
    // 국: 초성 ㄱ(1) + 종성 ㄱ(1) = 2 → 행 3 = [8,3,2], ㅜ 는 복합이 아니라 +0
    expect(chooseSets({ cho: 0, jung: 13, jong: 0 })).toEqual({ choSet: 8, jungSet: 3, jongSet: 2 })
    // 글: 초성 ㄱ(1) + 종성 ㄹ(3) = 4 → 행 1 = [10,5,1]
    expect(chooseSets({ cho: 0, jung: 18, jong: 7 })).toEqual({ choSet: 10, jungSet: 5, jongSet: 1 })
    // 를: 초성 ㄹ(3) + 종성 ㄹ(3) = 6 > 4 → 행 0 = [6,2,1]
    expect(chooseSets({ cho: 5, jung: 18, jong: 7 })).toEqual({ choSet: 6, jungSet: 2, jongSet: 1 })
    // 괜: 복합 모음 ㅙ 라 초성 벌이 하나 커진다 (행 3 의 8 → 9)
    expect(chooseSets({ cho: 0, jung: 10, jong: 3 })).toEqual({ choSet: 9, jungSet: 3, jongSet: 2 })
  })

  it('모음이 홀로 있으면 중성 전용 벌 6 을 쓴다', () => {
    expect(chooseSets({ cho: -1, jung: 0, jong: -1 }).jungSet).toBe(6)
    expect(composePieces({ cho: -1, jung: 0, jong: -1 })).toEqual([
      { atlas: 'hangul', column: 0, row: HANGUL_ATLAS.jungRow + 6, shiftX: 0 },
    ])
  })

  it('자음이 홀로 있으면 2픽셀 오른쪽으로 민다', () => {
    expect(composePieces({ cho: 0, jung: -1, jong: -1 })).toEqual([
      { atlas: 'hangul', column: 0, row: HANGUL_ATLAS.choRow, shiftX: 2 },
    ])
  })

  it('ㅐㅒㅔㅖㅙㅞ 아래 받침은 1픽셀 오른쪽으로 민다', () => {
    // 괜(ㅙ) 의 종성 ㄴ
    const pieces = composePieces({ cho: 0, jung: 10, jong: 3 })
    expect(pieces[2]).toEqual({ atlas: 'hangul', column: 3, row: HANGUL_ATLAS.jongRow + 2, shiftX: 1 })
    // 강(ㅏ) 의 종성 ㅇ 은 안 민다
    expect(composePieces({ cho: 0, jung: 0, jong: 20 })[2].shiftX).toBe(0)
  })

  /**
   * 2350자 + 호환 자모 51자를 전부 돌려 얻은 조각 목록의 지문.
   * 값은 tools/extract_font.py 의 choose_sets 로 뽑았고, 그 식은 해독 문서가 원본 함수 에뮬레이션과
   * 비트 단위로 맞춰 둔 것이다. 벌 고르기가 한 글자라도 달라지면 여기서 걸린다.
   */
  it('완성형 2350자 + 자모 51자의 조각 지문이 원본과 같다', () => {
    const characters = [...DRAWABLE_SYLLABLES]
    expect(characters).toHaveLength(2350)
    const jamo: string[] = []
    for (let code = 0x3131; code <= 0x3163; code += 1) jamo.push(String.fromCodePoint(code))
    expect(jamo).toHaveLength(51)

    const blob = [...characters, ...jamo]
      .map((character) => {
        const indices = decomposeSyllable(character)
        if (indices === null) throw new Error(`못 나눈 글자: ${character}`)
        return composePieces(indices)
          .map((piece) => `${piece.atlas[0]}${piece.column}:${piece.row}:${piece.shiftX}`)
          .join('|')
      })
      .join(';')

    let hash = 0x811c9dc5
    for (const byte of new TextEncoder().encode(blob)) {
      hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
    }
    expect(hash.toString(16)).toBe('bf2ece54')
  })

  it('영문은 아틀라스 한 칸이고 공백은 그림 없이 전진만 한다', () => {
    expect(glyphOf('A')).toEqual({
      kind: 'draw',
      advance: 5,
      pieces: [{ atlas: 'ascii', column: (0x41 - 0x21) % 16, row: Math.trunc((0x41 - 0x21) / 16), shiftX: 0 }],
    })
    expect(glyphOf(' ')).toEqual({ kind: 'blank', advance: 5 })
    expect(glyphOf('\n')).toEqual({ kind: 'newline' })
  })

  it("· 와 ‥ 만 영문 글꼴의 '.' 과 ':' 로 바뀐다", () => {
    expect(glyphOf('·')).toEqual(glyphOf('.'))
    expect(glyphOf('‥')).toEqual(glyphOf(':'))
    // 전각 숫자·원문자는 기호 글꼴을 안 올려서 원본에서 조용히 사라진다
    expect(glyphOf('０')).toEqual({ kind: 'skip' })
    expect(glyphOf('①')).toEqual({ kind: 'skip' })
  })
})
