import { useEffect, useRef, useState } from 'react'
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
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AcePlayer } from '@/shared/config/original/acePlayers'

interface MissionPlayScreenProps {
  readonly run: MissionRun
  readonly ability: BatterAbility
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 미션은 나리 타자편 저장을 올리므로 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  readonly pitcherAbility: PitcherAbility
  /** 마투수 미션의 상대. 일반 투수면 null */
  readonly opponent: AcePlayer | null
  readonly atBat: AtBatState
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  /** 셋째 인자는 필살타법이 성공한 타구인가 · 넷째는 번트 종류 장면 +0xfdc (`BattingStage.onPitchResolved` 그대로) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => void
  /**
   * 치는 선수의 **고른 필살 번호** (레코드 +0x18) — '0' 키 0x51dee 가 S+0x10 에 싣는다. 안 넘기면 0 = '0' 키 무시.
   */
  readonly specialSwingNumber?: number
  /** 이 미션 한 판의 남은 필살 횟수 (0xaea30). 안 넘기면 횟수 제한 없이 번호만 본다 (`BattingStage` 기본) */
  readonly specialSwingRemaining?: number
  /** 필살 스윙이 나가 남은 횟수가 줄었다 (0x4e136) — 인자는 줄인 뒤 값 */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  readonly onGiveUp: () => void
  readonly onFinish: () => void
  /**
   * 마선수 레벨 열 칸 (`useAceLevels` 의 `levels`) — `BattingStage` 로 그대로 넘긴다.
   * 상대 마투수의 마구 횟수가 `0xd8509[레벨]` = [3,4,5,6,7] 을 따른다 (타석 교대 0xaebe4). 안 넘기면 Lv1 = 3회.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **CPU 투수의 견제** — `BattingStage.onPickoff` 로 그대로 넘긴다. 미션(모드 6)도 견제 길에 모드·미션 갈림이 없다
   * (0x50f28 · 0x345fc 의 갈림은 홈런더비 하나). 안 넘기면 견제가 꺼진다.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /**
   * **도루 출발** (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`). 인자는 대상 주자가 선 루다.
   * 판정은 공이 도착할 때 도루 판(종류 5)이 한다.
   */
  readonly onSteal: (base: StealBase) => void
  /** 지금 출발시킬 수 있는 루 (`canStartSteal`). 안 넘기면 도루 입구가 없다 */
  readonly stealableBases?: readonly StealBase[]
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`).
   * 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다. 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

/**
 * 미션 타자편 = 원본 전역 모드 **6** — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(다시하기가 있는 줄).
 * 모드 5 가 XlsPITCHER_MISSION 을 올리는 투수편이다 (Q2-mission-rewards 1-0 확정).
 * 행은 "모드 5~7 → 1" 이라 5·6 어느 쪽이든 같은 칸이 나온다.
 */
const MISSION_BATTER_MODE = 6
type MenuOverlay = '조작방법' | '설정'

export function MissionPlayScreen({
  run,
  ability,
  batterSkillIds,
  pitcherAbility,
  opponent,
  atBat,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  specialSwingNumber,
  specialSwingRemaining,
  onSpecialSwingUsed,
  aceLevels,
  onPickoff,
  onGiveUp,
  onFinish,
  onSteal,
  stealableBases = [],
  onRestart,
  settings,
  onSettingsChange,
}: MissionPlayScreenProps) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  const goals = goalsOf(run.mission, run.progress)
  const isOver = run.status !== '진행중'
  const canBunt = run.mission.goals.includes('번트')
  // 도루 출발 — 사람 공격이고 앞길이 열린 주자가 있을 때 (`canStartSteal`). 목표에 도루가 없어도 키는 먹는다
  const canSteal = !isOver && stealableBases.length > 0
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const stealIfFlying = (base: StealBase) => {
    if (flightProbeRef.current?.() === true) onSteal(base)
  }
  // 원본 공용 키 처리 0x498d4 — 도루 '3'/'2'/'1' (공이 나는 동안만, 그 밖의 키는 먹고 끝난다)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isMenuOpen || overlay !== null) return
      const base = stealBaseOfKey(event.key)
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        if (flightProbeRef.current?.() === true) onSteal(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen, onSteal, overlay, stealableBases])

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
            ? { label: `도루 ${stealableBases[0]}루`, onPress: () => stealIfFlying(stealableBases[0]) }
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
          batterSkillIds={batterSkillIds}
          // 판정 묶음 '미션' = 모드 6(타자 미션) — 공격(사람) +100 (0xab5c0)
          swingMode="미션"
          // 미션은 나리 타자편 저장의 선수(등록 타자 rec[0xa] 0xa0 — 비트7)가 친다. 내 선수 보너스는 모드 3·4 에서만
          // 켜지므로(sp40) 판정 값은 안 바뀐다 — 연차도 그 갈래에서만 읽혀 넘기지 않는다
          isBatterOwnPlayer
          specialSwingNumber={specialSwingNumber}
          specialSwingRemaining={specialSwingRemaining}
          onSpecialSwingUsed={onSpecialSwingUsed}
          gameMode={MISSION_BATTER_MODE}
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
          aceLevels={aceLevels}
          onPitchResolved={onPitchResolved}
          onPickoff={onPickoff}
          flightProbeRef={flightProbeRef}
        />

        <div className={styles.overlay}>
          {isOver ? (
            <BigResult>{run.status === '성공' ? '미션 성공!' : '미션 실패'}</BigResult>
          ) : bannerText === '' ? (
            <Hint>
              {atBat.balls}볼 {atBat.strikes}스트라이크
              {canBunt && ' · 8·7·9(Shift)·길게 눌러 번트'}
              {stealableBases.includes(1) && ' · 3 도루(1루)'}
              {stealableBases.includes(2) && ' · 2 도루(2루)'}
              {stealableBases.includes(3) && ' · 1 도루(3루)'}
            </Hint>
          ) : (
            <BigResult>{bannerText}</BigResult>
          )}
        </div>
      </div>
    </PixelScreen>
  )
}
