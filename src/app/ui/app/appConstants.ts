import type { Screen } from '@/app/model/screen'

/**
 * 다시 불러도 날아갈 진행이 없는 화면 — 켤 때 길 · 타이틀 · 메인 메뉴. 모드는 나갈 때 저장을 마치고 메인 메뉴로 온다
 * (새 배포 뒤 열린 탭 다시 부르기, `shared/lib/staleBuild`)
 */
export const SAFE_TO_RELOAD_SCREENS: ReadonlySet<Screen['kind']> = new Set(['이용안내', '로고', '타이틀', '메인메뉴'])
export const SETTINGS_KEY = 'compus-baseball/settings'
export const COLLECTION_KEY = 'compus-baseball/collection'
/** 시즌모드 저장 — 원본은 나만의리그와 **다른 칸**에 담는다 (0x22755) */
export const SEASON_KEY = 'compus-baseball/season'
/** 투수편 저장 — 원본도 타자편과 **다른 칸**이다 (StrMAINMENU[210]·[211] 모드 초기화가 따로 지운다) */
export const PITCHER_KEY = 'compus-baseball/pitcher-league'
/**
 * 마선수 오픈 플래그 10칸 — 원본은 전역 기록 `mgr[0x30..0x39]` 다 (0xa3f6).
 * 옛 세이브에는 이 칸이 아예 없다 — 없으면 정규화가 기본 개방 둘(싸이커·메디카)만 켠다.
 */
export const ACE_OPEN_KEY = 'compus-baseball/ace-open'
/**
 * 마선수 레벨 열 칸 — 원본 전역 기록 `mgr[0x13a..0x143]` (올리는 곳은 레벨업 0x5fb24 하나).
 * 옛 세이브에는 이 칸이 없다 — 없으면 새 저장 기본값(0x9f26c)처럼 모두 0 = Lv1 이다.
 */
export const ACE_LEVEL_KEY = 'compus-baseball/ace-level'
/**
 * **G포인트 지갑** — 원본 전역 기록 `mgr[+0x64]` 한 칸이다 (`entities/wallet` 머리글에 디스어셈).
 * 모드와 상관없이 하나라 커리어·시즌 저장과 **따로** 둔다.
 * 옛 세이브에는 이 칸이 없다 — 없으면 `career.gamePoint` 를 그대로 옮겨 온다(이사).
 */
export const WALLET_KEY = 'compus-baseball/wallet'
/** 전역기록 +0x145 — 전부 수집 보상 지급 비트 (`game_o.sav` 의 그 바이트, `collectionRewards.ts`). 리그 1위 G 가 쓴다 */
export const COLLECTION_REWARD_KEY = 'compus-baseball/collection-rewards'
/**
 * 투수편 G를 지갑으로 옮겼는지 적어 두는 칸 — 옛 투수 저장은 G를 선수 안에 들고 있었다.
 * 이사를 마치면 선수 칸이 지갑의 그림자가 되어 저장만 봐서는 옮겼는지 알 수 없어 표식을 따로 둔다
 * (근거는 `usePitcherLeagueSession` 의 **투수 G 이사** 머리글).
 */
export const PITCHER_WALLET_MERGE_KEY = 'compus-baseball/pitcher-wallet-merged'
/**
 * **에디트 이름표** — 원본 앱 데이터 save[+0xac]+0x178 (투수 80 · 타자 120 칸, R11 1c). 모드와 상관없는 한 벌이다.
 * 옛 세이브에는 이 칸이 없다 — 없으면 빈 표(모두 원래 이름)다.
 */
export const EDITED_NAMES_KEY = 'compus-baseball/edited-names'
/**
 * **모드 저장 칸** — 원본 전역기록 +0x3c(마지막 모드) · +0x4d(일반모드 경기 중간 저장)와 모드 1 저장 블록(`entities/mode-save`).
 * 옛 세이브에는 이 칸이 없다 — 없으면 +0x3c 를 "나리 타자편 커리어가 있으면 4, 없으면 새 저장 기본값 1(생성자 0x9f26c)" 로
 * 읽어 예전 웹 [최근게임](늘 타자편 이어하기)과 같은 길로 이어 준다.
 */
export const MODE_SAVE_KEY = 'compus-baseball/mode-save'
/** 나만의리그 타자편 = 원본 모드 4 · 투수편 = 모드 3 (전역기록 +0x4c + 모드 = +0x50 · +0x4f) */
export const NARI_BATTER_MODE = 4
export const NARI_PITCHER_MODE = 3

export const ENTRY_SCREENS: readonly Screen['kind'][] = [
  '이용안내',
  '로고',
  '타이틀',
  '메인메뉴',
  '도움말',
  '환경설정',
  '스페셜',
  '팀선택',
  '선수등록',
  '홈런더비',
  '일반모드',
]

export const MISSION_SCREENS: readonly Screen['kind'][] = ['마선수대결', '미션선택', '미션진행', '투수미션']

/** 일반모드 = 원본 모드 1 (0x22c7d 의 획득 GP 칸 0) */
export const GENERAL_STAT_MODE = 1
/** 0x1ca4c 1cb42 `movs r1, #0x11` — 나리 명전 등록 완료 창 뒤에 여는 히든 (전광판 칸 1 "고대의전광판") */
export const REGISTERED_HALL_OF_FAME_HIDDEN_ID = 17
/** 0x7b426 `movs r1, #0xc` — 마선수 열 칸이 다 열리면 여는 히든 팀 외인구단 (0x62368 의 k) */
export const ALL_ACES_HIDDEN_TEAM_ID = 12
/** 투수 미션 · 타자 미션 = 원본 모드 5 · 6 (0x29a54 → 표 0xcec00) */
export const MISSION_PITCHER_MODE = 5
export const MISSION_BATTER_MODE = 6

export interface AppProps {
  /**
   * 켤 때 첫 화면 — 없으면 이용안내. 배포 빌드는 `main.tsx` 의 부팅 껍데기가 이 덩이를 받는 동안 이용안내를 먼저 그린다.
   * 그새 키를 받았으면 다음 화면인 로고부터 선다(r224).
   */
  readonly bootScreen?: Screen
}
