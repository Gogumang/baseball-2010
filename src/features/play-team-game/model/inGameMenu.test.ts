import { describe, expect, it } from 'vitest'
import {
  inGameMenuOf,
  inGameMenuRowOf,
  QUIT_CONFIRM_PLAIN,
  QUIT_CONFIRM_WITH_LOSS,
  quitConfirmTextOf,
} from '@/features/play-team-game/model/inGameMenu'

describe('경기 중 메뉴 표 0xcfcfc (I-controls 4c)', () => {
  it('행은 모드가 고른다 — 나리 3·4 → 2, 미션·홈런더비 5~7 → 1, 그 밖 → 0', () => {
    expect(inGameMenuRowOf(0)).toBe(0)
    expect(inGameMenuRowOf(1)).toBe(0)
    expect(inGameMenuRowOf(2)).toBe(0)
    expect(inGameMenuRowOf(8)).toBe(0)
    expect(inGameMenuRowOf(9)).toBe(0)
    expect(inGameMenuRowOf(3)).toBe(2)
    expect(inGameMenuRowOf(4)).toBe(2)
    expect(inGameMenuRowOf(5)).toBe(1)
    expect(inGameMenuRowOf(6)).toBe(1)
    expect(inGameMenuRowOf(7)).toBe(1)
  })

  it('행 0 (일반·시즌·대전) 은 자동진행을 낀 다섯 칸이다', () => {
    expect(inGameMenuOf(2)).toEqual(['계속', '자동진행', '조작방법', '설정', '나가기'])
  })

  it('행 1 (미션·홈런더비) 은 자동진행 자리가 다시하기다 (StrGAME[7])', () => {
    expect(inGameMenuOf(6)).toEqual(['계속', '다시하기', '조작방법', '설정', '나가기'])
  })

  it('행 2 (나만의리그) 는 네 칸뿐이다', () => {
    expect(inGameMenuOf(3)).toEqual(['계속', '조작방법', '설정', '나가기'])
    expect(inGameMenuOf(4)).toHaveLength(4)
  })

  it('나가기 확인 문구는 모드 1~4·8·9 만 StrGAME[0] 이다', () => {
    for (const mode of [1, 2, 3, 4, 8, 9]) {
      expect(quitConfirmTextOf(mode)).toBe(QUIT_CONFIRM_WITH_LOSS)
    }
    for (const mode of [0, 5, 6, 7]) {
      expect(quitConfirmTextOf(mode)).toBe(QUIT_CONFIRM_PLAIN)
    }
  })
})
