import {
  BENCH_CLEARING_PITCH_COUNT_GAIN,
  FRESH_HELD_CPU_MAGIC,
  drainPitcherForPitch,
  heldCpuMagicAfterPitch,
  lineupSlotOf,
  recordLineupPlay,
  type AtBatOutcome,
  type PitcherAbility,
} from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { missionPitchingDefenseOf } from '@/entities/mission/model/missionCpuTeam/defense/pitchingDefense'
import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam/types'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam/types'

/** 원본 실점 카운터 A·B 는 99 에서 멈춘다 (P7 E1) — 투구 수는 그 100 배에서 */
const MAXIMUM_COUNTER = 99

/**
 * **점수판 득점** — 득점 처리 0xa5c34 가 1점마다 수비 투수의 A(+0x284) · B(+0x280)를 올린다(99 에서 멈춤, P7 E1).
 * 타자 미션에서만 뜻이 있다(CPU 가 수비). `inningEnded` 면 이어서 이닝 교대 0xa5b00 이 A 를 0 으로 —
 * 사람 칸 반 이닝이 3아웃이면 그 자리가 이닝 교대다(뒤이어 자동진행 — `missionRun.runBatterMissionAutoHalves`).
 */
export function missionCpuAfterRuns(team: MissionCpuTeam, runs: number, inningEnded: boolean): MissionCpuTeam {
  const pitching = team.pitching
  if (pitching === null || (runs <= 0 && !inningEnded)) return team
  const inningRuns = Math.min(MAXIMUM_COUNTER, pitching.inningRunsAllowed + runs)
  return {
    ...team,
    pitching: {
      ...pitching,
      mound: { ...pitching.mound, runsAllowed: Math.min(MAXIMUM_COUNTER, pitching.mound.runsAllowed + runs) },
      inningRunsAllowed: inningEnded ? 0 : inningRuns,
      ourRuns: pitching.ourRuns + Math.max(0, runs),
    },
  }
}

/**
 * **벤치 클리어링 진입의 꼬리** 0x3ab82 — 수비 팀이 CPU 면(타자 미션) 그 팀 +0x27c(이번 투수 투구 수) += 10 (상한 없음,
 * `entities/game/model/benchClearing`). 투구 수 칸은 공 하나 셈(`missionCpuAfterPitch`)과 같은 칸이다. 투수진이 없으면 그대로
 */
export function missionCpuAfterBenchClearing(team: MissionCpuTeam): MissionCpuTeam {
  const pitching = team.pitching
  if (pitching === null) return team
  return {
    ...team,
    pitching: {
      ...pitching,
      mound: { ...pitching.mound, pitches: pitching.mound.pitches + BENCH_CLEARING_PITCH_COUNT_GAIN },
    },
  }
}

/**
 * **CPU 공격 타석 정산** — 0xa8024 가 그 타순 칸 기록(안타 +0x12 · 홈런 +0x13 · 타석 +0x14)을 올리고, 타석이 끝났으니
 * 0xaf020 이 타순을 (+1) mod 9 로 넘긴다. 투수 미션에서만 뜻이 있다(CPU 가 공격).
 */
export function missionCpuAfterPlateAppearance(team: MissionCpuTeam, outcome: AtBatOutcome): MissionCpuTeam {
  const batting = team.batting
  if (batting === null) return team
  return {
    ...team,
    batting: {
      ...batting,
      lineup: recordLineupPlay(batting.lineup, batting.order, outcome),
      order: lineupSlotOf(batting.order + 1),
    },
  }
}

/**
 * **공 하나** — 투구 처리 0xa5e14 (모드 갈래 없음, 0x3dec6). state[0xd](a5e72) · state[0xe](a5e7c)를 내리고, 던진 투수의
 * 투구 수 +0x27c 를 올리고 스태미나를 깎는다(0xaeb08). 투수 미션은 사람이 던지므로 막음 칸만 내린다.
 * 마투수 스태미나는 세션이 따로 든다(`missionOpponentStaminaAfterPitch`) — 여기서는 판정 때 받는다.
 */
export function missionCpuAfterPitch(
  team: MissionCpuTeam,
  pitch: {
    readonly pitchTypeNumber: number
    readonly batterIntimidates: boolean
    /** 마투수가 마운드면 세션이 깎은 그 레코드 +0x2c (`missionOpponentStaminaAfterPitch`) — 안 주면 그대로 */
    readonly aceStamina?: number
    /**
     * 던진 마운드 투수(`missionMoundPitcherAbility`)와 마선수 레벨 — 주면 마구 두 칸(`MissionCpuPitching.magic`)을 소모 0x345fc ·
     * 싣기 0x3de10 차례로 고친다. 안 주면 그대로
     */
    readonly magic?: { readonly pitcher: PitcherAbility; readonly aceLevels?: Readonly<Record<number, number>> }
  },
): MissionCpuTeam {
  const pitching = team.pitching
  if (pitching === null) return team.pinchHitBlocked ? { ...team, pinchHitBlocked: false } : team
  const mound = pitching.mound
  const isAce = pitching.roster[mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
  const stamina = isAce
    ? (pitch.aceStamina ?? mound.stamina)
    : drainPitcherForPitch(missionPitchingDefenseOf(pitching, 0), mound, pitch.pitchTypeNumber, pitch.batterIntimidates)
  return {
    ...team,
    pinchHitBlocked: false,
    pitching: {
      ...pitching,
      mound: { ...mound, stamina, pitches: Math.min(MAXIMUM_COUNTER * 100, mound.pitches + 1), justChanged: false },
      ...(pitch.magic === undefined
        ? {}
        : {
            magic: heldCpuMagicAfterPitch(pitching.magic ?? FRESH_HELD_CPU_MAGIC, pitch.magic.pitcher, pitch.magic.aceLevels, pitch.pitchTypeNumber),
          }),
    },
  }
}

/** 새 타석 0xd(0x48d50 48eb6) — state[0xe] 를 내린다 (앞 상태가 0x16 이면 건너뛰지만 그 길은 0xf 재진입이라 여기 안 온다) */
export function missionCpuAtNewPlateAppearance(team: MissionCpuTeam): MissionCpuTeam {
  return team.pinchHitBlocked ? { ...team, pinchHitBlocked: false } : team
}
