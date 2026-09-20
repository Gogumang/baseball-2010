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
    expect(normalizeSettings({ speedLevel: 4, pitchControl: '기본', soundLevel: 0, isVibrationOn: false })).toEqual({
      speedLevel: 4,
      pitchControl: '기본',
      soundLevel: 0,
      isVibrationOn: false,
    })
  })

  it('소리 크기·진동이 없거나 범위를 벗어나면 원본 기본값을 쓴다 (+0x2e = 2 · +0x3b = 켬)', () => {
    expect(normalizeSettings({ speedLevel: 4, pitchControl: '기본' })).toMatchObject({
      soundLevel: 2,
      isVibrationOn: true,
    })
    expect(normalizeSettings({ soundLevel: 9 })).toMatchObject({ soundLevel: 2 })
  })
})
