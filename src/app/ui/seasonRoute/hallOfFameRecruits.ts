import { HALL_OF_FAME_MAX_BATTERS, HALL_OF_FAME_MAX_PITCHERS, hallOfFameRecordIdOf } from '@/entities/collection/model/collection'
import type { RecruitCandidate, RecruitListInput } from '@/pages/season'
import { nariRecruitPlayerOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonRouteProps } from '@/app/ui/seasonRoute/seasonRouteProps'

/** 나리 칸 후보 — id 0xfe · +0xa 0x80/0xa0 · 기록 사본 (`nariRecruitPlayerOf`) */
export function nariRecruitOf(
  record: SeasonEntryBatterRecord | SeasonEntryPitcherRecord | null | undefined,
  isPitcher: boolean,
): RecruitCandidate | null {
  return record === null || record === undefined ? null : { name: record.name, player: nariRecruitPlayerOf(record, isPitcher) }
}

/** 명예의 전당 등록 `0x1f654`(투수: `+0xa = 0` · `+0 = i + 0xb4`) · `0x1f680`(타자: `+0xa = 0x20` · `+0 = i + 0xc8`) */
const HALL_OF_FAME_PITCHER_KIND = 0x00
const HALL_OF_FAME_BATTER_KIND = 0x20

/**
 * 선수영입 후보 목록의 명예의 전당 칸 — `0x1f62c(저장, i)`·`0x1f640(저장, i)` 가 주는 0x30 바이트 사본을 시즌 선수로.
 *
 * 등록(0x1f654·0x1f680, 직접 떴다)이 사본의 `+0x0a`(종류·칸 바이트)와 `+0`(선수 번호 = 칸 + 0xb4 / 0xc8)을 덮어쓴 뒤
 * 전역 기록에 복사하므로 그 둘은 칸 번호로 정해진다 — 중복 검사 `0xb50ac` 가 이 번호를 견준다.
 * ⚠️ 나머지 칸(+0x1c 수비 위치·+0x2c 스태미나)은 기록연감에 남아 있지 않다 — 0 으로 둔다. 영입이 투수 스태미나를
 * 10000 으로, 타자 수비 위치를 밀려난 선수의 자리로 덮으므로(S6 4-2·4-3) 영입 결과에는 닿지 않는다.
 * 경기 출전은 시즌 세션이 명전 칸을 기록으로 싣는다(05ac4dd `seasonHallOfFameRecordSourceOf`).
 */
export function hallOfFameRecruitsOf(hallOfFame: SeasonRouteProps['hallOfFame']): Pick<RecruitListInput, 'hallOfFamePitchers' | 'hallOfFameBatters'> {
  if (hallOfFame === undefined) return { hallOfFamePitchers: [], hallOfFameBatters: [] }
  const pitchers = Array.from({ length: HALL_OF_FAME_MAX_PITCHERS }, (_, slot): RecruitCandidate | null => {
    const famer = hallOfFame.hallOfFamePitchers.find((candidate) => candidate.slot === slot)
    return famer === undefined
      ? null
      : {
          name: famer.name,
          player: { id: hallOfFameRecordIdOf('투수', slot), kindByte: HALL_OF_FAME_PITCHER_KIND, fieldPosition: 0, stamina: 0 },
        }
  })
  const batters = Array.from({ length: HALL_OF_FAME_MAX_BATTERS }, (_, slot): RecruitCandidate | null => {
    // 옛 저장은 칸 번호가 없어 목록 순서가 칸이다 (`normalizeCollection` 과 같다)
    const famer = hallOfFame.hallOfFame.find((candidate, index) => (candidate.slot ?? index) === slot)
    return famer === undefined
      ? null
      : {
          name: famer.name,
          player: { id: hallOfFameRecordIdOf('타자', slot), kindByte: HALL_OF_FAME_BATTER_KIND, fieldPosition: 0, stamina: 0 },
        }
  })
  return { hallOfFamePitchers: pitchers, hallOfFameBatters: batters }
}
