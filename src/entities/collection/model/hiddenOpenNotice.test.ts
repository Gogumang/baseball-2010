import { describe, expect, it } from 'vitest'
import {
  announceHiddenOpens,
  closeHiddenOpenWindow,
  EMPTY_HIDDEN_OPEN_WINDOW,
  hiddenItemNameOf,
  hiddenOpenNoticeTextOf,
  hiddenOpenStoredIdOf,
  recordUnlockNoticeTextOf,
} from '@/entities/collection/model/hiddenOpenNotice'

describe('0x62368 히든 오픈 알림 글', () => {
  it('이름은 0x61e8c 의 구간표로 StrITEM 에서 — 관중석 · 전광판 · 투수 · 타자 장비', () => {
    expect(hiddenItemNameOf(13)).toBe('트로피컬')
    expect(hiddenItemNameOf(16)).toBe('내추럴전광판')
    expect(hiddenItemNameOf(21)).toBe('사신의 두건')
    expect(hiddenItemNameOf(31)).toBe('토끼털 신발')
    expect(hiddenItemNameOf(34)).toBe('황제의 신발')
    expect(hiddenItemNameOf(37)).toBe('프라임 헬멧')
    expect(hiddenItemNameOf(41)).toBe('오토봇 배트')
    expect(hiddenItemNameOf(47)).toBe('바이커 부츠')
    expect(hiddenItemNameOf(50)).toBe('이카로스슈즈')
    expect(hiddenItemNameOf(12)).toBeNull()
    expect(hiddenItemNameOf(51)).toBeNull()
  })

  it('StrCOMMON[139] + "!N!N" + 쓰는 곳 줄 [141] · [142] · [143] (원문)', () => {
    expect(hiddenOpenNoticeTextOf(13)).toBe('!C히든 아이템 오픈!!!N[!cFFFF00트로피컬!cFFFFFF]!N!N시즌모드에서!N사용가능합니다')
    expect(hiddenOpenNoticeTextOf(31)).toBe('!C히든 아이템 오픈!!!N[!cFFFF00토끼털 신발!cFFFFFF]!N!N나만의리그 투수편!N에서 사용가능합니다')
    expect(hiddenOpenNoticeTextOf(47)).toBe('!C히든 아이템 오픈!!!N[!cFFFF00바이커 부츠!cFFFFFF]!N!N나만의리그 타자편!N에서 사용가능합니다')
    expect(hiddenOpenNoticeTextOf(51)).toBeNull()
  })

  it('k ≤ 12 — 마선수 [140] · 히든 팀 [138] + StrCOMMON 이름, 쓰는 곳 줄 없음 (0x623ca~0x623fc)', () => {
    expect(hiddenOpenNoticeTextOf(0)).toBe('!C마선수 오픈!!N[!cFFFF00레오니!cFFFFFF]')
    expect(hiddenOpenNoticeTextOf(7)).toBe('!C마선수 오픈!!N[!cFFFF00킹타이거!cFFFFFF]')
    expect(hiddenOpenNoticeTextOf(12)).toBe('!C히든 팀 오픈!!!N[!cFFFF00외인구단!cFFFFFF]')
  })

  it('0x62234 글은 첫 줄만 — "!N!N" · 쓰는 곳 줄을 잇지 않는다', () => {
    expect(recordUnlockNoticeTextOf(46)).toBe('!C히든 아이템 오픈!!!N[!cFFFF00천상의 밴드!cFFFFFF]')
    expect(recordUnlockNoticeTextOf(5)).toBe('!C마선수 오픈!!N[!cFFFF00로제!cFFFFFF]')
  })

  it('히든 팀 k 8~12 는 웹 표의 팀 번호 10~14 로 적는다', () => {
    expect(hiddenOpenStoredIdOf(12)).toBe(14)
    expect(hiddenOpenStoredIdOf(8)).toBe(10)
    expect(hiddenOpenStoredIdOf(33)).toBe(33)
    expect(hiddenOpenStoredIdOf(7)).toBe(7)
  })

  it('공용 창은 떠 있는 것 하나 + 대기 한 칸 — 셋째는 대기를 덮는다 (0x74ef4 +0x2a4 · 0x75440)', () => {
    const one = announceHiddenOpens(EMPTY_HIDDEN_OPEN_WINDOW, [13])
    expect(one.shown).toBe(hiddenOpenNoticeTextOf(13))
    expect(one.pending).toBeNull()
    const three = announceHiddenOpens(one, [16, 41])
    expect(three.shown).toBe(hiddenOpenNoticeTextOf(13))
    expect(three.pending).toBe(hiddenOpenNoticeTextOf(41))
    const next = closeHiddenOpenWindow(three)
    expect(next.shown).toBe(hiddenOpenNoticeTextOf(41))
    expect(closeHiddenOpenWindow(next)).toEqual(EMPTY_HIDDEN_OPEN_WINDOW)
    // 글을 못 짓는 k 는 창을 안 바꾼다
    expect(announceHiddenOpens(EMPTY_HIDDEN_OPEN_WINDOW, [51])).toEqual(EMPTY_HIDDEN_OPEN_WINDOW)
  })

  it('창 꼬리표(이어 할 일)는 그 글과 함께 대기 칸으로 갔다가 다시 뜬다', () => {
    const then = () => undefined
    const one = announceHiddenOpens(EMPTY_HIDDEN_OPEN_WINDOW, [13])
    const two = announceHiddenOpens(one, [17], then)
    expect(two.shownThen ?? null).toBeNull()
    expect(two.pendingThen).toBe(then)
    expect(closeHiddenOpenWindow(two).shownThen).toBe(then)
  })
})
