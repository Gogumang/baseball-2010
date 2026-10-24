import { useEffect, useRef, useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { SEASON_CARD_INFO_LABELS } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonCardAbility, SeasonCardInfo } from '@/pages/season/lib/seasonPlayerDetail'
import { INFO_BOARD, INFO_COLUMNS, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP } from '@/pages/management/lib/basicInfoLayout'
import * as infoStyles from '@/pages/management/ui/ManagementScreen.css'
import { DetailWindow } from '@/pages/management/ui/DetailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'
import { ABILITY_DETAIL_VISIBLE_LINES, abilityDetailScrollKeyOf, scrollAbilityDetail } from '@/pages/management/lib/abilityDetail'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { SeasonPlayerCard } from '@/pages/season/ui/SeasonPlayerCard'
import { seasonCardLookOf } from '@/pages/season/lib/seasonPlayerCard'

export interface SeasonPlayerCardScreenProps {
  readonly teamId: number
  readonly view: SeasonPlayerRecordView
  /** 카드 도형 네 칸 — 0x7ba44 시즌 갈래 (`seasonCardAbilitiesOf`) */
  readonly abilities: readonly SeasonCardAbility[]
  /** 정보 칸 0x7c450 시즌 · 0xd9 갈래 (`seasonCardInfoOf`) — 없으면 안 그린다 */
  readonly info?: SeasonCardInfo
  /** 능력치 상세 창 글 0x897e8 (`seasonPlayerDetailViewOf`) — 상태 0xda 일 때만 그린다 */
  readonly detail: DetailView
  /** 상태 0xda(능력치 상세 창)인가 */
  readonly isDetailOpen: boolean
  /** 0xd9 '0'(0x30) → 0xda */
  readonly onOpenDetail: () => void
  /** 0xda 취소(−16)·'0' → 0xd9 */
  readonly onCloseDetail: () => void
  /** 0xd9 취소(−16) → 선수 고르기 0xdf */
  readonly onBack: () => void
  readonly gamePoint?: number
  /** 카드 딱지 [gfx+0x168] — 이 장면에서 0xca · 0xe4 를 거쳤는가 (`SeasonPlayerCard`) */
  readonly hasCardBadge?: boolean
}

const IMG_TEXT = './sprites/img_text/frames'

/**
 * **선수 기본정보 카드 0xd9 ↔ 능력치 상세 창 0xda** (R13 3절 확정, 나리 119/120 과 같은 쌍).
 *
 * ```
 * 0xd9 갱신 0x5404  선수 = 0xb5694(팀레코드, ed+0x33f ? 0 : 1, 커서) 의 0x30 바이트 사본 → [창+0x148]
 *                   투수면 그림 0x79368 · 타자면 0x789f0(장비 니블마다 vt+0x14(그림, 부위, n−1)) · 그림 +0x48 = 0(그림자 없음)
 *                   창+0x24c = (ed+0x33f == 0) — 타자였는가 · 0x76705([this+0xc4], 0x67, 0x38, 0)
 *      키   0x48a0  취소(−16) → 0xdf · '0'(0x30) → 0xda      ; 확인은 없다
 *      그림 0xae98  0x7ba44(카드) · 0x7c450(정보 칸) · 프레임 박스 [this+0xc8] 0번 안에
 *                   타자 그림(가운데 아래 −10) · 투수는 [0x1552ae0] 그림 0x98975(…, y − 0x23) · 머리띠 0x54d95(…, 10, 7, 0)
 * 0xda 갱신 0x52f4  글 버퍼 0x1552af4 를 0x200 바이트 비우고 0x897e8(창) — `seasonPlayerDetailViewOf`
 *      키   0x9398  취소(−16)·'0' → 0xd9 · 그 밖 0x8a044(창, 키) 글 스크롤 (↑·'2' / ↓·'8', 줄 수 > 4 일 때만 감긴다)
 *      그림 0xaf8c  0xae98 그대로 + 창 0x8a0a4
 * ```
 * 머리띠는 제목 10 "시즌모드" · 바닥 7(되돌아가기 + "0상세정보").
 *
 * 카드 0x7ba44 시즌 · 선수 갈래(계단형 판 · 반투명 로고 · ABILITY 레이더)와 선수 그림(타자 겹 그림 · 투수 이미지 [0x1552ae0] 두 배)은
 * `SeasonPlayerCard`(`lib/seasonPlayerCard.ts` 머리말, 직접 떴다). 카드에는 이름 글이 없다 — 이름은 정보 칸 줄 1 이다.
 * 정보 칸 0x7c450 의 시즌 · 0xd9 줄(팀명 · 이름 · 타입 · 필살 · 보직 · 손 · 피부 · 타순)은 `seasonCardInfoOf` 로 판 아래에 그린다.
 * 창 0x8a0a4 는 나리 120 과 같은 창이라 `DetailWindow` 를 그대로 쓴다.
 */
export function SeasonPlayerCardScreen({
  teamId, view, abilities, info, detail, isDetailOpen, onOpenDetail, onCloseDetail, onBack, gamePoint = 0, hasCardBadge = false,
}: SeasonPlayerCardScreenProps) {
  const [scrollOffset, setScrollOffset] = useState(0)
  // 0x52f4 가 들어올 때마다 글을 새로 만들고 창+0x380 = 0 — 창을 다시 열면 맨 위부터
  useEffect(() => {
    if (isDetailOpen) setScrollOffset(0)
  }, [isDetailOpen])

  const latest = useRef({ isDetailOpen, onOpenDetail, onCloseDetail, onBack, lineCount: detail.messages.length })
  latest.current = { isDetailOpen, onOpenDetail, onCloseDetail, onBack, lineCount: detail.messages.length }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      const isCancel = event.key === 'Escape' || event.key === 'Backspace'
      if (!current.isDetailOpen) {
        // 0x48a0 — 취소 → 0xdf · '0' → 0xda
        if (isCancel) current.onBack()
        else if (event.key === '0') current.onOpenDetail()
        else return
        event.preventDefault()
        return
      }
      // 0x9398 — 취소·'0' → 0xd9, 그 밖은 0x8a044 스크롤
      if (isCancel || event.key === '0') {
        event.preventDefault()
        current.onCloseDetail()
        return
      }
      const direction = abilityDetailScrollKeyOf(event.key)
      if (direction === null) return
      event.preventDefault()
      setScrollOffset((offset) => scrollAbilityDetail(offset, current.lineCount, direction))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 터치 기기 — 0xda 글이 4줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건 → 0x8a044). 원본 그림에는 막대뿐이다
  useTouchScrollKeys(isDetailOpen && detail.messages.length > ABILITY_DETAIL_VISIBLE_LINES)

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xd9 · 0xda 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <SeasonPlayerCard teamId={teamId} isPitcher={view.isPitcher} look={seasonCardLookOf(view, teamId)} abilities={abilities}
        isAnimating={!isDetailOpen} hasCardBadge={hasCardBadge}>
        {info !== undefined && (
          <>
            <div className={infoStyles.layer}
              style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: INFO_BOARD.width, height: INFO_BOARD.height, background: INFO_BOARD.color }} />
            {SEASON_CARD_INFO_LABELS[view.isPitcher ? '투수' : '타자'].map((frame, row) => {
              const column = INFO_COLUMNS[row < 4 ? 0 : 1]
              const top = INFO_TOP + (row % 4) * INFO_ROW_STEP
              const isBattingOrder = row === 7
              return (
                <div key={frame} data-testid={`선수상세-정보-${row}`}>
                  <img className={infoStyles.layer} alt="" src={`${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`}
                    style={{ left: column.label.x + column.label.width, top: top + 3, transform: 'translateX(-100%)' }} />
                  <div className={infoStyles.infoValue} data-testid={`선수상세-정보값-${row}`}
                    style={{ left: column.value.x, top, width: column.value.width, height: INFO_ROW_HEIGHT,
                      color: isBattingOrder ? ORIGINAL_COLORS.highlightYellow : ORIGINAL_COLORS.text }}>
                    {isBattingOrder ? info.battingOrder : info.values[row]}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </SeasonPlayerCard>

      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={isDetailOpen ? onCloseDetail : onBack} footer={7} slides={false}
        // 웹 덧붙임 — 바닥띠 "0상세정보" 글자 자리(가운데) 위 투명 칸 = 원본 '0' (0x48a0 → 0xda)
        footerPresses={{ [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: isDetailOpen ? onCloseDetail : onOpenDetail } }} />

      {isDetailOpen && (
        <DetailWindow rows={detail.rows} messages={detail.messages} scrollOffset={scrollOffset} onClose={onCloseDetail} />
      )}
    </RawScreen>
  )
}
