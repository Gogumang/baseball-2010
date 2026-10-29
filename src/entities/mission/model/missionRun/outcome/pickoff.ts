import { missionCpuAfterRuns } from '@/entities/mission/model/missionCpuTeam'
import { missionRunnersAfterPlay } from '@/entities/mission/model/missionRunners'
import { judgedAtGameEnd } from '@/entities/mission/model/missionRun/judge/gameEnd'
import { afterHumanPlateAppearance } from '@/entities/mission/model/missionRun/outcome/humanPlateAppearance'
import { OUTS_PER_INNING, type MissionRun } from '@/entities/mission/model/missionRun/types'
import { EMPTY_BASES, survivorsFromBaseOfFates, type AdvanceResult, type RunnerFate } from '@/entities/mission/model/missionRun/otherSlices'

/**
 * **CPU 투수의 견제 한 판**이 끝났다 — 진행기(`runPickoffPlay`)가 낸 진루·아웃만 먹인다.
 *
 * 원본은 메시지 0x10 → `0x50f28`(모드 갈림 없음) → 플레이 종류 4 · 상태 0x17 → 판 끝 `0xae3e8` 에서
 * 정산 0xa8024 와 미션 판정 0xaaa6c(0xae5c4)를 부른다. 종류 4 는 타석이 아니라(state[0x26], 0xa8d98)
 * 남은 타석·스윙은 그대로이고, 안타·타점 가지도 안 선다 — 목표 칸은 하나도 안 움직인다.
 *
 * 3아웃이면 빈 루 · 0아웃 · 자동진행 대기(타구 `advanceSituation` 과 같다). 판 끝 판정은 경기 끝(끝내기 등)이면 실패로.
 * 판의 득점(악송구 · 폭투 · 포일로 들어온 것)은 **점수판 0xa5c34 에 든다** — 경기 점수 `game.scores`(화면 점수 · 경기 끝 판정)와
 * CPU 수비 투수의 실점 A·B. **타점(R+0x104)에는 안 든다** — 정산 0xa8024 의 a8946 이 `state[0x11]`(공을 맞힌 판) ·
 * 볼넷 · 사구 판에서만 a8994 `0xa57f8(R, 0xe, 득점)` 을 부른다(Q2 '타점' 절, 메인 703e418). 견제(4) · 도루(5) · 폭투·포일(9) 판은
 * state[0x11] = 0 이라 타점 목표가 안 움직인다 — 원본 그대로다.
 */
export function applyPickoff<T extends MissionRun>(
  run: T,
  advance: AdvanceResult,
  /** 판의 주자 운명 — 살아남은 주자로 신원을 앉힌다(낫아웃 판이면 타자주자 0 포함). 안 주면 앞선 주자부터 앉히는 근사 */
  runnerFates?: readonly RunnerFate[],
): T {
  if (run.status !== '진행중') return run
  const outs = run.outs + advance.outsAdded
  // 판의 득점도 점수판 득점 0xa5c34 라 CPU 수비 투수의 실점 A·B 에 든다 (타자 미션)
  const isInningOver = outs >= OUTS_PER_INNING
  const cpu = missionCpuAfterRuns(run.cpu, advance.runsScored, isInningOver)
  const game = afterHumanPlateAppearance(run.game, run.mission, null, advance.runsScored, isInningOver)
  const runners = missionRunnersAfterPlay(
    run,
    { bases: advance.bases, inningOver: isInningOver },
    {
      batterReached: runnerFates?.some((fate) => fate.fromBase === 0 && !fate.retired) === true,
      runsScored: advance.runsScored,
      ...(runnerFates === undefined ? {} : { survivorsFromBase: survivorsFromBaseOfFates(runnerFates) }),
    },
  )
  const moved: T = isInningOver
    ? { ...run, bases: EMPTY_BASES, runners, outs: 0, cpu, game }
    : { ...run, bases: advance.bases, runners, outs, cpu, game }
  return judgedAtGameEnd(moved, outs)
}
