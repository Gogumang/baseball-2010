import { swingResultOf } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { BatterAbility, PitchResolution } from '@/entities/pitching/model/simulateBatter/otherSlices'
import { DEFAULT_PITCHER_STATS, UNWIRED_SITUATION } from '@/entities/pitching/model/simulateBatter/defaults'
import { cpuSwingChoiceOf } from '@/entities/pitching/model/simulateBatter/decision/swingChoice'
import { rollCpuBattedBall } from '@/entities/pitching/model/simulateBatter/resolve/battedBall'
import { cpuSwingInputOf } from '@/entities/pitching/model/simulateBatter/resolve/swingInput'
import { rollCpuSwingPlan, swungOutcomeOf } from '@/entities/pitching/model/simulateBatter/resolve/swingPlan'
import { takenPitchResolutionOf, unswungOutcomeOf } from '@/entities/pitching/model/simulateBatter/resolve/takenPitch'
import type { BatterSituation, CpuBatterTraits, CpuPitchOutcome, PitcherStats } from '@/entities/pitching/model/simulateBatter/types'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 투수편 한 구의 결과. 플레이어가 던지고 타자는 자동으로 반응한다.
 * 휘두른 뒤는 타자편과 같은 원본 스윙 결과(0xab214) → 방향 → 타구 패턴 → 대체 근사를 쓴다.
 * 휘두를지는 원본 0x34334(battingPattern.arr) 그대로다 — `cpuSwingChoiceOf` 참고.
 * **언제** 휘두를지는 원본 0x340f8 — `cpuSwingTimingOffsetOf` 참고.
 * 표에서 번트 칸이 뽑히면 타이밍 뒤에 rand(1,4) 로 번트 종류를 정한다 (`cpuBuntKindOf`, 마선수 제외).
 *
 * `batter` 는 **경기용 능력치**(0xb570c/0xb570d, 체력 인자 90)여야 한다 — 쫓아가기 문턱과
 * 타이밍 K 가 그 히트를 본다. 팀 경기는 `entryBatterGameAbilities`, 투수편은 `opponentBatterAbility`
 * (모드 3 `gameAbilityOf`), 투수 미션은 모드 5 `gameAbilityOf` 값을 넘긴다.
 * 미션 마타자는 부르는 쪽(`useMissionSession` 의 `missionOpponentAbility`)이 레벨 배율(0xb6414 의
 * 0xd88aa[`mgr[0x13a+칸]`])을 먼저 곱해 넘긴다 — 레벨은 전역 저장(`useAceLevels`)이고 스페셜 마선수
 * 레벨업(0x5fb24)이 올린다. 밑값은 레코드의 `0xb6414(rec, k, 1)`(장비 니블 · 장착 스킬 5 −100 · 7 +50,
 * `entities/team/model/recordAbility.recordAbilityOf`)이어야 한다 — 0xb570c 첫머리 b5728 이 플래그 1 로 부른다.
 * 투수편 `opponentBatterAbility` · 팀 경기 명단은 그 값을 넘긴다. 미션 쪽도 마스터 줄 CPU 타자는
 * `missionCpuBatterAbilityOf`(`0xb6415(타자, k, 1)`), 마타자는 `missionOpponentAbility`(`aceRecordAbilityAtLevel`)로
 * 같은 값을 넘긴다.
 */
export function pitchAgainstBatter(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: PitcherStats = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
  traits: CpuBatterTraits = {},
): PitchResolution {
  return pitchAgainstBatterDetailed(pitch, batter, random, pitcher, situation, traits).resolution
}

/**
 * `pitchAgainstBatter` 에 마타자 필살 칸을 더 돌려준다. 원본 차례:
 * ```
 * 0x34334  표 굴림 → (존 밖이면) 쫓기 굴림 → 0x340f8 타이밍 굴림 → 번트 종류 굴림 → S+0x10 (난수 없음)
 * 0x4e136  스윙 틱: S+0x10 ≠ 0 && 남은 > 0 이면 남은 − 1
 * 0x51294  0x34d6c 보정 구조체 → 0xab214 (번트 r100 · contact · B · C · 15/18)
 *          헛스윙이면 여기서 끝 (0x5135c → 0x51840)
 * 0x51430~ 방향 · 타구 패턴
 * 0x517e6  S+0x10 ≠ 0 이면 0x34c74 의 p(마타자 30) 로 p·10 > rand(0,1000)
 *          ── 그 뒤 수비 판(상태 0x17)이 안타·아웃을 낸다 (`features/defense-play`)
 * ```
 */
export function pitchAgainstBatterDetailed(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: PitcherStats = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
  traits: CpuBatterTraits = {},
): CpuPitchOutcome {
  const remainingBefore = traits.specialSwing?.remaining ?? null
  const choice = cpuSwingChoiceOf(pitch, batter, random, situation, traits.isMistakePitch === true)
  if (choice === null) return unswungOutcomeOf(takenPitchResolutionOf(pitch), remainingBefore)

  const plan = rollCpuSwingPlan(pitch, batter, choice, traits, remainingBefore, random)
  const result = swingResultOf(cpuSwingInputOf(pitch, batter, pitcher, situation, traits, plan), random)
  // 헛스윙은 0x5135c → 0x51840 — 필살 굴림이 없다. 번트 헛스윙도 0x3445a 가 쓴 번트 종류가 남는다
  if (result.kind === '헛스윙') return swungOutcomeOf(plan, { kind: '스트라이크', isSwinging: true }, false)
  return rollCpuBattedBall(result.code, pitch, situation, traits, plan, random)
}
