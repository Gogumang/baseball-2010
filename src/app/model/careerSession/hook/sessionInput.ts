import type { Screen } from '@/app/model/screen'
import type { AceMatchHoldPort, AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { NariGameSavePort, NariOpenedAces } from '@/pages/management/lib/nariMatchPrepare'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'

export interface CareerSessionInput {
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly saveGame: SaveGamePort
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  /**
   * 소리 통로 (원본 사운드 객체 `[0x1400058]`). 안 넘기면 아무 소리도 안 난다 —
   * 테스트는 그대로 두면 된다.
   */
  readonly sound?: SoundPort
  /**
   * 전역 G 지갑 (원본 `mgr[+0x64]`). 넘기면 **G의 주인이 지갑**이 되고 커리어 칸은 따라간다.
   * 안 넘기면 예전처럼 커리어 칸 하나로만 돈다 — 테스트는 그대로 두면 된다.
   */
  readonly wallet?: GamePointWalletSession
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 레코드 +0xbd). 안 넘기면 자동이다 —
   * 테스트는 그대로 두면 된다.
   *
   * 갈림길은 `0xae690` — `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이 거짓이면
   * 자동 진루 제어기(`0xaf8c0`)를 통째로 안 돌린다. 나만의리그 타자편은 사람이 늘 공격이라
   * 앞 항이 늘 거짓 → **설정이 그대로 먹는다.**
   */
  readonly runningModeManual?: boolean
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (GP 아이템 0x22e35 · G 사용처 0x22c29 · 획득 GP 0x22c7d · 켠 스킬 0xb663c).
   * 안 넘기면 아무것도 안 쌓는다 — 테스트는 그대로 두면 된다.
   */
  readonly recordStat?: (event: AnnalsStatEvent) => void
  /**
   * 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` (`useAceLevels().levels`). 같은 날 CPU 끼리 경기(0xc2a48)·포스트시즌
   * CPU 경기(0xc2760)의 마선수 능력치 배율(0xd88aa)이 이 칸을 본다. 안 넘기면 Lv1(60%) — 테스트는 그대로 두면 된다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 0x29 "오토봇 배트" 검사가 적재해 읽는 다른 두 저장 — 나리 투수편 저장
   * +0x7a · 시즌모드 시즌 기록 +0x7a · 전역 해금표 `app+0xc0`. 팝업을 닫을 때 읽는다. 안 넘기면 검사를 건너뛴다.
   */
  readonly readRegularSeasonOtherModes?: () => RegularSeasonOtherModes | undefined
  /** 공용 창에 히든 오픈 알림 (0x62368 → 0x74ef5) — 새로 연 k 만 넘긴다. 정규시즌 우승 팝업 0xb 닫힘이 쓴다 */
  readonly announceHiddenOpen?: (ids: readonly number[]) => void
  /**
   * 열린 마선수 로컬 번호 (전역 저장 +0x30.. 마투수 · +0x35.. 마타자, `useAceOpen`). 142 진입 0x1c46c 가 여기서
   * 내 팀 마선수를 굴린다(0x9f604 · 0x9f650). 안 넘기면 기본 개방 둘(마투수 0 · 마타자 0)이다.
   */
  readonly openedAces?: NariOpenedAces
  /**
   * 전역기록 +0x50(모드 4 "타자편 경기 중간 저장됨") 칸 — 142 확인이 세우고 등록·정산·지우기가 내린다(`entities/mode-save`).
   * 안 넘기면 아무 데도 안 쓴다.
   */
  readonly nariGameSave?: NariGameSavePort
  /**
   * 나간 마선수 대결 대기 칸 — 원본 **전역기록** g[0xec] · g[0xee] · g[0x11f] · g[0x144](타자편, `entities/mode-save`
   * `withAceMatchHeld`). 선수를 새로 만들어도 남는다. 안 넘기면 세션 메모리에만 든다.
   */
  readonly aceMatchPending?: AceMatchPendingPort
  /**
   * 두 편의 대결 대기 칸 g[0x11f] · g[0x176] (전역기록) — 자동 훑기 0x1cf9c 의 가드(1cfe4~1d008)가 모드를 안 보고 둘 다 본다
   * (`isAutoScanHeldByAceMatch`, B-124). 안 넘기면 가드가 없다.
   */
  readonly aceMatchHold?: AceMatchHoldPort
  /**
   * 화면이 '관리' 인 채 105 에 다시 들어온 앞 상태가 0x1aec4 의 배경음 4 목록에 들 때(125 훈련 결과 → 105) 부른다 — 배경음 표
   * `useScreenBgm` 의 다시 틀기(`restartsManagementBgmFrom`). 앱이 세션보다 먼저 배경음 표를 세우므로 수를 앱이 든다
   */
  readonly onManagementBgmRestart?: () => void
}

/** 기본값을 채운 매개변수 — 하위 훅이 받는다(`CareerScope`). `audio` 는 소리 통로가 없으면 조용한 포트다 */
export interface CareerSessionArgs extends Omit<
  CareerSessionInput,
  'sound' | 'runningModeManual' | 'recordStat' | 'openedAces' | 'onManagementBgmRestart'
> {
  readonly audio: SoundPort
  readonly runningModeManual: boolean
  readonly recordStat: (event: AnnalsStatEvent) => void
  readonly openedAces: NariOpenedAces
  readonly onManagementBgmRestart: () => void
}

const NO_STAT = () => {}
const NO_BGM_RESTART = () => {}

/** 처음부터 열린 마선수 — 저장 +0x30 · +0x35 (`normalizeAceOpenSave` 가 늘 켠다) */
const DEFAULT_NARI_OPENED_ACES: NariOpenedAces = {
  pitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
  batterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
}

/** 기본값 채우기 — 통로를 안 받으면 조용한 포트로(아래 자리들이 `sound` 가 있는지 매번 보지 않게 한다) */
export function careerSessionArgsOf(input: CareerSessionInput, silent: SoundPort): CareerSessionArgs {
  const { sound, runningModeManual, recordStat, openedAces, onManagementBgmRestart, ...rest } = input
  return {
    ...rest,
    audio: sound ?? silent,
    runningModeManual: runningModeManual ?? false,
    recordStat: recordStat ?? NO_STAT,
    openedAces: openedAces ?? DEFAULT_NARI_OPENED_ACES,
    onManagementBgmRestart: onManagementBgmRestart ?? NO_BGM_RESTART,
  }
}
