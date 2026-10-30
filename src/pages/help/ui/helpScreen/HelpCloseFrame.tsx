import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { HELP_VIEWER } from '@/pages/help/lib/helpLayout'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { HELP_WEB_BUTTON_TOP } from './HelpViewerBody'

/**
 * 닫는 길 — 경기 중 [조작방법](`gamePoint` 없음)은 원본에 띠가 없고 CLR 로만 닫는다. 판 안 [닫기] 칸은 웹판 편의(터치)다.
 * 메인 메뉴 7 · 10 은 들어옴 0x2668c → 뷰어 열기 0x63688 이 미끄러짐을 세운다 (63728~63730, r168 정정 — 예전엔 false).
 * 되돌아가기 표시는 CLR 키 그대로(r186) — 쪽 보기면 장 고르기로, 장 고르기면 닫기 연출 뒤 닫는다(뷰어 키 0x637d0).
 * 예전에는 onBack 을 바로 불러 쪽 보기에서도 도움말이 통째로 닫혔다
 */
export function HelpCloseFrame({ gamePoint, onBack }: { readonly gamePoint: number | undefined; readonly onBack: () => void }) {
  if (gamePoint !== undefined) return <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={() => tapKey('Escape')} />
  return (
    <button
      type="button"
      className={styles.sectionButton}
      aria-label="닫기"
      style={{ left: HELP_VIEWER.x0 + HELP_VIEWER.panelWidth / 2 - 12, top: HELP_WEB_BUTTON_TOP }}
      onClick={onBack}
    >
      닫기
    </button>
  )
}
