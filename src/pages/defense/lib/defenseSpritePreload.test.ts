import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { defenseSpritePreloadsOf, fielderRawFramesOf, runnerRawFramesOf } from '@/pages/defense/lib/defenseSpritePreload'
import { FIELDER_ACTION, fielderSpriteOf, runnerFrameOf, RUNNER_ACTION } from '@/pages/defense/lib/defenseView'
import type { DefenseFielder } from '@/pages/defense/lib/defenseView'
import { frameUrl } from '@/shared/lib/sprite/spritePreload'

const PUBLIC = resolve(__dirname, '../../../../public')
const fetched = (requests: readonly SpriteFolderPreload[]) => preloadImageUrlsOf(requests.map((request) => {
  if (request.framesListedIn === undefined || request.frames === 'all') return request
  const origins = JSON.parse(readFileSync(resolve(PUBLIC, `${request.framesListedIn.slice(2)}/origins.json`), 'utf8')) as Record<string, unknown>
  return { ...request, frames: request.frames.filter((frame) => String(frame).padStart(3, '0') in origins) }
}))

describe('defenseSpritePreload — 수비 화면 그림 목록(동작 표에서 계산)', () => {
  it('야수가 어떤 동작 · 틱에 그리는 칸이든(파일이 있는 칸) 목록에 있다 (보통 야수 · 마선수 둘 다)', () => {
    const urls = new Set(preloadImageUrlsOf(defenseSpritePreloadsOf({ batters: [1], pitchers: [3] })))
    for (const action of Object.values(FIELDER_ACTION)) {
      for (let tick = 0; tick < 30; tick += 1) {
        for (const [slot, aceIndex] of [[3, null], [3, 1], [0, 3]] as const) {
          const sprite = fielderSpriteOf({ action, actionTick: tick, slot, aceIndex } as unknown as DefenseFielder)
          const url = frameUrl(sprite.folder, sprite.frame)
          // 파일이 없는 칸(투수 마선수 38장 밖)은 그리기도 원점이 없어 안 받는다
          if (existsSync(resolve(PUBLIC, url.slice(2)))) expect(urls.has(url)).toBe(true)
        }
      }
    }
  })

  it('주자 칸은 000~016 안이고 야수 칸(+17)과 겹치지 않는다', () => {
    const runner = runnerRawFramesOf()
    expect(Math.max(...runner)).toBeLessThanOrEqual(16)
    expect(runner).toContain(runnerFrameOf(RUNNER_ACTION.slide, 0, 2, true))
    expect(Math.min(...fielderRawFramesOf())).toBe(0)
  })

  it('보통 야수는 번호 지도(팀 팔레트)도 받고, 실린 마선수만 그 폴더를 받는다 — 가리키는 파일이 모두 있다', () => {
    const plain = defenseSpritePreloadsOf()
    expect(plain.some((request) => request.folder.includes('defender_'))).toBe(false)
    expect(plain.find((request) => request.folder === './sprites/defender/frames/index')?.frames).toEqual(
      plain.find((request) => request.folder === './sprites/defender/frames')?.frames,
    )
    const withAces = defenseSpritePreloadsOf({ batters: [0, 4], pitchers: [0] })
    const urls = fetched(withAces)
    expect(urls.filter((url) => !existsSync(resolve(PUBLIC, url.slice(2))))).toEqual([])
    expect(urls).toContain('./sprites/defender_psyker/frames/000.png')
    expect(urls).toContain('./sprites/defense/index/000.png')
    // 125장을 통째로 받지 않는다
    expect(urls.filter((url) => url.startsWith('./sprites/defender/frames/0') || url.startsWith('./sprites/defender/frames/1')).length).toBeLessThan(125)
  })
})
