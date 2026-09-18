// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import type { BatterAbility } from '@/entities/batting/model/batter'

export interface AcePlayer {
  readonly id: string
  readonly name: string
  readonly role: '타자' | '투수'
  readonly ability: BatterAbility
  /** 원본 ace/ace_icon.pzx 의 33×33 아이콘 */
  readonly iconUrl: string
  /** 원본에서 합성한 애니메이션 프레임 폴더 */
  readonly framesUrl: string
  readonly frameCount: number
  /** 프레임 합성이 안 된 경우 쓰는 정지 그림 */
  readonly stillUrl: string
  /** 필살기 이름 (StrCOMMON) */
  readonly burst: string
}

/** 원본 XlsACE_BAT_DATA / XlsACE_PIT_DATA. 능력치는 원본 0~999 눈금 그대로. */
export const ACE_PLAYERS: readonly AcePlayer[] = [
  { id: 'medica', name: '메디카', role: '타자', ability: { hit: 620, power: 620, run: 450, defense: 620 }, iconUrl: '/sprites/ace_icon/005.png', framesUrl: '/sprites/batter_medica/frames', frameCount: 12, stillUrl: '/sprites/batter_medica/024.png', burst: '파워 스윙' },
  { id: 'kao', name: '어거지죠', role: '타자', ability: { hit: 700, power: 450, run: 650, defense: 600 }, iconUrl: '/sprites/ace_icon/006.png', framesUrl: '/sprites/batter_kao/frames', frameCount: 15, stillUrl: '/sprites/batter_kao/002.png', burst: '플레임 스윙' },
  { id: 'roze', name: '로제', role: '타자', ability: { hit: 580, power: 850, run: 320, defense: 600 }, iconUrl: '/sprites/ace_icon/007.png', framesUrl: '/sprites/batter_roze/frames', frameCount: 13, stillUrl: '/sprites/batter_roze/000.png', burst: '토네이도스윙' },
  { id: 'death', name: '크라이져', role: '타자', ability: { hit: 777, power: 555, run: 444, defense: 666 }, iconUrl: '/sprites/ace_icon/008.png', framesUrl: '/sprites/batter_death/frames', frameCount: 12, stillUrl: '/sprites/batter_death/037.png', burst: '미라지 스윙' },
  { id: 'tiger', name: '킹타이거', role: '타자', ability: { hit: 650, power: 920, run: 380, defense: 450 }, iconUrl: '/sprites/ace_icon/009.png', framesUrl: '/sprites/batter_tiger/frames', frameCount: 13, stillUrl: '/sprites/batter_tiger/001.png', burst: '메테오 스윙' },
  { id: 'psyker', name: '싸이커', role: '투수', ability: { hit: 670, power: 550, run: 300, defense: 820 }, iconUrl: '/sprites/ace_icon/000.png', framesUrl: '/sprites/pitcher_psyker/frames', frameCount: 20, stillUrl: '/sprites/pitcher_psyker/012.png', burst: '파이어 볼' },
  { id: 'leony', name: '레오니', role: '투수', ability: { hit: 580, power: 850, run: 330, defense: 580 }, iconUrl: '/sprites/ace_icon/001.png', framesUrl: '/sprites/pitcher_leony/frames', frameCount: 16, stillUrl: '/sprites/pitcher_leony/000.png', burst: '웨이브 볼' },
  { id: 'bbmachine', name: '붕붕머신', role: '투수', ability: { hit: 820, power: 620, run: 320, defense: 620 }, iconUrl: '/sprites/ace_icon/002.png', framesUrl: '/sprites/pitcher_bbmachine/frames', frameCount: 14, stillUrl: '/sprites/pitcher_bbmachine/003.png', burst: '썬더 볼' },
  { id: 'ballantine', name: '발렌타인', role: '투수', ability: { hit: 700, power: 600, run: 280, defense: 800 }, iconUrl: '/sprites/ace_icon/003.png', framesUrl: '/sprites/pitcher_ballantine/frames', frameCount: 19, stillUrl: '/sprites/pitcher_ballantine/012.png', burst: '샤이닝 볼' },
  { id: 'dragona', name: '드래고나', role: '투수', ability: { hit: 650, power: 900, run: 300, defense: 650 }, iconUrl: '/sprites/ace_icon/004.png', framesUrl: '/sprites/pitcher_dragona/frames', frameCount: 14, stillUrl: '/sprites/pitcher_dragona/000.png', burst: '캐넌 볼' },
]
