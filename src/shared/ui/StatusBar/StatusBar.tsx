import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import type { BatterAbility } from '@/entities/batting/model/batter'
import * as styles from '@/shared/ui/StatusBar/StatusBar.css'

export function StatusBar({ career }: { readonly career: PlayerCareer }) {
  return (
    <div className={styles.bar}>
      <div className={styles.cell}>
        <span>G포인트</span>
        <span>{career.gamePoint.toLocaleString('ko-KR')}</span>
      </div>
      <div className={styles.cell}>
        <span>체력</span>
        <span>{career.stamina}</span>
      </div>
      <div className={styles.cell}>
        <span>경기</span>
        <span>
          {career.gamesPlayed}/{GAMES_PER_SEASON}
        </span>
      </div>
    </div>
  )
}

/** 능력치 눈금 상한 (0~999) */
const ABILITY_BAR_MAXIMUM = 999

const ABILITY_LABELS: readonly (readonly [keyof BatterAbility, string])[] = [
  ['hit', '히트'],
  ['power', '파워'],
  ['run', '주루'],
  ['defense', '수비'],
]

export function AbilityBars({ ability }: { readonly ability: BatterAbility }) {
  return (
    <div>
      {ABILITY_LABELS.map(([key, label]) => (
        <div className={styles.abilityRow} key={key}>
          <span>{label}</span>
          <span className={styles.abilityTrack}>
            <span className={styles.abilityFill} style={{ width: `${(ability[key] / ABILITY_BAR_MAXIMUM) * 100}%` }} />
          </span>
          <span className={styles.abilityValue}>{ability[key]}</span>
        </div>
      ))}
    </div>
  )
}
