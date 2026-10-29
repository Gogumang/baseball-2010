import { withGameTeamMorale, type GameProgress } from '@/features/play-game/model/gameFlow'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import { nariMoraleOf, withNariGameMorale } from '@/entities/career/model/nariMorale'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_AT_BAT_PITCH_TALLY } from '@/features/play-at-bat/model/atBatPitchTally'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom, unsavedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { foulPlayAtom, loadingTipAtom, pitchTallyAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { leaveLiveGameState } from '@/app/model/careerSession/settlement/settlementSideEffects'

/**
 * 종류 1 사기는 0xa3a44 — 두 팀 레코드 +2 를 공마다 0xb570c 가 그 값으로 다시 덮어 다음 공부터 용량(0x66e44)이 본다.
 * 내 주력 0xb570d(ctx, 3, 나, 1, 0x5a, 1)도 그 칸으로 사기 감소를 다시 먹는다
 */
function withRewardedMorale(cleared: GameProgress, rewarded: PlayerCareer): GameProgress {
  const moraleChanged = withGameTeamMorale(cleared, nariMoraleOf(rewarded))
  const runAbility = effectiveAbilityOf(withNariGameMorale(rewarded)).run
  if (moraleChanged === cleared || cleared.myRunAbility === undefined || cleared.myRunAbility === runAbility) return moraleChanged
  return { ...moraleChanged, myRunAbility: runAbility }
}

/** 경기 칸 — 돌발 결과 창 닫기 · 나가기 · 로딩 끝 (그림마다 새 함수 — 옛 꼴 그대로) */
export function gameExitActionsOf({ atoms, audio, runner, setScreen }: CareerScope) {
  return {
    /**
     * 돌발미션 결과 창을 닫았다 — 보상·페널티를 내 선수에게 얹고 판정을 치운다 (0x8e34c).
     * 나만의리그는 붙을 곳이 내 선수 레코드(0x1fa2d)라 커리어에 바로 얹는다.
     */
    closeBurstResult: () => {
      const current = atoms.get(progressAtom)
      const resolution = current?.lastBurstResolution ?? null
      if (current === null || resolution === null) return
      const cleared = { ...current, lastBurstResolution: null }
      atoms.set(progressAtom, cleared)
      // 0x8e34c 는 내 선수 레코드(0x1fa2d)에 더하기만 하고 저장하지 않는다 — 경기 끝 정산 0x4ea0c 의 저장(4f3c0)이 함께 쓴다.
      // 경기 중 나가기(0x40140)는 저장이 없어 다시 들어오면(0x213c0 재적재) 이 보상이 없다 — StrGAME[0] "획득한 G포인트가 사라집니다"
      const player = atoms.get(rawCareerAtom)
      if (player === null) return
      const rewarded = applyBurstRewards(player, resolution.deltas)
      if (rewarded === player) return
      const withMorale = withRewardedMorale(cleared, rewarded)
      if (withMorale !== cleared) atoms.set(progressAtom, withMorale)
      atoms.set(unsavedCareerAtom, rewarded)
      atoms.set(rawCareerAtom, rewarded)
    },

    /** 경기 중 [메뉴] → 나가기. StrGAME[0] "현재 이닝의 기록과 획득한 G포인트가 사라집니다" */
    quitGame: () => {
      // 상태 0x22 → 장면 0x103 은 전역 경기 상태를 안 지운다 — 나간 그 이닝이 +0x6b 에 남는다
      const current = atoms.get(progressAtom)
      if (current !== null) leaveLiveGameState(current)
      atoms.set(progressAtom, null)
      runner.resetAtBat()
      atoms.set(pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
      atoms.set(foulPlayAtom, false)
      runner.setIsPaused(true)
      setScreen({ kind: '메인메뉴' })
    },

    finishLoading: () => {
      atoms.set(loadingTipAtom, null)
      runner.setIsPaused(false)
      // 경기 시작 인트로 예약음 61 (상태 0xc). 웹에는 인트로 화면이 없어 로딩이 끝나는 자리다 — 근사
      playSoundIds(audio, [GAME_INTRO_SOUND])
    },
  }
}
