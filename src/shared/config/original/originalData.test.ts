import { describe, expect, it } from 'vitest'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { TEAMS } from '@/shared/config/original/teams'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { BATTER_BURSTS, PITCHER_BURSTS } from '@/shared/config/original/bursts'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

describe('원본 팀 데이터', () => {
  it('팀이 15개다', () => {
    expect(TEAMS).toHaveLength(15)
  })

  it('원작 팀 이름이 순서대로 들어있다', () => {
    expect(TEAMS[0].name).toBe('서울 드래곤즈')
    expect(TEAMS[5].name).toBe('광주 타이거즈')
    expect(TEAMS[14].name).toBe('외인구단')
  })

  it('팀마다 고유한 로고 경로를 가진다', () => {
    const urls = TEAMS.map((team) => team.logoUrl)

    expect(new Set(urls).size).toBe(TEAMS.length)
    expect(urls.every((url) => url.startsWith('./sprites/team_logo/'))).toBe(true)
  })
})

describe('원본 마선수 데이터', () => {
  it('타자 5명 + 투수 5명이다', () => {
    expect(ACE_PLAYERS.filter((ace) => ace.role === '타자')).toHaveLength(5)
    expect(ACE_PLAYERS.filter((ace) => ace.role === '투수')).toHaveLength(5)
  })

  it('원작 이름이 들어있다', () => {
    const names = ACE_PLAYERS.map((ace) => ace.name)

    expect(names).toContain('메디카')
    expect(names).toContain('킹타이거')
    expect(names).toContain('붕붕머신')
  })

  it('아이콘은 투수 0~4, 타자 5~9 순서다 — StrCOMMON 순서와 같아야 한다', () => {
    const pitcher = ACE_PLAYERS.find((ace) => ace.name === '싸이커')
    const batter = ACE_PLAYERS.find((ace) => ace.name === '메디카')

    expect(pitcher?.iconUrl).toBe('./sprites/ace_icon/000.png')
    expect(batter?.iconUrl).toBe('./sprites/ace_icon/005.png')
  })

  it('필살기가 원작 목록에서 온다', () => {
    for (const ace of ACE_PLAYERS) {
      const pool = ace.role === '타자' ? BATTER_BURSTS : PITCHER_BURSTS
      expect(pool, `${ace.name}의 필살기 ${ace.burst}`).toContain(ace.burst)
    }
  })

  it('능력치가 원본 0~999 범위 안에 있다', () => {
    for (const ace of ACE_PLAYERS) {
      for (const value of Object.values(ace.ability)) {
        expect(value, `${ace.name}: ${value}`).toBeGreaterThan(0)
        expect(value, `${ace.name}: ${value}`).toBeLessThanOrEqual(999)
      }
    }
  })

  it('아이디가 중복되지 않는다', () => {
    const ids = ACE_PLAYERS.map((ace) => ace.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('원본 선수 명단', () => {
  it('타자 180명, 투수 120명이다', () => {
    expect(BATTERS.length).toBeGreaterThan(150)
    expect(PITCHERS.length).toBeGreaterThan(100)
  })

  it('실제 이름이 들어있다', () => {
    expect(BATTERS[0].name).toBe('박택용')
    expect(PITCHERS[0].name).toBe('봉은중')
  })
})

describe('원본 문자열 데이터', () => {
  it('칭호 128개, 아이템 255개가 들어있다', () => {
    expect(ORIGINAL_TITLES).toHaveLength(128)
    expect(ORIGINAL_ITEMS).toHaveLength(255)
  })

  it('스토리 장면과 대사가 살아있다', () => {
    expect(ORIGINAL_EVENTS.length).toBe(313)
    expect(ORIGINAL_EVENTS.reduce((sum, event) => sum + event.commands.length, 0)).toBeGreaterThan(2000)
  })
})

describe('스킬 40종 — StrCOMMON[55~94] 이름 + StrSKILL 소개·효과', () => {
  it('공통 8 · 타자 16 · 투수 16 이고 이름·효과가 짝지어져 있다', async () => {
    const { ORIGINAL_SKILLS } = await import('@/shared/config/original/skills')

    expect(ORIGINAL_SKILLS).toHaveLength(40)
    expect(ORIGINAL_SKILLS.filter((skill) => skill.role === '타자')).toHaveLength(16)
    expect(ORIGINAL_SKILLS[11]).toMatchObject({ name: '번트왕', effect: '번트 성공 확률 +10%' })
    expect(ORIGINAL_SKILLS[39].name).toBe('혼신')
  })
})

describe('StrMODE 문구표', () => {
  it('모드 화면 문구 231개를 원본에서 그대로 읽는다', () => {
    expect(ORIGINAL_MODE_TEXT).toHaveLength(231)
  })

  it('화면들이 코드에 옮겨 적던 문구가 여기 있다', () => {
    // 투수편 팝업 0x78 · 휴식 거절 · 트레이닝 거절 · 지옥훈련 500G
    expect(ORIGINAL_MODE_TEXT[59]).toContain('원하는 항목을 선택해주세요')
    expect(ORIGINAL_MODE_TEXT[91]).toContain('사기 최고 상태입니다')
    expect(ORIGINAL_MODE_TEXT[193]).toContain('훈련을 할 수 없습니다')
    expect(ORIGINAL_MODE_TEXT[141]).toContain('500 G포인트')
  })

  it('한국시리즈·국가대항전 보상 문구는 금액이 %d 다 — 값은 코드가 넣는다', () => {
    expect(ORIGINAL_MODE_TEXT[197]).toContain('한국시리즈 우승')
    expect(ORIGINAL_MODE_TEXT[198]).toContain('한국시리즈 준우승')
    expect(ORIGINAL_MODE_TEXT[200]).toContain('국가대항전 준우승')
    expect(ORIGINAL_MODE_TEXT[200]).toContain('소지금 +%d만')
  })
})
