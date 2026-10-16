import { describe, expect, it } from 'vitest'
import { screenSpritePreloadsOf } from '@/app/model/screenSpritePreload'
import { SPRITE_PRELOAD_SCENES } from '@/shared/config/spritePreloadScenes'
import { preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PUBLIC = resolve(__dirname, '../../../public')

describe('screenSpritePreloadsOf', () => {
  it('메인메뉴에서는 나리 관리 · 팀선택 · 미션 · 더비 선택 그림을 유휴로 받는다', () => {
    expect(screenSpritePreloadsOf('메인메뉴', false)).toEqual([
      { scene: 'nariMenu', priority: 'idle' },
      { scene: 'teamSelect', priority: 'idle' },
      { scene: 'missionSelect', priority: 'idle' },
      { scene: 'homeRunDerbySelect', priority: 'idle' },
    ])
  })

  it('메인메뉴 앞 화면(이용안내 · 로고 · 타이틀)도 메뉴에서 갈 화면 그림을 유휴로 받는다 (r124)', () => {
    for (const kind of ['이용안내', '로고', '타이틀'] as const) {
      expect(screenSpritePreloadsOf(kind, false)).toEqual(screenSpritePreloadsOf('메인메뉴', false))
    }
  })

  it('팀선택처럼 경기로 이어지는 화면은 경기 진입 그림 · 첫 그림 선수 몫을 바로, 나머지 선수 · 수비 그림을 유휴로 받는다', () => {
    expect(screenSpritePreloadsOf('팀선택', false)).toEqual([
      { scene: 'gameEntry', priority: 'scene' },
      { scene: 'gameEntryCast', priority: 'scene' },
      { scene: 'stageCast', priority: 'idle' },
      { scene: 'defense', priority: 'idle' },
    ])
    // 나리 투수편 · 미션도 경기로 이어진다
    expect(screenSpritePreloadsOf('투수편', false)).toContainEqual({ scene: 'gameEntry', priority: 'scene' })
    expect(screenSpritePreloadsOf('미션선택', false)).toContainEqual({ scene: 'gameEntry', priority: 'scene' })
  })

  it('나리 관리 쪽 화면은 관리 · 순위 · 경기 준비 그림을 바로 받는다', () => {
    for (const kind of ['관리', '다음경기순위', '경기준비', '투수편', '이벤트'] as const) {
      expect(screenSpritePreloadsOf(kind, false)).toContainEqual({ scene: 'nariMenu', priority: 'scene' })
    }
  })

  it('경기 장면이 서 있으면 타석은 바로, 경기 진행 · 선수 · 수비 · 경기 끝은 유휴로', () => {
    expect(screenSpritePreloadsOf('관리', true)).toEqual([
      { scene: 'nariMenu', priority: 'scene' },
      { scene: 'gameEntry', priority: 'scene' },
      { scene: 'gameEntryCast', priority: 'scene' },
      { scene: 'stageCast', priority: 'idle' },
      { scene: 'defense', priority: 'idle' },
      { scene: 'gameAtBat', priority: 'scene' },
      { scene: 'stageCast', priority: 'idle' },
      { scene: 'burstPortraits', priority: 'idle' },
      { scene: 'gamePlay', priority: 'idle' },
      { scene: 'defense', priority: 'idle' },
      { scene: 'afterGame', priority: 'idle' },
      { scene: 'afterGameEvaluation', priority: 'idle' },
    ])
  })

  it('홈런더비 화면은 더비 장면을 받는다, 상관없는 화면은 아무것도 안 받는다', () => {
    expect(screenSpritePreloadsOf('홈런더비', false)).toEqual([{ scene: 'homeRunDerby', priority: 'scene' }])
    expect(screenSpritePreloadsOf('환경설정', false)).toEqual([])
  })
})

describe('SPRITE_PRELOAD_SCENES', () => {
  it('모든 폴더가 ./sprites/ 아래이고 프레임 번호가 0 이상 정수다 (캐시 키가 화면 쪽 주소와 같아야 한다)', () => {
    for (const requests of Object.values(SPRITE_PRELOAD_SCENES)) {
      for (const request of requests) {
        expect(request.folder.startsWith('./sprites/')).toBe(true)
        expect(request.folder.endsWith('/')).toBe(false)
        if (request.frames !== 'all') expect(request.frames.every((frame) => Number.isInteger(frame) && frame >= 0)).toBe(true)
        // 가리키는 파일이 모두 있다 (r111 에 손으로 옮긴 측정 목록도)
        for (const url of [...preloadImageUrlsOf([request]), ...(request.json ?? []).map((name) => `${request.folder}/${name}`)]) {
          expect(existsSync(resolve(PUBLIC, url.replace(/^\.\//, '').replace(/\?mask$/, ''))), url).toBe(true)
        }
      }
    }
  })
})
