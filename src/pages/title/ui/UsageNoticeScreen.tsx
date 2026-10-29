import { useEffect, useEffectEvent } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { layoutDialogue } from '@/pages/story/lib/eventDialogue'
import type { DialogueGlyph } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/title/ui/BootScreen.css'

/** 0xce904 — 원문 그대로 (CP949) */
export const USAGE_NOTICE_TEXT =
  '!C !cFF0000<이용안내>!N!N이 게임은 게임 이용 시!N별도의 비용이 발생하지!N않는 단독형 게임입니다.!N안심하고 이용하세요.!N!N' +
  '단, 서버 접속 시 통화료!N와 G포인트, 명예의전당!N슬롯 구매 시 정보이용료!N가 발생합니다.'
/** 0xce8e4 — 원문 그대로 */
export const USAGE_NOTICE_PROMPT = '!C !cFF0000아무키나 누르세요!!'

/** 본문 y = H/2 − 0x50 = 80 · 안내 y = H − 40 = 280 (0x2cb1e · 0x2cb6c) */
const BODY_Y = 80
const PROMPT_Y = 280
/** 글 상자 x 20 · 폭 W − 0x28 = 200 (0x2cb22) */
const TEXT_X = 20
const TEXT_WIDTH = 200
/** 0x6ef4c 줄 높이 — 인자 −1 이면 글꼴 높이 + 줄간 (앱 전역 글꼴 11 + 3) */
const LINE_HEIGHT = 14
/** 안내는 상태 틱 [this+0x2c] 를 5 로 나눈 나머지가 0 이 아닐 때만 그린다 (0x2cb3c `0xca911(틱, 5)`) */
const PROMPT_PERIOD = 5

interface UsageNoticeScreenProps {
  /** 갱신 0x245dc — 키가 있으면 0xbcb49(this+0x18, 2) 로고 화면으로 */
  readonly onNext: () => void
}

/**
 * **켤 때 첫 화면 `<이용안내>`** — 장면 0x103 하위 0x2a. 생성자 0x234d4 가 `[0x140006c]` = −1(켤 때) 이고 앞 상태가 0 이면 여기서 연다
 * (그 밖에는 곧장 하위 2 로고). 진입 함수는 없다(진입 표 0xcf06c 는 0x27 까지).
 * 그리기 0x2cabc: 흰 바탕 → 0xba269(0xce904, x 20, y 80, 폭 200, 검정) → 틱 % 5 ≠ 0 이면 0xba269(0xce8e4, x 20, y 280, 폭 200).
 * 0xba269 → 0xba268 은 글상자 0x6ecd0(앱 전역 글꼴) 를 짓고 0x6ef4c(상자, 글, x, y, 폭, 바이트 −1, 줄 수 −1, 첫 줄 0, 줄 높이 −1, 0)
 * 을 부른다(0xba29c~0xba2b8, 직접 떴다). 0x6ef4c 의 줄 배치 (0x6efe0~0x6f13a):
 * ```
 * '!N' 줄 바꿈 · '!L' '!C' '!R' 정렬(다음 줄에도 남는다) · '!cRRGGBB' 색
 * 폭 − 지금 줄 폭 − 글자 폭 < 0 이면 그 글자 앞에서 줄을 접는다      ; `layoutDialogue` 와 같은 규칙
 * 줄 k 의 y = y + k × 줄 높이(−1 → 글꼴 높이 + 줄간 = 14)
 * 가운데 줄은 x + (폭 >> 1) 를 가운데로 (0x6f12c), 오른쪽 줄은 x + 폭 − 1 을 오른쪽 끝으로 (0x6f134)
 * ```
 * ⚠️ 근사(남김 — 웹 DOM 한계): 글꼴은 웹 글자다 — 줄 나누기 · 줄 y · 정렬만 원본대로다.
 */
export function UsageNoticeScreen({ onNext }: UsageNoticeScreenProps) {
  const tick = useUpdateCounter()
  const onNextLatest = useEffectEvent(onNext)

  useEffect(() => {
    // 갱신 0x245dc 는 키 값이 0 이 아니기만 하면 넘어간다 — 아무 키나
    const onKeyDown = () => onNextLatest()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen onPress={onNext}>
      <div className={styles.whiteBackground} />
      <LaidOutText raw={USAGE_NOTICE_TEXT} top={BODY_Y} testId="이용안내-본문" />
      {tick % PROMPT_PERIOD !== 0 && <LaidOutText raw={USAGE_NOTICE_PROMPT} top={PROMPT_Y} testId="이용안내-안내" />}
    </RawScreen>
  )
}

/** 같은 색으로 이어진 글자를 한 덩이로 */
function runsOf(glyphs: readonly DialogueGlyph[]): readonly { readonly start: number; readonly color: string | null; readonly text: string }[] {
  const runs: { start: number; color: string | null; text: string }[] = []
  for (const glyph of glyphs) {
    const last = runs[runs.length - 1]
    if (last !== undefined && last.color === glyph.color) last.text += glyph.character
    else runs.push({ start: glyph.start, color: glyph.color, text: glyph.character })
  }
  return runs
}

/** 0xba269(글, 20, 위, 200, 검정) — 0x6ef4c 가 접은 줄을 줄 높이 14 로 쌓는다 */
function LaidOutText({ raw, top, testId }: { readonly raw: string; readonly top: number; readonly testId: string }) {
  const { lines } = layoutDialogue(raw, TEXT_WIDTH)
  return (
    <div data-testid={testId}>
      {lines.map((line, index) => (
        <div
          key={index}
          className={styles.textLine}
          data-part="글줄"
          style={{
            left: TEXT_X,
            top: top + index * LINE_HEIGHT,
            textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
          }}
        >
          {runsOf(line.glyphs).map((run) => (
            // 기본 글색은 0xba269 의 검정 — `layoutDialogue` 는 !cFFFFFF 도 기본(null)으로 돌려주지만 이 글에는 없다
            <span key={run.start} style={run.color === null ? undefined : { color: run.color }}>
              {run.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
