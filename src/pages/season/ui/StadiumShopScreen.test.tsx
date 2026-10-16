// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StadiumShopScreen } from '@/pages/season/ui/StadiumShopScreen'
import { resetLiveGameState, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { seasonScoreboardRewindXOf } from '@/widgets/batting-stage/lib/renderScenery'
import {
  boardBonusOf, standCapacityOf, stadiumOwnedIndexOf,
} from '@/entities/season-mode/model/stadiumItems'

/**
 * 구장 아이템 상점(0x957c · 0x7d90)과 구장관리 교체(0x7958) — S3 확정.
 * 가드 순서와 **원본 버그 세 가지**(인기도 안 깎임 · 교체 가드 없음 · 잔디 무효과)를 못박는다.
 */

afterEach(cleanup)

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

const 보유하게 = (record: SeasonRecord, kind: '관중석' | '전광판' | '잔디', slot: number): SeasonRecord => ({
  ...record,
  stadiumOwned: record.stadiumOwned.map((owned, index) =>
    index === stadiumOwnedIndexOf(kind, slot) ? true : owned,
  ),
})

const 띄우기 = (record: SeasonRecord, 나머지: Partial<Parameters<typeof StadiumShopScreen>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <StadiumShopScreen
      record={record}
      onChange={onChange}
      onBack={vi.fn()}
      {...나머지}
    />,
  )
  return onChange
}

/** 칸 줄 누름 칸 — 처음 누르면 그 칸으로 초점 · 커서를 옮기고, 커서 칸을 다시 누르면 확인(−5) */
const 칸고르기 = (이름: string) => {
  fireEvent.click(screen.getByRole('option', { name: 이름 }))
  fireEvent.click(screen.getByRole('option', { name: 이름 }))
}
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('구장 아이템 상점 — 가드 순서 (0x9a84~0x9bd2)', () => {
  it('인기도가 모자라면 필요한 인기도를 알려 준다 (StrMODE[62])', () => {
    띄우기(레코드({ popularity: 0, money: 9999 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('인기도가 부족합니다. 필요한 인기도 : 200')
  })

  it('인기도를 채워도 소지금이 모자라면 막힌다 (StrMODE[77])', () => {
    띄우기(레코드({ popularity: 200, money: 299 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('소지금이 부족합니다')
  })

  it('이미 가진 칸은 인기도보다 먼저 걸린다 (StrMODE[78])', () => {
    띄우기(보유하게(레코드({ popularity: 0, money: 0 }), '관중석', 1))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('이미 가지고 있는 아이템입니다')
  })

  it('히든 칸(4~6)은 해금 전이면 이름이 "????"(0xd4c18)이고 StrMODE[76] 로 막힌다', () => {
    띄우기(레코드({ popularity: 9999, money: 9999 }))

    // 보이는 다섯 줄(0~4) 중 칸 4 가 잠긴 히든 — 설명은 힌트 StrITEM[249]
    칸고르기('관중석 ????')

    expect(알림글()).toContain('아직 구매할 수 없는 아이템입니다')
  })

  it('히든 칸 힌트는 설명 상자에 — 관중석 칸 4 StrITEM[249] · 전광판은 +3 (0x83e4c~0x83e5a)', () => {
    띄우기(레코드())
    fireEvent.click(screen.getByRole('option', { name: '관중석 ????' }))
    expect(screen.getByTestId('구장-설명').getAttribute('aria-label')).toBe('나는야\n관중석 컬렉터')
  })

  it('해금된 히든 칸은 살 수 있다', () => {
    띄우기(레코드({ popularity: 9999, money: 9999 }), { isHiddenOpen: (id) => id === 13 })

    칸고르기('관중석 트로피컬')

    expect(알림글()).toContain('구매하겠습니까')
  })
})

describe('구장 아이템 상점 — 구매 확정 (0x812c)', () => {
  it('가격은 표값 × 100(100만 단위) 이라 2단 관중석이 3억이다', () => {
    띄우기(레코드({ popularity: 200, money: 9999 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('소지금 3억')
  })

  it('사면 소지금이 깎이고 그 자리에서 장착된다', () => {
    const onChange = 띄우기(레코드({ popularity: 200, money: 400 }))

    칸고르기('관중석 2단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.money).toBe(100) // 400 − 300
    expect(바뀐.stadiumOwned[stadiumOwnedIndexOf('관중석', 1)]).toBe(true)
    expect(바뀐.stadiumEquipped[0]).toBe(1)
  })

  it('⚠️ 원본 버그: 사도 **인기도가 깎이지 않는다** (S3 5-1 — 차감 코드가 없다)', () => {
    const onChange = 띄우기(레코드({ popularity: 800, money: 9999 }))

    칸고르기('관중석 3단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect((onChange.mock.calls[0][0] as SeasonRecord).popularity).toBe(800)
  })

  it('기본 4칸을 다 모으면 컬렉터 해금 13 이 열린다 (0x81d0)', () => {
    const onUnlock = vi.fn()
    let record = 레코드({ popularity: 9999, money: 9999 })
    record = 보유하게(보유하게(보유하게(record, '관중석', 0), '관중석', 1), '관중석', 2)
    띄우기(record, { onUnlock })

    칸고르기('관중석 4단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    // 0x81d0 은 구매 완료 팝업(결과코드 15)이 닫힐 때 돈다
    expect(onUnlock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onUnlock).toHaveBeenCalledWith([13])
    // 0x62368 → 공용 창 StrCOMMON[139] "히든 아이템 오픈!!" [트로피컬] + [141] "시즌모드에서 사용가능합니다"
    expect(알림글()).toContain('히든 아이템 오픈!!')
    expect(알림글()).toContain('트로피컬')
    expect(알림글()).toContain('시즌모드에서')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
  })

  it('이미 열린 컬렉터 칸은 0x61f5c 가 걸러 다시 열지도 알리지도 않는다', () => {
    const onUnlock = vi.fn()
    let record = 레코드({ popularity: 9999, money: 9999 })
    record = 보유하게(보유하게(보유하게(record, '관중석', 0), '관중석', 1), '관중석', 2)
    띄우기(record, { onUnlock, isHiddenOpen: (id) => id === 13 })

    칸고르기('관중석 4단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onUnlock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
  })
})

describe('구장관리 교체 (0x7958)', () => {
  it('구장관리(0xb158)도 상점(0xb1f8 메뉴 칸 1 갈래)도 구장 미리보기를 깐다', () => {
    띄우기(레코드(), { mode: '구장관리' })
    expect(screen.getByTestId('구장-미리보기')).toBeTruthy()
    cleanup()
    띄우기(레코드())
    expect(screen.getByTestId('구장-미리보기')).toBeTruthy()
  })

  it('하늘 칸은 진입 때의 마지막 경기 상태 +0x6b 다 (0xe558 0x783b0 → 구장 +0x18 · 0xe560 0x76fc5)', () => {
    setLiveGameInningIndex(9)
    띄우기(레코드(), { mode: '구장관리' })
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-sky-column')).toBe('9')
    cleanup()
    resetLiveGameState()
    띄우기(레코드(), { mode: '구장관리' })
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-sky-column')).toBe('0')
  })

  it('구장관리 진입이 잰 하늘은 장면 구장 칸으로 돌려준다 — 상점은 0x783b0 을 안 불러 그 값을 쓴다 (0x5f3c 6250)', () => {
    setLiveGameInningIndex(9)
    const onPreviewSceneChange = vi.fn()
    띄우기(레코드(), { mode: '구장관리', onPreviewSceneChange })
    expect(onPreviewSceneChange).toHaveBeenCalledWith(expect.objectContaining({ skyColumn: 9 }))
    cleanup()
    resetLiveGameState()
    // 상점은 지금 경기 상태가 아니라 장면 칸(앞서 구장관리가 둔 4)을 쓴다
    띄우기(레코드(), { previewScene: { skyRow: 1, skyColumn: 4, scoreboardX: 0 } })
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-sky-column')).toBe('4')
  })

  it('상점 진입은 전광판 글자를 상자 폭 + 2 로 되감고(0x62ee 0x77edc), 나갈 때 그 자리를 장면 칸에 남긴다', () => {
    const record = { ...레코드(), stadiumEquipped: [0, 2, 0] }
    const onPreviewSceneChange = vi.fn()
    const { unmount } = render(
      <StadiumShopScreen record={record} onChange={vi.fn()} onBack={vi.fn()}
        previewScene={{ skyRow: 0, skyColumn: 0, scoreboardX: -40 }} onPreviewSceneChange={onPreviewSceneChange} />,
    )
    const rewound = seasonScoreboardRewindXOf(2)
    expect(rewound).not.toBeNull()
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-scoreboard-x')).toBe(String(rewound))
    unmount()
    expect(onPreviewSceneChange).toHaveBeenLastCalledWith({ skyRow: 0, skyColumn: 0, scoreboardX: rewound })
  })

  it('전광판 칸 0 · 5 는 되감기가 아무것도 안 해 장면 칸 값 그대로다 · 구장관리는 글자를 안 흘린다', () => {
    띄우기({ ...레코드(), stadiumEquipped: [0, 0, 0] }, { previewScene: { skyRow: 0, skyColumn: 0, scoreboardX: -40 } })
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-scoreboard-x')).toBe('-40')
    cleanup()
    띄우기({ ...레코드(), stadiumEquipped: [0, 2, 0] }, { mode: '구장관리', previewScene: { skyRow: 0, skyColumn: 0, scoreboardX: -40 } })
    expect(screen.getByTestId('구장-미리보기').getAttribute('data-scoreboard-x')).toBe('-40')
  })

  it('⚠️ 원본 버그: 가드가 하나도 없어 **안 산 칸도 그대로 끼워진다**', () => {
    const onChange = 띄우기(레코드({ popularity: 0, money: 0 }), { mode: '구장관리' })

    칸고르기('관중석 4단 관중석')

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.stadiumEquipped[0]).toBe(3)
    // 보유 기록은 건드리지 않는다 — `rec[0x1b8 + 종류] = 선택칸` 한 줄이 전부다
    expect(바뀐.stadiumOwned[stadiumOwnedIndexOf('관중석', 3)]).toBe(false)
    expect(바뀐.money).toBe(0)
    // StrMODE[185] `!C[!cFFFF00%s!cFFFFFF]!N아이템을 적용합니다` — 이름은 노랑, 안내는 둘째 줄
    expect(알림글()).toContain('[4단 관중석]아이템을 적용합니다')
    const 이름 = [...screen.getByRole('dialog', { name: '알림' }).querySelectorAll('span')]
      .find((node) => node.textContent === '4단 관중석') as HTMLElement | undefined
    expect(이름?.style.color).toBe('rgb(255, 255, 0)')
  })
})

describe('키 조작 (0x957c · 창 키 0x819ac)', () => {
  it('종류 목록에서 확인 · 아래 → 칸 목록(커서 0), ↑↓ 로 칸을 옮기고 확인 키로 고른다', () => {
    띄우기(레코드({ popularity: 0, money: 9999 }))

    expect(screen.getByTestId('구장-창').getAttribute('data-focus')).toBe('종류')
    fireEvent.keyDown(window, { key: 'ArrowDown' }) // 초점 → 칸 목록, 칸 0
    expect(screen.getByTestId('구장-창').getAttribute('data-focus')).toBe('칸')
    fireEvent.keyDown(window, { key: 'ArrowDown' }) // 0 → 1 (2단 관중석)
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(알림글()).toContain('필요한 인기도 : 200')
  })

  it('칸 목록에서 취소는 종류 목록으로, 종류 목록에서 ← → 로 종류를 감아 옮긴다 (0x81a6c · 0x81ca2)', () => {
    const onBack = vi.fn()
    띄우기(레코드(), { onBack })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByTestId('구장-창').getAttribute('data-focus')).toBe('종류')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('구장-창').getAttribute('data-kind')).toBe('잔디')
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByTestId('구장-창').getAttribute('data-kind')).toBe('관중석')
  })

  it('칸은 끝에서 감고 보이는 다섯 줄 밖이면 굴린다 (깃발 0x30 · 0x6c2bd)', () => {
    띄우기(레코드())
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'ArrowUp' }) // 0 → 6
    expect(screen.getByTestId('구장-칸-6')).toBeTruthy()
    expect(screen.queryByTestId('구장-칸-1')).toBeNull()
  })

  it('취소(−16)로 되돌아간다', () => {
    const onBack = vi.fn()
    render(
      <StadiumShopScreen record={레코드()} onChange={vi.fn()} onBack={onBack} />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})

describe('잔디', () => {
  it('⚠️ 원본 버그: 1·2·3억을 받으면서 **관중 계산에 하나도 안 들어간다** (S3 8절)', () => {
    const onChange = 띄우기(레코드({ popularity: 0, money: 9999 }))

    fireEvent.click(screen.getByRole('option', { name: '잔디' }))
    칸고르기('잔디 인조잔디')
    expect(알림글()).toContain('소지금 1억') // 표값 1 × 100 = 100(100만) = 1억
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.money).toBe(9899)
    expect(바뀐.stadiumEquipped[2]).toBe(1)
    // 관중 수용·가산은 관중석·전광판 칸만 본다 — 잔디를 바꿔도 그대로다
    expect(standCapacityOf(바뀐)).toBe(standCapacityOf(레코드()))
    expect(boardBonusOf(바뀐)).toBe(boardBonusOf(레코드()))
  })

  it('잔디에는 히든이 없어 네 칸뿐이고 인기도 제한도 없다', () => {
    띄우기(레코드())

    fireEvent.click(screen.getByRole('option', { name: '잔디' }))

    expect(screen.getAllByRole('option', { name: /^잔디 / })).toHaveLength(4)
    // 잔디 설명은 StrITEM[144 + 칸] 한 줄뿐이다 (0x83ebe~0x83ee6)
    expect(screen.getByTestId('구장-설명').getAttribute('aria-label')).toBe('조금은 거친\n인조잔디')
  })
})

describe('창 그림 (0x83378 종류 4)', () => {
  it('설명은 인기도 줄 → 효과 줄 차례다 (0x83f30 · 0x83f38 · 0x83f40)', () => {
    띄우기(레코드())
    fireEvent.click(screen.getByRole('option', { name: '관중석 2단 관중석' }))
    expect(screen.getByTestId('구장-설명').getAttribute('aria-label')).toBe('인기도 200 이상\n25000명 수용\n가능')
    fireEvent.click(screen.getByRole('option', { name: '전광판' }))
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByTestId('구장-설명').getAttribute('aria-label')).toBe('인기도 100 이상\n관중 +2000')
  })

  it('가격은 0xd45c0 × 10000 만원 — 커서 칸에만, 칸 목록에 있을 때만', () => {
    띄우기(레코드())
    expect(screen.queryByTestId('구장-가격')).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: '관중석 4단 관중석' }))
    expect(screen.getByTestId('구장-가격').getAttribute('aria-label')).toBe('100000')
  })
})
