import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { HEADING_SPRITE, POPUP_LABEL } from '@/shared/ui/PixelNumber/PixelNumber'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 화면이 가리키는 원본 그림이 실제로 존재하는지 확인한다.
 * 경로를 잘못 적으면 화면에서 조용히 빈칸으로 보일 뿐 오류가 나지 않는다 —
 * 그걸 테스트로 잡는다.
 */
function publicFileExists(url: string): boolean {
  return existsSync(`public${url}`)
}

describe('원본 스프라이트 경로', () => {
  it('메뉴 제목 그림이 모두 존재한다', () => {
    const missing = Object.entries(HEADING_SPRITE)
      .filter(([, id]) => !publicFileExists(`/sprites/game_frame/${id}.png`))
      .map(([name]) => name)

    expect(missing).toEqual([])
  })

  it('버튼 라벨 그림이 모두 존재한다', () => {
    const missing = Object.entries(POPUP_LABEL)
      .filter(([, id]) => !publicFileExists(`/sprites/popup/${id}.png`))
      .map(([name]) => name)

    expect(missing).toEqual([])
  })

  it('팀 로고 15개가 모두 존재한다', () => {
    const missing = TEAMS.filter((team) => !publicFileExists(team.logoUrl)).map((t) => t.name)

    expect(missing).toEqual([])
  })

  it('마선수 아이콘 10개가 모두 존재한다', () => {
    const missing = ACE_PLAYERS.filter((ace) => !publicFileExists(ace.iconUrl)).map((a) => a.name)

    expect(missing).toEqual([])
  })

  it('숫자 그림 0~9 세 가지 색이 모두 존재한다', () => {
    const missing: string[] = []
    for (const start of [0, 10, 20]) {
      for (let digit = 0; digit < 10; digit += 1) {
        const id = String(start + digit).padStart(3, '0')
        if (!publicFileExists(`/sprites/num/${id}.png`)) missing.push(id)
      }
    }
    expect(missing).toEqual([])
  })

  it('타석 화면이 쓰는 그림이 존재한다', () => {
    expect(publicFileExists('/sprites/attack/000.png'), '그라운드 배경').toBe(true)
    expect(publicFileExists('/sprites/main_title/000.png'), '타이틀 아트').toBe(true)
    expect(publicFileExists('/sprites/batter_balancer/frames/000.png'), '타자 프레임').toBe(true)
    expect(publicFileExists('/sprites/ball/000.png'), '공').toBe(true)
    expect(publicFileExists('/sprites/game_judge/008.png'), '판정 문구').toBe(true)
  })

  it('마선수 대부분이 애니메이션 프레임을 갖는다', () => {
    const withFrames = ACE_PLAYERS.filter((ace) => ace.frameCount > 0)

    expect(
      withFrames.length,
      `프레임 없는 마선수: ${ACE_PLAYERS.filter((a) => a.frameCount === 0).map((a) => a.name)}`,
    ).toBeGreaterThanOrEqual(8)
  })
})

describe('메뉴 아이콘', () => {
  it('허브 메뉴 아이콘이 모두 존재한다', async () => {
    const { MODE_ICON } = await import('@/shared/ui/PixelNumber/PixelNumber')
    const missing = Object.entries(MODE_ICON)
      .filter(([, url]) => !publicFileExists(url))
      .map(([name]) => name)

    expect(missing).toEqual([])
  })

  it('훈련 메뉴 수만큼 아이콘이 있다', async () => {
    const { TRAINING_MENUS } = await import('@/shared/config/trainingMenus')
    const missing = TRAINING_MENUS.map((_unused, index) =>
      `/sprites/mode_icon/${String(7 + index).padStart(3, '0')}.png`,
    ).filter((url) => !publicFileExists(url))

    expect(missing).toEqual([])
  })

  it('모든 마선수가 프레임이든 정지 그림이든 화면에 나올 수 있다', async () => {
    const { ACE_PLAYERS } = await import('@/shared/config/original/acePlayers')
    const invisible = ACE_PLAYERS.filter(
      (ace) => ace.frameCount === 0 && !publicFileExists(ace.stillUrl),
    ).map((ace) => ace.name)

    expect(invisible).toEqual([])
  })
})
