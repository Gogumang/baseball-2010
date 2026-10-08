import { describe, expect, it } from 'vitest'
import { rewardNoticeOf, rewardNoticeContextOf, seasonRewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import type { RewardNoticeContext } from '@/entities/story/model/rewardNotice'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 정해 둔 값을 차례로 내는 난수 — next() 를 몇 번 불렀는지 센다 */
const 난수 = (values: readonly number[]) => {
  let index = 0
  const random: RandomPort & { calls: () => number } = {
    next: () => values[index++] ?? 0,
    nextInRange: (minimum, maximum) => minimum + (values[index++] ?? 0) * (maximum - minimum),
    pick: (candidates) => candidates[Math.floor((values[index++] ?? 0) * candidates.length)],
    calls: () => index,
  }
  return random
}

const 맥락 = (patch: Partial<RewardNoticeContext> = {}): RewardNoticeContext => ({
  mode: 4, years: 0, illness: 0, salaryBase: 100, random: 난수([]), ...patch,
})

describe('rewardNoticeOf — 보상 알림 글 0x8beb8', () => {
  it('보통 종류는 "!C" + 이름 + (값 ≥ 0 이면 " +") + " " + 값, 둘째부터 "!N" 으로 잇는다', () => {
    const { notice } = rewardNoticeOf([{ kind: 0, value: 5 }, { kind: 1, value: -3 }, { kind: 10, value: 100 }], 1, 맥락())
    expect(notice).toEqual({ kind: '알림', text: '!C인기도 + 5!N!C평판 -3!N!CG포인트 + 100' })
  })

  it('능력치 13~16 은 모드로 이름이 옮겨 간다 — 타자 히트 · 투수 제구 · 시즌 투구', () => {
    const items = [{ kind: 13, value: 10 }]
    expect(rewardNoticeOf(items, 1, 맥락({ mode: 4 })).notice).toMatchObject({ text: '!C히트 + 10' })
    expect(rewardNoticeOf(items, 1, 맥락({ mode: 3 })).notice).toMatchObject({ text: '!C제구 + 10' })
    expect(rewardNoticeOf(items, 1, 맥락({ mode: 2 })).notice).toMatchObject({ text: '!C투구 + 10' })
  })

  it('소지금은 0x55cf4(|값 × 100|) + "만" — 음수는 부호가 빠진다(원본 그대로)', () => {
    expect(rewardNoticeOf([{ kind: 3, value: 10 }], 1, 맥락()).notice).toMatchObject({ text: '!C소지금 + 1000만' })
    expect(rewardNoticeOf([{ kind: 3, value: -5 }], 1, 맥락()).notice).toMatchObject({ text: '!C소지금 500만' })
    expect(rewardNoticeOf([{ kind: 3, value: 150 }], 1, 맥락()).notice).toMatchObject({ text: '!C소지금 + 1억5000만' })
  })

  it('타순 18 · 19 는 StrMODE[182] · [183] 만 — 앞 "!N" · "!C" 가 없다', () => {
    expect(rewardNoticeOf([{ kind: 1, value: 2 }, { kind: 19, value: 3 }], 1, 맥락()).notice).toMatchObject({
      text: '!C평판 + 2!C[!cFFFF003번 타자!cFFFFFF]가 되었습니다',
    })
    expect(rewardNoticeOf([{ kind: 18, value: 0 }], 1, 맥락()).notice).toMatchObject({
      text: '!C[!cFFFF004번 타자!cFFFFFF]를 목표로!N설정하였습니다',
    })
  })

  it('연봉 20 은 기준 r 에 값별 비율 — "연봉 (r × 100)만 결정!"', () => {
    expect(rewardNoticeOf([{ kind: 20, value: 0 }], 1, 맥락({ salaryBase: 33 })).notice)
      .toMatchObject({ text: '!C연봉 4200만 결정!' })
    expect(rewardNoticeOf([{ kind: 20, value: 3 }, { kind: 1, value: -30 }], 387, 맥락({ salaryBase: 33 })).notice)
      .toMatchObject({ text: '!C연봉 2700만 결정!!N!C평판 -30' })
  })

  it('첫 종류 4 는 스킬 창 — 스킬 이름(0x8457c) 과 획득 · 제거', () => {
    expect(rewardNoticeOf([{ kind: 4, value: 7 }], 1, 맥락()).notice).toEqual({
      kind: '스킬', gained: true, text: '!C!cFFFF00"행운"!cFFFFFF!N !N스킬을 획득하였습니다.',
    })
    expect(rewardNoticeOf([{ kind: 4, value: -5 }], 1, 맥락()).notice).toEqual({
      kind: '스킬', gained: false, text: '!C!cFFFF00"유리몸"!cFFFFFF!N !N스킬이 제거되었습니다.',
    })
    // 스킬 > 7 은 모드 4 가 아니면 +16 (StrCOMMON[71 + s])
    expect(rewardNoticeOf([{ kind: 4, value: 9 }], 1, 맥락({ mode: 3 })).notice).toMatchObject({ text: expect.stringContaining('"신선함"') })
  })

  it('GP 아이템 9 — 타자편 값 10 은 이글아이, 투수편은 십전대보탕', () => {
    expect(rewardNoticeOf([{ kind: 9, value: 10 }], 36, 맥락({ mode: 4 })).notice)
      .toMatchObject({ text: '!C아이템 획득!N[!cFFFF00이글아이!cFFFFFF]' })
    expect(rewardNoticeOf([{ kind: 9, value: 10 }], 36, 맥락({ mode: 3 })).notice)
      .toMatchObject({ text: '!C아이템 획득!N[!cFFFF00십전대보탕!cFFFFFF]' })
  })

  it('구질 6 은 StrMODE[222] 에 [0x140026c] 이름 — 값 0 GYRO · 1 P.SINKER', () => {
    expect(rewardNoticeOf([{ kind: 6, value: 1 }], 30, 맥락({ mode: 3 })).notice)
      .toMatchObject({ text: expect.stringContaining('[!cFFFF00P.SINKER!cFFFFFF]') })
  })

  it('질병 11 값 ≥ 0 은 글에서 굴리고(0xbfa55(0, 4)) 값을 r + 1 로 고친다 — 주는 쪽은 다시 안 굴린다', () => {
    const random = 난수([0.6])
    const result = rewardNoticeOf([{ kind: 11, value: 0 }], 490, 맥락({ random }))
    expect(result.notice).toMatchObject({ text: '!C!C다음 질병이 발생했습니다!N[!cFFFF00식중독!cFFFFFF]' })
    expect(result.items).toEqual([{ kind: 11, value: 3 }])
    expect(random.calls()).toBe(1)
    const after = applyEventRewards(createCareer('테스트'), result.items, random)
    expect(after.illnessName).toBe('식중독')
    expect(random.calls()).toBe(1)
  })

  it('질병 11 음수는 지금 질병 이름으로 치료 글 (굴림 없음)', () => {
    const random = 난수([])
    expect(rewardNoticeOf([{ kind: 11, value: -1 }], 1, 맥락({ illness: 4, random })).notice)
      .toMatchObject({ text: '!C!C다음 질병이 치료되었습니다!N[!cFFFF00배탈!cFFFFFF]' })
    expect(random.calls()).toBe(0)
  })

  it('연차 보정(393~396)은 글에만 — 돌려주는 항목은 그대로 (applyEventRewards 가 다시 보정)', () => {
    const items = [{ kind: 0, value: 10 }, { kind: 1, value: 10 }, { kind: 3, value: 1 }]
    const result = rewardNoticeOf(items, 393, 맥락({ years: 2 }))
    expect(result.notice).toMatchObject({ text: '!C인기도 + 16!N!C평판 + 6!N!C소지금 + 300만' })
    expect(result.items).toEqual(items)
    expect(rewardNoticeOf([{ kind: 0, value: 10 }], 396, 맥락({ years: 1, mode: 2 })).notice).toMatchObject({ text: '!C인기도 + 0' })
  })

  it('첫 종류 7 은 창 없음 · 21 은 엔딩 (0x8d4c4 · 0x8d70e)', () => {
    expect(rewardNoticeOf([{ kind: 7, value: 3 }], 1, 맥락()).notice).toEqual({ kind: '없음' })
    expect(rewardNoticeOf([{ kind: 21, value: 0 }], 500, 맥락()).notice).toEqual({ kind: '엔딩' })
  })
})

describe('rewardNoticeContextOf — 나리 선수 칸', () => {
  it('연차 y = 연차 − 1 · 지금 질병 번호 · 연봉 기준 0xa39fc + 연봉', () => {
    const career = { ...createCareer('테스트'), season: 3, isSick: true, illnessName: '몸살', salary: 30, popularity: 50, popularityAtSeasonStart: 10 }
    const context = rewardNoticeContextOf(career, 4, createSeededRandom(1))
    expect(context).toMatchObject({ mode: 4, years: 2, illness: 2, salaryBase: 40 })
  })
})

describe('seasonRewardNoticeContextOf — 시즌모드(모드 2) 알림 맥락', () => {
  it('393 은 모드 2 연차 보정(+5y)을 글에 얹고 항목은 그대로 돌려준다 (0x8d508)', () => {
    const ctx = seasonRewardNoticeContextOf({ yearIndex: 2, illness: 0 }, 난수([]))
    expect(ctx.mode).toBe(2)
    const result = rewardNoticeOf([{ kind: 0, value: 25 }, { kind: 3, value: 35 }], 393, ctx)
    expect(result.notice).toEqual({ kind: '알림', text: '!C인기도 + 35!N!C소지금 + 4500만' })
    expect(result.items).toEqual([{ kind: 0, value: 25 }, { kind: 3, value: 35 }])
  })

  it('490 질병은 글이 0xbfa55(0, 4) 를 한 번 굴려 값 r + 1 로 고친다 — 음수는 지금 질병 SR+5 이름', () => {
    const random = 난수([0.6])
    const result = rewardNoticeOf([{ kind: 11, value: 0 }], 490, seasonRewardNoticeContextOf({ yearIndex: 0, illness: 0 }, random))
    expect(result.items).toEqual([{ kind: 11, value: 3 }])
    expect(random.calls()).toBe(1)
  })
})

