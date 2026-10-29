import { MessageBox } from '@/shared/ui'
import { DetailWindow } from '@/pages/shop/ui/shopScreen/otherSlices'
import type { DetailView } from '@/pages/shop/ui/shopScreen/otherSlices'

/**
 * 결과 알림 글 — 원문 마크업으로 온 글(StrMODE[92] 구매 완료 `!C[!cFFFF00…`)은 그대로, 마크업 없이 옮겨 둔 글은 가운데 맞춤(!C)을 붙인다
 */
function centeredNoticeOf(text: string): string {
  return text.startsWith('!C') ? text : `!C${text}`
}

/** 상점 팝업 — 구매 확인 · 막힘 안내 · GP 결과 창 · 결과 알림 (앞 것이 떠 있으면 뒤 것은 기다린다) */
export function ShopPopups({
  pending,
  blockNotice,
  detail,
  noticeText,
  onAnswerPending,
  onCloseBlockNotice,
  onCloseDetail,
  onDismissNotice,
}: {
  readonly pending: { readonly itemId: string; readonly question: string } | null
  readonly blockNotice: { readonly text: string; readonly asks: boolean } | null
  readonly detail: DetailView | null
  /** 아직 닫지 않은 결과 알림 — 없으면 null */
  readonly noticeText: string | null
  readonly onAnswerPending: (index: number) => void
  readonly onCloseBlockNotice: () => void
  readonly onCloseDetail: () => void
  readonly onDismissNotice: () => void
}) {
  return (
    <>
      {pending !== null && <MessageBox text={pending.question} buttons={['예', '아니오']} onAnswer={onAnswerPending} />}
      {pending === null && blockNotice !== null && (
        <MessageBox
          text={centeredNoticeOf(blockNotice.text)}
          buttons={blockNotice.asks ? ['예', '아니오'] : ['확인']}
          onAnswer={onCloseBlockNotice}
        />
      )}
      {detail !== null && (
        // 장비 구매 확정 0x14a74(0x15084) — 0x741a0(높이 0), 키 0x1d648 이 0x742a9 로 바로 치운다
        <DetailWindow rows={detail.rows} messages={detail.messages} onClose={onCloseDetail} opensAsCommonPopup />
      )}
      {pending === null && blockNotice === null && (
        <ResultNotice isDetailOpen={detail !== null} noticeText={noticeText} onDismiss={onDismissNotice} />
      )}
    </>
  )
}

/** 결과 알림 — 결과 창이 닫힌 뒤에 뜬다 */
function ResultNotice({ isDetailOpen, noticeText, onDismiss }: { isDetailOpen: boolean; noticeText: string | null; onDismiss: () => void }) {
  if (isDetailOpen || noticeText === null) return null
  return <MessageBox text={centeredNoticeOf(noticeText)} buttons={['확인']} onAnswer={onDismiss} />
}
