import { useEffect, useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { canStealFrom } from '@/entities/game/model/steal'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
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
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean) => void
  /** 경기를 그만두고 메인 메뉴로 (이 경기 기록은 사라진다) */
  readonly onQuit: () => void
  /**
   * **도루** (원본 0x53610 → 메시지 0x583). 인자는 대상 주자가 선 루다 —
   * 원본 키는 '3' 1루 주자 · '2' 2루 주자이고, 3루 주자(키 '1')는 원본이 홈 도루를 걸지 않는다.
   * 안 넘기면 도루 입구가 뜨지 않는다.
   */
  readonly onSteal?: (base: 1 | 2) => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

/** 나만의리그 타자편 = 원본 전역 모드 4 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
const BATTER_CAREER_MODE = 4
/** 경기 화면을 덮는 하위 화면 */
type MenuOverlay = '조작방법' | '설정'

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
  onSteal,
  settings,
  onSettingsChange,
}: GameScreenProps) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  const isEagleEyeEnabled = career.eagleEyeGamesRemaining > 0
  const ace = progress.aceOpponent
  /**
   * 경기 중 모은 G포인트 누계. 원본도 기록을 달성할 때마다 더해 화면에 보여 준다 (0xa77f0 이 evt+0x180 에 누적).
   * 원본이 이 숫자를 어디에 그리는지는 아직 못 찾아, 웹 껍데기의 제목 옆 칸에 둔다 (추정).
   */
  const earnedGamePoint = recordGamePointsOf(progress.recordIds)

  /** 지금 도루를 걸 수 있는 루 — 앞 루가 비어 있어야 한다. 3루 주자는 빠진다 (`canStealFrom`) */
  const bases = progress.game.bases
  const stealableBases = (onSteal === undefined
    ? []
    : ([
        bases.first && !bases.second ? 1 : null,
        bases.second && !bases.third ? 2 : null,
      ].filter((base) => base !== null) as (1 | 2)[])
  ).filter((base) => canStealFrom(base))

  /** 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2' */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === '*') {
        event.preventDefault()
        return setMenuOpen((open) => !open)
      }
      if (isMenuOpen || overlay !== null) return
      const base = event.key === '3' ? 1 : event.key === '2' ? 2 : null
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        onSteal?.(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen, onSteal, overlay, stealableBases])

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
      title={`${career.name} · ${career.battingOrder}번타자`}
      badge={
        isEagleEyeEnabled
          ? `G ${earnedGamePoint} · 이글아이 ${career.eagleEyeGamesRemaining}`
          : `G ${earnedGamePoint}`
      }
      leftKey={
        stealableBases.length > 0 && !isMenuOpen
          ? {
              label: `도루 ${stealableBases[0]}루`,
              onPress: () => onSteal?.(stealableBases[0]),
            }
          : undefined
      }
      rightKey={{
        label: isMenuOpen ? '닫기' : '메뉴',
        onPress: () => setMenuOpen((open) => !open),
      }}
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
          isPaused={isPaused || isMenuOpen}
          random={random}
          // 필살타법 '0' (0x535a4 → 0x34c74). 레벨 0 이면 눌러도 늘 실패다 — 마타자는 30% 고정
          specialSwingLevel={career.specialSwingLevel}
          onPitchResolved={onPitchResolved}
        />
      </div>

      {isMenuOpen ? (
        <InGameMenu
          // 나만의리그 타자편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
          mode={BATTER_CAREER_MODE}
          onContinue={() => setMenuOpen(false)}
          onQuit={onQuit}
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
      ) : bannerText === '' ? (
        <Hint>
          탭·Space·5 스윙 · 좌우 끝 탭·←→(4·6) 타자 이동
          {stealableBases.includes(1) && ' · 3 도루(1루)'}
          {stealableBases.includes(2) && ' · 2 도루(2루)'}
        </Hint>
      ) : (
        <BigResult>{bannerText}</BigResult>
      )}
    </PixelScreen>
  )
}
