import { describe, expect, it } from 'vitest'
import { SEASON_FIRST_NOTICE } from '@/shared/config/original/mainMenu'
import {
  MODE_ENTRIES, RESTART_MODE_STATE, TOP_ENTRIES, generalModeEntryCursorOf, initialMainMenu, isEntryEnabled,
  reduceMainMenu, selectedIdOf,
} from '@/pages/main-menu/model/mainMenu'
import type { MainMenuState } from '@/pages/main-menu/model/mainMenu'

/**
 * 원작 메뉴는 두 단이라 모드 시험은 **윗단에서 [게임시작] 을 고른 뒤**(하위 상태 4 → 5) 시작한다.
 * (예전 시험들은 아랫단만 그리던 시절이라 곧바로 모드를 골랐다 — 원본 흐름을 되살리며 한 단 더 탄다.)
 */
function 게임시작목록(hasSavedGame: boolean): MainMenuState {
  const state = initialMainMenu(hasSavedGame)
  expect(state.tier).toBe(4)
  expect(selectedIdOf(state)).toBe('게임시작')
  return reduceMainMenu(state, { type: '시작' }, hasSavedGame).state
}

function 고르기(state: MainMenuState, id: string, hasSavedGame: boolean): MainMenuState {
  return reduceMainMenu(state, { type: '모드선택', id }, hasSavedGame).state
}

describe('처음 메뉴 (하위 상태 4) — 원작의 윗단', () => {
  it('여섯 칸이 순서대로 있다 — StrMAINMENU [0]~[4]·[209]', () => {
    expect(TOP_ENTRIES.map((entry) => entry.id)).toEqual([
      '게임시작', '스페셜', '도움말', '환경설정', '랭킹', '게임문의',
    ])
  })

  it('게임시작을 고르면 아랫단(상태 5)으로 내려가고 커서는 0(최근게임)이다 — 진입 0x25b88', () => {
    const 아랫단 = 게임시작목록(true)
    expect(아랫단.tier).toBe(5)
    expect(아랫단.selectedModeId).toBe('최근게임')
  })

  it('아랫단에서 취소하면 윗단으로 돌아온다 — 0x28cb0 의 CLR → 0xbcb49(this+0x18, 4)', () => {
    const 아랫단 = 고르기(게임시작목록(false), '시즌모드', false)
    const 윗단 = reduceMainMenu(아랫단, { type: '뒤로' }, false)

    expect(윗단.effect).toBeNull()
    expect(윗단.state.tier).toBe(4)
    expect(selectedIdOf(윗단.state)).toBe('게임시작')
  })

  it('윗단에서 다시 게임시작을 고르면 커서가 0 으로 돌아간다 — 진입 0x25b88', () => {
    const 아랫단 = 고르기(게임시작목록(false), '미션모드', false)
    const 윗단 = reduceMainMenu(아랫단, { type: '뒤로' }, false).state

    expect(reduceMainMenu(윗단, { type: '시작' }, false).state.selectedModeId).toBe('최근게임')
  })

  it('스페셜·도움말·환경설정은 윗단에서 갈라진다 — 하위 상태 6 · 9 · 8', () => {
    const 간곳 = (id: string) => {
      const 고름 = 고르기(initialMainMenu(false), id, false)
      return reduceMainMenu(고름, { type: '시작' }, false).effect
    }

    expect(간곳('스페셜')).toBe('스페셜')
    expect(간곳('도움말')).toBe('도움말')
    expect(간곳('환경설정')).toBe('환경설정')
  })

  it('윗단에서 취소하면 타이틀로 간다', () => {
    expect(reduceMainMenu(initialMainMenu(false), { type: '뒤로' }, false).effect).toBe('타이틀로')
  })

  it('랭킹·게임문의는 커서가 지나가되 시작해도 아무 데도 안 간다 (근사 — 원본 처리 미해독)', () => {
    for (const id of ['랭킹', '게임문의']) {
      const 고름 = 고르기(initialMainMenu(false), id, false)
      expect(selectedIdOf(고름)).toBe(id)

      const 시작 = reduceMainMenu(고름, { type: '시작' }, false)
      expect(시작.effect).toBeNull()
      expect(시작.state.lockedNotice).toBeNull()
      expect(시작.state.tier).toBe(4)
    }
  })

  it('윗단도 끝에서 한 바퀴 돈다', () => {
    let state = initialMainMenu(false)
    const 본것 = new Set<string>()
    for (let step = 0; step < TOP_ENTRIES.length; step += 1) {
      본것.add(selectedIdOf(state))
      state = reduceMainMenu(state, { type: '커서', step: 1 }, false).state
    }

    expect(본것.size).toBe(TOP_ENTRIES.length)
    expect(selectedIdOf(state)).toBe('게임시작')
  })
})

describe('reduceMainMenu — 원본 글자 목록에서 모드를 고르는 메인 메뉴 (하위 상태 5)', () => {
  it('원본은 저장 유무와 무관하게 늘 커서 0(최근게임)에서 시작한다', () => {
    expect(게임시작목록(false).selectedModeId).toBe('최근게임')
    expect(게임시작목록(true).selectedModeId).toBe('최근게임')
  })

  /**
   * 예전 시험은 "대전모드는 골라지지도 않는다" 였다. 원본은 **잠긴 칸도 목록에 그대로 나오고
   * 커서도 그대로 지나가며**, OK 를 눌렀을 때만 StrMAINMENU[115] 팝업이 뜨고 상태는 그대로다
   * (R11-special-leftovers 4-1 확정, 갱신 0x28cb0 / 0x28dcc) — 그 흐름으로 고쳤다.
   */
  it('대전모드는 골라지되 시작하면 StrMAINMENU[115] 안내만 뜨고 그대로 머문다', () => {
    const 고름 = 고르기(게임시작목록(true), '대전모드', true)
    expect(고름.selectedModeId).toBe('대전모드')

    const 시작 = reduceMainMenu(고름, { type: '시작' }, true)
    expect(시작.effect).toBeNull()
    expect(시작.state.lockedNotice).toBe(SEASON_FIRST_NOTICE)

    // 확인 팝업은 아무 키나 받아 닫힌다
    const 닫음 = reduceMainMenu(시작.state, { type: '시작' }, true)
    expect(닫음.state.lockedNotice).toBeNull()
    expect(닫음.state.selectedModeId).toBe('대전모드')
  })

  it('시즌모드로 시작하면 시즌모드로 간다 — 저장을 지워도 되는지 묻지 않는다', () => {
    const 고름 = 고르기(게임시작목록(true), '시즌모드', true)
    expect(고름.selectedModeId).toBe('시즌모드')

    const 시작 = reduceMainMenu(고름, { type: '시작' }, true)
    expect(시작.effect).toBe('시즌모드')
    expect(시작.state.isPickingNariEdition).toBe(false)
  })

  it('저장이 없어도 최근게임은 잠기지 않는다 — 원본은 커서로 막지 않는다', () => {
    const 나만의리그로이동 = 고르기(게임시작목록(false), '나만의리그', false)
    expect(나만의리그로이동.selectedModeId).toBe('나만의리그')

    expect(고르기(나만의리그로이동, '최근게임', false).selectedModeId).toBe('최근게임')
  })

  describe('최근게임 — 전역기록 +0x3c(마지막 모드)로 갈라진다 (0x28d54 → 0x327b8)', () => {
    const 최근게임 = (lastPlayedMode: number, inProgress = false) =>
      reduceMainMenu(게임시작목록(true), { type: '시작' }, true, inProgress, lastPlayedMode)

    it('미션(5·6)은 상태 17 선수 고르기, 홈런더비(7)는 상태 16 선수 고르기', () => {
      expect(최근게임(5).effect).toBe('미션')
      expect(최근게임(6).effect).toBe('미션')
      expect(최근게임(7).effect).toBe('홈런더비')
    })

    it('시즌(2)은 장면 0x105, 나리 투수편(3)·타자편(4)은 장면 0x106 — 그 편 고르기 뒤와 같은 길', () => {
      expect(최근게임(2).effect).toBe('시즌모드')
      expect(최근게임(3).effect).toBe('나리투수편')
      expect(최근게임(4).effect).toBe('나리타자편')
    })

    it('일반모드(1)는 +0x4d 면 창 없이 저장을 올려 경기로 (0x327f8)', () => {
      const 결과 = 최근게임(1, true)
      expect(결과.effect).toBe('일반모드경기이어하기')
      expect(결과.state.generalModeWindow).toBeNull()
    })

    it('일반모드(1)에 저장이 없으면 상태 12 [13] — 앞 상태 0x27 이라 처음 커서는 1(새로하기)', () => {
      const 결과 = 최근게임(1, false)
      expect(결과.effect).toBeNull()
      expect(결과.state.generalModeWindow).toEqual({ kind: '진입', initialSelected: 1 })
    })

    it('0 이면 아무 일도 없다 — 원본에선 나올 수 없는 값(새 저장은 1), 웹은 망가진 저장 대비로 목록에 남는다', () => {
      const 결과 = 최근게임(0)
      expect(결과.effect).toBeNull()
      expect(결과.state.generalModeWindow).toBeNull()
    })
  })

  it('미션모드로 시작하면 미션 선택으로 간다', () => {
    const 고름 = 고르기(게임시작목록(false), '미션모드', false)
    expect(reduceMainMenu(고름, { type: '시작' }, false).effect).toBe('미션')
  })

  it('나만의리그는 저장이 있어도 지울지 묻지 않고 편 고르기 창 [14](하위 13)를 띄운다 — [15] 는 일반모드 것이다', () => {
    for (const hasSavedGame of [false, true]) {
      const 고름 = 고르기(게임시작목록(hasSavedGame), '나만의리그', hasSavedGame)
      const 창 = reduceMainMenu(고름, { type: '시작' }, hasSavedGame)
      expect(창.effect).toBeNull()
      expect(창.state.isPickingNariEdition).toBe(true)
    }
  })

  it('[14] 답 0 은 타자편(모드 4) · 1 은 투수편(모드 3) · CLR(−1) 은 게임시작 목록 (0x2464c)', () => {
    const 고름 = 고르기(게임시작목록(true), '나만의리그', true)
    const 창 = reduceMainMenu(고름, { type: '시작' }, true).state
    const 답 = (answer: number) => reduceMainMenu(창, { type: '창답', answer }, true)

    expect(답(0).effect).toBe('나리타자편')
    expect(답(1).effect).toBe('나리투수편')
    expect(답(-1).effect).toBeNull()
    expect(답(-1).state.isPickingNariEdition).toBe(false)
    expect(답(-1).state.tier).toBe(5)
    // 창이 떠 있으면 목록 키는 안 먹는다
    expect(reduceMainMenu(창, { type: '뒤로' }, true).state).toBe(창)
  })
})

describe('원본 목록 — ↑↓ 로 고른다', () => {
  it('아래로 가면 다음 모드, 위로 가면 앞 모드가 된다', () => {
    const 시작 = 게임시작목록(false)
    const 아래 = reduceMainMenu(시작, { type: '커서', step: 1 }, false).state
    const 다시위 = reduceMainMenu(아래, { type: '커서', step: -1 }, false).state

    expect(아래.selectedModeId).not.toBe(시작.selectedModeId)
    expect(다시위.selectedModeId).toBe(시작.selectedModeId)
  })

  it('끝에서 한 바퀴 돈다', () => {
    let state = 게임시작목록(false)
    const 본것 = new Set<string>()
    for (let step = 0; step < MODE_ENTRIES.length; step += 1) {
      본것.add(state.selectedModeId)
      state = reduceMainMenu(state, { type: '커서', step: 1 }, false).state
    }

    // 한 바퀴 돌면 모든 칸을 지나고 처음으로 돌아온다
    expect(본것.size).toBe(MODE_ENTRIES.length)
    expect(state.selectedModeId).toBe(게임시작목록(false).selectedModeId)
  })

  it('고를 수 없는 칸에도 커서는 간다 — 설명을 읽을 수 있어야 한다', () => {
    let state = 게임시작목록(false)
    const 고를수없는칸 = MODE_ENTRIES.filter((entry) => !isEntryEnabled(entry, false)).map((entry) => entry.id)
    const 지난칸 = new Set<string>()
    for (let step = 0; step < MODE_ENTRIES.length; step += 1) {
      지난칸.add(state.selectedModeId)
      state = reduceMainMenu(state, { type: '커서', step: 1 }, false).state
    }

    expect(고를수없는칸.length).toBeGreaterThan(0)
    for (const id of 고를수없는칸) expect(지난칸).toContain(id)
  })
})

describe('일반모드 (모드 1) — 하위 12 진입 창 [13]·[15] (0x296f0)', () => {
  const 일반모드시작 = (inProgress: boolean) => {
    const 고름 = 고르기(게임시작목록(true), '일반모드', true)
    expect(고름.selectedModeId).toBe('일반모드')
    return reduceMainMenu(고름, { type: '시작' }, true, inProgress)
  }
  const 답 = (state: MainMenuState, answer: number, inProgress: boolean) =>
    reduceMainMenu(state, { type: '창답', answer }, true, inProgress)

  it('고르면 곧바로 들어가지 않고 [13] 창이 뜬다 — 저장(+0x4d)이 없으면 처음 커서는 1(새로하기)', () => {
    const 시작 = 일반모드시작(false)
    expect(시작.effect).toBeNull()
    expect(시작.state.generalModeWindow).toEqual({ kind: '진입', initialSelected: 1 })
  })

  it('중간 저장이 있으면 처음 커서는 0(이어하기), 앞 상태가 0x27 이면 저장과 상관없이 1 (0x297f0~0x29816)', () => {
    expect(일반모드시작(true).state.generalModeWindow).toEqual({ kind: '진입', initialSelected: 0 })
    expect(generalModeEntryCursorOf(RESTART_MODE_STATE, true)).toBe(1)
    expect(generalModeEntryCursorOf(RESTART_MODE_STATE, false)).toBe(1)
    expect(generalModeEntryCursorOf(5, true)).toBe(0)
  })

  it('저장이 없으면 이어하기·새로하기는 둘 다 상태 18(유저 팀), 빠른실행은 상태 22 — [15] 는 안 뜬다', () => {
    const 창 = 일반모드시작(false).state
    for (const answer of [0, 1]) {
      const 결과 = 답(창, answer, false)
      expect(결과.effect).toBe('일반모드')
      expect(결과.state.generalModeWindow).toBeNull()
    }
    expect(답(창, 2, false).effect).toBe('일반모드빠른실행')
  })

  it('CLR(−1) 은 창을 닫고 게임시작 목록(상태 5)에 남는다', () => {
    const 닫음 = 답(일반모드시작(false).state, -1, false)
    expect(닫음.effect).toBeNull()
    expect(닫음.state.generalModeWindow).toBeNull()
    expect(닫음.state.tier).toBe(5)
  })

  it('창이 떠 있으면 다른 키는 받지 않는다', () => {
    const 창 = 일반모드시작(false).state
    expect(reduceMainMenu(창, { type: '뒤로' }, true).state).toBe(창)
    expect(reduceMainMenu(창, { type: '시작' }, true).state).toBe(창)
  })

  it('저장이 있으면 이어하기는 상태 0x27(저장을 올려 경기), 새로하기·빠른실행은 [15] 확인을 먼저 띄운다', () => {
    const 창 = 일반모드시작(true).state
    expect(답(창, 0, true).effect).toBe('일반모드경기이어하기')

    const 새로 = 답(창, 1, true)
    expect(새로.effect).toBeNull()
    expect(새로.state.generalModeWindow).toEqual({ kind: '새로하기확인', next: '일반모드' })
    expect(답(새로.state, 0, true).effect).toBe('일반모드')
    for (const answer of [1, -1]) {
      const 아니오 = 답(새로.state, answer, true)
      expect(아니오.effect).toBeNull()
      expect(아니오.state.generalModeWindow).toBeNull()
    }

    const 빠른 = 답(창, 2, true)
    expect(빠른.state.generalModeWindow).toEqual({ kind: '새로하기확인', next: '일반모드빠른실행' })
    expect(답(빠른.state, 0, true).effect).toBe('일반모드빠른실행')
    expect(답(빠른.state, 1, true).effect).toBeNull()
  })
})
