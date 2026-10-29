import { useEffect, useEffectEvent } from 'react'
import { stageWarmCastOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import { useWarmStageCast } from '@/widgets/batting-stage/model/useWarmStageCast'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamStageWarmCastOf } from '@/pages/team-game/lib/teamMatchupCards'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { summaryAfterReplay, useShownReplay } from './otherSlices'

/**
 * 경기 요약 · 재생 칸 · 이어하기 저장 — 장면 머리에서 한 번.
 *
 * 재생 칸의 판 — 경기를 끝낸 재생 판도 0x17 로 다 그린 뒤에야 0xd → 경기 끝 판 0x18 · 정산 0x19 다(판정 B 0xae3e8). 그 그리기
 * 0x43278 의 실책 +0x2e 가 요약에 들도록 재생이 남은 동안은 요약을 안 낸다(`useShownReplay`, r248)
 */
export function useSceneSummary(session: TeamGameSession, onHalfInningSave: ((save: TeamGameProgress) => void) | undefined) {
  const { progress, summary: progressSummary } = session
  const play = progress.lastDefensePlay
  const { shownPlay, finishPlayback, isReplayPending } = useShownReplay(play)
  /**
   * **돌발 결과 창이 다음 상태보다 먼저** (r317 — 나리 타자편 r315 의 짝) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면
   * 0x1d · 0x1c(결과 창, 진입 보상 0x3b04c · 0x3b068 → 0x8e34c)를 먼저 거친 뒤 +0x1b6c 로 간다 — 그 다음이 경기 끝 0x18 · 0x19 여도,
   * 공수 교대 판 0x18 · 자동진행 0x21(0x35108 이 덮은 +0x1b6c)이어도 같다(R9 18-2 · R10 · K). 그 갈래들이 경기 장면(창이 얹히는 자리)보다
   * 앞이라 판정이 남아 있는 동안은 요약 · 교대 판 · 중계를 세우지 않는다 — 창을 닫으면(`closeBurst`) 선다
   */
  const isBurstResultHeld = progress.lastBurstResolution !== null
  const summary = isBurstResultHeld ? null : summaryAfterReplay(progressSummary, isReplayPending)
  // 이어하기 저장 0x4f928 — 진행기가 새 저장 진행을 담을 때마다 한 번씩 넘긴다
  const halfInningSave = progress.halfInningSave ?? null
  // 넘길 곳은 최신 것을 읽기만 한다 — 다시 넘기는 때는 저장 진행이 바뀔 때뿐
  const saveHalfInning = useEffectEvent((save: NonNullable<typeof halfInningSave>) => onHalfInningSave?.(save))
  useEffect(() => {
    if (halfInningSave !== null) saveHalfInning(halfInningSave)
  }, [halfInningSave])
  return { play, shownPlay, finishPlayback, isBurstResultHeld, summary }
}

/**
 * 곧 설 선수들(두 팀 명단 · 투수 명단)의 칠하기 — 사람 타석(우리 공격) · 사람 수비 타석(상대 공격) 그림이 그림마다 걸고,
 * 타석 캔버스가 아직 안 선 동안(수비 판 · 반 이닝 판)은 경기 화면이 건다. 원본은 타석 교대 0x47cc8 의 적재 때 칠한다
 */
export function useTeamWarmCast(progress: TeamGameProgress) {
  const ourBattingWarmCast = teamStageWarmCastOf(progress, true)
  const theirBattingWarmCast = teamStageWarmCastOf(progress, false)
  useWarmStageCast(
    stageWarmCastOf(
      [...ourBattingWarmCast.batters, ...theirBattingWarmCast.batters],
      [...ourBattingWarmCast.pitchers, ...theirBattingWarmCast.pitchers],
    ),
  )
  return { ourBattingWarmCast, theirBattingWarmCast }
}
