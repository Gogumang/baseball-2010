// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { NariResumeManagementFrame } from '@/pages/management/ui/NariResumeManagementFrame'
import { PitcherResumeManagementFrame } from '@/pages/pitcher-league/ui/PitcherResumeManagementFrame'

afterEach(cleanup)

describe('이어하기 길 137 앞 화면의 105 한 틀 — 0x19da4 (r163)', () => {
  it('커맨드 줄 · 가운데 판(미끄러짐 첫 자리)을 그린다 — 타자편 · 투수편', () => {
    const batter = render(<NariResumeManagementFrame career={createCareer('타')} cursor={0} />)
    expect(batter.getByTestId('command-bar')).not.toBeNull()
    expect(batter.getByTestId('가운데판')).not.toBeNull()
    cleanup()
    const pitcher = render(<PitcherResumeManagementFrame career={createPitcherCareer('투')} cursor={0} />)
    expect(pitcher.getByTestId('command-bar')).not.toBeNull()
    expect(pitcher.getByTestId('가운데판')).not.toBeNull()
  })
})
