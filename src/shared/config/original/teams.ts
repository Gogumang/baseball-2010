// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

export interface TeamRecord {
  readonly id: number
  readonly name: string
  readonly logoUrl: string
  /** 원본 XlsTEAM_DATA의 u16 6개. 팀 전력 지표로 보인다. */
  readonly values: readonly number[]
}

/** 원본 팀 15개. 이름은 StrCOMMON, 로고는 ui/team_logo.pzx 이며 순서가 같다. */
export const TEAMS: readonly TeamRecord[] = [
  { id: 0, name: '서울 드래곤즈', logoUrl: '/sprites/team_logo/000.png', values: [0, 100, 365, 440, 430, 365] },
  { id: 1, name: '서울 피닉스', logoUrl: '/sprites/team_logo/001.png', values: [1, 100, 400, 430, 460, 340] },
  { id: 2, name: '인천 돌핀즈', logoUrl: '/sprites/team_logo/002.png', values: [2, 100, 470, 460, 320, 390] },
  { id: 3, name: '대전 호크스', logoUrl: '/sprites/team_logo/003.png', values: [3, 100, 350, 500, 435, 310] },
  { id: 4, name: '대구 라이온즈', logoUrl: '/sprites/team_logo/004.png', values: [4, 100, 380, 395, 490, 355] },
  { id: 5, name: '광주 타이거즈', logoUrl: '/sprites/team_logo/005.png', values: [5, 100, 480, 470, 360, 340] },
  { id: 6, name: '부산 씨뮤스', logoUrl: '/sprites/team_logo/006.png', values: [6, 100, 410, 450, 380, 370] },
  { id: 7, name: '제주 유니콘즈', logoUrl: '/sprites/team_logo/007.png', values: [7, 100, 345, 420, 410, 430] },
  { id: 8, name: '서울 게임빌즈', logoUrl: '/sprites/team_logo/008.png', values: [8, 100, 330, 340, 370, 555] },
  { id: 9, name: '독도 스왈로즈', logoUrl: '/sprites/team_logo/009.png', values: [9, 100, 340, 380, 500, 370] },
  { id: 10, name: '대한민국', logoUrl: '/sprites/team_logo/010.png', values: [10, 100, 600, 590, 640, 600] },
  { id: 11, name: '일본', logoUrl: '/sprites/team_logo/011.png', values: [11, 100, 640, 550, 620, 620] },
  { id: 12, name: '쿠바', logoUrl: '/sprites/team_logo/012.png', values: [12, 100, 590, 640, 580, 600] },
  { id: 13, name: '미국', logoUrl: '/sprites/team_logo/013.png', values: [13, 100, 650, 660, 600, 540] },
  { id: 14, name: '외인구단', logoUrl: '/sprites/team_logo/014.png', values: [14, 100, 666, 666, 666, 666] },
]
