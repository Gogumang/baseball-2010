import type { ReactNode } from 'react'
import type { MissionOverlayInput } from '@/app/ui/missionRoutes/missionOverlayInput'
import { cpuSideOf, humanSideOf } from '@/entities/mission/model/missionGame'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionRunScoreBoardOf } from '@/pages/mission-play/lib/missionRunScoreBoard'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { missionStagePreloadsOf, MISSION_LOADING_SCENES } from '@/app/ui/missionRoutes/missionPreloads'
import { missionWithSideTeamsOf } from '@/app/ui/missionRoutes/missionStage'
import { missionBenchClearingOf, missionPickoffReplayOf, missionFirstBoardOf, missionAutoRelayOf } from '@/app/ui/missionRoutes/missionOverlayScenes'

/** 수비 장면 득점 점수판 0x41a64 — 판의 사람 칸 팀으로 세운 두 측과 플레이 시작 때 점수 (`missionRunScoreBoardOf`) */
function missionPlayScoreBoardOf(run: MissionRun | PitcherRun | null) {
  if (run === null) return undefined
  return missionRunScoreBoardOf(missionWithSideTeamsOf(run.mission, run.game.humanBatting.teamId), {
    ours: run.game.scores[humanSideOf(run.mission)],
    opponents: run.game.scores[cpuSideOf(run.mission)],
  })
}

// 경기 장면 로딩 판 — 상태 7 진입 0x39f88(0x667f8 로딩 판 · 0x54120 진행 칸 끝 0x24 · 0x53dbc 팁 rand(0, 73)) 뒤 상태 7 · 9 · 8 의
// 적재가 한 단계마다 0x54128(진행 +1) · 0x53e04(바탕 · loadingbar 판 · StrTIP[1 + +0x315] · 진행 막대 · 막대 끝 달리는 선수)를
// 부른다. 모드를 안 가려 미션 · 마선수 대결(타자 · 투수)도 같다. 다 그리면 상태 8 끝 48bf0 → 첫 0x18 판(인트로 0xc 없음).
// ⚠️ 근사(시간 · 남김 — 단말 몫 · 바이너리 밖): 원본 길이는 단말의 적재 시간이다(경기 틀로는 7 · 9 · 8 · 8 네 그림, 그 사이 동기 적재마다 다시 그린다) — 웹은 막대 한 칸을
// 한 그림으로 센다(`LoadingTip` — 모드 5 · 6 은 끝 0x24)
export function missionLoadingOf(input: MissionOverlayInput): ReactNode {
  const { session } = input
  const { actions } = input.session
  if (session.loadingTip === null) return null
  return (
    <RawScreen>
      <LoadingTip
        tip={session.loadingTip}
        onDone={actions.finishLoading}
        preloadScenes={MISSION_LOADING_SCENES}
        preloadRequests={missionStagePreloadsOf(session.pitcherRun?.cpu.batting?.teamId)}
      />
    </RawScreen>
  )
}

export function missionDefensePlayOf(input: MissionOverlayInput): ReactNode {
  const { session, defenseScene, pitchScene } = input
  const { pendingDefensePlay, actions } = input.session
  if (pendingDefensePlay === null || pitchScene?.isHitShowing === true) return null
  const isPitcher = pendingDefensePlay.side === '투수'
  const run = isPitcher ? session.pitcherRun : session.missionRun
  const runScoreBoard = missionPlayScoreBoardOf(run)
  return (
    <DefensePlayback
      input={pendingDefensePlay.input}
      side={isPitcher ? '수비' : '공격'}
      runScoreBoard={runScoreBoard}
      sceneMemory={defenseScene}
      onDone={actions.finishDefensePlay}
    />
  )
}

// 미션의 주자 판(도루 · 폭투 · 견제) — 상태 0x17 키 0x53420 이 사람 공격(타자 미션)이면 주루 0x5331c(0x582 진루 · 0x584 귀루 →
// 0xa9b04)와 OK 슬라이딩 0x585 를, 사람 수비(투수 미션)면 송구 0x533c8 → 0x588 → +0x160 을 보내므로 실시간으로 한 틱씩 돌린다
// (`features/defense-play/model/liveRunnerPlay`, 팀 경기와 같은 길). 판정 콜은 화면이 판 안의 그 틱에 낸다
export function missionRunnerPlayOf(input: MissionOverlayInput): ReactNode {
  const { session, pitchScene } = input
  const { actions } = input.session
  if (session.pendingRunnerPlay === null || pitchScene?.isArrivalHolding === true) return null
  const run = session.pendingRunnerPlay.side === '수비' ? session.pitcherRun : session.missionRun
  return <DefensePlayback runnerPlay={session.pendingRunnerPlay} runScoreBoard={missionPlayScoreBoardOf(run)} onDone={actions.finishRunnerPlay} />
}

/**
 * 공 사이에 끼어드는 화면 — 수비·벤치 클리어링·견제 재생. 없으면 null.
 *
 * **수비 화면(상태 0x17)이 먼저다.** 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라
 * 맞은 공은 0x11 → 0x13 → **늘 0x17** 로 간다 (`0xae5f0` = `movs r0,#0x17`, R10 8절 전이표).
 * 다 돌고 나서야 `0xae3e8` 이 다음 타석으로 보낸다 — 그 자리가 `finishDefensePlay` 다.
 *
 * 사람이 잡는 쪽(`side`)은 편에 따라 다르다: 타자 미션은 내가 공격(주루), 투수 미션은 내가 수비(송구).
 *
 * 수비 장면 득점 점수판 0x41a64(`runScoreBoard`) — 두 측 팀 · 사람 칸 · 공격 측은 미션 준비 0xaa57c 가 레코드 +2 · +3 으로 세운
 * 그대로다(`missionRunScoreBoardOf`). 두 점수는 플레이 시작 때의 경기 점수판 0xb69b0(`run.game.scores` — 타석 득점 · 자동진행
 * 반 이닝 득점이 모두 든다). 사람 칸 팀은 경기[0x28 + 사람 칸] — 마선수 대결(g[0x11f]/g[0x176] 이고 g[0xf6] ∈ 2..4)이면
 * 0xaa57c aa6dc~aa728 이 그 모드 저장 레코드 +1 의 팀으로 세운다(`missionHumanTeamIdOf` → `run.game.humanBatting.teamId`).
 */
/** 공 사이 화면 갈래 — 앞이 이긴다 */
const MISSION_OVERLAYS: readonly ((input: MissionOverlayInput) => ReactNode)[] = [
  missionLoadingOf,
  missionDefensePlayOf,
  missionRunnerPlayOf,
  missionBenchClearingOf,
  missionPickoffReplayOf,
  missionFirstBoardOf,
  missionAutoRelayOf,
]

export function missionOverlayOf(input: MissionOverlayInput): ReactNode | null {
  for (const overlayOf of MISSION_OVERLAYS) {
    const overlay = overlayOf(input)
    if (overlay !== null) return overlay
  }
  return null
}
