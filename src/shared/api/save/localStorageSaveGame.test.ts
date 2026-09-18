// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageSaveGame } from '@/shared/api/save/localStorageSaveGame'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 예전 세이브 불러오기. 형식 1 은 능력치가 0~100 눈금이라 10배로 옮기고,
 * 나중에 추가된 필드는 신인 기본값으로 채운다 — 하나라도 비면 화면에 undefined 가 그대로 나온다.
 */

const STORAGE_KEY = 'compus-baseball/career'

/** 지금 형식이 요구하는 필드 전체 */
const REQUIRED_FIELDS = Object.keys(createCareer('기준')) as (keyof PlayerCareer)[]

/** 형식이 갈라지기 전의 세이브 — 화면에 보이던 값만 들어 있었다 */
const ANCIENT_SAVE = {
  name: '옛선수',
  ability: { hit: 42, power: 38, defense: 31, run: 25 },
  gamePoint: 1200,
  stamina: 70,
  season: 3,
  gamesPlayed: 18,
}

beforeEach(() => window.localStorage.clear())

const writeSave = (version: number, career: unknown) =>
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version, career }))

describe('세이브 불러오기', () => {
  it('형식 1 은 능력치를 10배 눈금으로 옮긴다', () => {
    writeSave(1, ANCIENT_SAVE)

    const loaded = createLocalStorageSaveGame().load()

    expect(loaded?.ability, `ability: ${JSON.stringify(loaded?.ability)}`).toEqual({
      hit: 420, power: 380, defense: 310, run: 250,
    })
    // 10배가 안 된 결과와 구분한다 — 형식 2 로 읽어 버리면 42 그대로다
    expect(loaded?.ability.hit).not.toBe(ANCIENT_SAVE.ability.hit)
  })

  it('형식 1·2 어느 쪽이든 지금 형식의 필드가 하나도 비지 않는다', () => {
    for (const version of [1, 2]) {
      writeSave(version, ANCIENT_SAVE)

      const loaded = createLocalStorageSaveGame().load()

      const missing = REQUIRED_FIELDS.filter((field) => loaded?.[field] === undefined)
      expect(missing, `형식 ${version} 에서 빈 필드: ${missing.join(', ')}`).toEqual([])
    }
  })

  it('예전 값은 그대로 두고, 저장한 값이 기본값으로 덮이지 않는다', () => {
    writeSave(2, ANCIENT_SAVE)

    const loaded = createLocalStorageSaveGame().load()

    expect(loaded).toMatchObject({ name: '옛선수', gamePoint: 1200, season: 3, gamesPlayed: 18 })
  })

  it('저장한 뒤 다시 읽으면 값이 그대로다', () => {
    const save = createLocalStorageSaveGame()
    const career: PlayerCareer = { ...createCareer('저장'), gamePoint: 777, popularity: 1234 }

    save.save(career)

    expect(save.load()).toEqual(career)
  })

  it('알 수 없는 형식·깨진 JSON 은 새 게임으로 본다 (null)', () => {
    writeSave(99, ANCIENT_SAVE)
    expect(createLocalStorageSaveGame().load()).toBeNull()

    window.localStorage.setItem(STORAGE_KEY, '{망가짐')
    expect(createLocalStorageSaveGame().load()).toBeNull()
  })
})
