import { describe, expect, it } from 'vitest'
import {
  CLOUD_WRAP_WIDTH,
  PITCHER_RELEASE_TICKS,
  cloudScrollAt,
  isCloudVisible,
  judgeAnimationOf,
  judgeFrameAt,
  pitcherFrameAt,
  pitcherIdleFrameAt,
  skyColorsOf,
  teamIconOf,
} from '@/widgets/batting-stage/lib/stageScenery'

describe('하늘 — 0x77fe8 (표 0xd37a4 · 0xd37f2)', () => {
  it('행 0 · 1회는 #4089be → 흰색, 이닝이 갈수록 어두워진다', () => {
    expect(skyColorsOf(0, 1)).toEqual({ top: 'rgb(64, 137, 190)', bottom: 'rgb(255, 255, 255)', colorIndex: 0 })
    expect(skyColorsOf(0, 12).colorIndex).toBe(8)
    expect(skyColorsOf(1, 20).colorIndex).toBe(9)
  })

  it('열은 min(이닝, 12), 행은 0~5 로 자른다', () => {
    expect(skyColorsOf(9, 99)).toEqual(skyColorsOf(5, 12))
  })
})

describe('구름 — 0x78448', () => {
  it('3틱마다 구름 i 가 i+1 px 씩 왼쪽으로, −480 을 넘으면 되감긴다', () => {
    expect([0, 2, 3, 6].map((tick) => cloudScrollAt(0, tick))).toEqual([0, 0, -1, -2])
    expect(cloudScrollAt(2, 3)).toBe(-3)
    expect(cloudScrollAt(2, 3 * 161)).toBe(-483 + CLOUD_WRAP_WIDTH)
  })

  it('색 번호 9(밤)에는 구름을 그리지 않는다', () => {
    expect([isCloudVisible(8), isCloudVisible(9)]).toEqual([true, false])
  })
})

describe('투수 투구 — 0x9e0b8 (단계 표 · 유지 dur+1)', () => {
  it('폼 0 은 [0,3,4,…] 이고 단계 0 은 2틱, 단계 1 은 3틱 유지한다', () => {
    expect([0, 1, 2, 4, 5].map((tick) => pitcherFrameAt(0, tick))).toEqual([0, 0, 3, 3, 4])
  })

  it('폼 2 는 첫 칸과 6·7 단계가 다르다', () => {
    expect(pitcherFrameAt(2, 0)).toBe(1)
    expect(pitcherFrameAt(2, PITCHER_RELEASE_TICKS)).toBe(15)
  })

  it('단계 6 에 닿는 틱이 릴리스다 — 단계 0~5 유지 합 2+3+2+2+1+1 (추정: 공은 단계 6 부터 난다)', () => {
    expect(PITCHER_RELEASE_TICKS).toBe(11)
    expect(pitcherFrameAt(0, PITCHER_RELEASE_TICKS)).toBe(8)
  })

  it('마지막 단계 13 에서 멈춘다', () => {
    expect(pitcherFrameAt(0, 999)).toBe(14)
  })

  it('대기 [0,19,0,19,0] 유지 [1,1,3,4,4]+1 을 되풀이한다 (추정: 반복)', () => {
    expect([0, 1, 2, 3, 4].map(pitcherIdleFrameAt)).toEqual([0, 0, 19, 19, 0])
  })
})

describe('판정 글자 — game_judge 애니 (0x39504)', () => {
  it('종류 → 애니 번호', () => {
    expect(['스트라이크', '헛스윙', '볼', '파울', '아웃', '볼넷', '삼진', '몸에 맞는 공'].map(judgeAnimationOf)).toEqual([0, 0, 3, 4, 1, 6, 9, 7])
    expect(judgeAnimationOf('홈런!')).toBeNull()
  })
})

describe('판정 글자 재생 — 한 번만 돈다', () => {
  const 표 = [{ frame: 18, delay: 2 }, { frame: 19, delay: 1 }, { frame: 39, delay: 0 }]

  it('지연만큼 머물고 끝나면 마지막(빈 그림 39)에 멈춘다', () => {
    expect([0, 1, 2, 3, 50].map((tick) => judgeFrameAt(표, tick))).toEqual([18, 18, 19, 39, 39])
  })

  it('칸 길이는 max(1, 지연 + 보정) 이다 — 보정이 없으면 0 으로 본다 (0x93d90)', () => {
    const 보정있음 = [{ frame: 18, delay: 2, correction: 3 }, { frame: 39, delay: 0 }]
    // 첫 칸 길이 = max(1, 2+3) = 5 → 틱 0~4 는 18, 틱 5 부터 39
    expect([0, 4, 5].map((tick) => judgeFrameAt(보정있음, tick))).toEqual([18, 18, 39])

    const 음의보정 = [{ frame: 18, delay: 2, correction: -5 }, { frame: 39, delay: 0 }]
    // 첫 칸 길이 = max(1, 2-5) = 1 (0 밑으로는 못 내려간다) → 틱 0 만 18, 틱 1 부터 39
    expect([0, 1].map((tick) => judgeFrameAt(음의보정, tick))).toEqual([18, 39])
  })
})

describe('펜스 팀 아이콘 — team_s_icon', () => {
  it('팀 번호 그대로, 14 는 10, 10 이상은 11', () => {
    expect([0, 9, 10, 14].map(teamIconOf)).toEqual([0, 9, 11, 10])
  })
})
