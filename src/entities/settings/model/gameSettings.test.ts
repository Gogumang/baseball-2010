import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  PITCH_CONTROLS,
  SPEED_LEVEL_COUNT,
} from '@/entities/settings/model/gameSettings'

describe('환경설정 값', () => {
  it('속도는 원본 표 다섯 단계, 투구는 기본/게이지 두 가지다 (StrMAINMENU[74][75])', () => {
    expect(SPEED_LEVEL_COUNT).toBe(5)
    expect(PITCH_CONTROLS).toEqual(['기본', '게이지'])
  })

  it('저장값이 깨졌으면 기본값으로 채운다', () => {
    expect(normalizeSettings({ speedLevel: 9, pitchControl: '엉뚱' })).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('올바른 저장값은 그대로 쓴다', () => {
    expect(normalizeSettings({ speedLevel: 4, pitchControl: '기본' })).toEqual({
      speedLevel: 4,
      pitchControl: '기본',
    })
  })
})
