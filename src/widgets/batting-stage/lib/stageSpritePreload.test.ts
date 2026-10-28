import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import {
  aceBatterSpritePreloadsOf,
  acePitcherSpritePreloadsOf,
  batterSpritePreloadsOf,
  pitcherSpritePreloadsOf,
  stageCastSpritePreloadsOf,
} from '@/widgets/batting-stage/lib/stageSpritePreload'
import { batterFrameAt, batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import { frameUrl } from '@/shared/lib/sprite/spritePreload'

const PUBLIC = resolve(__dirname, '../../../../public')
const onDisk = (url: string) => existsSync(resolve(PUBLIC, url.replace(/^\.\//, '')))
/** 미리 받기가 실제로 받을 주소 — `framesListedIn` 은 디스크의 origins.json 으로 거른다(브라우저에서 하는 그대로) */
function fetchedUrlsOf(requests: readonly SpriteFolderPreload[]): string[] {
  return preloadImageUrlsOf(
    requests.map((request) => {
      if (request.framesListedIn === undefined || request.frames === 'all') return request
      const origins = JSON.parse(readFileSync(resolve(PUBLIC, `${request.framesListedIn.replace(/^\.\//, '')}/origins.json`), 'utf8')) as Record<
        string,
        unknown
      >
      return { ...request, frames: request.frames.filter((frame) => String(frame).padStart(3, '0') in origins) }
    }),
  )
}
const jsonUrlsOf = (requests: readonly SpriteFolderPreload[]) =>
  requests.flatMap((request) => (request.json ?? []).map((name) => `${request.folder}/${name}`))
const folderFrames = (requests: readonly SpriteFolderPreload[], folder: string) => requests.find((request) => request.folder === folder)?.frames

describe('stageSpritePreload — 그리기 코드에서 계산한 선수 그림 목록', () => {
  it('타격형 타자: 자세표가 낼 수 있는 모든 몸통 프레임과 그 겹(그림자 · 헬멧 · 배트 · 잔상)을 받는다', () => {
    const requests = batterSpritePreloadsOf(0)
    const urls = new Set(preloadImageUrlsOf(requests))
    // 대기 · 스윙 · 번트를 틱마다 돌려 실제로 그리는 겹이 모두 목록에 있다
    for (let tick = 0; tick < 40; tick += 1) {
      for (const swingTick of [null, 0, 3]) {
        for (const isBunting of [false, true]) {
          const frame = batterFrameAt({ tick, swingTick, isBunting, bodyType: 0 })
          for (const layer of batterLayersOf(frame, 0)) expect(urls.has(frameUrl(layer.folder, layer.frame))).toBe(true)
        }
      }
    }
    // 몸통 · 헬멧은 팔레트를 갈아 끼우므로 번호 지도와 palette.json 도
    expect(folderFrames(requests, './sprites/batter_balancer/frames/index')).toEqual(folderFrames(requests, './sprites/batter_balancer/frames'))
    expect(jsonUrlsOf(requests)).toContain('./sprites/batter_balancer/palette.json')
    expect(jsonUrlsOf(requests)).toContain('./sprites/batter_helmet/palette.json')
    // 장타형 그림은 안 받는다
    expect([...urls].some((url) => url.includes('batter_sluger'))).toBe(false)
  })

  it('장타형 타자는 sluger 몸통과 +14 보정 겹을 받는다 — 폴더를 통째로 받지 않는다', () => {
    const requests = batterSpritePreloadsOf(1)
    const body = folderFrames(requests, './sprites/batter_sluger/frames')
    expect(body).toContain(0)
    expect(body).toContain(7 + 13)
    expect(folderFrames(requests, './sprites/batter_shadow/frames')).toContain(14)
    expect(body?.length).toBeLessThan(40)
  })

  it('장비를 입으면 그 등급 폴더(머리 · 손 · 다리)와 등급 색 번호 지도를 받는다', () => {
    const urls = preloadImageUrlsOf(batterSpritePreloadsOf(0, { head: 3, hand: 4, leg: 2 }))
    expect(urls).toContain('./sprites/item_bat_head_3/frames/000.png')
    expect(urls).toContain('./sprites/item_bat_hand/frames/006.png')
    expect(urls).toContain('./sprites/item_bat_hand/frames/index/006.png')
    expect(urls).toContain('./sprites/item_bat_hand_4_1/frames/006.png')
    expect(urls).toContain('./sprites/item_bat_leg_0/frames/index/000.png')
  })

  it('마타자 · 마투수는 자기 폴더의 자세 프레임과 서 있는 그림만', () => {
    const kao = preloadImageUrlsOf(aceBatterSpritePreloadsOf(1))
    expect(kao).toContain('./sprites/batter_kao/frames/000.png')
    expect(kao).toContain('./sprites/batter_kao/002.png')
    expect(kao.every((url) => url.includes('batter_kao'))).toBe(true)
    const psyker = preloadImageUrlsOf(acePitcherSpritePreloadsOf(0))
    expect(psyker).toContain('./sprites/pitcher_psyker/012.png')
    // 싸이커는 마지막 단계가 12 라 프레임 15 는 안 나온다
    expect(psyker).not.toContain('./sprites/pitcher_psyker/frames/015.png')
    expect(aceBatterSpritePreloadsOf(7)).toEqual([])
    expect(acePitcherSpritePreloadsOf(-1)).toEqual([])
  })

  it('평범한 투수는 투구 단계 · 대기 프레임과 덧그림(+22)', () => {
    const frames = folderFrames(pitcherSpritePreloadsOf(), './sprites/pitcher/frames') ?? []
    expect(frames).toEqual(expect.arrayContaining([0, 3, 14, 19, 22, 25, 36, 41]))
  })

  it('한 경기 목록은 두 몸통 폼 · 실린 마선수 · 주자를 합친다 — 가리키는 파일이 모두 있다', () => {
    const requests = stageCastSpritePreloadsOf({
      aceBatters: [0, 4],
      acePitchers: [2],
      equippedBatters: [{ bodyType: 1, equipment: { head: 8, hand: 9, leg: 9 } }],
    })
    const urls = fetchedUrlsOf(requests)
    expect(new Set(requests.map((request) => request.folder)).size).toBe(requests.length)
    expect(urls.filter((url) => !onDisk(url))).toEqual([])
    // 원점 표로 거르지 않으면 없는 칸(번트 앞몸 · 덧그림 없는 단계)이 섞인다 — 그래서 거른다
    expect(preloadImageUrlsOf(requests).filter((url) => !onDisk(url)).length).toBeGreaterThan(0)
    expect(jsonUrlsOf(requests).filter((url) => !onDisk(url))).toEqual([])
    expect(urls).toContain('./sprites/defender_tiger/frames/001.png')
    expect(urls).toContain('./sprites/pitcher_bbmachine/frames/000.png')
  })
})
