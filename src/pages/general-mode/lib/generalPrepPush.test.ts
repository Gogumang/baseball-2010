import { describe, expect, it } from 'vitest'
import { generalPrepPushDirectionOf } from '@/pages/general-mode/lib/generalPrepPush'

describe('일반모드 준비 화면 밀기 0xbdae9(…, 8, 0, 방향, 1000) — A-68', () => {
  it('18 OK → 19 는 3 · 19 CLR → 18 은 4 (29d2a · 29c34)', () => {
    expect(generalPrepPushDirectionOf('18', '19')).toBe(3)
    expect(generalPrepPushDirectionOf('19', '18')).toBe(4)
  })

  it("22 '4' → 23 유저 팀 4 · '6' → CPU 팀 3, 23 나감은 유저 팀 3 · CPU 팀 4 (313e4 · 313fe · 2a46a~2a476)", () => {
    expect(generalPrepPushDirectionOf('22', '23:유저')).toBe(4)
    expect(generalPrepPushDirectionOf('22', '23:CPU')).toBe(3)
    expect(generalPrepPushDirectionOf('23:유저', '22')).toBe(3)
    expect(generalPrepPushDirectionOf('23:CPU', '22')).toBe(4)
  })

  it('그 밖의 바뀜은 밀지 않는다 — 19 → 20 · 메인 메뉴에서 18', () => {
    expect(generalPrepPushDirectionOf('19', '그밖')).toBeNull()
    expect(generalPrepPushDirectionOf('그밖', '18')).toBeNull()
    expect(generalPrepPushDirectionOf('그밖', '22')).toBeNull()
  })
})
