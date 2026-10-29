import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  FRESH_HELD_CPU_MAGIC,
  changePitcherIfNeeded,
  heldCpuMagicAfterPitcherChange,
  tryQuickCpuPinchHit,
} from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { missionPitchingDefenseOf } from '@/entities/mission/model/missionCpuTeam/defense/pitchingDefense'
import { isMissionCpuBatterAce } from '@/entities/mission/model/missionCpuTeam/roster/records'
import { PITCHER_CHANGE_BLOCKED_SLOTS, missionSlotOf } from '@/entities/mission/model/missionCpuTeam/start/missionSlot'
import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam/types'
import type {
  MissionCpuBatting,
  MissionCpuPitching,
  MissionCpuSubstitution,
  MissionCpuTeam,
  MissionPitchSelectionSituation,
} from '@/entities/mission/model/missionCpuTeam/types'

/** 0xf 진입의 결과 — 바뀐 팀과 무엇이 났는지(안 바뀌면 받은 팀 · null) */
interface PitchSelectionResult {
  readonly team: MissionCpuTeam
  readonly substitution: MissionCpuSubstitution | null
}

/**
 * **상태 0xf 진입 `0x3d954`** — 공 하나를 고르기 전마다 (위 머리글). 바꾸면 바뀐 팀과 무엇이 났는지, 아니면 받은 팀 그대로.
 * 난수: 모드 5 는 0xac228 의 막는 칸이 다 열려야 `rand(0, 1000)`, 들면 `rand(0, 벤치)`. 모드 6 은 0xac360 이 벤치에
 * 마선수가 있을 때만 구르는데 미션 팀 벤치에는 마선수가 없어(마투수는 0번 칸) 굴림이 없다.
 */
export function enterMissionPitchSelection(
  team: MissionCpuTeam,
  situation: MissionPitchSelectionSituation,
  random: RandomPort,
): PitchSelectionResult {
  const pitching = team.pitching
  if (pitching !== null) return rollMissionPitcherChange(team, pitching, situation, random)
  const batting = team.batting
  if (batting === null) return { team, substitution: null }
  return rollMissionPinchHit(team, batting, situation, random)
}

/** 모드 6 — 수비가 CPU 라 0xac428 투수 교체 (3da3e) */
function rollMissionPitcherChange(
  team: MissionCpuTeam,
  pitching: MissionCpuPitching,
  situation: MissionPitchSelectionSituation,
  random: RandomPort,
): PitchSelectionResult {
  const unchanged = { team, substitution: null }
  const { mission } = situation
  // 0x66864 — 모드 6 은 +0xbd ∈ {3, 7} 이면 막는다
  if (PITCHER_CHANGE_BLOCKED_SLOTS.includes(missionSlotOf(mission))) return unchanged
  const lead = situation.lead ?? mission.start.opponentScore - (mission.start.ourScore + pitching.ourRuns)
  const isAceMound = pitching.roster[pitching.mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
  const mound = isAceMound ? { ...pitching.mound, stamina: situation.aceStamina } : pitching.mound
  const after = changePitcherIfNeeded(
    missionPitchingDefenseOf({ ...pitching, mound }, lead, situation.fightingSpirit === true ? { fightingSpiritAt: () => true } : {}),
    mound,
    {
      // state[0x6b] — 0xaa57c 가 레코드 +3 아래 4비트로 적고 말이 끝날 때마다 0xb6b6c 가 올린다 (`MissionRun.game`)
      inningIndex: situation.inningIndex ?? mission.start.inning - 1,
      lead,
      runnerCount: situation.runnerCount,
      inningRunsAllowed: pitching.inningRunsAllowed,
      random,
      // 3da34 — 일곱째 인자 0, `[sp+4]`(모드 3) · `[sp+8]`(강제) 0
      minimumBench: 0,
    },
  )
  if (after === mound) return unchanged
  return {
    team: {
      ...team,
      pitching: {
        ...pitching,
        mound: after,
        inningRunsAllowed: 0,
        // 교체 가지 0xaebe4 aec7a `0xae9c4(팀, −1)` — 새 투수는 타석 교대(aeea8)에서 다시 찬다. 공 +0x10 은 그대로
        magic: heldCpuMagicAfterPitcherChange(pitching.magic ?? FRESH_HELD_CPU_MAGIC),
      },
    },
    substitution: { kind: '투수교체', incomingIsAce: pitching.roster[after.pitcherSlot] === MISSION_ACE_ROSTER_SLOT },
  }
}

/** 모드 5 — 수비가 사람이라 0xac228 대타 (3da70) */
function rollMissionPinchHit(
  team: MissionCpuTeam,
  batting: MissionCpuBatting,
  situation: MissionPitchSelectionSituation,
  random: RandomPort,
): PitchSelectionResult {
  const pinch = tryQuickCpuPinchHit(
    batting.lineup,
    batting.order,
    {
      alreadyUsedThisGame: team.pinchHitBlocked,
      runnerCount: situation.runnerCount,
      strikes: situation.strikes,
      balls: situation.balls,
      // 0xae89c(공격 팀) 마선수(0xb633c) — 마타자 칸이면 굴림 없이 안 낸다
      batterIsAce: isMissionCpuBatterAce(team),
    },
    random,
  )
  if (pinch === null) return { team, substitution: null }
  return {
    // state[0xe] = 1 (ac33e)
    team: { ...team, pinchHitBlocked: true, batting: { ...batting, lineup: pinch.lineup } },
    substitution: { kind: '대타', incomingIsAce: batting.records[pinch.incomingRosterSlot] === MISSION_ACE_ROSTER_SLOT },
  }
}
