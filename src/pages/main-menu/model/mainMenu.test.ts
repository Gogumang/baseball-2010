import { describe, expect, it } from 'vitest'
import { MODE_ENTRIES, initialMainMenu, isEntryEnabled, reduceMainMenu } from '@/pages/main-menu/model/mainMenu'

describe('reduceMainMenu — 원본 글자 목록에서 모드를 고르는 메인 메뉴', () => {
  it('저장이 없으면 나만의리그, 있으면 최근게임이 먼저 골라져 있다', () => {
    expect(initialMainMenu(false).selectedModeId).toBe('나만의리그')
    expect(initialMainMenu(true).selectedModeId).toBe('최근게임')
  })

  it('아직 만들지 않은 모드는 골라지지 않는다', () => {
    const result = reduceMainMenu(initialMainMenu(true), { type: '모드선택', id: '시즌모드' }, true)
    expect(result.state.selectedModeId).toBe('최근게임')
  })

  it('저장이 없으면 최근게임은 골라지지 않는다', () => {
    const result = reduceMainMenu(initialMainMenu(false), { type: '모드선택', id: '최근게임' }, false)
    expect(result.state.selectedModeId).toBe('나만의리그')
  })

  it('최근게임으로 시작하면 이어하기다', () => {
    expect(reduceMainMenu(initialMainMenu(true), { type: '시작' }, true).effect).toBe('이어하기')
  })

  it('미션모드로 시작하면 미션 선택으로 간다', () => {
    const 고름 = reduceMainMenu(initialMainMenu(false), { type: '모드선택', id: '미션모드' }, false)
    expect(reduceMainMenu(고름.state, { type: '시작' }, false).effect).toBe('미션')
  })

  it('저장이 없으면 나만의리그는 바로 새로하기다', () => {
    expect(reduceMainMenu(initialMainMenu(false), { type: '시작' }, false).effect).toBe('새로하기')
  })

  it('저장이 있는데 나만의리그로 시작하면 지울지 먼저 묻는다', () => {
    const 고름 = reduceMainMenu(initialMainMenu(true), { type: '모드선택', id: '나만의리그' }, true)
    const 물음 = reduceMainMenu(고름.state, { type: '시작' }, true)
    expect(물음.state.isConfirmingNewGame).toBe(true)
    expect(물음.effect).toBeNull()

    expect(reduceMainMenu(물음.state, { type: '확인', isAccepted: true }, true).effect).toBe('새로하기')
    expect(reduceMainMenu(물음.state, { type: '확인', isAccepted: false }, true).state.isConfirmingNewGame).toBe(false)
    expect(reduceMainMenu(물음.state, { type: '뒤로' }, true).state.isConfirmingNewGame).toBe(false)
  })

  it('뒤로는 타이틀로 간다', () => {
    expect(reduceMainMenu(initialMainMenu(false), { type: '뒤로' }, false).effect).toBe('타이틀로')
  })
})

describe('원본 목록 — ↑↓ 로 고른다', () => {
  it('아래로 가면 다음 모드, 위로 가면 앞 모드가 된다', () => {
    const 시작 = initialMainMenu(false)
    const 아래 = reduceMainMenu(시작, { type: '커서', step: 1 }, false).state
    const 다시위 = reduceMainMenu(아래, { type: '커서', step: -1 }, false).state

    expect(아래.selectedModeId).not.toBe(시작.selectedModeId)
    expect(다시위.selectedModeId).toBe(시작.selectedModeId)
  })

  it('끝에서 한 바퀴 돈다', () => {
    let state = initialMainMenu(false)
    const 본것 = new Set<string>()
    for (let step = 0; step < MODE_ENTRIES.length; step += 1) {
      본것.add(state.selectedModeId)
      state = reduceMainMenu(state, { type: '커서', step: 1 }, false).state
    }

    // 한 바퀴 돌면 모든 칸을 지나고 처음으로 돌아온다
    expect(본것.size).toBe(MODE_ENTRIES.length)
    expect(state.selectedModeId).toBe(initialMainMenu(false).selectedModeId)
  })

  it('고를 수 없는 칸에도 커서는 간다 — 설명을 읽을 수 있어야 한다', () => {
    let state = initialMainMenu(false)
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
