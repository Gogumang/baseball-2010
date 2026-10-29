import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { titleDisplayNameOf } from '@/entities/career/model/titles'
import { NAME_BAND, nameBandSplitOf } from '@/pages/management/lib/managementLayout'
import { StatusBoardBase } from '@/pages/management/ui/ManagementBoard'
import { NariStatusValues } from '@/pages/management/ui/StatusValues'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import {
  GAUGE_FILL,
  PITCHER_MORALE_OFFSET_Y,
  STAMINA_LABEL_FRAME,
  pitcherStatusIconStateOf,
  pitcherTitleNameOf,
  staminaBarLayoutOf,
} from '@/pages/management/lib/pitcherStatusBoard'

interface PitcherStatusBoardProps {
  readonly career: PitcherCareer
  readonly hour?: number
  /** 0x7d34c 둘째 인자 [이벤트+0xb] — 메시지줄 경기 번호 −1 */
  readonly isPreviousGame?: boolean
}

/**
 * 투수편 상태판 — 공용 상태판 **0x7d34c 의 모드 3 갈래** (직접 떴다). 나리 타자편과 다른 곳은
 * 사기 박스 y −3 과 스태미나 막대(`staminaBarLayoutOf`) 둘뿐이다 — 이름 띠(꺾임 75 · 이름 · 칭호), 값 칸 넷(인기도 · 소지금 ·
 * 평판 · 연봉), 메시지줄, 아이콘 다섯은 같다.
 */
export function PitcherStatusBoard({ career, hour, isPreviousGame = false }: PitcherStatusBoardProps) {
  const band = NAME_BAND
  const bar = staminaBarLayoutOf(career)
  return (
    <div role="group" aria-label="상태판">
      <StatusBoardBase
        hour={hour}
        nameBandSplit={nameBandSplitOf(false)}
        morale={career.morale}
        moraleOffsetY={PITCHER_MORALE_OFFSET_Y}
        nameContent={
          <>
            <div className={styles.nameText} style={{ left: band.nameBox.x, top: band.top, width: band.nameBox.width }}>
              {career.name}
            </div>
            <div className={styles.nameText} style={{ left: band.titleBox.x, top: band.top, width: band.titleBox.width }}>
              {titleDisplayNameOf(pitcherTitleNameOf(career))}
            </div>
          </>
        }
      />
      <svg className={styles.board} viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid="스태미나막대">
        <rect x={bar.outer.x} y={bar.outer.y} width={bar.outer.width} height={bar.outer.height} fill={GAUGE_FILL} />
        {bar.filled > 0 && (
          <>
            <rect x={bar.inner.x} y={bar.inner.y} width={bar.filled} height={4} fill="#FF0907" />
            <rect x={bar.inner.x} y={bar.inner.y + 1} width={bar.filled} height={2} fill="#FF8001" />
            <rect x={bar.inner.x} y={bar.inner.y + 4} width={bar.filled} height={1} fill="#BC0001" />
          </>
        )}
      </svg>
      <img
        className={styles.layer}
        src={assetUrl(`./sprites/img_text/frames/${STAMINA_LABEL_FRAME}.png`)}
        alt=""
        style={{ left: bar.label.left, top: bar.label.top }}
      />
      <NariStatusValues
        isPreviousGame={isPreviousGame}
        fields={{
          popularity: career.popularity,
          money: career.money,
          reputation: career.reputation,
          salary: career.salary,
          season: career.season,
          dayCounter: leagueDayCounterOf(career),
          isPostseason: career.postseason !== null,
          icons: pitcherStatusIconStateOf(career),
        }}
      />
    </div>
  )
}
