import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { isBallInEventZone, isEventZoneHit } from '@/entities/home-run-derby/model/eventZone'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 큰뜬공: BattedBallPattern = [118, 961, 1367, 2]
const 존밖 = { x: 200, y: 40 }
const 왼쪽칸 = { x: 60, y: 30 }
const 오른쪽칸 = { x: 540, y: 80 }

describe('B-32 홈런더비 이벤트 존이 적중을 안 보고 200G (0x372d4~0x372f6)', () => {
  it('존 그림 두 칸(필드 오프셋 기준 (51,16) 70×66 · (499,16) 70×66) 판정', () => {
    expect(isBallInEventZone(왼쪽칸)).toBe(true)
    expect(isBallInEventZone(오른쪽칸)).toBe(true)
    expect(isBallInEventZone(존밖)).toBe(false)
    expect(isBallInEventZone({ x: 121, y: 30 })).toBe(false)
    expect(isBallInEventZone({ x: 60, y: 82 })).toBe(false)
  })

  it('원본: 공 자리를 받아도 조건만 맞으면 적중', () => {
    expect(isEventZoneHit({ pattern: 큰뜬공, ballFieldPoint: 존밖 })).toBe(true)
  })

  it('고침: 공 자리가 존 칸 안이어야 적중 — 자리를 모르면(이식판 더비, A-01 전) 원본대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-32']))
    expect(isEventZoneHit({ pattern: 큰뜬공, ballFieldPoint: 존밖 })).toBe(false)
    expect(isEventZoneHit({ pattern: 큰뜬공, ballFieldPoint: 왼쪽칸 })).toBe(true)
    expect(isEventZoneHit({ pattern: 큰뜬공 })).toBe(true)
    expect(isEventZoneHit({ pattern: [90, 815, 1592, 0], ballFieldPoint: 왼쪽칸 })).toBe(false)
  })
})
