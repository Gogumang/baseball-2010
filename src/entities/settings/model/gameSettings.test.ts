import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  MANUAL_AUTO_MODES,
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
    expect(
      normalizeSettings({
        speedLevel: 4,
        pitchControl: '기본',
        soundLevel: 0,
        isVibrationOn: false,
        runningMode: '수동',
        throwMode: '자동',
        isScoreboardOn: false,
      }),
    ).toEqual({
      speedLevel: 4,
      pitchControl: '기본',
      soundLevel: 0,
      isVibrationOn: false,
      runningMode: '수동',
      throwMode: '자동',
      isScoreboardOn: false,
    })
  })

  it('소리 크기·진동이 없거나 범위를 벗어나면 원본 기본값을 쓴다 (+0x2e = 2 · +0x3b = 켬)', () => {
    expect(normalizeSettings({ speedLevel: 4, pitchControl: '기본' })).toMatchObject({
      soundLevel: 2,
      isVibrationOn: true,
    })
    expect(normalizeSettings({ soundLevel: 9 })).toMatchObject({ soundLevel: 2 })
  })

  it('주루·송구·전광판 (+0xbd·+0xf4·+0x3a) 도 원본 기본값 표다', () => {
    expect(MANUAL_AUTO_MODES).toEqual(['수동', '자동'])
    expect(DEFAULT_SETTINGS).toMatchObject({
      runningMode: '자동', // +0xbd 기본 1
      throwMode: '수동', // +0xf4 기본 0
      isScoreboardOn: true, // +0x3a 기본 1
    })
  })

  it('주루·송구가 없거나 엉뚱하면 원본 기본값(자동·수동)을 쓴다', () => {
    expect(normalizeSettings({ speedLevel: 4 })).toMatchObject({ runningMode: '자동', throwMode: '수동' })
    expect(normalizeSettings({ runningMode: '엉뚱', throwMode: 9 })).toMatchObject({
      runningMode: '자동',
      throwMode: '수동',
    })
  })

  it('전광판이 없거나 불리언이 아니면 원본 기본값(켬)을 쓴다', () => {
    expect(normalizeSettings({ speedLevel: 4 })).toMatchObject({ isScoreboardOn: true })
    expect(normalizeSettings({ isScoreboardOn: 'ON' })).toMatchObject({ isScoreboardOn: true })
  })

  it('옛 저장(주루·송구·전광판 칸이 아예 없던 시절)도 깨지지 않는다 — 새 칸은 기본값으로 메운다', () => {
    /** 커밋 c5a5294 이전 저장 모양 — 새로 늘어난 칸이 아예 없다 */
    const 옛저장 = { speedLevel: 3, pitchControl: '게이지', soundLevel: 4, isVibrationOn: false }

    expect(normalizeSettings(옛저장)).toEqual({
      speedLevel: 3,
      pitchControl: '게이지',
      soundLevel: 4,
      isVibrationOn: false,
      runningMode: DEFAULT_SETTINGS.runningMode,
      throwMode: DEFAULT_SETTINGS.throwMode,
      isScoreboardOn: DEFAULT_SETTINGS.isScoreboardOn,
    })
  })

  it('그보다 더 옛 저장(사운드·진동도 없던 시절)도 기본값으로 다 메운다', () => {
    const 더옛저장 = { speedLevel: 1, pitchControl: '기본' }

    expect(normalizeSettings(더옛저장)).toEqual({
      ...DEFAULT_SETTINGS,
      speedLevel: 1,
      pitchControl: '기본',
    })
  })
})
