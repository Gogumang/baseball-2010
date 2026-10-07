// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'

describe('NariScreenPush — 142 ↔ 143 화면 밀기', () => {
  it('화면이 바뀌면 앞 화면 복제를 겹쳐 밀고, 같은 화면이면 아무것도 안 건다', () => {
    const { container, rerender } = render(<NariScreenPush view="142"><p>경기 준비</p></NariScreenPush>)
    const host = container.querySelector('[aria-hidden]') as HTMLElement
    expect(host.childElementCount).toBe(0)
    rerender(<NariScreenPush view="143:내팀"><p>엔트리</p></NariScreenPush>)
    // 첫 프레임 — 옛 화면(142)의 복제가 겹친다. 방향 4 는 새 화면이 왼쪽 밖(−240)에서 들어온다
    expect(host.textContent).toBe('경기 준비')
    expect(host.style.transform).toContain('0px')
    expect((host.previousElementSibling as HTMLElement).style.transform).toContain('-240px')
  })
})
