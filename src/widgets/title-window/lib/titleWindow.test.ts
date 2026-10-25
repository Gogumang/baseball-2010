import { describe, expect, it } from 'vitest'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { TITLE_WINDOW, titleWindowLinesOf } from '@/widgets/title-window/lib/titleWindow'

describe('칭호 팝업 0x1afe8', () => {
  it('자리 — 프레임 369 는 ((240 − 52)/2, 124), 글은 x 30 · 폭 180 에 y 145(조건) · 172(이름)', () => {
    expect(TITLE_WINDOW.headerTop).toBe(124)
    expect(TITLE_WINDOW.textLeft).toBe(30)
    expect(TITLE_WINDOW.conditionTop).toBe(145)
    expect(TITLE_WINDOW.nameTop).toBe(172)
    expect(TITLE_WINDOW.height).toBe(120)
  })

  it('i ≤ 31 · 타자편 32~47 → 조건 [i + 64] · 이름 [i]', () => {
    expect(titleWindowLinesOf(ORIGINAL_TITLES[8])).toEqual({
      conditionRaw: `!C${ORIGINAL_TITLES[72]}`,
      nameRaw: `!C!cFFFF00"${ORIGINAL_TITLES[8]}"`,
    })
    expect(titleWindowLinesOf(ORIGINAL_TITLES[40])?.conditionRaw).toBe(`!C${ORIGINAL_TITLES[104]}`)
  })

  it('투수편 i > 31 → 이름 [i + 16] · 조건 [i + 80] — 웹은 +16 한 이름을 들어 조건이 이름 번호 + 64 와 같다', () => {
    expect(titleWindowLinesOf(ORIGINAL_TITLES[40 + 16])?.conditionRaw).toBe(`!C${ORIGINAL_TITLES[40 + 80]}`)
  })

  it('저장 열쇠(앞뒤 빈칸 뗀 이름)로도 찾고, 이름 줄은 원문 그대로 끝 빈칸까지 (r225 — 예전엔 [1] · [2] 를 못 찾아 빈 창)', () => {
    expect(ORIGINAL_TITLES[1]).toBe('떠오르는 샛별 ')
    expect(titleWindowLinesOf('떠오르는 샛별')).toEqual({
      conditionRaw: `!C${ORIGINAL_TITLES[65]}`,
      nameRaw: '!C!cFFFF00"떠오르는 샛별 "',
    })
    expect(titleWindowLinesOf('최고의 루키')?.nameRaw).toBe('!C!cFFFF00"최고의 루키 "')
  })

  it('모르는 이름이면 null', () => {
    expect(titleWindowLinesOf('없는 칭호')).toBeNull()
  })
})
