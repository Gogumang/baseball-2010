import { useEffect, useRef, useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { SEASON_CARD_INFO_LABELS } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonCardAbility, SeasonCardInfo } from '@/pages/season/lib/seasonPlayerDetail'
import { INFO_BOARD, INFO_COLUMNS, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP, RIGHT_PANEL } from '@/pages/management/lib/basicInfoLayout'
import * as infoStyles from '@/pages/management/ui/ManagementScreen.css'
import { DetailWindow } from '@/pages/management/ui/DetailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'
import { abilityDetailScrollKeyOf, scrollAbilityDetail } from '@/pages/management/lib/abilityDetail'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

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
}

/** StrMODE[35..38] 히트·파워·수비·주루 / [40..43] 제구·구속·변화·체력 */
const BATTER_NAME_BASE = 35
const PITCHER_NAME_BASE = 40
/** 카드 판 — ⚠️ 근사 (원본은 0x7ba44 프레임 박스) */
const CARD = { x: 15, y: 50, width: 210, height: 120 } as const
/** 네 칸 숫자 — ⚠️ 근사: 원본은 오른쪽 판(mode_ui 프레임 0 박스 1)의 도형 0x5a991 이다 */
const ROW = { x: RIGHT_PANEL.x, firstY: RIGHT_PANEL.y + 8, height: 18, width: RIGHT_PANEL.width } as const
const IMG_TEXT = './sprites/img_text/frames'

/** 숫자 색 — 0x7bf48~0x7bf6c: 기본 > 실효 → (0xff,0,0) · 기본 < 실효 → (0,0xff,0x40) · 같으면 흰 글 */
function colorOf({ base, shown }: SeasonCardAbility): string {
  if (base > shown) return ORIGINAL_COLORS.abilityDown
  if (base < shown) return ORIGINAL_COLORS.abilityUp
  return ORIGINAL_COLORS.text
}

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
 * 정보 칸 0x7c450 의 시즌 · 0xd9 줄(팀명 · 이름 · 타입 · 필살 · 보직 · 손 · 피부 · 타순)은 `seasonCardInfoOf` 로 판 아래에 그린다.
 * ⚠️ **원본 배치 미해독 — 근사**: 카드 0x7ba44 의 시즌 갈래는 도형 숫자(실효값, 기본값과 견준 색)까지만 풀었다 —
 * 선수 그림(투수 [0x1552ae0] · 타자 겹 그림)은 안 풀어 이름·팀만 적고, 도형 대신 네 줄 숫자로 적는다. 창 0x8a0a4 는 나리 120 과 같은 창이라 `DetailWindow` 를 그대로 쓴다.
 */
export function SeasonPlayerCardScreen({
  teamId, view, abilities, info, detail, isDetailOpen, onOpenDetail, onCloseDetail, onBack, gamePoint = 0,
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

  const nameBase = view.isPitcher ? PITCHER_NAME_BASE : BATTER_NAME_BASE

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xd9 · 0xda 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div className={styles.window} style={{ left: CARD.x, top: CARD.y, width: CARD.width, height: CARD.height }} />
      <div className={styles.title} style={{ left: CARD.x, top: CARD.y + 12, width: RIGHT_PANEL.x - CARD.x }}>
        {TEAMS[teamId]?.name ?? ''}
      </div>
      <div className={styles.title} style={{ left: CARD.x, top: CARD.y + 34, width: RIGHT_PANEL.x - CARD.x }} data-testid="선수상세-이름">
        {view.name}
      </div>
      {abilities.map((ability, slot) => (
        <div key={slot} className={styles.row} data-testid={`선수상세-능력-${slot}`}
          style={{ left: ROW.x, top: ROW.firstY + slot * ROW.height, width: ROW.width, height: ROW.height }}>
          <span className={styles.rowLabel}>{ORIGINAL_MODE_TEXT[nameBase + slot] ?? ''}</span>
          <span className={styles.rowValue} style={{ color: colorOf(ability) }}>{ability.shown}</span>
        </div>
      ))}

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

      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={isDetailOpen ? onCloseDetail : onBack} footer={7} />

      {isDetailOpen && (
        <DetailWindow rows={detail.rows} messages={detail.messages} scrollOffset={scrollOffset} onClose={onCloseDetail} />
      )}
    </RawScreen>
  )
}
