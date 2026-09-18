import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import * as styles from '@/pages/mission-play/ui/MissionPlayScreen.css'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { goalsOf } from '@/entities/mission/model/missionGoal'
import { GoalBar } from '@/entities/mission/ui/GoalBar'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { canSteal as canStealNow } from '@/entities/mission/model/missionRun'
import type { AcePlayer } from '@/shared/config/original/acePlayers'

interface MissionPlayScreenProps {
  readonly run: MissionRun
  readonly ability: BatterAbility
  readonly pitcherAbility: PitcherAbility
  /** 마투수 미션의 상대. 일반 투수면 null */
  readonly opponent: AcePlayer | null
  readonly atBat: AtBatState
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch) => void
  readonly onGiveUp: () => void
  readonly onFinish: () => void
  /** 도루 목표가 있는 미션에서만 쓴다 */
  readonly onSteal: () => void
}

export function MissionPlayScreen({
  run,
  ability,
  pitcherAbility,
  opponent,
  atBat,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  onGiveUp,
  onFinish,
  onSteal,
}: MissionPlayScreenProps) {
  const goals = goalsOf(run.mission, run.progress)
  const isOver = run.status !== '진행중'
  const canBunt = run.mission.goals.includes('번트')
  // 도루 목표가 있고 1루 주자가 있을 때만 (StrHOWTO[2])
  const canSteal = run.mission.goals.includes('도루') && canStealNow(run)

  const badgeParts: string[] = []
  if (run.remainingSeconds !== null) badgeParts.push(`${Math.ceil(run.remainingSeconds)}초`)
  if (run.remainingPlateAppearances !== null) {
    badgeParts.push(`${Math.max(0, run.remainingPlateAppearances)}타석`)
  }
  if (run.remainingSwings !== null) badgeParts.push(`${Math.max(0, run.remainingSwings)}스윙`)

  return (
    <PixelScreen
      title={run.mission.name}
      badge={badgeParts.join(' · ') || undefined}
      leftKey={
        isOver
          ? { label: '확인', onPress: onFinish }
          : canSteal
            ? { label: '도루', onPress: onSteal }
            : undefined
      }
      rightKey={isOver ? undefined : { label: '포기', onPress: onGiveUp }}
    >
      <GoalBar goals={goals} />

      <div className={styles.stageArea}>
        <BattingStage
          batterAbility={ability}
          swingMode="미션"
          pitcherAbility={pitcherAbility}
          isEagleEyeEnabled={false}
          // 시작 상황을 원본 HUD 에 보인다. 미션 팀 로고는 레코드에 없어 기본 두 팀을 쓴다 (추정)
          hud={{
            inning: run.mission.start.inning,
            half: '말',
            ourScore: run.mission.start.ourScore + (run.progress.counts['타점'] ?? 0),
            opponentScore: run.mission.start.opponentScore,
            balls: atBat.balls,
            strikes: atBat.strikes,
            outs: run.outs,
            bases: run.bases,
            ourLogoUrl: './sprites/team_logo_ini/000.png',
            opponentLogoUrl: './sprites/team_logo_ini/001.png',
          }}
          acePitcher={
            opponent === null
              ? null
              : { framesUrl: opponent.framesUrl, frameCount: opponent.frameCount, stillUrl: opponent.stillUrl }
          }
          canBunt={canBunt}
          isPaused={isPaused || isOver}
          random={random}
          onPitchResolved={onPitchResolved}
        />

        <div className={styles.overlay}>
          {isOver ? (
            <BigResult>{run.status === '성공' ? '미션 성공!' : '미션 실패'}</BigResult>
          ) : bannerText === '' ? (
            <Hint>
              {atBat.balls}볼 {atBat.strikes}스트라이크
              {canBunt && ' · 8·7·9(Shift)·길게 눌러 번트'}
              {canSteal && ' · 아래 [도루]'}
            </Hint>
          ) : (
            <BigResult>{bannerText}</BigResult>
          )}
        </div>
      </div>
    </PixelScreen>
  )
}
