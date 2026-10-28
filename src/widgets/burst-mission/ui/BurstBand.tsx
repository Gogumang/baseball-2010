import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  BURST_BAND_FRAME_SRC,
  BURST_BAND_GOAL_TEXT,
  BURST_BAND_PANEL,
  BURST_BAND_REWARD_TEXT,
  burstBandOf,
} from '@/widgets/burst-mission/lib/burstBandLayout'
import type { BurstBandRole } from '@/widgets/burst-mission/lib/burstBandLayout'
import * as styles from '@/widgets/burst-mission/ui/BurstBand.css'

interface BurstBandProps {
  /** 지금 돌발 행 [M+0xc] — 없으면(−1) 아무것도 안 그린다 */
  readonly row: BurstMissionRow | null
  /** 사람 팀이 공격(방망이 8)인가 수비(공 7)인가 */
  readonly role: BurstBandRole
  /**
   * 0xf 구질 목록이 실린 동안 — 빛 지도(4c5a6 · 0x9ce71)가 그 앞까지 그린 화면을 RGB 각 × 15/32 로 어둡게 한다.
   * 띠(4c522)는 그 앞이고 투수 둘레 원(지름 60) 밖이라 늘 15/32 다
   */
  readonly isDimmed?: boolean
}

/**
 * **타석 HUD 돌발 띠 (0x8e858)** — 오른쪽 위 trainning 합성 프레임 14 판에 사람 쪽 아이콘 · 목표 이름 · 첫 보상.
 * 그리기만 한다(키 없음). 배치는 `lib/burstBandLayout`.
 */
export function BurstBand({ row, role, isDimmed = false }: BurstBandProps) {
  const draw = burstBandOf(row, role)
  if (draw === null) return null
  return (
    <div className={styles.band} data-testid="돌발-띠" {...(isDimmed ? { style: { filter: `brightness(${15 / 32})` } } : {})}>
      <img
        className={styles.sprite}
        src={BURST_BAND_FRAME_SRC}
        alt=""
        style={{ left: BURST_BAND_PANEL.left, top: BURST_BAND_PANEL.top }}
        data-testid="돌발-띠-판"
      />
      {draw.icon !== null && (
        <img className={styles.sprite} src={draw.icon.src} alt="" style={{ left: draw.icon.left, top: draw.icon.top }} data-testid="돌발-띠-아이콘" />
      )}
      <span
        className={styles.text}
        data-testid="돌발-띠-목표"
        style={{ left: BURST_BAND_GOAL_TEXT.left, top: BURST_BAND_GOAL_TEXT.top, width: BURST_BAND_GOAL_TEXT.width }}
      >
        {stripGameMarkup(draw.goalText)}
      </span>
      <span
        className={styles.text}
        data-testid="돌발-띠-보상"
        style={{ left: BURST_BAND_REWARD_TEXT.left, top: BURST_BAND_REWARD_TEXT.top, width: BURST_BAND_REWARD_TEXT.width }}
      >
        {stripGameMarkup(draw.rewardText)}
      </span>
    </div>
  )
}
