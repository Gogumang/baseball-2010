import { judgeSeasonAwards } from '@/entities/awards/model/seasonAwards/mvp/judgeAwards'
import { recordMvpSeason } from '@/entities/awards/model/seasonAwards/mvpBits'
import type { PlayerCareer } from '@/entities/awards/model/seasonAwards/otherSlices'
import { careerLeagueRecordsOf } from '@/entities/awards/model/seasonAwards/records/leagueRecords'

/**
 * 시즌이 끝날 때 시상을 하고 **MVP 비트를 남긴다** (0x8dd60 → career+0x1ca).
 * 새 시즌으로 넘어가도 지우지 않는다 — 통산 MVP 를 보는 칭호(2·11·12·32·33)가 이것을 읽는다.
 * 시상 자격이 없으면 커리어를 그대로 돌려준다.
 */
export function recordSeasonMvp(career: PlayerCareer): PlayerCareer {
  const awards = judgeSeasonAwards(career, careerLeagueRecordsOf(career))
  if (!awards.isMostValuablePlayer) return career
  return { ...career, mvpSeasonBits: recordMvpSeason(career.mvpSeasonBits, career.season) }
}
