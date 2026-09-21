import { describe, expect, it } from 'vitest'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { TEAMS } from '@/shared/config/original/teams'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { BATTER_BURSTS, PITCHER_BURSTS } from '@/shared/config/original/bursts'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  BATTING_PATTERNS,
  battingPatternChoiceOf,
  battingPatternOdds,
  battingPatternRunnerColumn,
} from '@/shared/config/original/battingPatterns'
import { D_LEVEL, D_LEVEL_RAW } from '@/shared/config/original/dLevel'
import { magicPitchRecord, magicPitchRecordIndex } from '@/shared/config/original/pitchRecords'
import { MISSIONS, MISSION_AIM_SHAKES } from '@/shared/config/original/missions'

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

  /**
   * ⚠️ 예전에는 **육성 선수용 기술 이름**(`BATTER_BURSTS`·`PITCHER_BURSTS`, StrCOMMON 25~35)에서
   * 온다고 못박고 있어 메디카가 "파워 스윙" 인 것을 지켜 주고 있었다.
   * 마선수 기술은 다른 구간이다 — 마타자 `StrCOMMON[0x5f+n]` = 100~104 ·
   * 마투수 `[0x5a+n]` = 95~99 (H2 6절·4-1 확정).
   */
  it('마선수 필살기는 **마선수 전용 이름**이다 — 육성 기술 이름이 아니다', () => {
    const 마타자 = ['핑크 봄', '플레임 스트라이커', '메이든 임팩트', '하트 브레이커', '크로스 액스']
    const 마투수 = ['싸이킥 스타', '트리플 크로우', '홀로그램 레이저', '다크 일루전', '브레스 웨폰']

    expect(ACE_PLAYERS.filter((ace) => ace.role === '타자').map((ace) => ace.burst)).toEqual(마타자)
    expect(ACE_PLAYERS.filter((ace) => ace.role === '투수').map((ace) => ace.burst)).toEqual(마투수)

    // 육성 기술 이름은 여전히 그쪽 목록이다 (필살타법 창이 쓴다)
    for (const ace of ACE_PLAYERS) {
      const 육성목록 = ace.role === '타자' ? BATTER_BURSTS : PITCHER_BURSTS
      expect(육성목록, `${ace.name} 의 ${ace.burst} 가 육성 목록에 있으면 안 된다`).not.toContain(ace.burst)
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

describe('CPU 타자 행동 확률표 (battingPattern.arr)', () => {
  it('72행이고 치기·번트·지켜보기 합이 늘 100이다', () => {
    expect(BATTING_PATTERNS).toHaveLength(72)
    for (const row of BATTING_PATTERNS) {
      expect(row[3] + row[4] + row[5], `행 ${row}`).toBe(100)
    }
  })

  it('주자열은 주자 없음 3 · 2사 2 · 그 밖 1 이다 (0x9f190)', () => {
    expect(battingPatternRunnerColumn(0, false)).toBe(3)
    expect(battingPatternRunnerColumn(2, true)).toBe(2)
    expect(battingPatternRunnerColumn(1, true)).toBe(1)
  })

  it('원본 행을 그대로 찾아온다 — 2스트라이크면 번트를 안 댄다', () => {
    // 0-0, 무사, 주자 있음 = 행 0 [0,0,0, 65,3,32, 1]
    expect(battingPatternOdds(0, 0, 0, true)).toEqual({ swing: 65, bunt: 3, take: 32 })
    // 2스트라이크 3볼, 무사, 주자 없음 = 행 47 [2,3,0, 85,0,15, 3]
    expect(battingPatternOdds(2, 3, 0, false)).toEqual({ swing: 85, bunt: 0, take: 15 })
    // 번트는 주자 없음 열 0-0 에서 가장 흔하다 (행 36 = 60/10/30)
    expect(battingPatternOdds(0, 0, 0, false)).toEqual({ swing: 60, bunt: 10, take: 30 })
  })

  it('뽑기는 rand(0,100) 한 번이다 (0x9f224)', () => {
    const odds = { swing: 60, bunt: 10, take: 30 }

    expect(battingPatternChoiceOf(odds, 0)).toBe('치기')
    expect(battingPatternChoiceOf(odds, 59)).toBe('치기')
    expect(battingPatternChoiceOf(odds, 60)).toBe('번트')
    expect(battingPatternChoiceOf(odds, 69)).toBe('번트')
    expect(battingPatternChoiceOf(odds, 70)).toBe('지켜보기')
  })
})

describe('경기 밸런스 표 (d_level.dat)', () => {
  it('파일 488바이트를 통째로 읽어 둔다', () => {
    expect(D_LEVEL_RAW).toHaveLength(488)
  })

  it('폴백 0xb6f28 로 확인된 수비 설정이 그대로다', () => {
    expect(D_LEVEL.fielding.throwSpeedBase).toBe(940)
    expect(D_LEVEL.fielding.movePerGrade).toBe(3)
    expect(D_LEVEL.fielding.throwSpeedPerGrade).toBe(8)
    expect(D_LEVEL.fielding.errorBase).toBe(2)
    expect(D_LEVEL.fielding.runSpeed).toBe(220)
    expect(D_LEVEL.fielding.relayDistance).toBe(17_000)
  })

  it('타격 판정 값이 손으로 옮겨 적던 값과 같다 (balance.json)', async () => {
    const { BALANCE } = await import('@/shared/config/original/balance')

    expect(D_LEVEL.swing.aceFormula).toEqual(BALANCE.swing.aceFormula)
    expect(D_LEVEL.swing.normalFormula).toEqual(BALANCE.swing.normalFormula)
    expect(D_LEVEL.swing.pitchGradeMultipliers).toEqual(BALANCE.swing.pitchGradeMultipliers)
    expect(D_LEVEL.swing.aceBonus).toEqual(BALANCE.swing.aceBonus)
    expect(D_LEVEL.swingTiming).toEqual({
      floor: BALANCE.quickAtBat.powerScale.minimum,
      scale: BALANCE.quickAtBat.powerScale.maximumValue,
    })
  })

  it('필살타법·마구 보정이 H2 표(150·180·200·220)와 같다', () => {
    expect(D_LEVEL.boost.burstBatterHit).toEqual([150, 180, 200, 220])
    expect(D_LEVEL.boost.burstBatterSolidPercent).toEqual([15, 17, 19, 20])
    expect(D_LEVEL.boost.magicPitchSolidPercent).toEqual([10, 12, 14, 15])
    // 마선수는 레벨×5 + 순번 이라 다섯 명 값이 같다 — Lv0 다섯 칸이 모두 150
    expect(D_LEVEL.boost.aceBatterHit.slice(0, 5)).toEqual([150, 150, 150, 150, 150])
    expect(D_LEVEL.boost.aceBatterHit.slice(20, 25)).toEqual([220, 220, 220, 220, 220])
  })

  it('투수 교체 확률이 45·35·50·60·60·30 이다 (0xac360)', () => {
    expect(D_LEVEL.reliefChances).toEqual([45, 35, 50, 60, 60, 30])
  })
})

describe('마구 레코드 고르기 (0x9e944)', () => {
  it('육성·일반 마구는 3(m−1) + 폼/2 다 — 홀수 폼은 하나 내린다', () => {
    expect(magicPitchRecordIndex(1, 0)).toBe(0)
    expect(magicPitchRecordIndex(1, 1)).toBe(0)
    expect(magicPitchRecordIndex(1, 3)).toBe(1)
    expect(magicPitchRecordIndex(2, 0)).toBe(3)
    expect(magicPitchRecordIndex(3, 4)).toBe(8)
    expect(magicPitchRecordIndex(4, 4)).toBe(11)
  })

  it('마투수는 m + 7 이다 (싸이커 12 ~ 드래고나 16)', () => {
    expect(magicPitchRecordIndex(5, 6)).toBe(12)
    expect(magicPitchRecordIndex(9, 10)).toBe(16)
  })

  it('고른 레코드의 비행 틱이 H2 3-5 표와 같다', () => {
    expect(magicPitchRecord(1, 0)).toMatchObject({ curve: 0, frames: 22, form: 0 })
    expect(magicPitchRecord(2, 0)).toMatchObject({ curve: 1, frames: 42 })
    expect(magicPitchRecord(3, 0)).toMatchObject({ curve: 1, frames: 16 })
    // 마구 4 는 폼에 따라 샤이닝(24) · 캐넌(24) · 미라지(34) 로 갈린다
    expect(magicPitchRecord(4, 0)?.frames).toBe(24)
    expect(magicPitchRecord(4, 4)?.frames).toBe(34)
    expect(magicPitchRecord(5, 6)?.frames).toBe(40)
    expect(magicPitchRecord(9, 10)?.frames).toBe(38)
  })
})

describe('미션 조건코드 = 투수 미션 조준점 흔들림 세기 (0x39c5c)', () => {
  it('타자편은 모두 0 이고 투수편만 1~3 을 쓴다', () => {
    const 타자 = MISSIONS.filter((mission) => mission.side === '타자')
    const 투수 = MISSIONS.filter((mission) => mission.side === '투수')

    expect(타자.every((mission) => mission.conditionCode === 0)).toBe(true)
    expect(new Set(투수.map((mission) => mission.conditionCode))).toEqual(new Set([0, 1, 2, 3]))
  })

  it('원본이 흔들림을 붙인 미션 다섯 개가 그대로다 (E-7)', () => {
    const 세기 = (id: number) =>
      MISSIONS.find((mission) => mission.side === '투수' && mission.id === id)?.conditionCode

    expect(세기(4)).toBe(1)
    expect(세기(5)).toBe(1)
    expect(세기(8)).toBe(2)
    expect(세기(12)).toBe(2)
    expect(세기(10)).toBe(3)
  })

  it('세기 1~3 의 흔들림 폭이 디스어셈과 같다', () => {
    expect(MISSION_AIM_SHAKES[0]).toBeNull()
    expect(MISSION_AIM_SHAKES[1]).toEqual({ chancePercent: 50, shakeX: 40, shakeY: 0, teleport: false })
    expect(MISSION_AIM_SHAKES[2]).toEqual({ chancePercent: 50, shakeX: 80, shakeY: 80, teleport: false })
    expect(MISSION_AIM_SHAKES[3]).toEqual({ chancePercent: 50, shakeX: 600, shakeY: 400, teleport: true })
  })
})
