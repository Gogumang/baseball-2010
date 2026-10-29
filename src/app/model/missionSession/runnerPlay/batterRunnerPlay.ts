import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { applyOutcome as applyMissionOutcome, applyPickoff, isMissionBatterUp, type MissionRun } from '@/entities/mission/model/missionRun'
import { isCleared, recordSteal } from '@/entities/mission/model/missionGoal'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { STEAL_RECORD_ID } from '@/app/model/missionSession/constants/missionConstants'

/** 도루 칸 R+0x10c(코드 0x10 ≤ 0x13)는 지금 타석에 미션 타자가 섰을 때만 든다 (0xa57f8 a5844 — `isMissionBatterUp`) */
function stealsCountedOf(run: MissionRun, play: PitchArrivalPlay): number {
  return isMissionBatterUp(run) ? play.recordIds.filter((id) => id === STEAL_RECORD_ID).length : 0
}

/**
 * **타자 미션의 주자 판**(공 도착 0x3dfac 의 종류 5 도루 · 9 폭투·포일)을 먹인다 — 진루·아웃은 견제 판과 같은
 * `applyPickoff`(3아웃이면 빈 루 · 0아웃 · 자동진행 대기), 미션 도루 목표는 도루 판의 기록 8 하나마다 +1 이다(미션 타자가 타석일 때만).
 * 도루 목표 칸은 확정이다 (직접 재역어셈): 판정 0xaaa6c 모드 6 갈래가 `0xaa928(R+0x10c, 행+0xa4 아래)`(aab56)로 재고,
 *    R+0x10c(사건 코드 0x10, 핸들러 0xa5900 `+= 1`)를 올리는 곳은 정산 0xa8024 의 a8388 하나 — 도루 주자 루프(a830c~a83d6)
 *    에서 루를 옮긴 주자마다 기록 8(a83c6)과 **같은 반복**에서 부른다. 그래서 기록 8 의 수와 같다. 판정은 판 끝(0xae5c4)에서 돈다.
 * 악송구·폭투로 들어온 득점은 점수판(화면 점수 · 경기 끝)에는 들고 타점 목표에는 안 든다 — 원본 정산 a8946 그대로(`applyPickoff` 주석).
 */
export function withMissionRunnerPlay(run: MissionRun, play: PitchArrivalPlay): MissionRun {
  if (run.status !== '진행중') return run
  const moved = applyPickoff(run, play.result.advance, play.result.runnerFates)
  const steals = stealsCountedOf(run, play)
  if (steals === 0) return moved
  let progress = moved.progress
  for (let index = 0; index < steals; index += 1) progress = recordSteal(progress)
  return { ...moved, progress, status: isCleared(run.mission, progress) ? '성공' : moved.status }
}

/**
 * **타자 미션 낫아웃** — 삼진 타석의 목표·타석 수·스윙은 보통 삼진 길(`applyOutcome`) 그대로, 루·아웃만 폭투·포일
 * 판의 진루(타자주자 포함, 아웃 없음)로 바꾼다. 삼진 기록(0xa7c4c)은 원본도 그대로 남는다.
 */
export function withBatterNotOut(run: MissionRun, outcome: AtBatOutcome, isBunt: boolean, play: PitchArrivalPlay): MissionRun {
  if (run.status !== '진행중') return run
  const struck = applyMissionOutcome(run, outcome, isBunt)
  const moved = applyPickoff(run, play.result.advance, play.result.runnerFates)
  // 판의 득점(점수판 0xa5c34)은 CPU 수비 투수의 실점 A·B 로 — 삼진 길에는 득점이 없다. 타순 · 타석 칸은 삼진 정산(struck) 것,
  // 점수 · 반 이닝 끝은 판의 것. 판 끝 판정의 경기 끝(폭투 끝내기 등)은 판 쪽이 낸다
  const merged: MissionRun = {
    ...struck,
    bases: moved.bases,
    runners: moved.runners,
    outs: moved.outs,
    cpu: moved.cpu,
    game: { ...struck.game, scores: moved.game.scores, halfEnded: moved.game.halfEnded },
  }
  return struck.status === '진행중' && moved.status === '실패' ? { ...merged, status: '실패' } : merged
}
