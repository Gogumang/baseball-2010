import { useEffect, useState } from 'react'
import { BigResult, Hint, MenuList, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import type { MenuItem, StatEntry } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { pitchSlotsFor } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitcherGameOptions,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'

/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 화면.
 *
 * 원본 경기 장면의 사람 조작 세 단계를 그대로 따른다 (I-controls 0절 · R10 2절):
 *   0xf  구질 고르기 — (2)(4)OK(6)(8) 다섯 자리 + '0' 마구
 *   0x10 코스 고르기 — 방향키
 *   0x11 게이지 — OK 한 번 (환경설정 "투구 게이지" 가 꺼져 있으면 이 단계가 없다)
 * 그리고 0xe·0xf 에서 `#` 를 누르면 "그만 던지시겠습니까?"(StrGAME[104]) 가 뜬다.
 *
 * ⚠️ 원본 코스 커서의 칸 수·좌표는 해독 문서에 없다 — 설명서 <투구 조작> 2단계를 따라 3×3 격자로 둔다
 * (`features/play-pitcher-game/model/pitcherPitch.courseTargetOf` 주석 참조).
 */
type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'

/** 나만의리그 투수편 = 원본 전역 모드 3 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
const PITCHER_CAREER_MODE = 3

interface PitcherGameScreenProps {
  readonly options: PitcherGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 */
  readonly onFinish: (summary: PitcherGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
}

export function PitcherGameScreen({
  options,
  random,
  onFinish,
  onQuit,
  settings,
  onSettingsChange,
}: PitcherGameScreenProps) {
  const session = usePitcherGame(options, random)
  const { progress, canPitch, summary, actions } = session

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  const [courseCell, setCourseCell] = useState(4)
  /** 제안 대사를 이미 보여 준 돌발 행 */
  const [shownProposal, setShownProposal] = useState<BurstMissionRow | null>(null)
  /** `#` 강판 물음이 떠 있는가 */
  const [asksGiveUp, setAsksGiveUp] = useState(false)

  // 타석·차례가 바뀌면 1단계로 되돌린다
  useEffect(() => {
    if (!canPitch) return
    if (progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }, [canPitch, progress.atBat.balls, progress.atBat.strikes])

  /**
   * 원본 공용 키 처리 `0x498d4` 의 '\*' — 경기 중 메뉴.
   * ('#' 는 이 모드에서 교체 화면이 아니라 "그만 던지시겠습니까"(StrGAME[104])로 간다 — I-controls 4b.)
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      event.preventDefault()
      setMenuOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  const proposal =
    burst !== null && burst.current !== null && burst.current !== shownProposal ? burst.current : null
  const burstRow = resolution?.row ?? proposal
  const burstLines =
    burst === null || burstRow == null
      ? null
      : (ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null)

  const throwWith = (gaugeCell: number) => {
    if (slot === null) return
    actions.throwPitch({ typeNumber: slot.typeNumber, courseCell, gaugeCell })
    setPhase('구질')
    setSlot(null)
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

  if (summary !== null) {
    return (
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '확인', onPress: () => onFinish(summary) }}
      >
        <BigResult>
          {summary.ourScore} : {summary.opponentScore} {summary.result}
        </BigResult>
        <StatGrid entries={pitcherStatEntries(summary)} />
        <Panel heading="감독 평가" />
        <Hint>{ORIGINAL_USER_EVENTS[summary.evaluation.managerCommentIndex] ?? ''}</Hint>
        <Hint>
          인기도 {signed(summary.evaluation.popularityChange)} · 평판{' '}
          {signed(summary.evaluation.reputationChange)} · 사기{' '}
          {signed(summary.evaluation.moraleChange)}
        </Hint>
      </PixelScreen>
    )
  }

  return (
    <div className={styles.frame}>
      <PixelScreen
        title={`${progress.game.inning}회${progress.game.half}`}
        badge={`${staminaPercentOf(progress.stamina)}%`}
        leftKey={
          canPitch && !isMenuOpen
            ? { label: '# 강판', onPress: () => setAsksGiveUp(true) }
            : undefined
        }
        rightKey={{
          label: isMenuOpen ? '닫기' : '메뉴',
          onPress: () => setMenuOpen((open) => !open),
        }}
      >
        <div className={styles.hud}>
          <span>
            아웃 {progress.game.outs} · 투구 {progress.pitchCount}
          </span>
          <span className={styles.bases}>
            <span className={progress.game.bases.first ? styles.baseOn : undefined}>1</span>
            <span className={progress.game.bases.second ? styles.baseOn : undefined}>2</span>
            <span className={progress.game.bases.third ? styles.baseOn : undefined}>3</span>
          </span>
          <span className={styles.score}>
            {progress.game.ourScore} : {progress.game.opponentScore}
          </span>
        </div>

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
            style={{ width: `${staminaPercentOf(progress.stamina)}%` }}
            data-low={staminaPercentOf(progress.stamina) <= 20}
          />
        </div>

        {isMenuOpen && (
          <InGameMenu
            // 나만의리그 투수편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
            mode={PITCHER_CAREER_MODE}
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
        )}

        {!isMenuOpen && asksGiveUp && (
          <>
            {/* StrGAME[104] "그만 던지시겠습니까?" — 모드 3 은 교체 화면 대신 이 물음만 뜬다 */}
            <Panel heading="그만 던지시겠습니까?" />
            <MenuList
              items={[
                { id: '예', label: '예' },
                { id: '아니오', label: '아니오' },
              ]}
              onSelect={(id) => {
                setAsksGiveUp(false)
                if (id === '예') actions.giveUp()
              }}
            />
          </>
        )}

        {!asksGiveUp && !isMenuOpen && canPitch && phase === '구질' && (
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

        {!asksGiveUp && !isMenuOpen && canPitch && phase === '코스' && (
          <>
            <Panel heading={<>2. 코스 선택 — {slot?.name}</>} />
            <CourseGrid
              selectedCell={courseCell}
              onSelect={(cell) => {
                setCourseCell(cell)
                // 마구는 게이지를 쓰지 않고 등급이 늘 5 다 (0x3f500 의 `구질 != 22`)
                if (options.gaugeSettingOn && slot?.isMagic !== true) {
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

        {!asksGiveUp && !isMenuOpen && canPitch && phase === '게이지' && (
          <>
            <Panel heading="3. 투구 결정" />
            <PitchGradeGauge onPress={throwWith} />
          </>
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
            resolution !== null ? actions.closeBurst : () => setShownProposal(proposal)
          }
        />
      )}

      {progress.managerHookText !== null && (
        <ManagerHookWindow
          userEventIndex={progress.managerHookText}
          onConfirm={actions.confirmManagerHook}
        />
      )}
    </div>
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

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

function pitcherStatEntries(summary: PitcherGameSummary): StatEntry[] {
  const outs = summary.record.outsRecorded
  return [
    { label: '이닝', value: `${Math.trunc(outs / 3)}${['', '⅓', '⅔'][outs % 3]}` },
    { label: '피안타', value: String(summary.record.hitsAllowed) },
    { label: '볼넷', value: String(summary.record.walksAllowed) },
    { label: '탈삼진', value: String(summary.record.strikeouts) },
    { label: '투구수', value: String(summary.pitchCount) },
    { label: '방어율', value: (summary.earnedRunAverage / 100).toFixed(2) },
  ]
}
