import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { RecordPickPopup } from '@/widgets/record-pick-popup'
import {
  SEASON_RANKING_SIZE, rankingCategoriesOf, seasonRankingValueTextOf,
} from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry, SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

const IMG_TEXT = './sprites/img_text/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/** 두 칸 글 img_text — 392 "타자기록" · 393 "투수기록" (그림 객체 +8 의 +0x620 · +0x624 — 0xf3fa · 0xf502) */
const PICK_LABEL_FRAMES = { 타자: 392, 투수: 393 } as const
/** 머리 글 img_text — 136 "순위" · 27 "이름" · 235 "팀명" (0x57a76 · 0x57ab2 · 0x57aec) */
const HEADER_FRAMES = [136, 27, 235] as const
/** 팀 이름 img_text = 0x41 + 팀 (0x57e76) */
const TEAM_NAME_FRAME_BASE = 0x41
/** 내 팀 줄 글색 (0xff, 0xd4, 0x29) — 0x57c70 */
const MY_TEAM_COLOR = '#ffd429'

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
    <RecordPickPopup ariaLabel="기록순위" testIdPrefix="기록순위" selected={side === '타자' ? 0 : 1}
      cells={[
        { label: '타자기록', labelFrame: PICK_LABEL_FRAMES.타자 },
        { label: '투수기록', labelFrame: PICK_LABEL_FRAMES.투수 },
      ]}
      onToggle={onToggle} onConfirm={onConfirm} onCancel={onCancel} />
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

/** ⚠️ 근사 배치 — 시작 x 는 창 가운데 − 100(0x57a72), 칸 사이 3px · 줄 사이 4px 까지만 확정이고 칸 너비는 근사 */
const TABLE = { x: 20, headerY: 60, firstRowY: 84, rowStep: 18, columns: [24, 76, 64, 36] } as const

/**
 * **기록순위 목록 0xdb** — 나리 판 목록 그리기 0x5796c (직접 떴다):
 * 머리 줄 = 순위 · 이름 · 팀명 · (쪽의 종류 글), 종류 글 왼쪽·오른쪽에 쪽을 옮길 수 있으면 깜박이는 화살표.
 * 줄 i = 0..9: 칸이 차 있으면(0x9da19) 순위 i + 1 · 이름 0xb62c1 · 팀 img_text 0x41 + 팀 · 값(0x6aff8),
 * 그 줄의 팀이 내 팀이면 글색 (0xff, 0xd4, 0x29), 아니면 흰 글.
 */
export function SeasonRecordRankScreen({
  side, page, entries, myTeamId, gamePoint = 0, onMovePage, onBack,
}: SeasonRecordRankScreenProps) {
  const latest = useRef({ onMovePage, onBack })
  latest.current = { onMovePage, onBack }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (isCancelKey(event.key)) current.onBack()
      else if (event.key === 'ArrowRight' || event.key === '6') current.onMovePage(1)
      else if (event.key === 'ArrowLeft' || event.key === '4') current.onMovePage(-1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const categories = rankingCategoriesOf(side)
  const category = categories[page] ?? categories[0]
  const columnX = TABLE.columns.map((_width, index) => TABLE.x + TABLE.columns.slice(0, index).reduce((sum, width) => sum + width + 3, 0))
  const headerFrames = [...HEADER_FRAMES, category.labelFrame]

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xdb 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`기록순위 ${side} ${category.label}`}>
        <div className={windowStyles.window} style={{ left: 14, top: 52, width: 212, height: 216 }} />
        {headerFrames.map((frame, index) => (
          <img key={frame} className={windowStyles.layer} alt="" src={frameSrc(frame)}
            style={{ left: columnX[index] + TABLE.columns[index] / 2, top: TABLE.headerY, transform: 'translateX(-50%)' }} />
        ))}
        {page > 0 && (
          <span className={styles.title} style={{ left: columnX[3] - 6, top: TABLE.headerY - 2, width: 6 }}>◀</span>
        )}
        {page < categories.length - 1 && (
          <span className={styles.title} style={{ left: columnX[3] + TABLE.columns[3], top: TABLE.headerY - 2, width: 6 }}>▶</span>
        )}
        {Array.from({ length: SEASON_RANKING_SIZE }, (_unused, row) => {
          const entry = entries[row]
          const top = TABLE.firstRowY + row * TABLE.rowStep
          const color = entry !== undefined && entry.record.teamId === myTeamId ? MY_TEAM_COLOR : ORIGINAL_COLORS.text
          return (
            <div key={row} data-testid={`기록순위-줄-${row}`} style={{ color }}>
              {entry !== undefined && (
                <>
                  <span className={styles.title} style={{ left: columnX[0], top, width: TABLE.columns[0], color }}>{row + 1}</span>
                  <span className={styles.title} style={{ left: columnX[1], top, width: TABLE.columns[1], color }}>{entry.record.name}</span>
                  <img className={windowStyles.layer} alt="" src={frameSrc(TEAM_NAME_FRAME_BASE + entry.record.teamId)}
                    style={{ left: columnX[2] + TABLE.columns[2] / 2, top: top + 2, transform: 'translateX(-50%)' }} />
                  <span className={styles.title} data-testid={`기록순위-값-${row}`}
                    style={{ left: columnX[3], top, width: TABLE.columns[3], color }}>
                    {seasonRankingValueTextOf(category.kind, entry.value)}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}
