import { useEffect, useState } from 'react'
import { BigResult, DialogueBox, Hint, MarkupText, MenuList, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import type { MenuItem, StatEntry } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import {
  currentBatterAbility,
  currentPitcherAbility,
  pitchSlotsFor,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  TeamGameOptions,
  TeamGameSummary,
} from '@/features/play-team-game/model/teamGameFlow'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
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
 * 원본에 있고 여기 없는 것: 경기 중 메뉴 '*' 의 자동진행(30G)·다시하기, 교체 '#',
 * 공수 교대 화면(0x18)·경기 끝 결과 판의 승·패·세 투수 세 줄.
 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

/** StrGAME[0] 경기 중 메뉴 호출(*) 확인 문구 */
const QUIT_CONFIRM =
  '!C!cFFFFFF현재 이닝의 기록과 획득한!N!cFF0000G포인트가 사라집니다!cFFFFFF!N메인메뉴로 나가시겠습니까?'

type PitchPhase = '구질' | '코스' | '게이지'

interface TeamGameScreenProps {
  readonly options: TeamGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 — 시즌 세션은 이 요약으로 하루를 정산한다 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
}

export function TeamGameScreen({ options, random, onFinish, onQuit }: TeamGameScreenProps) {
  const session = useTeamGame(options, random)
  const { progress, canBat, canPitch, summary, actions } = session

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  const [courseCell, setCourseCell] = useState(4)
  const [isConfirmingQuit, setIsConfirmingQuit] = useState(false)
  /** 제안 대사를 이미 보여 준 돌발 행 번호 */
  const [shownProposal, setShownProposal] = useState<number | null>(null)

  // 타석·차례가 바뀌면 투구 1단계로 되돌린다
  useEffect(() => {
    if (!canPitch) return
    if (progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }, [canPitch, progress.atBat.balls, progress.atBat.strikes])

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
          isConfirmingQuit && onQuit !== undefined ? { label: '예', onPress: onQuit } : undefined
        }
        rightKey={
          onQuit === undefined
            ? undefined
            : isConfirmingQuit
              ? { label: '아니오', onPress: () => setIsConfirmingQuit(false) }
              : { label: '메뉴', onPress: () => setIsConfirmingQuit(true) }
        }
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

        {isConfirmingQuit ? (
          <DialogueBox>
            <MarkupText raw={QUIT_CONFIRM} />
          </DialogueBox>
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
