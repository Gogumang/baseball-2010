import { EMPTY_BASES, survivorsFromBaseOfFates } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { AtBatOutcome } from '@/entities/mission/model/pitcherRun/otherSlices'
import { MISSION_PITCHER_MODE } from '@/entities/mission/model/pitcherRun/types'
import type { PitcherOutcomeOptions, PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import { OUTS_PER_INNING } from '@/entities/mission/model/missionGoal'
import { missionPlay } from '@/entities/mission/model/missionRun'
import { missionRunnersAfterPlay } from '@/entities/mission/model/missionRunners'

/** 타자가 살아 나갔나 — 안타 · 볼넷 · 사구 (주자 신원을 밀 때 타자 칸이 1루에 선다) */
const isBatterOnBase = (kind: AtBatOutcome['kind']) => kind === '안타' || kind === '볼넷' || kind === '사구'

/**
 * 수비 쪽에서 주자·아웃을 옮긴다. 3아웃이면 다음 이닝(주자 없음, 0아웃).
 *
 * 인플레이 타구는 타자편 미션과 **같은** 길(`missionPlay` = `missionAdvance` + 주자 운명)로 간다 — 원본 수비 시뮬레이션
 * (태그업 0xa9620 + 자동 진루 0xaf918 "송구보다 2틱 이상 빠를 때만" + 2아웃 득점 보류)이다.
 * 실점(`allowed.runs`)·이닝 목표(`totalOuts`)가 이 결과를 그대로 받는다 (P2 7절 · U-02).
 */
export function advanceDefense(run: PitcherRun, outcome: AtBatOutcome, options: PitcherOutcomeOptions) {
  const {
    advance,
    runnerFates,
    outcome: settled,
  } = missionPlay(run.bases, run.outs, outcome, {
    random: options.random,
    played: options.played,
    gameMode: MISSION_PITCHER_MODE,
  })
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= OUTS_PER_INNING
  return {
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    // 판의 살아남은 주자로 CPU 타선 신원을 민다 — 지금 타자 칸은 판 앞 타순(정산 뒤 0xaf020 이 넘긴다)
    runners: missionRunnersAfterPlay(
      run,
      { bases: advance.bases, inningOver: isInningOver },
      {
        batterReached: isBatterOnBase(settled.kind),
        runsScored: advance.runsScored,
        survivorsFromBase: survivorsFromBaseOfFates(runnerFates),
      },
    ),
    outs: isInningOver ? 0 : outs,
    outsAdded: advance.outsAdded,
    /** 점수판 득점 (0xa5c34) — CPU 측 점수 */
    runsScored: advance.runsScored,
    isInningOver,
    /** 기록할 결과 — 판을 돈 타구는 판 끝 정산(0xa8024)이 낸 것 */
    outcome: settled,
    /** 정산(0xa8024)이 보는 주자 목록 — 이닝 정리보다 앞이다 */
    runnerFates,
    /**
     * 정산 때의 state[6] — 원본은 셋째 아웃에서 플레이가 끝나 3 을 넘지 않는다.
     * 웹 진행기가 혹시 넘겨 세어도 원본 칸처럼 3 에서 멈춘 값으로 본다.
     */
    outsAtSettlement: Math.min(OUTS_PER_INNING, outs),
  }
}
