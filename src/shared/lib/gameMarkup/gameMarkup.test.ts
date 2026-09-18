import { describe, expect, it } from 'vitest'
import { parseGameMarkup, stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

describe('parseGameMarkup', () => {
  it('마크업이 없으면 한 줄 한 조각이다', () => {
    const lines = parseGameMarkup('막둥아, 준비됐제?')

    expect(lines).toEqual([
      { segments: [{ text: '막둥아, 준비됐제?', color: null }], isCentered: false },
    ])
  })

  it('!N에서 줄을 나눈다', () => {
    const lines = parseGameMarkup('첫 줄!N둘째 줄')

    expect(lines).toHaveLength(2)
    expect(lines[0].segments[0].text).toBe('첫 줄')
    expect(lines[1].segments[0].text).toBe('둘째 줄')
  })

  it('!C 로 가운데 정렬이 시작되고 !L 에서 왼쪽으로 돌아간다', () => {
    const lines = parseGameMarkup('!C가운데!N그대로 가운데!N!L왼쪽')

    expect(lines.map((line) => line.isCentered)).toEqual([true, true, false])
  })

  it('!cRRGGBB 이후 글자에 색이 붙는다', () => {
    const lines = parseGameMarkup('보통!cFFFF00노랑')

    expect(lines[0].segments).toEqual([
      { text: '보통', color: null },
      { text: '노랑', color: '#FFFF00' },
    ])
  })

  it('!cFFFFFF는 기본색으로 되돌린다 — 흰색을 박아넣지 않는다', () => {
    const lines = parseGameMarkup('!cFFFF00강조!cFFFFFF보통')

    expect(lines[0].segments[1]).toEqual({ text: '보통', color: null })
  })

  it('색은 줄이 바뀌어도 유지된다', () => {
    const lines = parseGameMarkup('!cFF0000빨강!N여전히 빨강')

    expect(lines[1].segments[0].color).toBe('#FF0000')
  })

  it('%s를 순서대로 치환한다', () => {
    const lines = parseGameMarkup('%s은(는) %s 소속이다', ['신성수', '청운'])

    expect(lines[0].segments[0].text).toBe('신성수은(는) 청운 소속이다')
  })

  it('치환할 값이 없으면 %s를 그대로 둔다 — 빈 문자열로 지우지 않는다', () => {
    const lines = parseGameMarkup('%s 선수', [])

    expect(lines[0].segments[0].text).toBe('%s 선수')
  })

  it('색 코드처럼 안 생긴 !c는 그냥 글자로 남긴다', () => {
    const lines = parseGameMarkup('!cZZZ 일반 텍스트')

    expect(lines[0].segments[0].text).toBe('!cZZZ 일반 텍스트')
  })

  it('원본 실제 문자열을 처리한다', () => {
    const raw = '!C통한의 !cFF0000부상!cFFFFFF... 내게 다시!N한번 기회가 주어진다면!'
    const lines = parseGameMarkup(raw)

    expect(lines).toHaveLength(2)
    expect(lines[0].isCentered).toBe(true)
    expect(lines[0].segments.map((s) => s.text)).toEqual(['통한의 ', '부상', '... 내게 다시'])
    expect(lines[0].segments[1].color).toBe('#FF0000')
    expect(lines[1].segments[0].text).toBe('한번 기회가 주어진다면!')
  })
})

describe('!C·!L 은 다음 전환까지 이어진다', () => {
  it('게임문의 원문처럼 !C 뒤 여러 줄이 가운데이고 !L 부터 왼쪽이다', () => {
    const lines = parseGameMarkup('!C2010프로야구!NV %s!N(주)게임빌!N!N!Lwww.gamevil.com', ['1.0'])

    expect(lines.map((line) => line.isCentered)).toEqual([true, true, true, true, false])
  })
})

describe('!L 왼쪽 정렬', () => {
  it('도움말(StrHOWTO) 본문의 !L 은 글자로 남기지 않고 왼쪽 정렬로 읽는다', () => {
    const lines = parseGameMarkup('!C<기본 조작>!N!L상 : (2)')

    expect(lines[0].isCentered).toBe(true)
    expect(lines[1].isCentered).toBe(false)
    expect(lines[1].segments.map((s) => s.text)).toEqual(['상 : (2)'])
  })
})

describe('stripGameMarkup', () => {
  it('마크업을 걷어내고 줄바꿈만 남긴다', () => {
    const raw = '!C통한의 !cFF0000부상!cFFFFFF...!N다시 한번'

    expect(stripGameMarkup(raw)).toBe('통한의 부상...\n다시 한번')
  })

  it('치환도 함께 적용된다', () => {
    expect(stripGameMarkup('%s은(는) 전설이 되었다.', ['신성수'])).toBe('신성수은(는) 전설이 되었다.')
  })
})
