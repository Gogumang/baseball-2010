import type { ReactElement } from 'react'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { fielderNamesByPosition, halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { isOurOffense } from '@/features/play-team-game/model/teamGameFlow'
import { teamHalfInningCardsOf } from '@/pages/team-game/lib/teamHalfInningCards'
import { TeamAutoRelay } from '@/pages/team-game/ui/TeamAutoRelay'
import { SettingsScreen } from './otherSlices'
import { teamRecordBattersOf, teamWalkAcesOf } from './teamWalkAces'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다 (진입 굴림 45 번은 진행기가 이미 썼다) */
function renderBenchClearing(model: TeamGameSceneModel): ReactElement | null {
  const { options, random, session } = model.props
  const { progress, actions } = session
  const bench = progress.pendingBenchClearing
  if (bench?.phase !== 'scene') return null
  const { walkers } = model
  return (
    <BenchClearingScene
      // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명. 타자 손은 사구를 맞은 지금 타자(타석 소개 판과 같은 값)
      field={benchClearingFieldOf({
        entryRolls: bench.entryRolls,
        half: progress.game.half,
        playerSide: options.playerSide,
        ourTeamId: options.ourTeamId,
        opponentTeamId: options.opponentTeamId,
        batterHand: model.matchup.batterHand,
        bases: progress.game.bases,
        grassPalette: model.backdrop.fieldPalette,
        // 마선수 그림 0x79b48 — 수비 줄 · 공격 줄 팀 각각 (명단 차례로 본다 — `teamWalkAcesOf`)
        defenseAces: teamWalkAcesOf(progress, !isOurOffense(progress)),
        // 수비 줄 +0xec — 이 장면에서 마지막으로 적힌 값 (교대 판 · 수비 판 시작)
        defenseSeats: walkers.walkerSeats.benchDefense,
        offenseAces: walkers.benchOffense,
      })}
      walkStateRef={walkers.benchWalkRef}
      // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
      random={random}
      onDone={(reachedTargetTick) => {
        if (walkers.benchWalkRef.current !== null) walkers.fieldCarryTrack.afterBenchClearing(walkers.benchWalkRef.current)
        walkers.benchWalkRef.current = null
        actions.finishBenchClearing(reachedTargetTick)
      }}
    />
  )
}

/**
 * 공수 교대 판 — 그 반 이닝을 끝낸 플레이(0x17)를 다 본 뒤, 다음 사람 타석(0xd → 0xf) 앞에 선다.
 * 진행기가 판을 세울 때 0x3fac4 의 굴림 36 개를 이미 썼다. 징글 13 은 판의 틱 2 (0x4f7ac).
 */
function renderHalfInningBoard(model: TeamGameSceneModel): ReactElement | null {
  const { options, session } = model.props
  const { progress } = session
  const { board } = model.covers
  if (!model.covers.isHalfInningBoardOpen || board === null) return null
  const { walkers } = model
  return (
    <HalfInningBoard
      key={board.serial}
      inning={board.inning}
      half={board.half}
      onTick={(tick) => {
        if (tick === HALF_INNING_JINGLE_TICK) model.change.audio.play(HALF_INNING_SOUND)
      }}
      scoreboardSides={model.scoreboardSides}
      // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
      cards={teamHalfInningCardsOf(progress, board.half)}
      // 운동장 전경 0x4fb8c — 새 수비가 더그아웃에서 제자리로 걷고 앞 수비가 들어간다 (판 틱 0 의 굴림 36 개)
      field={halfInningFieldOf({
        rolls: board.fielderRolls,
        half: board.half,
        // 앞 장면(0x17 · 앞 판 · 0x1e · 0x21)이 남긴 수비 줄 자리 · 카메라 — 자리 합 0 인 칸이 있으면 0x3fac4 가 경기 첫 판으로 본다
        carry: walkers.fieldCarry,
        // 마선수 그림 0x79b48 — 수비 줄 · 공격 줄 팀 각각 (못 찾은 칸은 판 앞 +0xec 가 남는다)
        defenseAces: teamWalkAcesOf(progress, !isOurOffense(progress)),
        offenseAces: teamWalkAcesOf(progress, isOurOffense(progress)),
        seats: walkers.walkerSeats.boardBefore,
        playerSide: options.playerSide,
        ourTeamId: options.ourTeamId,
        opponentTeamId: options.opponentTeamId,
        grassPalette: model.backdrop.fieldPalette,
        // 이름표 — 칸 0 은 수비 팀 지금 투수, 1~8 은 수비 팀 레코드 차례에서 위치 코드가 칸 + 1 인 첫 선수 (0x40008)
        fielderNames: fielderNamesByPosition(
          teamHalfInningCardsOf(progress, board.half).pitcherName,
          teamRecordBattersOf(progress, !isOurOffense(progress)),
        ),
      })}
      walkStateRef={walkers.boardWalkRef}
      onConfirm={() => {
        // 판이 닫힌 틱의 자리 · 카메라 — 0x4f7ac 는 0x18 동안만 걸음 · 카메라를 굴린다
        if (walkers.boardWalkRef.current !== null) walkers.fieldCarryTrack.afterHalfInning(walkers.boardWalkRef.current)
        walkers.boardWalkRef.current = null
        model.covers.setClosedBoardSerial(board.serial)
      }}
    />
  )
}

/**
 * 자동진행 중계(경기 상태 0x21) — 경기진행 설정의 자동 이닝 · 30G 자동진행. 화면이 갱신마다 0xc2198 → 0xc262c 를 한 번씩
 * 굴리고(`stepAutoRelay`), 그 사이 속도 ←→ · CLR 중단 질문을 받는다 (`TeamAutoRelay`). 끝나면 진행기가 다음 사람 타석을 세운다.
 */
function renderAutoRelay(model: TeamGameSceneModel): ReactElement | null {
  const { options, session } = model.props
  const { progress, actions } = session
  if (progress.autoRelay == null || model.isBurstResultHeld) return null
  return (
    <TeamAutoRelay
      progress={progress}
      onStep={actions.stepAutoRelay}
      onStop={actions.stopAutoRelay}
      sideTeams={options.playerSide === 0 ? [options.ourTeamId, options.opponentTeamId] : [options.opponentTeamId, options.ourTeamId]}
      humanSide={options.playerSide}
      grassPalette={model.backdrop.fieldPalette}
      entryLoadedRunnerAce={model.walkers.menuRelayLoaded}
      // 0x21 에도 기록 달성 알림 0x4e35c 를 그린다(0x17 말고는 늘 — 53066). 질문 창 동안은 멈춘다
      recordAlert={<RecordAlertStageOverlay frame={model.recordAlert} />}
      onAskingChange={model.sceneMenu.setRelayAsking}
    />
  )
}

/** 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 경기 장면 위에 얹는다(`renderTeamGameStage`) */
function renderSettings(model: TeamGameSceneModel): ReactElement | null {
  const { settings, onSettingsChange } = model.props
  if (model.sceneMenu.overlay !== '설정' || settings === undefined || onSettingsChange === undefined) return null
  return (
    <SettingsScreen
      settings={settings}
      // 경기 중 "설정" 은 작은 판(skin+0x125)이라 모드 초기화 줄이 아예 없다 — mainMenu 를 안 넘기면 그렇게 그린다
      onChange={onSettingsChange}
      onResetCareer={() => {}}
      onBack={() => {
        // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
        model.sceneMenu.setOverlay(null)
        model.sceneMenu.menu.reopen()
      }}
    />
  )
}

/** 수비 판 뒤 차례의 판 — 벤치 클리어링(0x1e) · 공수 교대 판(0x18) · 중계(0x21) · 설정. 없으면 null */
export function renderSceneBoard(model: TeamGameSceneModel): ReactElement | null {
  return renderBenchClearing(model) ?? renderHalfInningBoard(model) ?? renderAutoRelay(model) ?? renderSettings(model)
}
