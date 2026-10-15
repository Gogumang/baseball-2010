// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeasonTeamInfoScreen } from '@/pages/season/ui/SeasonTeamInfoScreen'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'

afterEach(cleanup)

const ROWS: readonly TeamInfoRow[] = [
  { labelFrame: 394, value: { kind: '글', text: '단장' } },
  { labelFrame: 222, value: { kind: '글', text: '----' } },
  { labelFrame: 191, value: { kind: '숫자', value: 5000, suffixFrame: 345 } },
  { labelFrame: 80, value: { kind: '글', text: '구장' } },
  { labelFrame: 321, value: { kind: '그림', frame: 347 } },
  { labelFrame: 224, value: { kind: '글', text: '--' } },
  { labelFrame: 47, value: { kind: '숫자', value: 3 } },
]

const filterOf = (scope: HTMLElement, frame: number) => (scope.querySelector(`img[data-frame="${frame}"]`) as HTMLImageElement).style.filter

describe('구단정보 0xd5 img_text 팔레트 (0x7c450)', () => {
  it('이름표는 팔레트 0 — 47 "순위" 는 팔레트 3 으로 구운 그림을 흰 글자로 되돌린다 (0x7c620 · 0x7c656)', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    expect(filterOf(screen.getByTestId('구단정보-줄-6'), 47)).toMatch(/^url\(#img-text-palette-.*-3-0\)$/)
    expect(filterOf(screen.getByTestId('구단정보-줄-0'), 394)).toBe('')
  })

  it('값 칸의 좌석 "석" 345 와 타입 이름표는 팔레트 1(노랑) — 0x7c914 · 0x7cca6', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    expect(filterOf(screen.getByTestId('구단정보-값-2'), 345)).toMatch(/^url\(#img-text-palette-.*-0-1\)$/)
    expect(filterOf(screen.getByTestId('구단정보-값-4'), 347)).toMatch(/^url\(#img-text-palette-.*-0-1\)$/)
  })
})
