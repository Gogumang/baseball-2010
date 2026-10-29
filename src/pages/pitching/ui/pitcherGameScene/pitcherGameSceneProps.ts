import type { RandomPort } from '@/shared/api/random/randomPort'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherMatchupRecords } from '@/pages/pitching/lib/pitcherMatchupCards'
import type { PitcherFieldLineups } from '@/pages/pitching/lib/pitcherFieldTeams'
import type { PitcherGameSession } from '@/pages/pitching/model/usePitcherGame'

/** 투구 세 단계 — 구질 0xf → 코스 0x10 → 게이지 0x11 */
export type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
export type MenuOverlay = '조작방법' | '설정'

/** 나만의리그 투수편 = 원본 전역 모드 3 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
export const PITCHER_CAREER_MODE = 3

export interface PitcherGameScreenProps {
  readonly options: PitcherGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 */
  readonly onFinish: (summary: PitcherGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 내 투수 이름 — 경기 끝 결과 판의 승·패·세 줄이 내 이름을 적을 때 쓴다(진행기 옵션에는 이름이 없다).
   * 안 넘기면 내 줄은 이름 칸이 빈다.
   */
  readonly pitcherName?: string
  /**
   * 경기 전 보유 G [app+0x64] — 정산 판(0x4a384)의 "보유 GP" 줄. 정산 진입 0x4ea0c 가 이 경기 기록 달성 G 를 먼저 더하고(4ec5a,
   * 0~99999) 판을 그리므로 판은 더한 값을 보인다. 안 주면 그 줄 숫자를 비운다.
   */
  readonly gamePoint?: number
  /**
   * 상태 0xe 소개 판(0x44944)의 시즌 줄 출처 — 내 투수 시즌 줄과 리그 선수 기록표. 안 주면 방어율·탈삼진·타율·홈런·타점을
   * 비운다 (`pitcherMatchupCardsOf`).
   */
  readonly matchupRecords?: PitcherMatchupRecords
  /**
   * 내 투수의 장비 니블 (`PitcherCareer.equipmentLevels`) — 장면 셋업 0x108f8 이 모드 ≠ 4 면 세우는 투수 그림(0x79368)에
   * 0x10810 이 부위마다 0x79790 으로 장비 겹을 싣는다. 안 주면 맨몸 투수다.
   */
  readonly pitcherEquipmentLevels?: PitcherAbility
  /**
   * 내 투수의 피부 `(rec[0xb] >> 2) & 3` — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 적재 0x793b0 에 넘겨 794c2 가 `pitcher.pzx` 를
   * 피부 × 15 + 수비 팀(내 팀) 벌로 연다. 안 주면 0
   */
  readonly pitcherSkinIndex?: number
  /**
   * 두 팀의 레코드 타자 배열 차례 — 경기 장면 0x39fdc 가 `0xb891c(…, 모드 3, 팀)` 로 세운 나리 팀 레코드(국가대항전이면 대회 칸).
   * 공수 교대 판 이름표 0x40008 · +0xec(마선수 그림) · 벤치 클리어링이 이 차례로 훑는다. 안 주면 이름표는 투수만, 마선수 그림은 보통 그림
   */
  readonly fieldLineups?: PitcherFieldLineups
}

/** 로딩 판 뒤 경기 장면 — 화면 props 에 진행기 세션을 더한다 */
export type PitcherGameSceneProps = PitcherGameScreenProps & { readonly session: PitcherGameSession }
