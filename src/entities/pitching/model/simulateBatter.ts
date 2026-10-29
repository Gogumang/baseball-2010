/**
 * 투수편에서 상대 타자를 대신 판단한다.
 *
 * 휘두를지는 **원본 확률표 battingPattern.arr**(0x34334) 이 정한다 — 볼카운트·아웃·주자로
 * 고른 행에서 치기/번트/지켜보기를 뽑고, 공이 존 밖이면 "쫓아갈지" 를 한 번 더 굴린다.
 * 히트가 높을수록 존 밖 공을 덜 쫓는다 (원본 문턱 250 − h/4 · 2000 − 3h/2).
 *
 * 공개 이름 모음 — 하위 폴더 (`simulateBatter/`): `types`(상황 · 성질 · 결과 꼴) · `defaults`(자리표시) · `truncated` ·
 * `decision/`(휘두를지 0x34334 · 타이밍 0x340f8 · 번트 종류 0x3445a · 마타자 필살 0x34468) ·
 * `resolve/`(지켜본 공 0x3dfac · 스윙 계획 · 0xab214 입력 0x51294 · 맞은 공 0x51430~ · 한 구 판정) · `swingPose` · `otherSlices`(다른 조각)
 */
export type {
  BatterSituation,
  CpuBatterTraits,
  CpuPitchOutcome,
  CpuSwingPose,
  CpuSwingSkillSituation,
} from '@/entities/pitching/model/simulateBatter/types'
export { cpuSwingChoiceOf, willSwing } from '@/entities/pitching/model/simulateBatter/decision/swingChoice'
export { cpuBuntKindOf, cpuSpecialSwingNumberOf } from '@/entities/pitching/model/simulateBatter/decision/buntAndSpecial'
export { cpuSwingTimingOffsetOf } from '@/entities/pitching/model/simulateBatter/decision/swingTiming'
export { cpuSwingPoseOf } from '@/entities/pitching/model/simulateBatter/swingPose'
export { pitchAgainstBatter, pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter/resolve/pitchAgainstBatter'
