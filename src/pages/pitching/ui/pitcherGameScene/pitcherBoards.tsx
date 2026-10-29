import type { ReactElement, ReactNode } from 'react'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { RecordAlertScreenOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { fielderNamesByPosition, halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { pitcherMatchupCardsOf } from '@/pages/pitching/lib/pitcherMatchupCards'
import { pitcherFieldAcesOf } from '@/pages/pitching/lib/pitcherFieldTeams'
import { pitcherHalfInningCardsOf } from '@/pages/pitching/lib/pitcherHalfInningCards'
import { pitcherAutoRelayStepsOf } from '@/pages/pitching/lib/pitcherAutoRelay'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { AutoPlayRelayReplay } from './otherSlices'
import { isOurDefenseBoardOf } from './usePitcherFieldWalkers'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 경기 장면 위에 알림을 얹는다 — 화면과 형제 자리(`position: relative` 판)에 기둥으로 */
export function withRecordAlert(model: PitcherSceneModel, screen: ReactNode): ReactElement {
  return (
    <div className={styles.frame}>
      {screen}
      <RecordAlertScreenOverlay frame={model.recordAlert} />
    </div>
  )
}

/** 자동진행 중계(0x21) — 굴려 둔 틱을 매 틱 한 칸씩 (모드 3: 키 · 속도 · 배경음 없음) */
function renderRelay(model: PitcherSceneModel): ReactElement | null {
  const { options, pitcherName } = model.props
  const { relay } = model.replay
  if (!model.isRelaying || relay === null) return null
  const isFirstBat = options.playerSide === PLAYER_SIDE_FIRST_BAT
  return withRecordAlert(
    model,
    <AutoPlayRelayReplay
      key={relay.serial}
      steps={pitcherAutoRelayStepsOf(relay.ticks, pitcherName ?? null)}
      sideTeams={isFirstBat ? [options.ourTeamId, options.opponentTeamId] : [options.opponentTeamId, options.ourTeamId]}
      humanSide={isFirstBat ? 0 : 1}
      grassPalette={model.backdrop.grassPalette}
      onDone={model.replay.finishRelay}
    />,
  )
}

/** 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 진입 굴림 45 번은 진입 틀에 진행기가 이미 썼다 */
function renderBenchClearing(model: PitcherSceneModel): ReactElement | null {
  const { options, random, pitcherName, session } = model.props
  const { progress, actions } = session
  const bench = progress.pendingBenchClearing
  if (bench?.phase !== 'scene') return null
  const { fieldLineups, walkerSeats, benchOffense } = model.walkers
  return withRecordAlert(
    model,
    <BenchClearingScene
      // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명. 타자 손은 사구를 맞은 상대 타자(타석 소개 판과 같은 값)
      field={benchClearingFieldOf({
        entryRolls: bench.entryRolls,
        half: progress.game.half,
        playerSide: options.playerSide,
        ourTeamId: options.ourTeamId,
        opponentTeamId: options.opponentTeamId,
        batterHand: pitcherMatchupCardsOf(progress, pitcherName).batterHand,
        bases: progress.game.bases,
        grassPalette: model.backdrop.grassPalette,
        // 마선수 그림 0x79b48 — 수비 줄은 내 팀(내가 맞혔다), 공격 줄은 상대 팀
        defenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, true),
        // 수비 줄 +0xec — 이 장면에서 마지막으로 적힌 값(1회초 판 · 내 수비 판 시작)
        defenseSeats: walkerSeats.benchDefense,
        offenseAces: benchOffense,
      })}
      // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
      random={random}
      onDone={actions.finishBenchClearing}
    />,
  )
}

/**
 * 공수 교대 판 — 진행기가 판을 세울 때 0x3fac4 의 굴림 36 개를 이미 썼다. 징글 13 은 판의 틱 2 (0x4f7ac).
 * 모드 3 에서는 1회초 판만 선다 (진행기 `withHalfInningBoard` 머리말).
 */
function renderHalfInningBoard(model: PitcherSceneModel): ReactElement | null {
  const { options, pitcherName, session } = model.props
  const { progress } = session
  const { board } = model.setup
  if (!model.setup.isHalfInningBoardOpen || board === null) return null
  const { fieldLineups, walkerSeats } = model.walkers
  const isOurDefenseBoard = isOurDefenseBoardOf(board.half, options.playerSide)
  return withRecordAlert(
    model,
    <HalfInningBoard
      key={board.serial}
      inning={board.inning}
      half={board.half}
      onTick={(tick) => {
        if (tick === HALF_INNING_JINGLE_TICK) model.setup.audio.play(HALF_INNING_SOUND)
      }}
      scoreboardSides={model.backdrop.scoreboardSides}
      // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
      cards={pitcherHalfInningCardsOf(progress, pitcherName, board.half)}
      // 운동장 전경 0x4fb8c — 투수편 판은 경기 첫 판(1회초 — 인트로 0xc 바로 뒤)뿐이라 장면이 수비 줄 · 카메라를 아직 안 옮겼다
      // (`carry` 없음 = 0x3fac4 의 자리 합 0 갈래, `lib/fieldCarry`)
      field={halfInningFieldOf({
        rolls: board.fielderRolls,
        half: board.half,
        carry: null,
        playerSide: options.playerSide,
        ourTeamId: options.ourTeamId,
        opponentTeamId: options.opponentTeamId,
        grassPalette: model.backdrop.grassPalette,
        // 이름표 — 칸 0 은 내 투수, 1~8 은 0x40008: 수비 팀(내 팀) 레코드 타자 배열 차례에서 자리 니블이 칸 + 1 인 첫 선수
        fielderNames: fielderNamesByPosition(pitcherName ?? null, (isOurDefenseBoard ? fieldLineups?.ours : fieldLineups?.opponent) ?? null),
        // 마선수 그림 0x79b48 — 수비 줄 · 공격 줄 팀 각각 (0x3fac4 가 +0xec · 두 그림을 싣는다)
        defenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, isOurDefenseBoard),
        offenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, !isOurDefenseBoard),
        seats: walkerSeats.boardBefore,
      })}
      onConfirm={() => model.setup.closed.setClosedBoardSerial(board.serial)}
    />,
  )
}

/** 판 위 창 갈래 뒤의 판 — 중계(0x21) · 벤치 클리어링(0x1e) · 공수 교대 판(0x18). 없으면 null */
export function renderPitcherBoard(model: PitcherSceneModel): ReactElement | null {
  return renderRelay(model) ?? renderBenchClearing(model) ?? renderHalfInningBoard(model)
}
