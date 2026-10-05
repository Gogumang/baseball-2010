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

  /**
   * 리그 선수 기록표(0xa8024)는 나중에 생긴 칸이다. 예전 저장에는 없으니 빈 표로 시작해야 하고,
   * 쌓인 표는 JSON 을 오가도 그대로여야 한다 (키가 숫자라 문자열로 오가는 것만 조심하면 된다).
   */
  it('리그 선수 기록표는 예전 저장에서 빈 표가 되고, 저장한 표는 그대로 돌아온다', () => {
    writeSave(2, ANCIENT_SAVE)
    expect(createLocalStorageSaveGame().load()?.leaguePlayerStats).toEqual({ batters: {} })

    const save = createLocalStorageSaveGame()
    const 표 = { batters: { 51: { atBats: 120, hits: 40, homeRuns: 9, runsBattedIn: 33 } } }
    save.save({ ...createCareer('저장'), leaguePlayerStats: 표 })

    const loaded = save.load()
    expect(loaded?.leaguePlayerStats).toEqual(표)
    expect(loaded?.leaguePlayerStats.batters[51].homeRuns).toBe(9)
  })

  /** 고른 필살타법 번호(+0x18)는 나중에 생긴 칸이다 — 옛 저장은 0(안 고름)으로 채우고, 고른 값은 오간다 */
  it('고른 필살타법 번호는 옛 저장에서 0 이 되고, 저장한 번호는 그대로 돌아온다', () => {
    writeSave(2, { ...ANCIENT_SAVE, specialSwingLevel: 3 })
    expect(createLocalStorageSaveGame().load()).toMatchObject({ specialSwingLevel: 3, specialSwingNumber: 0 })

    const save = createLocalStorageSaveGame()
    save.save({ ...createCareer('저장'), specialSwingLevel: 4, specialSwingNumber: 4 })
    expect(save.load()?.specialSwingNumber).toBe(4)
  })

  /**
   * 장착 칸(선수기록 +0x14)·슬롯 단계(+0x1c6)도 나중에 생긴 칸이다. 예전 웹엔 장착 창이 없었으니 장착은
   * 획득 때의 자동 장착뿐 — 보유 목록을 얻은 차례대로 단계 0(상한 6)에서 다시 자동 장착해 세운다.
   */
  it('장착 칸이 없는 옛 저장은 보유 스킬을 얻은 차례대로 자동 장착해 세운다 (0xa4bd8 → 0xa4b04)', () => {
    // 플러스 0,8,1,6,7,9 (여섯) → 21 은 상한에 걸려 못 끼고, 마이너스 3·17 은 상한과 무관하게 낀다
    writeSave(2, { ...ANCIENT_SAVE, skillIds: [0, 8, 3, 1, 6, 7, 9, 21, 17] })

    const loaded = createLocalStorageSaveGame().load()

    expect(loaded?.equippedSkillIds).toEqual([0, 8, 3, 1, 6, 7, 9, 17])
    expect(loaded?.skillSlotLevel).toBe(0)
  })

  it('저장한 장착 칸·슬롯 단계는 그대로 돌아온다', () => {
    const save = createLocalStorageSaveGame()
    save.save({ ...createCareer('저장'), skillIds: [0, 8, 6], equippedSkillIds: [0, 6], skillSlotLevel: 1 })

    expect(save.load()).toMatchObject({ equippedSkillIds: [0, 6], skillSlotLevel: 1 })
  })

  it('알 수 없는 형식·깨진 JSON 은 새 게임으로 본다 (null)', () => {
    writeSave(99, ANCIENT_SAVE)
    expect(createLocalStorageSaveGame().load()).toBeNull()

    window.localStorage.setItem(STORAGE_KEY, '{망가짐')
    expect(createLocalStorageSaveGame().load()).toBeNull()
  })
})
