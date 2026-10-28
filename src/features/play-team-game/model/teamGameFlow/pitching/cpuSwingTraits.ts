import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import type { CpuBatterTraits } from '@/entities/pitching/model/simulateBatter'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { entryBatterSkillIdsOf, entryBattersOf, entryPitcherSkillIdsOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import {
  ACE_SPECIAL_NUMBER_OFFSET,
  aceBatterLevelOf,
  specialSwingRemainingAt,
} from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** `pitchOnce` 가 CPU 타자 결정 0x34334 에 넘기는 타자 · 투수 쪽 칸 — 몸통에서 그대로 떼어 냈다(r344) */
export function cpuSwingTraitsOf(
  progress: TeamGameProgress,
  isMistake: boolean,
  isMagicBatter: boolean,
  aceBatterIndex: number,
  ourRepertoireAce: boolean,
  repertoire: PitcherRepertoire,
  staminaPercent: number,
): CpuBatterTraits {
  const { options } = progress
  return {
    isMistakePitch: isMistake,
    isMagicBatter,
    // 마타자 필살 0x34468~0x34488 — 남은 칸(0xaea30)이 0 이 아니면 휘두를 때마다 필살이다 (난수 없음).
    // 번호 = 마선수 +0x18 = 순번 + 5, 보정 구조체 k = 레벨·5 + 순번
    ...(isMagicBatter
      ? {
          specialSwing: {
            swingNumber: aceBatterIndex + ACE_SPECIAL_NUMBER_OFFSET,
            remaining: specialSwingRemainingAt(progress, '상대'),
            aceOrder: aceBatterIndex,
            aceLevel: aceBatterLevelOf(progress, aceBatterIndex),
          },
        }
      : {}),
    // 0x34d6c 투수 쪽 — 공+0x10 이 서 있고 우리 투수가 마투수면 `mgr[0x13a + 순번]`
    pitcherAceLevel: ourRepertoireAce ? aceLevelOf(options.aceLevels, aceLevelSlotOf('투수', repertoire.magicId - ACE_SPECIAL_NUMBER_OFFSET + 1)) : 0,
    // 팀 경기 모드 1·2·8·9 는 판정 묶음 '일반' — 수비(우리)가 사람이라 hit·power 쪽 −10 (0xab5c0).
    // 내 선수 보너스(모드 3·4)·투수 미션 +100(모드 5)은 없다 — 팀 명단에 비트7 선수가 없다
    swingMode: '일반',
    // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
    playsFoulBall: true,
    // ab838 — 이번 공을 깎은 뒤 체력% 가 0 이면 B · C 에 +2000
    pitcherStaminaPercent: staminaPercent,
    // 0xab214 ab91c~ — 상대 지금 타자 레코드 +0x14 (`0xb62b4(타자, n)`, 마타자는 제 행)
    batterSkillIds: entryBatterSkillIdsOf(entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]),
    // 같은 갈래가 던지는 우리 투수 레코드 +0x14 도 `0xb62b4(투수, n)` 로 읽는다 — 명단 투수 비트 + 16 (마투수는 제 행)
    pitcherSkillIds: entryPitcherSkillIdsOf(pitcherEntryAt(progress, options.ourTeamId, progress.ourPitcherIndex)),
    skillSituation: {
      // 투수 스킬 31(0xabcd8)의 `0xb6394(타자)` — 경기 시작 레코드 첨자 · 마타자 순번 (`TeamEntryBatter.recordSlot`)
      batterOrderIndex: entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]?.recordSlot ?? 0,
      inning: progress.game.inning,
      // 0xab966 — 수비(우리) 점수 > 공격(상대) 점수
      isLosing: progress.game.ourScore > progress.game.opponentScore,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 이 타순 칸의 오늘 타석 결과 링 (팀 객체 + 타순×0x18 + 0x34)
      recentAtBatCodes: progress.opponentEntryRecords[progress.opponentOrderIndex]?.results ?? [],
    },
  }
}
