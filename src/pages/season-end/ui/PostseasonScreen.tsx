import { MessageBox } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { postseasonPopupTextOf } from '@/pages/season-end/lib/postseasonPopupText'

/**
 * 나만의리그 포스트시즌 대진 화면 (상태 128) — 대진표 0x853ac 위에 알림 팝업 하나.
 * [다음] 이 키 0x13da0 (확인)이고, 팝업이 떠 있는 동안은 팝업만 키를 받는다.
 *
 * 머리띠·바닥: 나리 공통 틀 0x16928 이 상태 0x80 이면 판에 (제목 [장면+0xcc] == 4 ? 8 타자편 : 9 투수편, 바닥 1)을
 * 넣고(0x1699e~0x169e8 → 0x7f53c), 대진표 0x853ac 가 끝에서 0x7f4ec 로 그린다 — 되돌아가기 표시가 없다.
 */
export function PostseasonScreen({
  series,
  popup,
  onConfirm,
  onClosePopup,
  edition,
  gamePoint,
}: {
  readonly series: PostseasonSeries | null
  /** 머리띠 부제 — 타자편(제목 8) · 투수편(9) */
  readonly edition: '타자편' | '투수편'
  /** 머리띠 G포인트 */
  readonly gamePoint: number
  readonly popup: PostseasonPopup | null
  readonly onConfirm: () => void
  readonly onClosePopup: () => void
}) {
  // 팝업은 대진 판(`RawScreen`) 안에 둔다 — 판 밖이면 zoom · 240 폭 기준을 잃어 상자가 왼쪽으로 쏠린다(r251)
  return (
    <PostseasonBracket
      series={series}
      nextLabel="다음"
      onNext={popup === null ? onConfirm : undefined}
      frame={
        <ScreenFrame
          title={edition === '타자편' ? '나만의리그타자편' : '나만의리그투수편'}
          gamePoint={gamePoint}
          onBack={null}
          footer={1}
          slides={false}
        />
      }
      overlay={popup !== null && <MessageBox text={postseasonPopupTextOf(popup)} buttons={['OK']} onAnswer={onClosePopup} />}
    />
  )
}
