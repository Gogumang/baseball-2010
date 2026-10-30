import { MessageBox } from '@/shared/ui'
import type { ScreenEffectFrame } from '@/entities/story/model/screenEffect'
import * as styles from '@/pages/ending/ui/EndingScreen.css'
import type { endingQuestionOf } from './endingPhase'

/**
 * 엔딩 판 위에 얹는 것 — 누름 칸 · 보너스 팝업 0x2b(StrMODE[214]) · 예/아니오 팝업 · 효과기 덮개.
 * 효과기 0xbd844 는 장면 그리기 끝(창 0x746cd 뒤)에 칠한다 — 창까지 덮는다
 */
export function EndingOverlays({
  onPress,
  bonusText,
  onBonusClosed,
  question,
  effect,
}: {
  readonly onPress: (() => void) | undefined
  /** 보너스 팝업 글 — 보너스 단계가 아니면 null */
  readonly bonusText: string | null
  readonly onBonusClosed: () => void
  readonly question: ReturnType<typeof endingQuestionOf>
  readonly effect: ScreenEffectFrame | null
}) {
  return (
    <>
      {onPress !== undefined && <button type="button" className={styles.pressArea} aria-label="확인" onClick={onPress} />}
      {bonusText !== null && <MessageBox text={bonusText} buttons={['OK']} onAnswer={onBonusClosed} />}
      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? question.onYes() : question.onNo())} />
      )}
      {effect?.overlay != null && effect.overlay.opacity > 0 && (
        <div className={styles.effectCover} data-testid="엔딩-효과기" style={{ opacity: effect.overlay.opacity }} />
      )}
    </>
  )
}
