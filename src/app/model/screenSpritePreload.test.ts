import { describe, expect, it } from 'vitest'
import { screenSpritePreloadsOf } from '@/app/model/screenSpritePreload'
import { SPRITE_PRELOAD_SCENES } from '@/shared/config/spritePreloadScenes'

describe('screenSpritePreloadsOf', () => {
  it('메인메뉴에서는 팀선택·더비 선택 그림을 유휴로 받는다', () => {
    expect(screenSpritePreloadsOf('메인메뉴', false)).toEqual([
      { scene: 'teamSelect', priority: 'idle' },
      { scene: 'homeRunDerbySelect', priority: 'idle' },
    ])
  })

  it('팀선택처럼 경기로 이어지는 화면은 경기 진입 그림을 바로 받는다', () => {
    expect(screenSpritePreloadsOf('팀선택', false)).toEqual([{ scene: 'gameEntry', priority: 'scene' }])
  })

  it('경기 장면이 서 있으면 타석은 바로, 경기 진행(수비 등)은 유휴로', () => {
    expect(screenSpritePreloadsOf('관리', true)).toEqual([
      { scene: 'gameEntry', priority: 'scene' },
      { scene: 'gameAtBat', priority: 'scene' },
      { scene: 'gamePlay', priority: 'idle' },
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
      }
    }
  })
})
