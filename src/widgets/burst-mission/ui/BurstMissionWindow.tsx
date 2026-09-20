import { useEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import {
  BURST_HEADLINE_BAND, BURST_HEADLINE_TEXT, BURST_RESULT_HEADLINE, BURST_TEXT, BURST_TEXT_BOX,
  BURST_WINDOW, burstLineIndexOf,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import * as styles from '@/widgets/burst-mission/ui/BurstMissionWindow.css'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface BurstMissionWindowProps {
  /**
   * 그 행의 `_TEXT` 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효.
   * `ORIGINAL_BURST_TABLES[표].lines[행]` 을 그대로 넘기면 된다.
   */
  readonly lines: readonly OriginalBurstLine[]
  /**
   * `null` 이면 **제안** 모습(발동한 순간, 줄 0), 아니면 **결과** 모습이다.
   * `resolveBurst` 가 돌려주는 판정을 그대로 넘긴다.
   */
  readonly judgement: BurstJudgement | null
  /** 대사 안 %s 를 순서대로 채울 값 (보통 선수 이름) */
  readonly replacements?: readonly string[]
  /** 창을 닫고 다음으로 간다 — 제안이면 타석(상태 0xf), 결과면 보상 적용 뒤 원래 흐름 */
  readonly onClose: () => void
}

/**
 * 돌발미션 창 — 경기 장면 **상태 0x1b** (K 4절 1-6).
 *
 * 발동하면 제안 대사(줄 0)를 띄우고, 타석이 끝나면 결과 대사(줄 1/2/3)와 함께
 * "돌발미션 성공!!"·"실패!!"(0xd5114 · 0xd512c) 문구를 얹는다. **무효는 문구가 없다** —
 * 원본 문자열이 성공·실패 둘뿐이다.
 *
 * 안 하는 것 둘:
 *   - **화자 초상·이름**. `_TEXT` 의 화자·표정 번호가 미해독이라(원본 값은 데이터에 그대로 있다)
 *     초상(0x8e2dc)도 이름 머리(0xd5108 `"!C!cffffff["`)도 고르지 않는다.
 *   - **효과음** (제안 0x2a · 성공 0x24 · 실패 0x20 · 무효 0x25). 웹에 소리 장치가 없다.
 *     번호는 `BURST_SOUND` 에 있으니 나중에 붙이면 된다.
 *
 * 좌표는 `burstMissionWindowLayout.ts` 에 있고, **원본 배치가 안 풀려 모두 근사**다.
 */
export function BurstMissionWindow({ lines, judgement, replacements = [], onClose }: BurstMissionWindowProps) {
  const line = lines[burstLineIndexOf(judgement)]
  const headline = judgement === null ? null : BURST_RESULT_HEADLINE[judgement]

  // 창이 떠 있는 동안 키는 창 것이다 — 뒤 타석 화면이 같은 Enter 를 같이 받으면 스윙이 나간다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 타석·커맨드 줄의 window 리스너까지 막는다
      event.stopImmediatePropagation()
      // 원본은 상태 0x1b 에서 아무 키나 받으면 다음으로 간다 (0x3b014 → 0x3b032)
      event.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <div className={styles.overlay} role="dialog" aria-label="돌발미션" onClick={onClose}>
      {headline !== null && (
        <>
          {/* game_ui 프레임 8 — 171×25 파란 둥근 막대, 원점 (0,0) */}
          <img
            className={styles.sprite}
            style={{ left: BURST_HEADLINE_BAND.x, top: BURST_HEADLINE_BAND.y }}
            src={frameSrc(GAME_UI_FRAMES, BURST_HEADLINE_BAND.frame)}
            alt=""
          />
          <div
            className={styles.headline}
            style={{ left: BURST_HEADLINE_TEXT.x, top: BURST_HEADLINE_TEXT.y, width: BURST_HEADLINE_TEXT.width }}
          >
            <MarkupText raw={headline} />
          </div>
        </>
      )}

      <div
        className={styles.window}
        style={{ left: BURST_WINDOW.x, top: BURST_WINDOW.y, width: BURST_WINDOW.width, height: BURST_WINDOW.height }}
      />
      <div
        className={styles.innerBox}
        style={{ left: BURST_TEXT_BOX.x, top: BURST_TEXT_BOX.y, width: BURST_TEXT_BOX.width, height: BURST_TEXT_BOX.height }}
      />
      <div className={styles.dialogue} style={{ left: BURST_TEXT.x, top: BURST_TEXT.y, width: BURST_TEXT.width }}>
        {/* 줄이 모자란 행은 원본에도 없지만, 없으면 빈 칸으로 둔다 */}
        <MarkupText raw={line?.text ?? ''} replacements={replacements} />
      </div>
    </div>
  )
}
