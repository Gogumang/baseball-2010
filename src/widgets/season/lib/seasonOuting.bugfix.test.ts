import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { checkSeasonOuting } from '@/widgets/season/lib/seasonOuting'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 병원 = 2
const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({ ...startNewSeason(0, '테스터').record, ...덮어쓰기 })

describe('B-25 시즌 외출 가드 0xbd38 이 병원 서브 아이템(SR+0x5f)을 안 봄', () => {
  const 서브아이템 = 레코드({ money: 0, illness: 3, outingSubItems: [false, false, true, false, false] })

  it('원본: 서브 아이템이 있어도 소지금 5 미만이면 입원이 막힌다', () => {
    expect(checkSeasonOuting(서브아이템, 50, 병원).reason).toBe('소지금부족')
  })

  it('고침: 서브 아이템이 비용 5 를 메워 들어간다 — 없으면 여전히 막힌다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-25']))
    expect(checkSeasonOuting(서브아이템, 50, 병원).ok).toBe(true)
    expect(checkSeasonOuting({ ...서브아이템, outingSubItems: [false, false, false, false, false] }, 50, 병원).reason).toBe('소지금부족')
  })
})
