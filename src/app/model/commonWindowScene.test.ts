import { describe, expect, it } from 'vitest'
import { sceneClosesWithoutShrinkOf } from '@/app/model/commonWindowScene'

describe('[창+0x24f] — 메인 메뉴 0x234d4 · 경기 0x3301c 는 1, 시즌 0x3b14 · 나리 0xf684 · 미션 목록 0x1d784 는 0', () => {
  it('메인 메뉴 장면(0x103)의 화면은 줄임 없이 닫힌다', () => {
    for (const kind of ['타이틀', '메인메뉴', '도움말', '환경설정', '스페셜', '홈런더비', '일반모드'] as const) {
      expect(sceneClosesWithoutShrinkOf(kind, false)).toBe(true)
    }
  })

  it('미션은 선수 고르기(하위 17)만 메인 메뉴 장면이고 목록(0x107)은 아니다', () => {
    expect(sceneClosesWithoutShrinkOf('미션선택', false)).toBe(true)
    expect(sceneClosesWithoutShrinkOf('미션선택', true)).toBe(false)
  })

  it('나리 · 시즌 화면은 줄임으로 닫힌다', () => {
    for (const kind of ['팀선택', '선수등록', '투수편', '시즌모드', '관리', '이벤트', '경기결과', '경기평가', '포스트시즌'] as const) {
      expect(sceneClosesWithoutShrinkOf(kind, false)).toBe(false)
    }
  })
})
