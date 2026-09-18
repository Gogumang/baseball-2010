import { useState } from 'react'
import { BigResult, DialogueBox, Hint, MarkupText, PixelScreen } from '@/shared/ui'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import * as styles from '@/pages/game/ui/GameScreen.css'
import { detail } from '@/shared/ui/MenuList/MenuList.css'

const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

interface GameScreenProps {
  readonly career: PlayerCareer
  readonly progress: GameProgress
  readonly atBat: AtBatState
  readonly pitcherAbility: PitcherAbility
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch) => void
  /** 경기를 그만두고 메인 메뉴로 (이 경기 기록은 사라진다) */
  readonly onQuit: () => void
}

/** StrGAME[0] 경기 중 메뉴 호출(*) 확인 문구 */
const QUIT_CONFIRM =
  '!C!cFFFFFF현재 이닝의 기록과 획득한!N!cFF0000G포인트가 사라집니다!cFFFFFF!N메인메뉴로 나가시겠습니까?'

export function GameScreen({
  career,
  progress,
  atBat,
  pitcherAbility,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  onQuit,
}: GameScreenProps) {
  const [isConfirmingQuit, setIsConfirmingQuit] = useState(false)
  const isEagleEyeEnabled = career.eagleEyeGamesRemaining > 0
  const ace = progress.aceOpponent

  return (
    <PixelScreen
      title={`${career.name} · ${career.battingOrder}번타자`}
      badge={isEagleEyeEnabled ? `이글아이 ${career.eagleEyeGamesRemaining}` : undefined}
      leftKey={isConfirmingQuit ? { label: '예', onPress: onQuit } : undefined}
      rightKey={
        isConfirmingQuit
          ? { label: '아니오', onPress: () => setIsConfirmingQuit(false) }
          : { label: '메뉴', onPress: () => setIsConfirmingQuit(true) }
      }
    >
      <div className={styles.stageArea}>
        {ace !== null && (
          <div className={styles.aceAlert}>
            <img src={ace.iconUrl} alt={ace.name} width={33} height={33} />
            <div>
              <strong>{ace.name}</strong> 등판!
              <span className={detail}>필살기 · {ace.burst}</span>
            </div>
          </div>
        )}

        <BattingStage
          batterAbility={effectiveAbilityOf(career)}
          swingMode="나만의리그"
          batterSkillIds={career.skillIds}
          recentAtBatCodes={progress.recentAtBatCodes}
          pitcherAbility={pitcherAbility}
          hud={{
            inning: progress.game.inning,
            half: progress.game.half,
            ourScore: progress.game.ourScore,
            opponentScore: progress.game.opponentScore,
            balls: atBat.balls,
            strikes: atBat.strikes,
            outs: progress.game.outs,
            bases: progress.game.bases,
            // HUD 팀 아이콘은 작은 로고 ui/team_logo_ini (0x373d0)
            ourLogoUrl: smallLogoUrlOf(career.teamId),
            opponentLogoUrl: smallLogoUrlOf(progress.opponentTeamId),
            ourTeamId: career.teamId,
            opponentTeamId: progress.opponentTeamId,
          }}
          isEagleEyeEnabled={isEagleEyeEnabled}
          acePitcher={
            ace === null
              ? null
              : { framesUrl: ace.framesUrl, frameCount: ace.frameCount, stillUrl: ace.stillUrl }
          }
          isPaused={isPaused || isConfirmingQuit}
          random={random}
          onPitchResolved={onPitchResolved}
        />
      </div>

      {isConfirmingQuit ? (
        <DialogueBox>
          <MarkupText raw={QUIT_CONFIRM} />
        </DialogueBox>
      ) : bannerText === '' ? (
        <Hint>
          탭·Space·5 스윙 · 좌우 끝 탭·←→(4·6) 타자 이동
        </Hint>
      ) : (
        <BigResult>{bannerText}</BigResult>
      )}
    </PixelScreen>
  )
}
