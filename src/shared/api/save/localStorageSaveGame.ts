import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { ignoreErrors, tryOr } from '@/shared/lib/safe/tryOr'
import { safeLocalStorage } from '@/shared/lib/safe/safeStorage'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer, rebuildEquippedSkillIds } from '@/entities/career/model/playerCareer'
import { MID_SEASON_GAME } from '@/entities/career/model/seasonFlow'

const STORAGE_KEY = 'compus-baseball/career'

/** 저장 형식이 바뀌면 올린다. 2 = 능력치 0~999 눈금 (1 은 0~100 이라 10배로 옮긴다) */
const SAVE_FORMAT_VERSION = 2
const LEGACY_ABILITY_VERSION = 1
const LEGACY_ABILITY_FACTOR = 10

interface SaveFile {
  readonly version: number
  readonly career: PlayerCareer
}

/**
 * localStorage 세이브 어댑터.
 * 시크릿 창이나 저장소가 막힌 환경에서는 접근 자체가 예외를 던지므로 모든 호출을 감싼다.
 * 저장이 실패하더라도 게임 진행은 막지 않는다.
 */
export function createLocalStorageSaveGame(): SaveGamePort {
  return {
    load: () => {
      const raw = safeLocalStorage.get(STORAGE_KEY)
      if (raw === null) return null
      return tryOr(() => careerOf(JSON.parse(raw) as Partial<SaveFile>), null)
    },

    save: (career) => {
      const payload: SaveFile = { version: SAVE_FORMAT_VERSION, career }
      // 저장 실패(직렬화 실패 포함)는 진행을 막지 않는다.
      ignoreErrors(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)))
    },

    clear: () => safeLocalStorage.remove(STORAGE_KEY),
  }
}

/** 읽은 저장 파일 → 커리어. 형식이 안 맞으면 null (예전 능력치 눈금은 10배로 옮긴다) */
function careerOf(parsed: Partial<SaveFile>): PlayerCareer | null {
  if (parsed.career === undefined) return null
  if (parsed.version === LEGACY_ABILITY_VERSION) return normalizeCareer(scaleLegacyAbility(parsed.career))
  if (parsed.version !== SAVE_FORMAT_VERSION) return null
  return normalizeCareer(parsed.career)
}

function scaleLegacyAbility(saved: PlayerCareer): PlayerCareer {
  const ability = saved.ability
  if (ability === undefined) return saved
  return {
    ...saved,
    ability: {
      hit: ability.hit * LEGACY_ABILITY_FACTOR,
      power: ability.power * LEGACY_ABILITY_FACTOR,
      run: ability.run * LEGACY_ABILITY_FACTOR,
      defense: ability.defense * LEGACY_ABILITY_FACTOR,
    },
  }
}

/**
 * 예전 세이브에는 나중에 추가된 필드가 없을 수 있다.
 * 기본 커리어 위에 덮어써서 빠진 필드를 채운다 — 비워두면 화면에 undefined가 그대로 나온다.
 */
function normalizeCareer(saved: PlayerCareer): PlayerCareer {
  const base = createCareer(saved.name ?? '선수')

  return {
    ...base,
    ...saved,
    ability: { ...base.ability, ...saved.ability },
    stats: { ...base.stats, ...saved.stats },
    careerStats: { ...base.careerStats, ...saved.careerStats },
    affection: { ...saved.affection },
    league: saved.league ?? base.league,
    // 리그 선수 기록표(0xa8024)는 나중에 생긴 칸이다 — 예전 저장에는 없으니 빈 표로 시작한다.
    // 저장 형식 번호를 올리지 않는 이유: 빠진 칸이 기본값으로 채워지면 그만이고,
    // 번호를 올리면 `load` 가 예전 저장을 통째로 버려(`version !== ...` → null) 선수가 사라진다.
    leaguePlayerStats: {
      batters: { ...base.leaguePlayerStats.batters, ...saved.leaguePlayerStats?.batters },
      // 투수 줄은 타자 줄보다 더 나중에 생겼다 — 저장에 없으면 칸 자체를 두지 않는다.
      // ⚠️ 빈 표를 `{}` 로 박아 두면 안 된다: `EMPTY_LEAGUE_PLAYER_STATS` 가 `{ batters: {} }`
      //    모양 그대로라 왕복 비교가 어긋난다 (저장 형식 번호는 그대로 둔다).
      ...(saved.leaguePlayerStats?.pitchers === undefined ? {} : { pitchers: { ...saved.leaguePlayerStats.pitchers } }),
    },
    titleIds: saved.titleIds ?? [],
    // 장착 칸(선수기록 +0x14)은 나중에 생긴 칸이다. 예전 웹엔 장착 창이 없어 장착은 모두 획득 때의 자동 장착
    // (0xa4bd8 → 0xa4b04)뿐이었으므로, 보유 목록(얻은 차례)을 슬롯 단계 0 에서 다시 자동 장착해 세운다.
    // 새 선수 기본값([0, 8])을 그대로 덮으면 마이너스 스킬이 빠지고 7번째 플러스부터도 켜져 버린다.
    equippedSkillIds: saved.equippedSkillIds ?? rebuildEquippedSkillIds(saved.skillIds ?? base.skillIds),
    seenEventIds: saved.seenEventIds ?? [],
    // 그 해 중간 성적표 비트(S+0x180)는 나중에 생긴 칸이다. 예전 웹은 22경기째 116 [확인]에서 곧장 117 을 띄웠으므로 올해 22경기를
    // 넘긴(또는 막 마친) 저장은 이미 본 것으로 둔다 — 지난 해들의 비트는 다시 읽는 곳이 없다(연차가 바뀐다)
    midSeasonEvaluatedYears: saved.midSeasonEvaluatedYears ?? ((saved.gamesPlayed ?? 0) >= MID_SEASON_GAME ? [(saved.season ?? 1) - 1] : []),
  }
}
