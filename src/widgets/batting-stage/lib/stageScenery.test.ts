import { describe, expect, it } from 'vitest'
import { describeResolution } from '@/widgets/batting-stage/lib/stageText'
import {
  CLOUD_WRAP_WIDTH,
  PITCHER_OVERLAY_FRAME_OFFSET,
  PITCHER_RELEASE_TICKS,
  cloudPaletteRowOf,
  cloudScrollAt,
  LOADING_CLOUD_CALLS,
  isCloudVisible,
  isSkyLightModeShown,
  skyLightFrameAt,
  skyLightPaletteRowOf,
  stadiumSkyRowOf,
  judgeAnimationOf,
  judgeFrameAt,
  pitcherFrameAt,
  resultBackdropOffsetAt,
  pitcherAnimationAt,
  pitcherPoseOf,
  pitcherReleaseTicksOf,
  pitchLastStepOf,
  pitchStepAt,
  PITCHER_IDLE_TICKS,
  skyColorsOf,
  skyColumnOfInning,
  teamIconOf,
} from '@/widgets/batting-stage/lib/stageScenery'

describe('하늘 — 0x77fe8 (표 0xd37a4 · 0xd37f2)', () => {
  it('하늘 칸은 경기 상태 +0x6b(0부터 세는 이닝) — 1회가 칸 0 (0x3ad22 → 구장 +0x18)', () => {
    expect(skyColumnOfInning(1)).toBe(0)
    expect(skyColumnOfInning(9)).toBe(8)
    expect(skyColorsOf(0, skyColumnOfInning(1))).toEqual(skyColorsOf(0, 0))
  })

  it('행 0 · 칸 1 은 #4089be → 흰색, 이닝이 갈수록 어두워진다', () => {
    expect(skyColorsOf(0, 1)).toEqual({ top: 'rgb(64, 137, 190)', bottom: 'rgb(255, 255, 255)', colorIndex: 0 })
    expect(skyColorsOf(0, 12).colorIndex).toBe(8)
    expect(skyColorsOf(1, 20).colorIndex).toBe(9)
  })

  it('열은 min(칸, 12), 행은 0~5 로 자른다', () => {
    expect(skyColorsOf(9, 99)).toEqual(skyColorsOf(5, 12))
  })
})

describe('구름 — 0x78448', () => {
  it('3틱마다 구름 i 가 i+1 px 씩 왼쪽으로, −480 을 넘으면 되감긴다', () => {
    expect([0, 2, 3, 6].map((tick) => cloudScrollAt(0, tick))).toEqual([0, 0, -1, -2])
    expect(cloudScrollAt(2, 3)).toBe(-3)
    expect(cloudScrollAt(2, 3 * 161)).toBe(-483 + CLOUD_WRAP_WIDTH)
  })

  it('−480 은 "미만" 이 아니라 그대로 남고, 한 번 돈 뒤로는 0 대신 −480 에 선다 (7846c bge)', () => {
    expect(cloudScrollAt(0, 3 * 480)).toBe(-480)
    expect(cloudScrollAt(0, 3 * 481)).toBe(-1)
    expect(cloudScrollAt(1, 3 * 240)).toBe(-480)
    expect(cloudScrollAt(1, 3 * 241)).toBe(-2)
  })

  it('로딩 판은 상태 9 가 0 으로 둔 뒤 상태 8 두 그림에서 센다 — 다음 첫 그림이 세 번째 부름(한 칸)', () => {
    expect(LOADING_CLOUD_CALLS).toBe(2)
    expect(cloudScrollAt(0, LOADING_CLOUD_CALLS)).toBe(0)
    expect(cloudScrollAt(0, LOADING_CLOUD_CALLS + 1)).toBe(-1)
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

  it('대기 동작(상태 2)은 [0,19,0,19] 를 유지 [1,1,3,4]+1 로 한 바퀴만 하고 선 자세(상태 0)로 돌아온다 — 0x9e004 단계 > 3', () => {
    const poseAt = (idleTick: number, form = 0) => pitcherPoseOf(pitcherAnimationAt({ pitchTick: null, idleTick }), form)
    expect([0, 1, 2, 3, 4, 7, 8, 12].map((tick) => poseAt(tick))).toEqual([0, 0, 19, 19, 0, 0, 19, 19])
    expect(PITCHER_IDLE_TICKS).toBe(13)
    expect(pitcherAnimationAt({ pitchTick: null, idleTick: 13 })).toEqual({ state: 0, step: 0 })
    // 상태 0 은 폼 표의 단계 0 — 폼 2·3 은 1, 4·5 는 2 (대기 동작의 0 과 다르다)
    expect([poseAt(13, 2), poseAt(99, 4), poseAt(0, 2)]).toEqual([1, 2, 0])
  })

  it('0x9e004 는 0xf · 0x11 갱신에서만 — 0x11 이 끝나면 단계가 굳고, 0xf 를 떠나면 대기 동작도 굳는다', () => {
    // 0x11 이 틱 15 에 끝나면(공이 빨리 닿음) 단계 10 에 머문다
    expect(pitcherAnimationAt({ pitchTick: 40, pitchEndTick: 15 })).toEqual({ state: 1, step: 10 })
    expect(pitcherAnimationAt({ pitchTick: 12, pitchEndTick: null })).toEqual({ state: 1, step: 7 })
    // 빈 칸 키 뒤 틱 3 에 0x10 으로 가면 단계 1(자세 19)에 굳어 선 자세로 안 돌아온다
    expect(pitcherAnimationAt({ pitchTick: null, idleTick: 50, idleEndTick: 3 })).toEqual({ state: 2, step: 1 })
    // 한 바퀴를 다 돈 뒤 굳으면 상태 0
    expect(pitcherAnimationAt({ pitchTick: null, idleTick: 50, idleEndTick: 13 })).toEqual({ state: 0, step: 0 })
  })

  it('상태 걸기 사건이 없으면 상태 0 · 투구 틱이 있으면 상태 1 이고 마지막 단계에 머문다', () => {
    expect(pitcherAnimationAt({ pitchTick: null })).toEqual({ state: 0, step: 0 })
    expect(pitcherAnimationAt({ pitchTick: 999, idleTick: 3 })).toEqual({ state: 1, step: 13 })
  })

  it('마투수 — 유지 0xd73fa · 프레임 0xd7483 · 마지막 0xd744f · 놓는 단계 0xcfbe4', () => {
    expect([0, 1, 2, 3, 4].map(pitchLastStepOf)).toEqual([12, 14, 12, 15, 12])
    expect(pitchLastStepOf(null)).toBe(13)
    // 싸이커: 단계 0 이 5틱, 단계 1~5 가 3틱씩 → 단계 6 은 틱 20
    expect([0, 4, 5, 8, 20].map((tick) => pitchStepAt(tick, 0))).toEqual([0, 0, 1, 2, 6])
    expect([0, 1, 2, 3, 4].map(pitcherReleaseTicksOf)).toEqual([20, 23, 20, 32, 24])
    // 싸이커 단계 7 · 8 은 프레임 16 · 17, 마지막(12)은 14 — 표의 15 는 안 나온다
    expect([7, 8, 12].map((step) => pitcherPoseOf({ state: 1, step }, 0, 0))).toEqual([16, 17, 14])
    expect(pitcherPoseOf(pitcherAnimationAt({ pitchTick: 999 }, 0), 0, 0)).toBe(14)
    // 마투수의 상태 2 는 0, 상태 0 은 표 줄의 단계 0
    expect(pitcherPoseOf({ state: 2, step: 1 }, 0, 3)).toBe(0)
    expect(pitcherPoseOf({ state: 0, step: 0 }, 0, 3)).toBe(0)
  })

  it('덧그림은 프레임 f+22 다 — 0x79662 `adds r3,r6,#0x16`', () => {
    expect(PITCHER_OVERLAY_FRAME_OFFSET).toBe(22)
    // 와인드업 3~6 의 몸통은 25~28, 대기 0~2 의 글러브 안 공은 22~24 에 들어 있다
    expect([3, 4, 5, 6].map((frame) => frame + PITCHER_OVERLAY_FRAME_OFFSET)).toEqual([25, 26, 27, 28])
    expect(pitcherPoseOf({ state: 2, step: 0 }, 0) + PITCHER_OVERLAY_FRAME_OFFSET).toBe(22)
  })
})

describe('판정 글자 — game_judge 애니 (0x39504)', () => {
  it('종류 → 애니 번호', () => {
    expect(['스트라이크', '헛스윙', '볼', '파울', '아웃', '볼넷', '삼진', '몸에 맞는 공'].map(judgeAnimationOf)).toEqual([0, 0, 3, 4, 1, 6, 9, 7])
    expect(judgeAnimationOf('홈런!')).toBeNull()
    // 홈런(판정 v = 8 · 12)은 0x393b4 의 표 0xcfe90 이 0x394d6 으로 건너뛴다 — 글자 대신 HOMERUN 연출이다
    expect(
      describeResolution({ batterHand: 0, resolution: { kind: '타구', outcome: { kind: '홈런' } }, hasSwung: true, isBunt: false, resultCode: 24 }),
    ).toBe('')
    // 사구 판정 문구가 애니 7 로 이어진다 (판정 v4)
    expect(
      judgeAnimationOf(
        describeResolution({ batterHand: 0, resolution: { kind: '사구' }, hasSwung: false, isBunt: false, resultCode: null }),
      ),
    ).toBe(7)
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

describe('하늘 그림 팔레트 줄 — 0x76fd0', () => {
  it('구름은 줄 v − 1, v = 0 이면 구운 벌 (attack_sky_cloud 8벌 = v 1~8)', () => {
    expect([0, 1, 5, 8].map(cloudPaletteRowOf)).toEqual([null, 0, 4, 7])
  })

  it('조명은 v ≤ 1 이면 구운 벌, 아니면 줄 v − 2 (sky_effect_light 6벌 = v 2~7)', () => {
    expect([0, 1, 2, 7].map(skyLightPaletteRowOf)).toEqual([null, null, 0, 5])
  })

  it('조명 애니는 되풀이다 — 0x93cfc(애니, 1)', () => {
    const entries = [
      { frame: 0, delay: 2 },
      { frame: 1, delay: 0 },
      { frame: 2, delay: 1 },
    ]
    // 칸 길이 max(1, 지연) = 2 · 1 · 1 → 4틱에 한 바퀴
    expect([0, 1, 2, 3, 4, 5, 6].map((tick) => skyLightFrameAt(entries, tick))).toEqual([0, 0, 1, 2, 0, 0, 1])
  })
})

describe('하늘 조명 모드 검사 — 0x784a2~0x784b0', () => {
  it('모드 5(투수 미션)·6(타자 미션)·7(홈런더비)이면 안 그린다', () => {
    expect([5, 6, 7].map(isSkyLightModeShown)).toEqual([false, false, false])
  })

  it('그 밖의 모드(일반 1·시즌 2·나리 3·4·대전 8·9)와 모드를 모를 때는 그린다', () => {
    expect([1, 2, 3, 4, 8, 9, undefined].map(isSkyLightModeShown)).toEqual([true, true, true, true, true, true, true])
  })
})

describe('결과 창 뒤 구장 밀기 — +0x17e2 (진입 0x4f574 = 0 · 갱신 0x3c0b8 += 5, 150 상한)', () => {
  it('들어선 틱의 그림부터 5 이고 틱마다 5 씩 오른다', () => {
    expect(resultBackdropOffsetAt(0)).toBe(5)
    expect(resultBackdropOffsetAt(1)).toBe(10)
    expect(resultBackdropOffsetAt(28)).toBe(145)
  })

  it('150 에서 멈춘다', () => {
    expect(resultBackdropOffsetAt(29)).toBe(150)
    expect(resultBackdropOffsetAt(1_000)).toBe(150)
  })
})

describe('하늘 줄 — 구장 +0x10 (0x783b0)', () => {
  it('모드 2 · 3 · 4 는 리그 날짜 g(+0xb2) mod 6, 모드 1 · 8 · 9 는 측 0 팀 번호 mod 6 — 굴림이 없다', () => {
    expect(stadiumSkyRowOf({ mode: 4, dayCounter: 0 })).toBe(0)
    expect(stadiumSkyRowOf({ mode: 4, dayCounter: 13 })).toBe(1)
    expect(stadiumSkyRowOf({ mode: 3, dayCounter: 41 })).toBe(5)
    expect(stadiumSkyRowOf({ mode: 2, dayCounter: 6 })).toBe(0)
    expect(stadiumSkyRowOf({ mode: 1, side0TeamId: 9 })).toBe(3)
    expect(stadiumSkyRowOf({ mode: 8, side0TeamId: 4 })).toBe(4)
  })

  it('모드 0 은 0x39fdc(3a066~3a072)가 전역 모드를 1 로 바꿔 모드 1 갈래 — 측 0 팀 mod 6, 굴림 없음', () => {
    expect(stadiumSkyRowOf({ mode: 0, side0TeamId: 9 })).toBe(3)
    expect(stadiumSkyRowOf({ mode: 0, dayCounter: 3, side0TeamId: 2 })).toBe(stadiumSkyRowOf({ mode: 1, side0TeamId: 2 }))
  })

  it('모드 5 · 6 · 7 은 rand(0, 6) — 부르는 쪽이 굴린다(null)', () => {
    for (const mode of [5, 6, 7]) expect(stadiumSkyRowOf({ mode, dayCounter: 3, side0TeamId: 2 })).toBeNull()
  })
})
