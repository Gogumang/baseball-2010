import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { TEAMS } from '@/shared/config/original/teams'
import { batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import {
  BATTING_TYPE_NAMES, FIGURE_BOX, FIGURE_FOOT, INFO_BOARD, POSITION_NAMES, RIGHT_PANEL, SIDE_NAMES, SKIN_NAMES,
} from '@/pages/management/lib/basicInfoLayout'
import { RadarChart } from '@/pages/management/ui/RadarChart'
import { InfoTable } from '@/pages/management/ui/InfoTable'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

/** 기본정보 카드 (0x15e20) — 선수 그림 · ABILITY 레이더 · 정보 칸. 카드 판 모양(0x7ba44)은 박스만 알아 근사한다 (추정) */
export function BasicInfoCard({ career }: { readonly career: PlayerCareer }) {
  const shown = effectiveAbilityOf(career)
  const values = [
    (TEAMS[career.teamId] ?? TEAMS[0]).name,
    career.name,
    BATTING_TYPE_NAMES[career.battingTypeIndex] ?? '',
    // 필살 = 선수 +0x18 필살 번호의 이름. 웹은 필살타법 번호가 없어 레벨이 있으면 "필살타법" 으로 둔다 (추정)
    career.specialSwingLevel > 0 ? '필살타법' : '',
    POSITION_NAMES[career.positionIndex] ?? '',
    SIDE_NAMES[career.battingSide] ?? '',
    SKIN_NAMES[career.skinIndex] ?? '',
  ]
  return (
    <>
      <div className={styles.cardPanel} style={{ left: FIGURE_BOX.x, top: FIGURE_BOX.y, width: FIGURE_BOX.width, height: FIGURE_BOX.height }} />
      <div className={styles.cardPanel} style={{ left: RIGHT_PANEL.x, top: RIGHT_PANEL.y, width: RIGHT_PANEL.width, height: RIGHT_PANEL.height }} />
      {batterLayersOf(0, career.battingTypeIndex).map((layer, index) => (
        <LayerSprite key={index} layer={layer} />
      ))}
      <RadarChart base={career.ability} shown={shown} />
      <div className={styles.cardPanel} style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: INFO_BOARD.width, height: INFO_BOARD.height, background: INFO_BOARD.color }} />
      <InfoTable values={values} battingOrder={career.battingOrder} />
    </>
  )
}

function LayerSprite({ layer }: { readonly layer: BatterLayer }) {
  const origins = useFrameOrigins(layer.folder)
  return <FrameSprite folder={layer.folder} frame={layer.frame} origins={origins} x={FIGURE_FOOT.x} y={FIGURE_FOOT.y} />
}
