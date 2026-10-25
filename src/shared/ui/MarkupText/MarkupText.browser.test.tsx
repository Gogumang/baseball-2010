import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@/app/styles/global.css'
import { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import { TITLE_WINDOW } from '@/widgets/title-window/lib/titleWindow'

/**
 * **브라우저 시험 — 원문 끝 빈칸이 빈 줄을 만들지 않는가** (r225, 실제 CSS).
 *
 * r223 이 생성 표에 원문 앞뒤 빈칸을 두고 `MarkupText` 를 `white-space: break-spaces` 로 바꿨다 — 끝 빈칸도 가운데 맞춤 폭에 들게
 * (원본 폭 재기 0x9c52c 는 빈칸도 5 + 자간을 센다). 그런데 `break-spaces` 는 폭에 꽉 찬 줄의 끝 빈칸을 다음 줄로 접어 빈 줄을
 * 만든다(폭 150 에 "!C2년 연속 페넌트 MVP 수상 "). 원본 줄 접기 0x9c2f8 은 빈칸에서 줄을 안 바꾼다. `pre-wrap` 은 들어가는 끝 빈칸을
 * 가운데 맞춤에 세고 안 들어가는 끝 빈칸은 매단다 — 두 상자(알림 0x74ef4 폭 150 · 칭호 팝업 0x1afe8 폭 180)에서 둘 다 본다.
 */

afterEach(cleanup)

/** 끝 빈칸(줄 끝 · `!N` 앞)이 있는 원문 — 알림 상자 · 칭호 팝업이 그리는 표들 */
const TRAILING_SPACE = / (!N|$)/
const samples: readonly string[] = [
  ...ORIGINAL_MODE_TEXT,
  ...ORIGINAL_ITEMS,
  ...ORIGINAL_TITLES.map((text) => `!C${text}`),
  ...ORIGINAL_MAIN_MENU_TEXT,
  // 시즌 복권 꽝(우정상) — [120] + [116] + StrITEM + [117] + "!N" + [122] (seasonItemShop)
  `${ORIGINAL_MODE_TEXT[120]}${ORIGINAL_MODE_TEXT[116]}영지버섯${ORIGINAL_MODE_TEXT[117]}!N${ORIGINAL_MODE_TEXT[122]}`,
].filter((text) => TRAILING_SPACE.test(text))

/** 같은 줄에서 끝 빈칸만 뗀 글로 바꿔 높이를 다시 잰다 */
function heightWithoutTrailingSpaces(line: HTMLElement): number {
  const clone = line.cloneNode(true) as HTMLElement
  const spans = clone.querySelectorAll('span')
  const last = spans[spans.length - 1]
  if (last !== undefined) last.textContent = (last.textContent ?? '').replace(/ +$/, '')
  line.after(clone)
  const height = clone.getBoundingClientRect().height
  clone.remove()
  return height
}

describe.each([
  ['알림 상자 0x74ef4 (폭 150)', undefined],
  ['칭호 팝업 0x1afe8 (폭 180)', TITLE_WINDOW.textWidth],
])('%s', (_label, width) => {
  it(`끝 빈칸이 있는 원문 ${samples.length}개 — 줄마다 빈칸을 뗀 글과 높이가 같다(빈 줄 없음)`, () => {
    expect(samples.length).toBeGreaterThan(40)
    const broken: string[] = []
    for (const raw of samples) {
      const { container, unmount } = render(
        <div className={boxStyles.text} style={width === undefined ? undefined : { width, marginLeft: 0 }}>
          <MarkupText raw={raw} />
        </div>,
      )
      for (const line of container.querySelectorAll<HTMLElement>('p')) {
        const height = line.getBoundingClientRect().height
        const stripped = heightWithoutTrailingSpaces(line)
        if (height !== stripped) broken.push(`${JSON.stringify(raw)} — ${height} ≠ ${stripped}`)
      }
      unmount()
    }
    expect(broken).toEqual([])
  })
})

describe('가운데 맞춤이 끝 빈칸을 센다 (0x9c52c 처럼)', () => {
  it('"!C…회복되었습니다 "(StrMODE[122]) 는 빈칸을 뗀 글보다 왼쪽에 선다', () => {
    const raw = ORIGINAL_MODE_TEXT[122] ?? ''
    expect(raw.endsWith(' ')).toBe(true)
    const leftOf = (text: string) => {
      const { container, unmount } = render(<div className={boxStyles.text}><MarkupText raw={text} /></div>)
      const span = container.querySelector('p span')
      const left = span?.getBoundingClientRect().left ?? Number.NaN
      unmount()
      return left
    }
    const withSpace = leftOf(raw)
    const withoutSpace = leftOf(raw.trimEnd())
    expect(withoutSpace - withSpace).toBeGreaterThan(0.5)
  })
})
