import { judgePitcherRun, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import { MISSION_OUTS_PER_INNING } from '@/app/model/missionSession/constants/missionConstants'

/**
 * **주자 판의 아웃도 '아웃' 목표에 든다** (직접 재역어셈) — 판의 아웃 콜 수.
 *
 * 투수 미션 판정 0xaaa6c 의 모드 5 갈래(0xaab9c~)는 '아웃' 목표를 `0xaa928(미션, R+0x13c, 행+0xa4)`(aacd6)로 잰다 —
 * `0xaa928` 은 한도 > 0 이고 칸 < 한도면 상태 1(아직)로 두는 성공 비교라, 다른 목표가 다 찼으면 칸이 한도에 닿는 판에서
 * 상태 0 → 0x76c(성공)이다. R+0x13c 는 사건 코드 0x1a(0xa57f8 → 표 0xd8218)의 "잡은 아웃 수" 칸이고, 올리는 곳은
 * 삼진 0xa7c4c(a7cc4) · **아웃 콜 0xa7d0c**(a7d52 `0xa57f8(R, 0x1a, 1)`, 코드 0x14~0x1f 라 지금 투수가 R 의 선수일 때 —
 * 미션 투수라 늘 선다) · 정산의 낫아웃 보정 −1(a8cfc) 셋이다.
 * 아웃 콜 0xa7d0c 는 플레이 판정 메시지 0x51408 의 결과 갈래(점프표 0xd0488)가 부른다: 결과 11(0x51b20, 콜 62) ·
 * 결과 13(0x51b36 → 0x51bea, 콜 62/20). **견제사·도루사가 내는 62/20 이 바로 결과 13 갈래**(`pickoffCallSoundIdOf`)라
 * 그 아웃도 R+0x13c 에 1 씩 든다. 판에는 주자 목록뿐이고 정산(0xa8ce8)은 state[0x1a](낫아웃)일 때만 빼므로 그대로 남는다.
 * R 은 같은 객체다 — 미션 준비 0xaa57c 의 여섯째 인자(미션+0x14, aa5a0)가 0x3f8b6 의 [장면+0x230], 0x51b24 가 넘기는 것도 [장면+0x230].
 * 판정은 견제 판 끝 판정 B 0xae3e8 의 ae5c4 에서 정산 뒤에 돈다 → 견제사로 '아웃' 목표를 채우면 그 자리에서 성공이다.
 *
 * 노히트노런·퍼펙트게임 칸(웹의 "잡은 아웃" 표시 칸, `recordPitcherOutcome`)도 같은 아웃 수로 올린다 — 판정은 이닝 목표
 * (`totalOuts`)가 하고, 주자 판은 안타·볼넷을 허용하지 않으니 0 으로 되돌릴 일이 없다.
 * 타석 수·삼진콤보는 타석이 끝난 게 아니라 안 건드린다. 칸을 올리는 것은 `missionGoal.withOutCalls`(타석 결과와 같은 칸들).
 */
export function outCallsOf(run: PitcherRun, outsAdded: number): number {
  // 판은 셋째 아웃에서 끝나 그 뒤로는 아웃 콜이 없다
  return Math.max(0, Math.min(outsAdded, MISSION_OUTS_PER_INNING - run.outs))
}

/** 깨진 조건 목록에 하나를 더한다(이미 있으면 그대로) */
function brokenWith(run: PitcherRun, condition: string): readonly string[] {
  const broken = run.progress.brokenConditions
  return broken.includes(condition) ? broken : [...broken, condition]
}

/** 한도가 서 있고 칸이 한도에 닿았나 (0xaa940) */
const reachesLimit = (limit: number, value: number) => limit > 0 && value >= limit

/**
 * 판 끝 미션 판정 0xaaa6c 중 주자 판이 바꿀 수 있는 갈래 — 실점 한도(+0xa1 ↔ R+0x128) → 실패 · 이닝 목표 → 성공 ·
 * 목표 칸(주자 판의 아웃이 '아웃' R+0x13c 에 든다, `outCallsOf`)이 다 차면 → 성공.
 */
export function judgedAfterRunnerPlay(run: PitcherRun, outs: number): PitcherRun {
  if (reachesLimit(run.mission.failLimits.runs, run.allowed.runs)) {
    return { ...run, progress: { ...run.progress, brokenConditions: brokenWith(run, '무실점') }, status: '실패' }
  }
  // 출루 허용 한도(+0xa3 ↔ R+0x130) — 정산하는 주자 판이 R+0x130 을 덮어쓴 값으로 같은 실패 한도 비교(0xaa940)를 지난다
  if (reachesLimit(run.mission.failLimits.baserunners, run.allowed.baserunner)) {
    return { ...run, progress: { ...run.progress, brokenConditions: brokenWith(run, '무출루') }, status: '실패' }
  }
  // 나머지는 판 끝 판정 그대로 — 경기 끝(0xb68fc) · 노히트노런 · 퍼펙트게임 · 목표 칸 · 남은 기회 (`judgePitcherRun`)
  return judgePitcherRun({ ...run, status: '진행중' }, outs)
}
