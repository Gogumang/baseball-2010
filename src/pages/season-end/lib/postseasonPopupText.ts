import { POSTSEASON_TEXT_ID } from '@/entities/career/model/postseasonFlow'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 팝업 글 — 0xbbef9(글, 1, 코드, 1) 의 글.
 * 우승 팀 발표(7)는 StrMODE[137] 의 `%s` 에 팀 이름 표 0x1552cf8[L+0x37] 을 넣는다 (0x13dd2~0x13dfc).
 */
export function postseasonPopupTextOf(popup: PostseasonPopup): string {
  if (popup.kind === '우승발표') {
    const name = TEAMS[popup.champion]?.name ?? ''
    return ORIGINAL_MODE_TEXT[POSTSEASON_TEXT_ID.우승발표].replace('%s', name)
  }
  return ORIGINAL_MODE_TEXT[POSTSEASON_TEXT_ID[popup.kind]]
}
