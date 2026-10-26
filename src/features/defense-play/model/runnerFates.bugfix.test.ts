import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { baserunnerAllowedOfFates } from '@/features/defense-play/model/runnerFates'
import { EMPTY_PITCHER_GAME_RECORD, recordAllowedBaserunner } from '@/entities/pitcher-career/model/pitcherGameRecord'
import {
  redrawnFieldingErrorsOf,
  redrawnFumbleCheerOf,
  drawnFieldingErrorsOf,
  drawnFumbleCheerOf,
} from '@/features/defense-play/model/fieldingErrors'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

describe('B-37 야수선택으로 타자주자만 살면 퍼펙트가 안 깨진다', () => {
  /** 1루 주자 2루 포스 아웃 · 타자주자는 1루에 산다 — 목록 [타자주자, 1루 주자] */
  const 야수선택 = [
    { fromBase: 0, scored: false, retired: false },
    { fromBase: 1, scored: false, retired: true },
  ]

  it('원본: 마지막 원소(죽은 1루 주자)만 보아 출루 허용이 안 선다', () => {
    expect(baserunnerAllowedOfFates(야수선택)).toBe(false)
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, [false, true]).allowedBaserunner).toBe(false)
  })

  it('고침: 산 주자가 하나라도 있으면 선다 — 모두 죽거나 들어오면 안 선다', () => {
    켜기('B-37')
    expect(baserunnerAllowedOfFates(야수선택)).toBe(true)
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, [false, true]).allowedBaserunner).toBe(true)
    expect(baserunnerAllowedOfFates([{ fromBase: 0, scored: false, retired: true }])).toBe(false)
    expect(baserunnerAllowedOfFates([])).toBe(false)
  })
})

describe('B-56 수비 그림 창 첫 그림에서 실책을 두 번 센다', () => {
  const 펌블야수 = [{ slot: 4, fumbleTicks: 6 }]

  it('원본: 다시 그린 그림도 펌블 실책 · 함성을 또 낸다', () => {
    expect(redrawnFieldingErrorsOf(펌블야수)).toEqual(drawnFieldingErrorsOf(펌블야수))
    expect(redrawnFieldingErrorsOf(펌블야수)).toHaveLength(1)
    expect(redrawnFumbleCheerOf(펌블야수)).toBe(true)
  })

  it('고침: 다시 그리기는 아무것도 안 낸다 — 첫 그림의 셈은 그대로', () => {
    켜기('B-56')
    expect(redrawnFieldingErrorsOf(펌블야수)).toEqual([])
    expect(redrawnFumbleCheerOf(펌블야수)).toBe(false)
    expect(drawnFieldingErrorsOf(펌블야수)).toHaveLength(1)
    expect(drawnFumbleCheerOf(펌블야수)).toBe(true)
  })
})
