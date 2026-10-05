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
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound } from '@/shared/api/audio/soundPort'
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
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 상대 마투수의 마구 횟수
   * 0xd8509[레벨] (0xaebe4) 이 이 칸을 본다 — 안 넘기면 Lv1(3 회).
   */
  readonly aceLevels?: Readonly<Record<number, number>>
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
  /**
   * **CPU 투수의 견제** — 상대 투수 AI 가 목표점 대신 견제(종류 4, 0x34848)를 고르면 타석 화면이 공을 안 던지고
   * 그 루를 알려 준다. 원본 0x345fc 는 홈런더비(모드 7)만 갈라 타자편(모드 4)도 견제한다.
   * 안 넘기면 견제가 꺼진다(종류 4 → 1, `selectPitch` 주석).
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 벤치 클리어링 연출(상태 0x1e)이 끝났다 — `progress.pendingBenchClearing` 이 차 있는 동안 타석 대신 연출을 띄운다.
   * 인자는 틱 10 의 갱신이 돌았는가 (진행기 `resolveBenchClearing` 이 그 굴림 8 번을 낸다).
   */
  readonly onBenchClearingDone?: (reachedTargetTick: boolean) => void
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
  aceLevels,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  onQuit,
  onSteal,
  onPickoff,
  settings,
  onSettingsChange,
  onBenchClearingDone,
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

  const isBenchClearing = progress.pendingBenchClearing !== null
  /** OK 로 1회초 판을 닫았는가 */
  const [isBoardClosed, setBoardClosed] = useState(false)
  const board = progress.halfInningBoard ?? null
  const isHalfInningBoardOpen = !isBoardClosed && board !== null && isAtFirstPitchOf(progress, atBat)
  /** 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2' */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 벤치 클리어링(0x1e)·1회초 판(0x18) 중에는 공용 키가 안 열린다 (0x498d4 의 상태 범위 밖)
      if (isBenchClearing || isHalfInningBoardOpen) return
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
  }, [isBenchClearing, isHalfInningBoardOpen, isMenuOpen, onSteal, overlay, stealableBases])

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 공용 키 '*'·도루도 0x1e 에서는 안 열린다
  if (progress.pendingBenchClearing !== null && onBenchClearingDone !== undefined) {
    return <BenchClearingScene onDone={onBenchClearingDone} />
  }

  /**
   * 1회초 판(상태 0x18) — 선공·1번 타자일 때만 진행기가 세운다(`gameFlow.withFirstInningBoard`, 굴림 36 개는 그때 썼다).
   * 징글 13 은 판의 틱 2 (0x4f7ac). OK → 0xae3a0 → 0xd → 첫 타석.
   */
  if (isHalfInningBoardOpen && board !== null) {
    return (
      <HalfInningBoard
        inning={board.inning}
        half={board.half}
        onTick={(tick) => {
          if (tick === HALF_INNING_JINGLE_TICK) activeSound().play(HALF_INNING_SOUND)
        }}
        onConfirm={() => setBoardClosed(true)}
      />
    )
  }

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
          gameMode={BATTER_CAREER_MODE}
          // 타자 폼 = 원본 rec[0xb] 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a) — 장타형이면 sluger 몸통이 나온다
          batterForm={career.battingTypeIndex * 2 + career.battingSide}
          // 고른 피부(0 황인 · 1 백인 · 2 흑인)와 장비를 타석 그림에 입힌다 —
          // 안 넘기면 구운 벌(피부 0)과 맨몸으로 나간다
          batterSkinIndex={career.skinIndex}
          batterEquipmentLevels={career.equipmentLevels}
          // 스윙 결과 0xab214 는 0xb62b4 = 장착 비트(+0x14)만 본다 — 보유 전부가 아니다
          batterSkillIds={career.equippedSkillIds}
          recentAtBatCodes={progress.recentAtBatCodes}
          pitcherAbility={pitcherAbility}
          // 마선수 대결의 상대 마투수 마구 횟수 = 0xd8509[mgr[0x13a + 순번]] (0xaebe4)
          aceLevels={aceLevels}
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
          // 필살타법 '0' (0x535a4 → 0x51dee → 0x34c74). 레벨이 아니라 **고른 번호**(+0x18)를 넘긴다 —
          // 0 이면(아직 안 고름) '0' 키가 무시된다
          specialSwingNumber={career.specialSwingNumber}
          onPitchResolved={onPitchResolved}
          onPickoff={onPickoff}
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

/**
 * 판이 아직 OK 를 기다리는 자리인가 — 경기 첫 타석의 첫 공 전(아웃·주자·점수 없고 볼카운트 0-0).
 * 이 화면은 수비 재생 동안 앱이 내렸다 다시 올리므로(닫힘 상태가 사라진다) 판이 다시 서지 않게
 * 경기가 한 걸음이라도 나갔으면 판을 안 띄운다. 1회초 판은 경기 첫 장면에만 서므로 이것으로 충분하다.
 */
function isAtFirstPitchOf(progress: GameProgress, atBat: AtBatState): boolean {
  const { game } = progress
  return (
    game.inning === 1 &&
    game.outs === 0 &&
    game.ourScore === 0 &&
    game.opponentScore === 0 &&
    !game.bases.first &&
    !game.bases.second &&
    !game.bases.third &&
    atBat.balls === 0 &&
    atBat.strikes === 0
  )
}
