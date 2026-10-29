import type { ReactNode } from 'react'
import { humanSideOf } from '@/entities/mission/model/missionGame'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { isWalkPlayResult } from '@/features/defense-play/model/walkPlay'
import { AutoPlayRelayScreen } from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { missionScoreboardSidesOf } from '@/pages/mission-play/lib/missionRunScoreBoard'
import { missionFirstBoardCardsOf } from '@/pages/mission-play/lib/missionFirstBoardCards'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound } from '@/shared/api/audio/soundPort'
import { halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { missionFielderPlatesOf, missionWalkTeamOf } from '@/entities/mission/model/missionRunners'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { missionCpuBatterHandOf, missionWithSideTeamsOf, missionBenchOffenseOf } from '@/app/ui/missionRoutes/missionStage'
import type { MissionOverlayInput } from '@/app/ui/missionRoutes/missionOverlayInput'

// 미션 사구 뒤 벤치 클리어링 연출(상태 0x1e) — 투수편 `PitcherGameScreen` 과 같은 위젯이다. 타자 미션(모드 6)도 0x4e6d4 를 타
// 같은 연출이 선다(r298) — 두 팀 · 루 · 공격 줄은 판의 사람 칸 · CPU 칸 그대로
export function missionBenchClearingOf(input: MissionOverlayInput): ReactNode {
  const { session, walkerSeats, benchBatterHand } = input
  const { actions } = input.session
  if (session.pendingBenchClearing?.phase !== 'scene') return null
  const benchRun = session.pendingBenchClearing.run
  const sideTeams = missionWithSideTeamsOf(benchRun.mission, benchRun.game.humanBatting.teamId).sideTeams
  return (
    <BenchClearingScene
      // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명. 타자는 사구를 맞은 지금 CPU 타자(투구 장면과 같은 손)
      field={benchClearingFieldOf({
        entryRolls: session.pendingBenchClearing.entryRolls,
        half: benchRun.game.offenseSide === 0 ? '초' : '말',
        playerSide: 0,
        ourTeamId: sideTeams[0],
        opponentTeamId: sideTeams[1],
        // 타자 미션이면 사구를 맞은 사람 칸 타자(타석 화면과 같은 손 — `missionStageBatterOf` 의 레코드 +0xb 폼)
        batterHand: session.pendingBenchClearing.side === '투수' ? missionCpuBatterHandOf(session.pendingBenchClearing.run) : (benchBatterHand ?? 0),
        bases: benchRun.bases,
        // 마선수 그림 0x79b48 — 수비 줄은 사람 칸 팀(미션 투수), 공격 줄은 CPU 타선(마타자 칸 포함)
        defenseAces: missionWalkTeamOf(benchRun, true),
        defenseSeats: walkerSeats?.benchDefense ?? null,
        offenseAces: missionBenchOffenseOf(benchRun),
      })}
      // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
      random={session.random}
      onDone={actions.finishBenchClearing}
    />
  )
}

// CPU 견제 한 판 — 세션이 이미 다 돌려 먹였다. 화면은 재생만 한다 (나만의리그 `GameRoute` 의 lastDefensePlay 와 같은 꼴)
// 볼넷 · 사구 밀어내기 판(종류 2)도 이 칸으로 오는데 0x12 갱신 0x4e6d4 가 0x1f 틱 기다린 뒤 판정 A 0xae24c 가 0x17 로 보낸다
// (사구 벤치 클리어링 뒤면 출구에서 곧장) — 그동안은 아래로 내려가 타석 · 투구 화면을 그린다
export function missionPickoffReplayOf(input: MissionOverlayInput): ReactNode {
  const { session, isFreePassReady } = input
  const { actions } = input.session
  if (session.pickoffReplay === null || !isFreePassReady) return null
  return (
    <DefensePlayback
      ticks={session.pickoffReplay.ticks}
      onDone={actions.finishPickoffReplay}
      // 볼넷 · 사구 밀어내기 판(종류 2)도 이 재생 칸으로 온다 — 키 건너뛰기(0x519cc)를 받는다
      freePassPlay={isWalkPlayResult(session.pickoffReplay)}
    />
  )
}

// 미션 시작의 첫 0x18 판 — 상태 8 끝(48bf0)이 인트로 없이 보내고, 첫 반 이닝이 사람 몫이라 판이 서서 OK 를 기다린다
// (굴림 36 은 세션이 세울 때 썼다). 틱 2 에 징글 13(0x4f7ac). OK → 0xae3a0 → 0xd → 0xe. 제한 시간은 그 동안에도 흐르고(0xaada4),
// 다 되면 0x76d → 0x19 가 덮어 결과 판으로 간다.
// 틱 ≥ 70 에 점수판 틀 0x41440 과 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER") — 공격 팀 타순 세 칸 · 수비 팀 지금 투수 이름 ·
// 48c86 0xaae7c 가 깐 미션 시작 카운트 점 (`missionFirstBoardCardsOf`).
export function missionFirstBoardOf(input: MissionOverlayInput): ReactNode {
  const { session, playingRun, missionBatterName, missionPitcherName, walkerSeats } = input
  const { actions } = input.session
  const board = session.halfInningBoard
  if (board === null || playingRun === null || playingRun.status !== '진행중') return null
  const sideMission = missionWithSideTeamsOf(playingRun.mission, playingRun.game.humanBatting.teamId)
  const boardSides = missionScoreboardSidesOf(sideMission)
  const boardCards = missionFirstBoardCardsOf(playingRun, {
    missionBatter: missionBatterName ?? null,
    missionPitcher: missionPitcherName ?? null,
  })
  return (
    <HalfInningBoard
      key={board.serial}
      inning={board.inning}
      half={board.half}
      onTick={(tick) => {
        if (tick === HALF_INNING_JINGLE_TICK) activeSound().play(HALF_INNING_SOUND)
      }}
      scoreboardSides={boardSides}
      cards={boardCards}
      // 운동장 전경 0x4fb8c — 미션 판은 장면의 첫 판뿐이라(상태 8 끝 48bf0 이 곧장 보낸다) 장면이 수비 줄 · 카메라를 아직 안 옮겼다
      // (`carry` 없음 = 0x3fac4 의 자리 합 0 갈래). 팀은 두 측 그대로
      field={halfInningFieldOf({
        rolls: board.fielderRolls,
        half: board.half,
        carry: null,
        playerSide: 0,
        ourTeamId: boardSides[0].team,
        opponentTeamId: boardSides[1].team,
        // 이름표 — 칸 0 은 수비 팀 지금 투수, 1~8 은 0x40008: 수비 팀 레코드 차례에서 자리 니블이 칸 + 1 인 첫 레코드 — 판 시작 0xb0fb4 와
        // 같은 훑기라 수비 판 이름 판의 야수(`missionFielderPlatesOf`, 대타 니블 맞바꿈까지)를 그대로 쓴다.
        fielderNames: [
          boardCards.pitcherName,
          ...missionFielderPlatesOf(playingRun)
            .slice(1)
            .map((plate) => plate?.name ?? null),
        ],
        // 마선수 그림 0x79b48 — 수비 줄 · 공격 줄 팀 각각 (`missionWalkTeamOf`). 판 앞 +0xec 는 장면을 세운 직후라 0
        defenseAces: missionWalkTeamOf(playingRun, true),
        offenseAces: missionWalkTeamOf(playingRun, false),
        seats: walkerSeats?.boardBefore ?? null,
      })}
      onConfirm={actions.confirmHalfInningBoard}
    />
  )
}

// 자동진행 중계(상태 0x21) — 사람 반 이닝이 3아웃으로 끝나(`halfEnded`) 결과 띠 · 수비 · 주자 판이 다 돈 뒤 0x18 → 0x21.
// 0xd → 0xe 확인 대기와 결과 판(자동진행 중 경기가 끝난 실패 포함)보다 먼저다. 그 동안 제한 시간은 세션 타이머 그대로 흐르고,
// 다 되면(실패) 판이 끝나 이 화면이 곧장 내려간다 — 남은 타석은 안 굴린다(`stepAutoRelay`).
export function missionAutoRelayOf(input: MissionOverlayInput): ReactNode {
  const { session, playingRun, bannerText, missionBatterName } = input
  if (playingRun === null || !playingRun.game.halfEnded || playingRun.status !== '진행중' || bannerText !== '') return null
  return (
    <AutoPlayRelayScreen
      step={session.autoRelayStep}
      onTick={session.stepAutoRelay}
      sideTeams={missionWithSideTeamsOf(playingRun.mission, playingRun.game.humanBatting.teamId).sideTeams}
      humanSide={humanSideOf(playingRun.mission)}
      missionBatterName={missionBatterName ?? null}
    />
  )
}
