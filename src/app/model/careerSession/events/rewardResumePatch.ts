import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { EventReward } from '@/entities/story/model/eventReward'
import { nariSeasonEndStateOfResumeCode, rewardItemsResumeCodeOf, rewardResumePatchOf } from '@/entities/story/model/storyScene'
import { withNationalCupEntered } from '@/app/model/careerSession/nationalCup/nationalCupEntry'

/** 이어하기 자리(S+0x50)를 고친다 — 같으면 그대로 */
const withSeasonEndState = (career: PlayerCareer, state: PlayerCareer['seasonEndState']) =>
  career.seasonEndState === state ? career : { ...career, seasonEndState: state }

/**
 * 보상 명령 뒤 이어하기 자리 — 0x8c460 끝 8cc2e(나리 갈래, 모드 4 라 393~396 은 0xc) → 8cd44 저장 (`rewardResumePatchOf`).
 * 463 은 S+0x12c = 1(대회 진행 중)이라 웹은 대회를 이 자리에서 세운다. 464 는 S+0x50 = 0x11 · S+0x12c = 0 — 웹은 464 앞에
 * 대회를 세우지 않으므로(463 만 세운다) 0 은 이미 그 값이다.
 * 그 앞, 줄을 도는 동안 보상 20(연봉)은 8cb90 에서 S+0x50 = 0xa 를 쓴다(`rewardItemsResumeCodeOf` — 웹 133).
 */
export function withRewardResumePatch(career: PlayerCareer, eventId: number, items: readonly EventReward[]): PlayerCareer {
  const itemsCode = rewardItemsResumeCodeOf(items)
  const salaried = itemsCode === null ? career : withSeasonEndState(career, nariSeasonEndStateOfResumeCode(itemsCode))
  const patch = rewardResumePatchOf(eventId, '나리타자')
  if (patch === null) return salaried
  if (patch.nationalCup === true) return withNationalCupEntered(salaried)
  return withSeasonEndState(salaried, nariSeasonEndStateOfResumeCode(patch.resumeCode))
}
