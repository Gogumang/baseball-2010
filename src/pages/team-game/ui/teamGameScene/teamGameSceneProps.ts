import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { TeamGameOptions, TeamGameProgress, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamMatchupRecords } from '@/pages/team-game/lib/teamMatchupCards'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'

/** 투구 세 단계 — 구질 0xf → 코스 0x10 → 게이지 0x11 */
export type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 통째로 덮는 하위 화면 — 경기 중 메뉴가 연다 */
export type MenuOverlay = '조작방법' | '설정'
/** `#` 교체 화면(경기 상태 0xb) — 수비 중이면 투수 교체, 공격 중이면 대타 */
export type ChangeWindowKind = '투수' | '대타'

export interface TeamGameScreenProps {
  readonly options: TeamGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 — 시즌 세션은 이 요약으로 하루를 정산한다 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /**
   * 지금 가진 G포인트(`저장+0x64`). **안 넘기면 자동진행 칸이 잠긴다** —
   * 비용을 검사할 수 없기 때문이다.
   */
  readonly gamePoint?: number
  /** 자동진행 비용만큼 G포인트를 깎아 달라는 알림 (모드 8·9 는 100, 그 밖은 30) */
  readonly onSpendGamePoint?: (cost: number) => void
  /** 환경설정 값. 안 넘기면 경기 중 메뉴의 "설정" 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **시즌 홈경기 구장** — 장착한 관중석·전광판과 관중 수 그림 단계다.
   * 넘기면 타석 배경이 시즌 구장(0x77494)으로 그려진다.
   *
   * 원본 배경 고르기 `0x40ff0` 은 **모드 2 이고 `0xb6bdc(경기, 1) == SR[1]`**(= 내 팀이 홈)
   * 이거나 **모드 8·9(대전)** 일 때만 이 길로 간다 — 시즌 **원정**이면 안 넘겨야 원본과 같다.
   * 값을 만드는 것은 부르는 쪽(`SeasonRoute`)이다.
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * **이어하기** — 저장된 진행에서 다시 세운다 (`useTeamGame` 넷째 인자). 인트로(0xc)는 새 경기처럼 다시 선다 —
   * 원본도 장면 0x104 를 처음부터 들어가 상태 8 → 0xc 를 지난다.
   */
  readonly resumeFrom?: TeamGameProgress
  /**
   * **이어하기 저장을 썼다** — 진행의 `halfInningSave` 가 바뀔 때마다(경기를 세운 첫 진행 포함) 부른다.
   * 원본 0x4f928 → 0x22754(저장, 1) 자리다. 받는 쪽이 저장소에 담는다. 안 넘기면 아무 데도 안 남는다(시즌·대전).
   */
  readonly onHalfInningSave?: (save: TeamGameProgress) => void
  /**
   * **정산(0x19)에 들어섰다** — 경기 끝 결과 판의 OK. 원본 0x4ea0c 가 이 자리에서 정산을 다 하고(기록 달성 G · 모드별 정산 ·
   * 저장) 전역기록 +0x4c+모드 를 0 으로 지운다(0x4f3d6). 그래서 요약을 함께 넘긴다 — `onFinish` 는 결과 화면 확인이다.
   */
  readonly onSettlementEnter?: (summary: TeamGameSummary) => void
  /**
   * 상태 0xe 소개 판(0x44944)의 시즌 줄 출처 — 시즌 레코드 +0x20~ 의 웹 자리인 리그 선수 기록표와, 이 경기 줄을 더할지
   * (기록 게이트 0xa56dc). 안 주면 방어율·탈삼진·타율·홈런·타점 칸을 비운다 (`teamMatchupCardsOf`).
   */
  readonly matchupRecords?: TeamMatchupRecords
}

/** 로딩 판 뒤 경기 장면 — 화면 props 에 진행기 세션을 더한다 */
export type TeamGameSceneProps = TeamGameScreenProps & { readonly session: TeamGameSession }
