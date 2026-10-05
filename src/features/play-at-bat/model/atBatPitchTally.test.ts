import { describe, expect, it } from 'vitest'
import { EMPTY_AT_BAT_PITCH_TALLY, tallyPitch } from '@/features/play-at-bat/model/atBatPitchTally'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'

const 공들 = (resolutions: readonly PitchResolution[]) => resolutions.reduce(tallyPitch, EMPTY_AT_BAT_PITCH_TALLY)
const 파울: PitchResolution = { kind: '파울' }
const 볼: PitchResolution = { kind: '볼' }

describe('타석 공 집계 — 공 수 · 연속 파울 (0xa5e14 · 0xa7dbc)', () => {
  it('판정이 난 공마다 하나씩 센다', () => {
    expect(공들([볼, 파울, { kind: '스트라이크', isSwinging: false }]).pitches).toBe(3)
  })

  it('세 번째 연속 파울에 32, 네 번째에 33, 그 뒤는 없다', () => {
    expect(공들([파울, 파울, 파울]).foulRecordIds).toEqual([32])
    expect(공들([파울, 파울, 파울, 파울, 파울, 파울]).foulRecordIds).toEqual([32, 33])
  })

  it('파울 아닌 공이 오면 끊긴다 — 파울 둘, 볼, 파울 둘이면 없다 (0xa5fdc, 유력)', () => {
    const 집계 = 공들([파울, 파울, 볼, 파울, 파울])
    expect(집계.foulRecordIds).toEqual([])
    expect(집계.foulStreak).toBe(2)
  })
})
