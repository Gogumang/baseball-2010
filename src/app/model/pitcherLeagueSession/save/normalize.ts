import { pitcherCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import { createPitcherCareer, migratePitcherYearlyStats, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { rebuildEquippedSkillIds } from '@/entities/career/model/playerCareer'

/**
 * 저장을 불러올 때 **빠진 칸을 기본값으로 메운다**.
 *
 * 커리어에 칸을 더할 때마다 옛 저장에는 그 칸이 없어 `undefined` 가 된다 — 그대로 캐스팅하면
 * 화면이 조용히 어긋난다(예: 마구 고른 번호가 없어 "사용 중" 표시가 안 된다).
 * 새 커리어 한 벌을 바탕에 깔고 저장을 덮어쓰는 것으로 한 번에 막는다.
 *
 * ⚠️ 겉만 덮어쓰면 **한 겹 안쪽 칸**은 못 메운다. 리그 선수 기록표에 투수 줄(`pitchers`)이
 * 새로 생겼는데 옛 저장에는 `{ batters }` 뿐이라, 그대로 두면 `pitchers` 가 `undefined` 인 채
 * 돌아다닌다. 저장 형식 번호는 올리지 않는다 — 올리면 옛 저장이 통째로 버려져 선수가 사라진다.
 */
export function normalizePitcherCareer(raw: unknown): PitcherCareer | null {
  if (raw === null || typeof raw !== 'object') return null
  const saved = raw as Partial<PitcherCareer>
  if (typeof saved.name !== 'string') return null
  const base = createPitcherCareer(saved.name)
  // 지난 해 연도별 칸(0x1fa78)이 연차만큼 없는 옛 저장은 앞에 채운다 (`migratePitcherYearlyStats`)
  return migratePitcherYearlyStats({
    ...base,
    ...saved,
    stats: { ...base.stats, ...saved.stats },
    careerStats: { ...base.careerStats, ...saved.careerStats },
    leaguePlayerStats: { ...base.leaguePlayerStats, ...saved.leaguePlayerStats },
    // 완투 계열 칸(+0x1f0[0..3])은 나중에 생긴 칸이다 — 옛 저장은 0 에서 시작한다
    completeGameCounts: { ...base.completeGameCounts, ...saved.completeGameCounts },
    /*
     * 장착 칸(선수기록 +0x14)은 나중에 생긴 칸이다 — 바탕의 신인 값([0, 8])을 그대로 두면 보유와 어긋난다.
     * 예전 웹엔 장착 창이 없어 장착은 모두 획득 때의 자동 장착(0xa4bd8 → 0xa4b04, 모드 3 도 같다)뿐이었으므로
     * 타자편 저장(`localStorageSaveGame`)과 같이 보유 목록(얻은 차례)을 단계 0 에서 다시 자동 장착해 세운다.
     * 슬롯 단계(+0x1c6)는 바탕의 0 이 그대로 들어간다.
     */
    equippedSkillIds: saved.equippedSkillIds ?? rebuildEquippedSkillIds(saved.skillIds ?? base.skillIds),
    // 나리 팀 레코드는 바탕(기본 팀·선발 보직의 등록 꼴)을 쓰면 안 된다 — 없던 옛 저장은 없는 채로(`nariTeamsOf` · 날짜 셈이 세운다)
    nariTeams: saved.nariTeams,
    /*
     * 컬렉터 해금(20·24·28·32)은 구매 확정 0x14a74 가 전역 표에 켜 둔 것이다 — 그보다 앞서 산 옛 저장은 칸이 비어 있을 수 있어
     * 보유에서 다시 센다(`pitcherCollectorHiddenIdsOf`). `isPitcherHiddenOpen` 은 이 표만 본다.
     */
    openedHiddenIds: withCollectorIds(
      saved.openedHiddenIds ?? base.openedHiddenIds,
      pitcherCollectorHiddenIdsOf({
        ...base,
        ...saved,
      } as PitcherCareer),
    ),
  })
}

/** 해금 id 를 더한다 — 이미 있으면 그대로 */
function withCollectorIds(ids: readonly number[], collector: readonly number[]): readonly number[] {
  const missing = collector.filter((id) => !ids.includes(id))
  return missing.length === 0 ? ids : [...ids, ...missing]
}
