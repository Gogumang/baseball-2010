import { describe, expect, it } from 'vitest'
import { derbyBattedBallOf, skipDerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { cameraBoundsOf, centerOn, screenOffsetOf, stepCamera, toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import {
  derbyFieldBallTickAt,
  derbyFieldShotsAt,
  derbyFieldTimelineOf,
  derbyFieldViewOf,
  type DerbyFieldInput,
} from '@/pages/home-run-derby/lib/derbyField'

/** 필드 배율 0xb94b5([+0x1f0] = 40000×32500 → 620×500)를 unicorn 으로 돌린 값 — [월드 x, z, 화면 x, y] (docs `_raw/verify/r274_emu_hit_path.py`) */
const FIELD_SCALE_EMULATED: readonly (readonly number[])[] = [
  [20000, 30000, 310, 461],
  [0, 0, 0, 0],
  [-7259, -2400, -112, -36],
  [40000, 32500, 620, 500],
  [12345, 6789, 191, 104],
  [-1, -1, 0, 0],
  [31, 65, 0, 1],
  [-12517, -11700, -194, -180],
  [3999, 1000, 61, 15],
]

/** 결과 24 의 큰 뜬공(플래그 & 2) 패턴 — 원본 패턴 표 그대로 */
const ZONE_PATTERN: BattedBallPattern = [118, 961, 1367, 2]
const inputOf = (pattern: BattedBallPattern, resultCode: number, extra: Partial<DerbyFieldInput> = {}): DerbyFieldInput => ({
  batted: derbyBattedBallOf(pattern),
  resultCode,
  isBigFlyPattern: (pattern[3] & 2) !== 0,
  watchesBigHit: false,
  ...extra,
})

describe('홈런더비 판 필드 화면 (A-01) — 필드 카메라 [+0x1e8] 는 2D 배율 0xb9481, 0xbe3d8 이 아니다', () => {
  it('배율 0xb94b5 — 웹 수비 화면 배율(toScreenX · toScreenY)과 unicorn 값이 같다', () => {
    for (const [wx, wz, sx, sy] of FIELD_SCALE_EMULATED) {
      // 0 쪽 자름의 −0 은 0 으로 본다
      expect([toScreenX(wx!) + 0, toScreenY(wz!) + 0]).toEqual([sx, sy])
    }
  })

  it('카메라 — 진입이 공 첫 점 (x, z) 로 곧바로 맞추고 같은 그림의 G1 부터 (x, z − y) 로 20% 따라간다. 관문이 닫히면 선다', () => {
    const input = inputOf(ZONE_PATTERN, 24)
    const { batted } = input
    const timeline = derbyFieldTimelineOf(input)
    const bounds = cameraBoundsOf(240, 320)
    const first = batted.trajectory.pointAt(0)
    const entry = centerOn(bounds, { x: first.x, z: first.z })
    expect(timeline.frames[0]!.camera).toEqual(stepCamera(bounds, entry, { x: first.x, z: first.z - first.y }))
    const close = batted.closeTick
    expect(timeline.frames[close]!.camera).toEqual(timeline.frames[close - 1]!.camera)
    expect(timeline.frames.at(-1)!.camera).toEqual(timeline.frames[close - 1]!.camera)
    expect(timeline.frames).toHaveLength(batted.endTicks + 1)
  })

  it('공 틱 — 진입 그림 0, 관문이 닫히면 그대로, 키로 건너뛰면 1000(0xbf01c)', () => {
    const batted = derbyBattedBallOf(ZONE_PATTERN)
    expect(derbyFieldBallTickAt(batted, 0)).toBe(0)
    expect(derbyFieldBallTickAt(batted, 5)).toBe(5)
    expect(derbyFieldBallTickAt(batted, batted.closeTick + 3)).toBe(batted.closeTick)
    const homeRunTick = batted.homeRunTicks[0]!
    const skipped = skipDerbyBattedBall(batted, homeRunTick + 1)
    expect(derbyFieldBallTickAt(skipped, homeRunTick)).toBe(homeRunTick)
    expect(derbyFieldBallTickAt(skipped, homeRunTick + 1)).toBe(1000)
  })

  it('이벤트 존 — 결과 24~26 · 플래그 & 2 · 높이 투영 ≤ 54 · 땅점 화면 y < 106 인 첫 그림에 (오프셋 + x 투영, 땅점 y)', () => {
    const input = inputOf(ZONE_PATTERN, 24)
    const timeline = derbyFieldTimelineOf(input)
    const zone = timeline.zone!
    expect(zone).not.toBeNull()
    const frame = timeline.frames[zone.tick]!
    const point = input.batted.trajectory.pointAt(frame.ballTick)
    const offset = screenOffsetOf(frame.camera)
    expect(toScreenY(point.y)).toBeLessThanOrEqual(0x36)
    expect(offset.y + toScreenY(point.z)).toBeLessThan(Math.trunc(320 / 3))
    expect(zone).toEqual({ tick: zone.tick, x: offset.x + toScreenX(point.x), y: Math.max(offset.y + toScreenY(point.z), 15) })
    // 앞 그림들은 조건이 안 맞았다
    for (let tick = 0; tick < zone.tick; tick += 1) {
      const before = timeline.frames[tick]!
      const at = input.batted.trajectory.pointAt(before.ballTick)
      const groundY = screenOffsetOf(before.camera).y + toScreenY(at.z)
      expect(before.ballTick === 0 || toScreenY(at.y) > 0x36 || groundY >= 106 || groundY < 1).toBe(true)
    }
  })

  it('결과 코드가 24~26 이 아니면(예: 18) 같은 패턴이라도 존이 없다 — 0x357e0 (예전 웹은 플래그만 봤다)', () => {
    expect(derbyFieldTimelineOf(inputOf(ZONE_PATTERN, 18)).zone).toBeNull()
    expect(derbyFieldTimelineOf(inputOf(ZONE_PATTERN, 26)).zone).not.toBeNull()
    expect(derbyFieldTimelineOf(inputOf([90, 815, 1592, 0], 24)).zone).toBeNull()
  })

  it('스냅샷 — 야수 아홉은 0xd86ec 에 선 자세, 칸 0 만 마투수 그림 · 주자 없음 · 진입 그림은 공을 안 그린다', () => {
    const input = inputOf(ZONE_PATTERN, 24)
    const timeline = derbyFieldTimelineOf(input)
    const start = derbyFieldViewOf(input, timeline, 0, { defenseTeamIndex: 3, acePitcherOrder: 1 })
    expect(start.ball.isPlaybackStart).toBe(true)
    expect(start.runners).toEqual([])
    expect(start.fielders.map((fielder) => [fielder.slot, fielder.action, fielder.aceIndex, fielder.teamIndex])).toEqual(
      Array.from({ length: 9 }, (_unused, slot) => [slot, 0, slot === 0 ? 1 : null, 3]),
    )
    expect(start.fielders[8]).toMatchObject({ x: 20000, z: 8000 })
    const flying = derbyFieldViewOf(input, timeline, 10, { defenseTeamIndex: 3, acePitcherOrder: null })
    const point = input.batted.trajectory.pointAt(10)
    expect(flying.ball).toMatchObject({ x: point.x, z: point.z, height: point.y, isPlaybackStart: false })
  })

  it('파티클 — 감상 플래그면 공 자리에 큰 타구(4, 10) 를 그림마다 · 진입 그림은 없다 (36f76)', () => {
    const input = inputOf(ZONE_PATTERN, 24, { watchesBigHit: true })
    const timeline = derbyFieldTimelineOf(input)
    expect(derbyFieldShotsAt(input, timeline, 0)).toEqual([])
    const frame = timeline.frames[3]!
    const point = input.batted.trajectory.pointAt(3)
    const offset = screenOffsetOf(frame.camera)
    expect(derbyFieldShotsAt(input, timeline, 3)).toEqual([
      { id: 4, img: 10, x: offset.x + toScreenX(point.x), y: offset.y + toScreenY(point.z) - toScreenY(point.y) },
    ])
    expect(derbyFieldShotsAt({ ...input, watchesBigHit: false }, timeline, 3)).toEqual([])
  })
})
