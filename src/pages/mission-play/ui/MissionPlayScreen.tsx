import { useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
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
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`).
   * 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다. 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

/** 미션 타자편 = 원본 전역 모드 5 — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(다시하기가 있는 줄) */
const MISSION_BATTER_MODE = 5
type MenuOverlay = '조작방법' | '설정'

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
  onRestart,
  settings,
  onSettingsChange,
}: MissionPlayScreenProps) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
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

  // 경기 중 메뉴의 "조작방법"(0x3c212)·"설정"(0x3c326)
  if (overlay === '조작방법') return <HelpScreen onBack={() => setOverlay(null)} />
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        hasSavedCareer={false}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => setOverlay(null)}
      />
    )
  }

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
      rightKey={
        isOver
          ? undefined
          : { label: isMenuOpen ? '닫기' : '메뉴', onPress: () => setMenuOpen((open) => !open) }
      }
    >
      <GoalBar goals={goals} />

      {isMenuOpen && (
        <InGameMenu
          // 미션 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
          mode={MISSION_BATTER_MODE}
          onContinue={() => setMenuOpen(false)}
          onQuit={onGiveUp}
          onRestart={onRestart}
          onOpenHelp={() => {
            setMenuOpen(false)
            setOverlay('조작방법')
          }}
          onOpenSettings={
            settings === undefined || onSettingsChange === undefined
              ? undefined
              : () => {
                  setMenuOpen(false)
                  setOverlay('설정')
                }
          }
        />
      )}

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
