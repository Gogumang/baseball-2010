import { useEffect, useEffectEvent } from 'react'
import { RawScreen } from '@/shared/ui'
import { addSkinStepCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { RecordPickPopup } from '@/widgets/record-pick-popup'
import { rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry, SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { RankingBoard } from '@/pages/nari-record-room/ui/RankingBoard'

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/** 0x5787d 까지 가지만 쪽을 안 넘기는 키 — [skin+0x40c] 만 센다 */
const RANK_OTHER_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'Enter', '0', '1', '2', '3', '5', '7', '8', '9', '*', '#'])

/** 두 칸 글 img_text — 392 "타자기록" · 393 "투수기록" (그림 객체 +8 의 +0x620 · +0x624 — 0xf3fa · 0xf502) */
const PICK_LABEL_FRAMES = { 타자: 392, 투수: 393 } as const

export interface SeasonRecordPickPopupProps {
  /** this+0x16c — 1 타자기록 · 0 투수기록. 0x9008 이 창을 열 때 1 로 둔다 */
  readonly side: SeasonRankingSide
  readonly onToggle: () => void
  /** 확인(−5 · '5') → 창 닫기 · 0xdb */
  readonly onConfirm: () => void
  /** 취소(−16) → 창 닫기 (0xcd 그대로) */
  readonly onCancel: () => void
}

/**
 * **기록순위 창** (팝업 id 0x80, 그리기 0xf334 · 키 0xf5d4 — 직접 떴다). 나리 기록실 0x19448 과 같은 꼴
 * (`widgets/record-pick-popup` 머리말 — 두 함수를 명령 단위로 견줬다):
 * ```
 * 0xf334  제목 StrMODE[74] 흰 글 (W/2 − 0x54, H/2 − 0x28) · 칸 둘 32×32 (W/2 − 0x38, H/2) · (W/2 + 0x18, H/2)
 *         칸 그림 0x858fd([장면+0xc0], 칸, 6 / 10, 팔레트) — `ui/mode_icon` 프레임 6 · 10, 고른 칸 팔레트 0(mpl 첫 벌) · 아닌 칸 −1
 *         (f3bc~f3d6 · f4c2~f4de: [장면+0x16c] ≠ 0 이면 칸 0 이 고른 칸) · 그 아래 h + 4 에 img_text 392 · 393 가운데
 *         (그림 객체 +8 의 +0x620 · +0x624), 고른 칸 글은 그대로, 아닌 칸 글은 (0xb2, 0xb2, 0xb2) 효과 0xb(단색)
 * 0xf5d4  취소 → 닫기 · 좌·우(−3·−4) · '4' · '6' → 뒤집기 · 확인(−5 · '5') → 닫기 · 0xdb
 * ```
 */
export function SeasonRecordPickPopup({ side, onToggle, onConfirm, onCancel }: SeasonRecordPickPopupProps) {
  return (
    <RecordPickPopup
      ariaLabel="기록순위"
      testIdPrefix="기록순위"
      selected={side === '타자' ? 0 : 1}
      closeKind="바로"
      cells={[
        { label: '타자기록', labelFrame: PICK_LABEL_FRAMES.타자 },
        { label: '투수기록', labelFrame: PICK_LABEL_FRAMES.투수 },
      ]}
      onToggle={onToggle}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export interface SeasonRecordRankScreenProps {
  readonly side: SeasonRankingSide
  /** ed+0x444 — 쪽 (종류표의 칸) */
  readonly page: number
  /** 이 쪽의 상위 10명 — `rankSeasonRecords` */
  readonly entries: readonly SeasonRankingEntry[]
  /** ed+0x448 — 내 팀 (그 팀 줄은 노란 글) */
  readonly myTeamId: number
  readonly gamePoint?: number
  /** 0x5787c — 좌·우 */
  readonly onMovePage: (step: -1 | 1) => void
  /** 0x74c4 — 취소 → 0xcd */
  readonly onBack: () => void
}

/**
 * **기록순위 목록 0xdb** — 그리기 0xafa8 = 순위 판 0x5796d([장면+0xa8]) · 머리띠 0x7f4ed. 판은 나리 124 순위와 같은 함수라
 * `RankingBoard`(배치 `pages/nari-record-room/lib/rankingBoard.ts` 머리말 — 칸 폭은 game_ui 프레임 25 · 54 · 75 · 36)를 같이 쓴다.
 */
export function SeasonRecordRankScreen({ side, page, entries, myTeamId, gamePoint = 0, onMovePage, onBack }: SeasonRecordRankScreenProps) {
  const latest = useEffectEvent(() => ({ onMovePage, onBack }))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest()
      // 0x74c4: 취소(−16) → 0xcd · 그 밖은 모두 0x5787d — 쪽이 바뀌든 말든 [skin+0x40c] += 1 (5793e~57948, 쪽 화살 x 가 본다)
      if (isCancelKey(event.key)) current.onBack()
      else if (event.key === 'ArrowRight' || event.key === '6') {
        addSkinStepCounter()
        current.onMovePage(1)
      } else if (event.key === 'ArrowLeft' || event.key === '4') {
        addSkinStepCounter()
        current.onMovePage(-1)
      } else if (RANK_OTHER_KEYS.has(event.key)) addSkinStepCounter()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const categories = rankingCategoriesOf(side)
  const category = categories[page] ?? categories[0]
  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xdb 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`기록순위 ${side} ${category.label}`}>
        <RankingBoard
          kind={category.kind}
          kindLabelFrame={category.labelFrame}
          entries={entries}
          myTeamId={myTeamId}
          hasPreviousPage={page > 0}
          hasNextPage={page < categories.length - 1}
          testIdPrefix="기록순위"
        />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}
