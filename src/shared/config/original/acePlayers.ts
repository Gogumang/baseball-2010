// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import type { BatterAbility } from '@/entities/batting/model/batter'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

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
  /** 레코드 +0x14 u32 — 장착 스킬 비트 (0xb62b4 가 읽는 칸) */
  readonly skillBits: number
  /** 레코드 +0xb — 윗니블 폼 · 아랫 2비트 보직(0xb6704, 다섯 투수 모두 2 구원) */
  readonly profile: number
  /**
   * 레코드 +0x20~+0x2b s16 여섯 칸 — 시즌 줄. 0x20094 6번 갈래가 XlsACE_* 행을 그대로 붓고 마선수 줄은 기록 게이트
   * 0xa56dc 가 늘 거르므로(모드 2 · 3 · 4 0xb633d, 5 · 6 은 나리 · 명예만) 표의 값이 그대로 남는다. 소개 판 0x44944 가 읽는다.
   */
  readonly recordLine: readonly number[]
}

/** 원본 XlsACE_BAT_DATA / XlsACE_PIT_DATA. 능력치는 원본 0~999 눈금 그대로. */
export const ACE_PLAYERS: readonly AcePlayer[] = [
  {
    id: 'medica',
    name: '메디카',
    role: '타자',
    ability: { hit: 620, power: 620, run: 450, defense: 620 },
    iconUrl: assetUrl('./sprites/ace_icon/005.png'),
    framesUrl: assetUrl('./sprites/batter_medica/frames'),
    frameCount: 12,
    stillUrl: assetUrl('./sprites/batter_medica/024.png'),
    burst: '핑크 봄',
    skillBits: 0x2102,
    profile: 0x42,
    recordLine: [1000, 355, 0, 0, 15, 70],
  },
  {
    id: 'kao',
    name: '어거지죠',
    role: '타자',
    ability: { hit: 700, power: 450, run: 650, defense: 600 },
    iconUrl: assetUrl('./sprites/ace_icon/006.png'),
    framesUrl: assetUrl('./sprites/batter_kao/frames'),
    frameCount: 15,
    stillUrl: assetUrl('./sprites/batter_kao/002.png'),
    burst: '플레임 스트라이커',
    skillBits: 0x200400,
    profile: 0x52,
    recordLine: [1000, 380, 0, 0, 10, 75],
  },
  {
    id: 'roze',
    name: '로제',
    role: '타자',
    ability: { hit: 580, power: 850, run: 320, defense: 600 },
    iconUrl: assetUrl('./sprites/ace_icon/007.png'),
    framesUrl: assetUrl('./sprites/batter_roze/frames'),
    frameCount: 13,
    stillUrl: assetUrl('./sprites/batter_roze/000.png'),
    burst: '메이든 임팩트',
    skillBits: 0x9100,
    profile: 0x62,
    recordLine: [1000, 325, 0, 0, 30, 85],
  },
  {
    id: 'death',
    name: '크라이져',
    role: '타자',
    ability: { hit: 777, power: 555, run: 444, defense: 666 },
    iconUrl: assetUrl('./sprites/ace_icon/008.png'),
    framesUrl: assetUrl('./sprites/batter_death/frames'),
    frameCount: 12,
    stillUrl: assetUrl('./sprites/batter_death/037.png'),
    burst: '하트 브레이커',
    skillBits: 0x16000,
    profile: 0x72,
    recordLine: [1000, 444, 0, 0, 22, 90],
  },
  {
    id: 'tiger',
    name: '킹타이거',
    role: '타자',
    ability: { hit: 650, power: 920, run: 380, defense: 450 },
    iconUrl: assetUrl('./sprites/ace_icon/009.png'),
    framesUrl: assetUrl('./sprites/batter_tiger/frames'),
    frameCount: 13,
    stillUrl: assetUrl('./sprites/batter_tiger/001.png'),
    burst: '크로스 액스',
    skillBits: 0x401200,
    profile: 0x82,
    recordLine: [1000, 399, 0, 0, 45, 100],
  },
  {
    id: 'psyker',
    name: '싸이커',
    role: '투수',
    ability: { hit: 670, power: 550, run: 300, defense: 820 },
    iconUrl: assetUrl('./sprites/ace_icon/000.png'),
    framesUrl: assetUrl('./sprites/pitcher_psyker/frames'),
    frameCount: 20,
    stillUrl: assetUrl('./sprites/pitcher_psyker/012.png'),
    burst: '싸이킥 스타',
    skillBits: 0x9002,
    profile: 0x62,
    recordLine: [300, 23, 0, 60, 0, 0],
  },
  {
    id: 'leony',
    name: '레오니',
    role: '투수',
    ability: { hit: 580, power: 850, run: 330, defense: 580 },
    iconUrl: assetUrl('./sprites/ace_icon/001.png'),
    framesUrl: assetUrl('./sprites/pitcher_leony/frames'),
    frameCount: 16,
    stillUrl: assetUrl('./sprites/pitcher_leony/000.png'),
    burst: '트리플 크로우',
    skillBits: 0x200100,
    profile: 0x72,
    recordLine: [300, 22, 0, 80, 0, 0],
  },
  {
    id: 'bbmachine',
    name: '붕붕머신',
    role: '투수',
    ability: { hit: 820, power: 620, run: 320, defense: 620 },
    iconUrl: assetUrl('./sprites/ace_icon/002.png'),
    framesUrl: assetUrl('./sprites/pitcher_bbmachine/frames'),
    frameCount: 14,
    stillUrl: assetUrl('./sprites/pitcher_bbmachine/003.png'),
    burst: '홀로그램 레이저',
    skillBits: 0x16000,
    profile: 0x82,
    recordLine: [300, 18, 0, 70, 0, 0],
  },
  {
    id: 'ballantine',
    name: '발렌타인',
    role: '투수',
    ability: { hit: 700, power: 600, run: 280, defense: 800 },
    iconUrl: assetUrl('./sprites/ace_icon/003.png'),
    framesUrl: assetUrl('./sprites/pitcher_ballantine/frames'),
    frameCount: 19,
    stillUrl: assetUrl('./sprites/pitcher_ballantine/012.png'),
    burst: '다크 일루전',
    skillBits: 0x410000,
    profile: 0x92,
    recordLine: [300, 15, 0, 75, 0, 0],
  },
  {
    id: 'dragona',
    name: '드래고나',
    role: '투수',
    ability: { hit: 650, power: 900, run: 300, defense: 650 },
    iconUrl: assetUrl('./sprites/ace_icon/004.png'),
    framesUrl: assetUrl('./sprites/pitcher_dragona/frames'),
    frameCount: 14,
    stillUrl: assetUrl('./sprites/pitcher_dragona/000.png'),
    burst: '브레스 웨폰',
    skillBits: 0x208a00,
    profile: 0xa2,
    recordLine: [300, 5, 0, 100, 0, 0],
  },
]
