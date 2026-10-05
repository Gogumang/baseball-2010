import { MessageBox } from '@/shared/ui'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import { POSTSEASON_TEXT_ID } from '@/entities/career/model/postseasonFlow'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import type { PostseasonSeries } from '@/entities/league/model/league'
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

/**
 * 나만의리그 포스트시즌 대진 화면 (상태 128) — 대진표 0x853ac 위에 알림 팝업 하나.
 * [다음] 이 키 0x13da0 (확인)이고, 팝업이 떠 있는 동안은 팝업만 키를 받는다.
 */
export function PostseasonScreen({
  series,
  popup,
  onConfirm,
  onClosePopup,
}: {
  readonly series: PostseasonSeries | null
  readonly popup: PostseasonPopup | null
  readonly onConfirm: () => void
  readonly onClosePopup: () => void
}) {
  return (
    <>
      <PostseasonBracket series={series} nextLabel="다음" onNext={popup === null ? onConfirm : undefined} />
      {popup !== null && (
        <MessageBox text={postseasonPopupTextOf(popup)} buttons={['OK']} onAnswer={onClosePopup} />
      )}
    </>
  )
}
