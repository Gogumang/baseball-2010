import { FrameSprite, InsetBox } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { MISSION_RETRY_BOX, MISSION_RETRY_BUTTONS, MISSION_RETRY_QUESTION, MISSION_RETRY_TEXT } from '@/pages/mission-play/lib/missionResultBoard'
import * as styles from '@/pages/mission-play/ui/MissionResultBoard.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const POPUP_FRAMES = assetUrl('./sprites/popup/frames')

/** "다시 도전?" 칸 — 질문 글 · 예/아니오 단추 · 고른 쪽 커서. 단추를 누르면 그 쪽으로 옮겨 OK 와 같다(`onPick`) */
export function MissionRetryBox({
  answer,
  popupOrigins,
  onPick,
}: {
  readonly answer: boolean
  readonly popupOrigins: FrameOrigins | null
  readonly onPick: (answer: boolean) => void
}) {
  const question = parseGameMarkup(MISSION_RETRY_QUESTION)[0]
  return (
    <>
      {/* 4a69c 칸 0xbb28d(W/2, H/2 + 0x10, 162, 0x31, 정렬 2) */}
      <InsetBox x={MISSION_RETRY_BOX.x} y={MISSION_RETRY_BOX.y} width={MISSION_RETRY_BOX.width} height={MISSION_RETRY_BOX.height} />
      {question !== undefined && (
        <span
          className={styles.text}
          data-testid="미션-재도전-글"
          style={{
            left: MISSION_RETRY_TEXT.x,
            top: MISSION_RETRY_TEXT.y,
            width: MISSION_RETRY_TEXT.width,
            textAlign: question.isCentered ? 'center' : 'left',
          }}
        >
          {question.segments.map((segment, index) => (
            <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
        </span>
      )}
      {MISSION_RETRY_BUTTONS.map((button) => (
        <FrameSprite key={button.name} folder={POPUP_FRAMES} frame={button.frame} origins={popupOrigins} x={button.x} y={button.y} />
      ))}
      {MISSION_RETRY_BUTTONS.filter((button) => button.answer === answer).map((button) => (
        <span key={button.name} data-testid="미션-재도전-커서" data-answer={button.name}>
          <FrameSprite folder={POPUP_FRAMES} frame={button.selectedFrame} origins={popupOrigins} x={button.x} y={button.y} />
        </span>
      ))}
      {/* 원본에 없는 웹 단추 — 누르면 그 쪽으로 옮겨 OK 와 같다 */}
      {MISSION_RETRY_BUTTONS.map((button) => (
        <button
          key={button.name}
          type="button"
          className={styles.hitArea}
          aria-label={button.name}
          style={{ left: button.x, top: button.y, width: 41, height: 15 }}
          onClick={() => onPick(button.answer)}
        />
      ))}
    </>
  )
}
