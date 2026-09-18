import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createCareer } from '@/entities/career/model/playerCareer'

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
      const raw = readRaw()
      if (raw === null) return null

      try {
        const parsed = JSON.parse(raw) as Partial<SaveFile>
        if (parsed.career === undefined) return null
        if (parsed.version === LEGACY_ABILITY_VERSION) return normalizeCareer(scaleLegacyAbility(parsed.career))
        if (parsed.version !== SAVE_FORMAT_VERSION) return null
        return normalizeCareer(parsed.career)
      } catch {
        return null
      }
    },

    save: (career) => {
      const payload: SaveFile = { version: SAVE_FORMAT_VERSION, career }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // 저장 실패는 진행을 막지 않는다.
      }
    },

    clear: () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // 무시
      }
    },
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
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
    titleIds: saved.titleIds ?? [],
    seenEventIds: saved.seenEventIds ?? [],
  }
}
