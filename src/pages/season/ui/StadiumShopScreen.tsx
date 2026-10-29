import { MessageBox, RawScreen } from '@/shared/ui'
import { StadiumPreviewCanvas } from '@/pages/season/ui/StadiumPreviewCanvas'
import { StadiumItemWindow } from '@/pages/season/ui/StadiumItemWindow'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SkinBackdrop } from './stadiumShopScreen/otherSlices'
import type { StadiumShopScreenProps } from './stadiumShopScreen/stadiumShopProps'
import { useStadiumShop } from './stadiumShopScreen/useStadiumShop'

export type { StadiumShopScreenProps } from './stadiumShopScreen/stadiumShopProps'

/**
 * 구장 아이템 화면 — 상점 `0x957c`(가드) + `0x7d90` 결과코드 14·15(구매·해금) ·
 * 구장관리 `0x7958`(교체). `docs/re/S3-stadium-items.md` 확정. 창은 아이템 창 0x83378 종류 4(`StadiumItemWindow`).
 *
 * **키** (직접 떴다 — 창 키 0x819ac 의 종류 3 · 4 공용 두 층 갈래 0x81a5e~0x81cc6):
 * ```
 * 종류 목록(초점 [창+0x1a8] = 0)  취소(−16) → 상점 0xd0(0x957c 0x9bd4~0x9bec) · 구장관리 0xce(0x7958 0x7a68)
 *                                 확인(−5 · '5') · 아래(−2 · '8') → 칸 수 > 0 이면 초점 1 · 칸 커서 0 · 맨 윗줄 0 (0x81c24~0x81c74)
 *                                 그 밖 → 종류 목록 vt+0x18(3 열 × 1 줄, 키 방식 1 — '4' · '6' 은 왼 · 오른, 감는다) · 0x8146c 칸 수 다시
 * 칸 목록(초점 1)                 취소 → 초점 0 · 칸 커서 0 · 맨 윗줄 0 (0x81a6c~0x81a90) — 그 앞에 미리보기를 저장값으로 되돌린다
 *                                 (상점 0x9c0a~0x9c84 · 구장관리 0x7a8c~0x7afc)
 *                                 확인 → 상점 가드(0x9aa4~) · 구장관리 교체(0x799c~)
 *                                 그 밖 → 칸 목록 vt+0x18(1 열 × 칸 수, 감는다)
 * 미리보기 갈아 끼우기             구장관리: 창 키 뒤 초점 1 이고 취소가 아니면 늘 지금 종류의 커서 칸(0x7b10~0x7bae)
 *                                 상점: 칸 목록이 움직였을 때만([목록+0x25], 0x9ca6~0x9cb8)
 * ```
 *
 * 원본 버그 두 가지를 **그대로** 옮겼다:
 *   ⚠️ 사도 **인기도가 깎이지 않는다** — 인기도는 조건일 뿐이다 (S3 5-1).
 *   ⚠️ 교체(구장관리)에는 **가드가 하나도 없다** — 안 산 칸도 그대로 끼워진다 (S3 6절).
 * 그리고 **잔디는 1·2·3억을 받으면서 어떤 계산에도 들어가지 않는다** (S3 8절).
 */
export function StadiumShopScreen(props: StadiumShopScreenProps) {
  const s = useStadiumShop(props)
  const { record, onBack, gamePoint = 0 } = props
  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xea · 0xdc 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      {/*
        구장 미리보기 — 0xea 그리기 0xb158 · 0xdc 그리기 0xb1f8 의 메뉴 칸 1 갈래(0xb216~0xb262) 모두 구장 [장면+0x10c] 를 (−165, −80) 에
        두고 하늘 0x77fe8 · 시즌 구장 0x77494 · 바닥 0x7725c 뒤 아이템 창 0x83378 을 그린다. 진입(0xe4d0 · 0x5f3c)이 저장값으로 세우고
        키가 지금 종류의 칸 하나만 갈아 끼운다(`stadiumPreviewOf`). 하늘 줄 · 칸과 전광판 글자 자리는 장면 구장 칸이다
        (`StadiumPreviewScene` — 상점은 구장관리가 앞서 둔 하늘을 쓰고, 0xb1f8 만 0x77fb5 로 글자를 흘린다).
      */}
      <StadiumPreviewCanvas
        state={{ skyRow: s.entryScene.skyRow, skyColumn: s.entryScene.skyColumn, scoreboardX: s.scoreboardX, seasonStadium: s.previewStadium }}
      />
      <StadiumItemWindow
        record={record}
        kind={s.kind}
        slot={s.slot}
        top={s.top}
        isSlotFocus={s.isSlotFocus}
        tick={s.tick}
        isShop={s.isShop}
        isHiddenOpen={s.isHiddenOpen}
        onPickKind={s.pickKind}
        onPickSlot={s.pickSlot}
      />
      {/* 머리띠 — 공통 틀 0xb810 의 기본 갈래(제목 10 시즌모드 · 바닥 5 되돌아가기) */}
      <ScreenFrame title="시즌모드" onBack={s.isSlotFocus ? s.leaveSlots : onBack} footer={5} slides={false} gamePoint={gamePoint} />
      <StadiumPopups s={s} />
    </RawScreen>
  )
}

/** 구매 물음 · 알림(가드 · 구매 완료 · 교체) · 히든 오픈 글(하나씩) */
function StadiumPopups({ s }: { readonly s: ReturnType<typeof useStadiumShop> }) {
  const { question, notice, hiddenNotices } = s
  if (question !== null) {
    return (
      <MessageBox key="물음" text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? s.buy() : s.setQuestion(null))} />
    )
  }
  if (notice !== null) return <MessageBox key="알림" text={notice} buttons={['확인']} onAnswer={s.closeNotice} />
  if (hiddenNotices[0] === undefined) return null
  return (
    <MessageBox
      key={hiddenNotices.length}
      text={hiddenNotices[0]}
      buttons={['확인']}
      onAnswer={() => s.setHiddenNotices((shown) => shown.slice(1))}
    />
  )
}
