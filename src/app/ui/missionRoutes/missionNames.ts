import type { useMissionSession } from '@/app/model/useMissionSession'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { Collection } from '@/entities/collection/model/collection'
import { hallOfFameBatterAt, hallOfFamePitcherAt } from '@/entities/collection/model/collection'

/** 선수 고르기에서 그 편 명예 선수를 골랐으면 그 칸(+0xa5 · +0xa6), 아니면 null */
function pickedHallOfFameIndexOf(session: ReturnType<typeof useMissionSession>, side: '투수' | '타자'): number | null {
  const pick = session.player
  if (pick?.side !== side) return null
  return pick.hallOfFameIndex
}

/**
 * **미션 타자 0x1fc20 의 이름** — 0xb62c0 은 id 가 에디트 이름표 범위 밖이면 기록 +1 을 준다(나리 저장 선수 +0 = 0xfe · 명예 타자
 * id 도 이름표 칸 밖 — R11). 0x1fc20 은 선수 고르기에서 명예 타자를 골랐으면(+0xa6 ≥ 0) 그 명전 기록, 아니면 나리 타자편 저장 선수 —
 * 마선수 대결(g[0x11f])은 명예 갈래를 안 탄다(세션 `hallOfFameBatter` 와 같은 갈래).
 */
export function missionBatterNameOf(
  session: ReturnType<typeof useMissionSession>,
  hallOfFame: Collection,
  nariBatter: HallOfFameNariPlayer | null,
  isAceMatch: boolean,
): string | null {
  // 0x1fc20 — g[0x11f](타자편 대기)가 서 있으면 보통 미션도 명예 갈래를 안 탄다 (세션 `hallOfFameBatter` 와 같은 갈래)
  const index = isAceMatch || session.aceMatchHold.batter ? null : pickedHallOfFameIndexOf(session, '타자')
  if (index !== null) return hallOfFameBatterAt(hallOfFame, index)?.name ?? null
  return nariBatter?.name ?? null
}

/**
 * **미션 투수 0x1fbd0 의 이름** — 모드 5 · g[0x176] == 0 · +0xa5 ≥ 0 이면 명예 투수(0x1f62c) 기록, 그 밖은 나리 투수편 저장 선수
 * (세션 `hallOfFamePitcher` 와 같은 갈래). 0xb62c0 은 둘 다 이름표 칸 밖이라 기록 +1 의 이름이다.
 * 투수편 마선수 대결(`PitcherAceMatchRoute`)은 g[0x176] 이 서 있어 늘 나리 투수다 — 그 라우트는 이름을 따로 받는다.
 */
export function missionPitcherNameOf(
  session: ReturnType<typeof useMissionSession>,
  hallOfFame: Collection,
  nariPitcher: HallOfFameNariPlayer | null,
): string | null {
  const isAceMatch = session.pitcherAceMatchMission !== null || session.aceMatchHold.pitcher
  const index = isAceMatch ? null : pickedHallOfFameIndexOf(session, '투수')
  if (index !== null) return hallOfFamePitcherAt(hallOfFame, index)?.name ?? null
  return nariPitcher?.name ?? null
}

/** 소개 판의 미션 투수 칸 재료 — 세션이 든 선수 게터 0x1fbd0 의 기록(`session.pitcher`)과 지금 +0x2c */
export function missionCardPitcherOf(session: ReturnType<typeof useMissionSession>, name: string | null) {
  const { pitcher } = session
  return {
    name,
    ...(pitcher.plate?.role === undefined ? {} : { role: pitcher.plate.role }),
    form: pitcher.repertoire.form,
    staminaAbility: pitcher.staminaAbility,
    stamina: session.pitcherStamina,
    ...(pitcher.recordLine === undefined ? {} : { recordLine: pitcher.recordLine }),
  }
}
