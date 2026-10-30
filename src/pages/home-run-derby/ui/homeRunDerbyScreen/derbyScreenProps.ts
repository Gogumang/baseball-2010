import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'

export interface HomeRunDerbyScreenProps {
  /**
   * 치는 선수의 능력치. 원본은 모드 7 로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 **나리 타자편 저장**을
   * 올린다 — 선수 고르기 창 결과 2 = 육성 타자 · 4 = 명예 타자다(H-2, Q2 확정).
   * 웹에는 아직 명예의 전당 선수를 경기에 넣는 길이 없어 부르는 쪽이 육성 선수를 넘긴다.
   */
  readonly ability: BatterAbility
  /**
   * 치는 선수의 겉모습 — 원본이 나리 타자편 저장을 올리므로 **그 선수의 피부·폼·장비**가 그대로 나온다.
   * 안 넘기면 구운 벌(피부 0)과 맨몸으로 그려진다.
   */
  readonly batterForm?: number
  readonly batterSkinIndex?: number
  readonly batterEquipmentLevels?: BatterAbility
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 같은 저장을 올리니 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 난입 마투수 능력치 배율
   * 0xd88aa(0xb6414)·마구 횟수 0xd8509(0xaebe4)가 본다. 안 넘기면 배율 없이 날 값 · 마구 Lv1.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  readonly random: RandomPort
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 보유 G (app+0x64) — 결과 화면 "보유 GP" 칸 */
  readonly gamePoint: number
  /** 한 판이 끝났을 때. 최고 기록 갱신과 G 지급은 부르는 쪽이 한다 */
  readonly onFinish?: (result: DerbyResult) => void
  /** 판 끝 누적 비거리 > 1999 의 히든 39 열기 (0x52a14 `0x62368`) — `useHomeRunDerby` 의 `onOpenHidden` */
  readonly onOpenHidden?: (id: number, then: () => void) => boolean | void
  /** 결과 화면에서 "아니오" — 메인 메뉴로 (전역 0x140006c = 4) */
  readonly onExit: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 상태 0xe 소개 판(0x44944)의 타자 판 칸 — 모드 타자 기록(0x1fc20)의 이름(0xb62c0) · 수비(+0x1c & 0xf) ·
   * 타율(0xb8e3c) · 홈런(+0x28) · 타점(+0x2a) · 타순(팀 +0x32 = 0xb6394(기록) = +0xa & 0x1f) · 오늘 타석 기록.
   * 앱(`EntryRoutes` 의 `derbyMatchupBatterOf`)이 넘긴다 — 안 넘긴 칸은 비워 둔다.
   */
  readonly matchupBatter?: Omit<MatchupBatterCard, 'isComputer'>
  /**
   * 내 타자편 팀 — 나리 타자편 저장의 팀(0x1f8d5(저장, 4) +1). 상대 팀 굴림 3a454 가 이 팀을 피한다 (`rollDerbySceneStart`).
   * 저장이 없으면 0 (`DERBY_NO_BATTER_SAVE_TEAM_ID`) — 안 넘기면 그 값이다.
   */
  readonly myTeamId?: number
  /**
   * 모드 타자가 든 명부 칸 k = 0xb6394(모드 타자 기록) — 나리 팀 레코드의 내 줄 첨자, 명예 타자면 0. 첫 타순이 이 칸이고,
   * 볼넷 · 사구 뒤 0xd 를 지나면 내 팀 r7 마스터 명부의 다음 칸 타자가 친다(`derbyLineup`). 안 넘기면 0.
   */
  readonly modeBatterSlot?: number
}

/** 홈런더비 = 원본 전역 모드 7 — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(자동진행 자리에 다시하기) */
export const DERBY_MODE = 7
export type MenuOverlay = '조작방법' | '설정'
/** 상태 0xe 의 OK — 원본 키 −5(OK)·'5'(0x35) (0x532b0). 웹은 Enter·스페이스를 OK 로 받는다 (스윙 키와 같은 묶음) */
export const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
