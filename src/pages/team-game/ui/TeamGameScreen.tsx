import { useEffect, useState } from 'react'
import { BigResult, Hint, MenuList, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import type { MenuItem, StatEntry } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import {
  autoProgressCostOf,
  canAutoProgress,
  currentBatterAbility,
  currentPitcherAbility,
  pitchSlotsFor,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  TeamGameOptions,
  TeamGameSummary,
} from '@/features/play-team-game/model/teamGameFlow'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
// 조작방법·환경설정 화면은 메인 메뉴 쪽에 이미 있다 — 경기 중 메뉴도 **같은 화면**을 연다
// (원본 0x3c212 는 StrHOWTO 뷰어, 0x3c326 은 StrMAINMENU 쪽 설정 페이지를 그대로 부른다).
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
// 투수 조작 부품 두 개는 투수편 화면이 이미 원본 규칙대로 만들어 둔 것을 **그대로 빌려 쓴다**
// (같은 상태 0x10·0x11 의 조작이라 화면을 따로 만들 이유가 없다).
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import * as styles from '@/pages/team-game/ui/TeamGameScreen.css'

/**
 * **팀 경기 화면** — 원본 게임 모드 1 일반 · 2 시즌 · 8·9 대전 이 쓰는 경기 장면(0x104)이다.
 *
 * 한 화면에서 공수를 번갈아 돈다:
 *   - 우리 공격 → 타석 화면(`widgets/batting-stage`, 상태 0xf~0x13)
 *   - 우리 수비 → 투구 세 단계(구질 0xf → 코스 0x10 → 게이지 0x11)
 *   - 그 밖(경기진행 설정이 "자동" 이라고 한 타석) → 진행기가 간이 엔진으로 넘긴 뒤 다음 사람 차례에서 멈춘다
 *
 * 경기 중 조작은 원본 `0x498d4` 를 따른다:
 *   - **'\*'** 경기 중 메뉴 (표 0xcfcfc 행 0: 계속·자동진행·조작방법·설정·나가기 — I-controls 4c)
 *   - **'#'** 투수 교체 화면 (상태 0xb, 투구 전·구질 고르기에서 벤치 투수가 있을 때 — I-controls 4b · R4 1a)
 *   - **'3'/'2'** 도루 (공격 중, 메시지 0x583 — I-controls 0절)
 *
 * 원본에 있고 여기 없는 것: 대타 '#'(공격 중), 자동진행 **중계 화면**(상태 0x21),
 * 공수 교대 화면(0x18)·경기 끝 결과 판의 승·패·세 투수 세 줄.
 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 통째로 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'

interface TeamGameScreenProps {
  readonly options: TeamGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 — 시즌 세션은 이 요약으로 하루를 정산한다 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /**
   * 지금 가진 G포인트(`저장+0x64`). **안 넘기면 자동진행 칸이 잠긴다** —
   * 비용을 검사할 수 없기 때문이다.
   */
  readonly gamePoint?: number
  /** 자동진행 비용만큼 G포인트를 깎아 달라는 알림 (모드 8·9 는 100, 그 밖은 30) */
  readonly onSpendGamePoint?: (cost: number) => void
  /** 환경설정 값. 안 넘기면 경기 중 메뉴의 "설정" 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

export function TeamGameScreen({
  options,
  random,
  onFinish,
  onQuit,
  gamePoint,
  onSpendGamePoint,
  settings,
  onSettingsChange,
}: TeamGameScreenProps) {
  const session = useTeamGame(options, random)
  const { progress, canBat, canPitch, summary, actions } = session

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  const [courseCell, setCourseCell] = useState(4)
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /** `#` 투수 교체 화면(경기 상태 0xb)이 떠 있는가 */
  const [isChangingPitcher, setChangingPitcher] = useState(false)
  /** 제안 대사를 이미 보여 준 돌발 행 번호 */
  const [shownProposal, setShownProposal] = useState<number | null>(null)

  // 타석·차례가 바뀌면 투구 1단계로 되돌린다
  useEffect(() => {
    if (!canPitch) return
    if (progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }, [canPitch, progress.atBat.balls, progress.atBat.strikes])

  /**
   * 원본 공용 키 처리 `0x498d4` — '\*' 경기 중 메뉴 · '#' 교체 · 도루 '3'/'2'.
   * (CLR 은 웹에서 Escape·Backspace 로 받는다 — 원본 키 코드 −16.)
   */
  const isStealable = session.stealableBases
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === '*') {
        event.preventDefault()
        setChangingPitcher(false)
        return setMenuOpen((open) => !open)
      }
      if (isMenuOpen || overlay !== null) {
        // 교체 화면과 메뉴에서 CLR 은 닫기다 (0x495fc 의 '#'·CLR 가지)
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault()
          setMenuOpen(false)
        }
        return
      }
      if (event.key === '#') {
        event.preventDefault()
        if (isChangingPitcher) return setChangingPitcher(false)
        if (session.canChangePitcher) setChangingPitcher(true)
        return
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (!isChangingPitcher) return
        event.preventDefault()
        return setChangingPitcher(false)
      }
      // 도루 0x53610 — '3' 1루 주자 · '2' 2루 주자 ('1' 3루 주자는 원본이 홈 도루를 걸지 않는다)
      const stealBase = event.key === '3' ? 1 : event.key === '2' ? 2 : null
      if (stealBase !== null && isStealable.includes(stealBase)) {
        event.preventDefault()
        actions.steal(stealBase)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, isChangingPitcher, isMenuOpen, isStealable, overlay, session.canChangePitcher])

  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  const proposal =
    burst !== null && burst.current !== null && burst.current.index !== shownProposal
      ? burst.current
      : null
  const burstRow = resolution?.row ?? proposal
  const burstLines =
    burst === null || burstRow == null
      ? null
      : (ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null)

  const game = progress.game
  const staminaPercent = staminaPercentOf(progress.stamina)

  if (summary !== null) {
    return (
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '확인', onPress: () => onFinish(summary) }}
      >
        <BigResult>
          {summary.ourScore} : {summary.opponentScore} {summary.result}
        </BigResult>
        <StatGrid entries={summaryEntries(summary)} />
        <Hint>
          {TEAMS[summary.ourTeamId]?.name ?? ''} vs {TEAMS[summary.opponentTeamId]?.name ?? ''}
        </Hint>
      </PixelScreen>
    )
  }

  // 경기 중 메뉴의 "조작방법"(0x3c212)·"설정"(0x3c326) — 원본도 경기 장면 위에 같은 화면을 얹는다
  if (overlay === '조작방법') {
    return <HelpScreen onBack={() => setOverlay(null)} />
  }
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        // 경기 중에는 모드 초기화가 갈 곳이 없다 — 줄은 그대로 두고 잠가 둔다 (웹판 판단)
        hasSavedCareer={false}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => setOverlay(null)}
      />
    )
  }

  const throwWith = (gaugeCell: number) => {
    if (slot === null) return
    actions.throwPitch({ typeNumber: slot.typeNumber, courseCell, gaugeCell })
    setPhase('구질')
    setSlot(null)
  }

  return (
    <div className={styles.frame}>
      <PixelScreen
        title={`${game.inning}회${game.half}`}
        badge={canPitch ? `${staminaPercent}%` : `${game.ourScore} : ${game.opponentScore}`}
        leftKey={
          isChangingPitcher
            ? { label: '취소', onPress: () => setChangingPitcher(false) }
            : session.canChangePitcher
              ? { label: '# 교체', onPress: () => setChangingPitcher(true) }
              : isStealable.length > 0
                ? {
                    label: `도루 ${isStealable[0]}루`,
                    onPress: () => actions.steal(isStealable[0]),
                  }
                : undefined
        }
        rightKey={{
          label: isMenuOpen ? '닫기' : '메뉴',
          onPress: () => {
            setChangingPitcher(false)
            setMenuOpen((open) => !open)
          },
        }}
      >
        <div className={styles.hud}>
          <span>아웃 {game.outs}</span>
          <span className={styles.bases}>
            <span className={game.bases.first ? styles.baseOn : undefined}>1</span>
            <span className={game.bases.second ? styles.baseOn : undefined}>2</span>
            <span className={game.bases.third ? styles.baseOn : undefined}>3</span>
          </span>
          <span className={styles.score}>
            {game.ourScore} : {game.opponentScore}
          </span>
        </div>

        {isMenuOpen ? (
          <InGameMenu
            mode={options.mode}
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
            autoProgressCost={autoProgressCostOf(options.mode)}
            canAutoProgress={canAutoProgress(progress)}
            gamePoint={gamePoint}
            onAutoProgress={
              onSpendGamePoint === undefined
                ? undefined
                : (cost) => {
                    onSpendGamePoint(cost)
                    actions.autoProgress()
                    setMenuOpen(false)
                  }
            }
          />
        ) : isChangingPitcher ? (
          <PitcherChangeWindow
            teamId={options.ourTeamId}
            currentIndex={progress.ourPitcherIndex}
            benchIndexes={session.benchPitchers}
            onSelect={(benchIndex) => {
              actions.changePitcher(benchIndex)
              setChangingPitcher(false)
            }}
          />
        ) : canBat ? (
          <div className={styles.stageArea}>
            <Panel heading="타석" />
            <BattingStage
              batterAbility={currentBatterAbility(progress)}
              // 팀 경기는 "내 선수" 보너스가 없다 — 그 보너스는 나만의리그 판정에만 있다 (0xab214)
              swingMode="일반"
              pitcherAbility={currentPitcherAbility(progress)}
              hud={{
                inning: game.inning,
                half: game.half,
                ourScore: game.ourScore,
                opponentScore: game.opponentScore,
                balls: progress.atBat.balls,
                strikes: progress.atBat.strikes,
                outs: game.outs,
                bases: game.bases,
                ourLogoUrl: smallLogoUrlOf(options.ourTeamId),
                opponentLogoUrl: smallLogoUrlOf(options.opponentTeamId),
                ourTeamId: options.ourTeamId,
                opponentTeamId: options.opponentTeamId,
              }}
              isEagleEyeEnabled={false}
              acePitcher={null}
              isPaused={burstLines !== null}
              random={random}
              onPitchResolved={(detail) => actions.resolvePitch(detail)}
            />
            <Hint>
              {(game.battingOrderIndex % 9) + 1}번 타자 · 탭·Space·5 스윙 · ←→(4·6) 타자 이동
              {isStealable.includes(1) && ' · 3 도루(1루)'}
              {isStealable.includes(2) && ' · 2 도루(2루)'}
            </Hint>
          </div>
        ) : canPitch ? (
          <>
            <div className={styles.count}>
              <span>
                B{' '}
                {[0, 1, 2].map((index) => (
                  <span key={index} className={styles.lamp} data-on={progress.atBat.balls > index}>
                    ●
                  </span>
                ))}
              </span>
              <span>
                S{' '}
                {[0, 1].map((index) => (
                  <span key={index} className={styles.lamp} data-on={progress.atBat.strikes > index}>
                    ●
                  </span>
                ))}
              </span>
              <span>상대 {progress.opponentOrderIndex + 1}번</span>
            </div>
            <div className={styles.staminaTrack}>
              <div
                className={styles.staminaFill}
                style={{ width: `${staminaPercent}%` }}
                data-low={staminaPercent <= 20}
              />
            </div>

            {phase === '구질' && (
              <>
                <Panel heading="1. 구질 선택" />
                <MenuList
                  items={slotItems(progress.magicRemaining, pitchSlotsFor(progress))}
                  onSelect={(id) => {
                    const found = pitchSlotsFor(progress).find((candidate) => slotIdOf(candidate) === id)
                    if (found === undefined || !canSelectSlot(found, progress.magicRemaining)) return
                    setSlot(found)
                    setPhase('코스')
                  }}
                />
              </>
            )}

            {phase === '코스' && (
              <>
                <Panel heading={<>2. 코스 선택 — {slot?.name}</>} />
                <CourseGrid
                  selectedCell={courseCell}
                  onSelect={(cell) => {
                    setCourseCell(cell)
                    // 마구는 게이지를 쓰지 않고 등급이 늘 5 다 (0x3f500 의 `구질 != 22`)
                    if (options.gaugeSettingOn === true && slot?.isMagic !== true) {
                      setPhase('게이지')
                      return
                    }
                    if (slot === null) return
                    actions.throwPitch({ typeNumber: slot.typeNumber, courseCell: cell, gaugeCell: 0 })
                    setPhase('구질')
                    setSlot(null)
                  }}
                />
                <Hint>노릴 코스를 고르세요</Hint>
              </>
            )}

            {phase === '게이지' && (
              <>
                <Panel heading="3. 투구 결정" />
                <PitchGradeGauge onPress={throwWith} />
              </>
            )}
          </>
        ) : (
          <Hint>자동 진행 중…</Hint>
        )}

        <ul className={styles.log}>
          {progress.log.slice(0, 6).map((entry) => (
            <li key={entry.id} className={styles.logLine} data-mine={entry.isMine}>
              {entry.text}
            </li>
          ))}
        </ul>
      </PixelScreen>

      {burstLines !== null && (
        <BurstMissionWindow
          lines={burstLines}
          judgement={resolution?.judgement ?? null}
          onClose={
            resolution !== null
              ? actions.closeBurst
              : () => setShownProposal(proposal?.index ?? null)
          }
        />
      )}
    </div>
  )
}

interface PitcherChangeWindowProps {
  readonly teamId: number
  readonly currentIndex: number
  readonly benchIndexes: readonly number[]
  readonly onSelect: (benchIndex: number) => void
}

/**
 * **투수 교체 화면** — 원본 경기 상태 0xb (진입 0x3ae08 · 그리기 0x384b8, R4 1b).
 *
 * 원본은 192×210 창에 제목 "투수 교체", 그 아래 **현재 선수 칸** 하나와 **벤치 목록 6줄**을 놓고,
 * 칸마다 이름 · 보직 · **방어율** · **탈삼진** 넷을 적는다. OK 가 확정(상태 0x16 연출), '#'·CLR 이 취소다.
 *
 * ⚠️ **근사**: 웹 로스터에는 보직(`+0xb`)도 시즌 기록(방어율·탈삼진)도 없다 —
 * 대신 경기에서 실제로 쓰는 능력치 제구·구속·체력을 적는다. 창 배치도 웹 껍데기 그대로다.
 */
function PitcherChangeWindow({
  teamId,
  currentIndex,
  benchIndexes,
  onSelect,
}: PitcherChangeWindowProps) {
  const roster = teamPitchers(teamId)
  const describe = (index: number) => {
    const player = roster[index]
    if (player === undefined) return { label: `${index + 1}번`, detail: undefined }
    return {
      label: player.name,
      detail: `제구 ${player.ability[0]} · 구속 ${player.ability[1]} · 체력 ${player.ability[3]}`,
    }
  }
  const current = describe(currentIndex)

  return (
    <>
      <Panel heading="투수 교체" />
      <Hint>
        지금 투수 — {current.label}
        {current.detail === undefined ? '' : ` (${current.detail})`}
      </Hint>
      {benchIndexes.length === 0 ? (
        <Hint>벤치에 남은 투수가 없습니다</Hint>
      ) : (
        <MenuList
          items={benchIndexes.map((index) => ({ id: String(index), ...describe(index) }))}
          onSelect={(id) => onSelect(Number(id))}
        />
      )}
      <Hint># · CLR 취소</Hint>
    </>
  )
}

function slotIdOf(slot: PitchSlot): string {
  return `${slot.slot}-${slot.typeNumber}`
}

/** 칸 5 는 '0' 키 자리다 (0x534d8 의 메시지 7) */
function slotItems(magicRemaining: number, slots: readonly PitchSlot[]): MenuItem[] {
  return slots
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => ({
      id: slotIdOf(slot),
      label: slot.name,
      detail: slot.isMagic
        ? `마구 · 남은 ${magicRemaining}회${magicRemaining === 0 ? ' (못 던짐)' : ''}`
        : undefined,
    }))
}

function summaryEntries(summary: TeamGameSummary): StatEntry[] {
  const outs = summary.pitching.outsRecorded
  return [
    { label: '이닝', value: `${Math.trunc(outs / 3)}${['', '⅓', '⅔'][outs % 3]}` },
    { label: '피안타', value: String(summary.pitching.hitsAllowed) },
    { label: '볼넷', value: String(summary.pitching.walksAllowed) },
    { label: '실점', value: String(summary.pitching.runsAllowed) },
  ]
}
