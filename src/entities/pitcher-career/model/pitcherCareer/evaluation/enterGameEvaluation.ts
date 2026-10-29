import { addSeasonPopularityGain, countReputationZeroGame, countSkillGameCounters } from '@/entities/career/model/playerCareer'
import { NO_LAST_EVALUATION } from '@/entities/pitcher-career/model/pitcherCareer/evaluation/lastGame'
import { hasPitcherSkill } from '@/entities/pitcher-career/model/pitcherCareer/skills/pitcherSkills'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 공통 스킬 비트 — 무력감 · 먹튀 (투수 비트 0~7 은 타자와 같은 번호) */
const HELPLESS_SKILL = 5
const MONEY_GRUBBER_SKILL = 2

/**
 * **116 경기 뒤 평가 진입 0x1278c 의 저장 칸 몫** — S+0x50 = 2(0x1279a) 뒤, 0x8a6fc 다음의 경기 뒤 카운터(12bc2~12c3c):
 * `s16 +0x1c2 += s8 +0x4a`(이번 시즌 인기도 변화 합, `addSeasonPopularityGain`) · `0xa4d09`(평판 0 연속 +0x184). 이어하기(S+0x50 == 2)가 다시 들어오면
 * **한 번 더** 쌓인다(원본 그대로 — 타자편 `countGameForSkills` 와 같은 자리).
 * 무력감 +0x1c7 · 먹튀 +0x1c0/+0x1cd 도 같은 자리(12bc2~12c84)다 — `0xa3a75(S, 5|2)` 의 5·2 는 보유 비트 번호이고 투수 비트 0~7 은
 * 타자와 같은 공통 스킬(5 무력감 · 2 먹튀)이라 짝이 그대로다(`countSkillGameCounters`, 0x8457c 이름표 · skills.json 공통).
 */
export function enterPitcherGameEvaluation(career: PitcherCareer): PitcherCareer {
  const popularityChange = (career.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange
  return {
    ...career,
    seasonEndState: 116,
    ...countSkillGameCounters(
      {
        highMoraleStreak: career.highMoraleStreak ?? 0,
        moneyGrubberGames: career.moneyGrubberGames ?? 0,
        moneyGrubberPopularityGain: career.moneyGrubberPopularityGain ?? 0,
      },
      {
        hasHelpless: hasPitcherSkill(career, HELPLESS_SKILL),
        hasMoneyGrubber: hasPitcherSkill(career, MONEY_GRUBBER_SKILL),
        morale: career.morale,
        popularityChange,
      },
    ),
    seasonPopularityGain: addSeasonPopularityGain(career.seasonPopularityGain, popularityChange),
    reputationZeroGames: countReputationZeroGame(career.reputationZeroGames, career.reputation),
  }
}
