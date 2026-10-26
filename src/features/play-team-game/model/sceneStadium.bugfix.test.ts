import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { generalMatchInfoStage, rollSceneStadium } from '@/features/play-team-game/model/sceneStadium'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-64 히든 팀 홈 구장의 바닥 줄', () => {
  it('원본: 표 0xcfd0c 밖 낱말을 줄로 읽는다', () => {
    expect(rollSceneStadium(createSeededRandom(1), 12).paletteRow).toBe(0x211a1818)
  })

  it('고침: 경기정보 미리보기 표 0xce9d8 과 같은 줄 — 0~9 는 그대로, 굴림 수 같음', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-64']))
    for (const team of [10, 11, 12, 13, 14]) {
      expect(rollSceneStadium(createSeededRandom(1), team).paletteRow).toBe(generalMatchInfoStage(0, team).paletteRow)
    }
    expect(rollSceneStadium(createSeededRandom(1), 12).paletteRow).toBe(9)
    expect(rollSceneStadium(createSeededRandom(1), 3).paletteRow).toBe(2)
    const 원본 = createSeededRandom(5)
    const 고침 = createSeededRandom(5)
    rollSceneStadium(고침, 13)
    setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)
    rollSceneStadium(원본, 13)
    expect(고침.rand(0, 1_000_000)).toBe(원본.rand(0, 1_000_000))
  })
})
