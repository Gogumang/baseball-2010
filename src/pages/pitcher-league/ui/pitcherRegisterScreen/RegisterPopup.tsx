import { MessageBox } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import type { PitchPopup } from './useBreakingPitchCell'

const PITCH_SHORTAGE_TEXT = ORIGINAL_MODE_TEXT[13] ?? ''
const CONFIRM_TEXT = ORIGINAL_MODE_TEXT[2] ?? ''

/** 0x67 상자 — StrMODE[13] 알림(확인 → 닫기) · StrMODE[2] 확인(예 → 등록 확정 104, 아니오 → 닫기) */
export function RegisterPopup({ popup, onYes, onClose }: { readonly popup: PitchPopup; readonly onYes: () => void; readonly onClose: () => void }) {
  if (popup === '부족') return <MessageBox key={popup} text={PITCH_SHORTAGE_TEXT} buttons={['확인']} onAnswer={onClose} />
  return <MessageBox key={popup} text={CONFIRM_TEXT} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? onYes() : onClose())} />
}
