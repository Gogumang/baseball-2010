import { describe, expect, it } from 'vitest'
import { TITLE_IMAGES, footerBottomOf, headerTopOf } from '@/widgets/screen-frame/lib/screenFrameLayout'

/** 머리띠·바닥띠 (0x54a61 · 0x55110) — 제목표는 점프표 0xd19b0 17칸 (P6 1절 확정) */

describe('머리띠 제목표', () => {
  it('제목 그림은 x = 8, 시즌모드만 10 이다', () => {
    const 시즌 = TITLE_IMAGES.시즌모드[0]

    expect([시즌.image, 시즌.x, 시즌.dy]).toEqual([22, 10, 15])
    expect(TITLE_IMAGES.홈런더비[0].x).toBe(8)
  })

  it('나만의리그·미션모드는 제목 + 부제 두 장이다 — 부제는 x = 98, dy = 21', () => {
    expect(TITLE_IMAGES.나만의리그타자편.map((part) => part.image)).toEqual([9, 10])
    expect(TITLE_IMAGES.나만의리그투수편.map((part) => part.image)).toEqual([9, 11])
    expect(TITLE_IMAGES.미션모드타자편.map((part) => part.image)).toEqual([18, 10])
    expect(TITLE_IMAGES.미션모드투수편[1]).toEqual({ image: 11, x: 98, dy: 21 })
  })

  it('점프표 17칸이 모두 들어 있다 — 1·2 팀선택, 12·13 미션 편은 한 칸으로 합쳤다', () => {
    // 번호 0~16 중 1·2 가 같은 그림, 8/9 와 12/13 이 부제만 다르다 → 이름 16개
    expect(Object.keys(TITLE_IMAGES)).toHaveLength(16)
  })
})

describe('띠 기준선', () => {
  it('머리띠는 정착하면 −8, 바닥띠는 320 이다', () => {
    expect(headerTopOf(30)).toBe(-8)
    expect(footerBottomOf(30)).toBe(320)
  })
})
