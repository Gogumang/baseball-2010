import { useEffect, useState } from 'react'
import { MarkupText, MessageBox } from '@/shared/ui'
import { ACE_OPEN_TABLE } from '@/shared/config/original/aceOpen'
import {
  ACE_LEVEL_UP_TEXT,
  aceLevelUpOutcomeOf,
  aceLevelUpRowsOf,
} from '@/entities/mission/model/aceLevel'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'

/** 원작 화면 크기 — 창은 (W/2, H/2) 가운데 192×212 (0x5f3d8~0x5f424 `0x55e60(…, 0xc0, 0xd4, …)`) */
const SCREEN = { width: 240, height: 320 } as const
const WINDOW = { width: 192, height: 212 } as const

/** 마투수/마타자 구분 — 창 그리기 0x5f4be `cmp idx,#4; bgt` (칸 0~4 마투수) */
const LAST_PITCHER_CELL = 4

export interface AceLevelUpWindowProps {
  /** 고른 마선수 칸 0~9 (`skin+0x31d`) */
  readonly cell: number
  /** 그 칸의 지금 레벨 0~3 — 최고 레벨이면 부르는 쪽이 창을 열지 않는다 (0x2b0e0) */
  readonly level: number
  /** 들고 있는 G (`mgr[+0x64]`) */
  readonly gamePoint: number
  /** 레벨업 확정 — 받는 쪽이 레벨을 올리고 G를 뺀다 (0x5fbee · 0x5fc0a). 창은 이 뒤 닫힌다 */
  readonly onLevelUp: (cell: number, cost: number) => void
  /** 창 닫기 0x5faf4 */
  readonly onClose: () => void
}

/**
 * **마선수 레벨업 창** — 그리기 `0x5f394` · 키 `0x5fb24` (S9 1·2-1 절, 이번에 키 쪽을 다시 디스어셈해 확인).
 *
 * 키 (0x5fb68~0x5fb94):
 * ```
 * −5(OK) · '5'           → 레벨업 시도 (커서가 "아니오" 면 그냥 닫기, 0x5fb9e)
 * −4 · −3 · '4' · '6'    → 예 ↔ 아니오 (0x5fc80). S9 가 적은 −2·−1·0·1·2 는 **아무 일도 없다**
 *                          (0x5fb68 `adds r2,r4,#3; bgt` 뒤 비교 줄에 그 값이 없다)
 * −16(CLR) · '0'         → 닫기 0x5faf4
 * ```
 * 레벨업 시도는 `aceLevelUpOutcomeOf` — G가 모자라면 0xcc214 팝업을 띄우고 **창은 열린 채** 하위 단계
 * +0x314 = 1 이다. 팝업 "아니오" 는 팝업만 닫는다 (0x5fcaa). "예" 는 원본에서 G 충전 페이지(상태 24)로
 * 나간다(0x2af56 → 0x2b25a) — ⚠️ 웹판엔 통신 충전 화면이 없어 "아니오" 와 같이 팝업만 닫는다 (근사).
 *
 * 창 안 (0x5f394): 제목 img_text 375 "레벨업", 다섯 줄 = 능력치 네 칸의 지금 값·다음 레벨 값(배율 사본
 * 0xd1734) + 필살타법/마구 횟수(0xd1739/0xd173e), 비용 줄 StrCOMMON[49], 예/아니오 버튼.
 * ⚠️ 미해결(화면): 줄 y·막대 그림 0x585ac·버튼 그림 0xbb28d(…, 0xae, 0x41, 2) 의 세부 배치는
 *    S9 2-5 도 "유력" 까지라 여기서는 글자 판으로만 그린다. 성공 연출 0xbbc85 도 없다.
 */
export function AceLevelUpWindow({ cell, level, gamePoint, onLevelUp, onClose }: AceLevelUpWindowProps) {
  /** `skin+0x31e` — 1 = "예" 가 기본 (0x5faf4 가 1 로 되돌린다) */
  const [isYes, setIsYes] = useState(true)
  /** 하위 단계 +0x314 = 1 — G 부족 팝업이 떠 있다 */
  const [isShortageOpen, setIsShortageOpen] = useState(false)

  const entry = ACE_OPEN_TABLE[cell]
  const role = cell <= LAST_PITCHER_CELL ? '투수' : '타자'
  const outcome = aceLevelUpOutcomeOf(level, gamePoint)
  const rows = entry === undefined ? [] : aceLevelUpRowsOf(role, entry.ability, level)

  const confirm = () => {
    if (!isYes) return onClose()
    if (outcome.kind === 'G부족') return setIsShortageOpen(true)
    onLevelUp(cell, outcome.cost)
    onClose()
  }

  useEffect(() => {
    if (isShortageOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === '4' || event.key === '6') {
        event.preventDefault()
        event.stopImmediatePropagation()
        return setIsYes((previous) => !previous)
      }
      if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        event.stopImmediatePropagation()
        return confirm()
      }
      if (event.key === 'Escape' || event.key === 'Backspace' || event.key === '0') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <>
      <div
        className={styles.window}
        role="dialog"
        aria-label="마선수 레벨업"
        style={{
          left: (SCREEN.width - WINDOW.width) / 2,
          top: (SCREEN.height - WINDOW.height) / 2,
          width: WINDOW.width,
          height: WINDOW.height,
        }}
      >
        <div className={styles.title}>레벨업</div>
        <div className={styles.name}>
          {entry?.name ?? ''} <span className={styles.level}>LV.{level + 1}</span>
        </div>
        <div className={styles.rows}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'contents' }} data-testid="레벨업-줄">
              <span>{row.label}</span>
              <span className={styles.value}>{row.current}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.nextValue}>{row.next}</span>
            </div>
          ))}
        </div>
        <div className={styles.cost}>
          <MarkupText raw={ACE_LEVEL_UP_TEXT.confirm.replace('%d', String(outcome.cost))} />
        </div>
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.button} ${isYes ? styles.buttonSelected : ''}`}
            aria-pressed={isYes}
            onMouseEnter={() => setIsYes(true)}
            onClick={() => (isYes ? confirm() : setIsYes(true))}
          >
            예
          </button>
          <button
            type="button"
            className={`${styles.button} ${isYes ? '' : styles.buttonSelected}`}
            aria-pressed={!isYes}
            onMouseEnter={() => setIsYes(false)}
            onClick={onClose}
          >
            아니오
          </button>
        </div>
      </div>
      {isShortageOpen && (
        <MessageBox
          text={ACE_LEVEL_UP_TEXT.shortage}
          buttons={['예', '아니오']}
          onAnswer={() => setIsShortageOpen(false)}
        />
      )}
    </>
  )
}
