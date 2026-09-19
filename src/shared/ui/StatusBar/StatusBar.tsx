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
      {/*
        체력은 **투수 능력치**다 (StrHOWTO: "투수 능력치 … 체력 : 투구 수에 영향").
        타자 능력치는 히트·파워·수비·주루뿐이고, 관리 수치도 사기·인기도·평판·소지금·관중이다.
        웹판이 타자에게 만들어 붙였던 체력을 걷어내고 원본에 있는 사기를 보여 준다.
      */}
      <div className={styles.cell}>
        <span>사기</span>
        <span>{career.morale}</span>
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
