import type { SeasonSceneState, SeasonMenuCursors } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import type { TeamGameSummary, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { LeagueFirstAward, SeasonReward } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonEventReward } from '@/entities/season-mode/model/seasonEventFlow'

/** `equipSeasonPlayer` 의 인자 */
export interface SeasonEquipPurchase {
  readonly isPitcher: boolean
  readonly recordIndex: number
  /** 새 소지금 (100만 원 단위) */
  readonly money: number
  /** 새 니블 네 칸 */
  readonly equipment: readonly number[]
  /** B-23 고친 길 — 부위별 산 칸 비트 (`SeasonPlayer.ownedEquipment`) */
  readonly ownedEquipment?: readonly number[]
}

export interface SeasonActions {
  /**
   * 새 시즌 — 0xc8 이름 입력에서 [2] 예(0x4a58) → 0xcc 0x5758. 이름은 0xa33e4 가 SR+0x17c 에 (≤ 8바이트, 끝 0).
   * 단장 줄(0xd5)·이벤트 글의 %s 가 이 이름이다.
   */
  readonly chooseTeam: (teamId: number, name: string) => void
  readonly goto: (scene: SeasonSceneState) => void
  /** 0xe5 진입 0x5cd0 첫머리 `0xb512c` × 열 팀 — 레코드에 남은 마선수를 뺀다 (`SeasonSave.recordAces`, U-105 r154) */
  readonly clearRecordAces: () => void
  readonly updateRecord: (record: SeasonRecord) => void
  readonly updateRoster: (roster: SeasonTeamRoster) => void
  /**
   * 명전 칸을 지웠다 — 시즌 저장이 있으면 내 팀 명단에서 그 명전 선수(기록 번호 `id`)를 빼고 저장한다 (`0x221dc`,
   * `removeHallOfFamerFromRoster`). 시즌 저장이 없으면 아무것도 안 한다.
   */
  readonly removeHallOfFamer: (id: number, isPitcher: boolean) => void
  /**
   * 나만의리그 초기화가 시즌 내 팀에서 그 편 나리 선수를 뺀다 — 0x224ec 칸 3 → `0x223a8(mgr, 1)`(투수) · 칸 4 → `(mgr, 0)`(타자)
   * (`removeCareerPlayerFromRoster`). 시즌 저장이 없으면 아무것도 안 한다.
   */
  readonly removeCareerPlayer: (isPitcher: boolean) => void
  /**
   * 시즌모드 초기화 — 모드 저장 지우기 `0x224ec(mgr, 2)`: game_s.sav 를 지우고 전역기록 +0x42(시즌 커리어 있음) ·
   * +0x4e(경기 중간 저장)를 0 으로. 다음 시즌모드 진입은 팀 고르기다. 경기진행 설정·창 본 표시(전역 칸)는 남는다.
   */
  readonly resetSeason: () => void
  /** 트레이드 한 번이 끝났다 (0xe7) — 커맨드 표시·명단·G 를 **한 번에** 적어 넣는다 */
  readonly finishTrade: (settlement: TradeSettlement) => void
  /**
   * 장비 창 0xdc(종류 3)의 구매 확정 — 0x7d90 결과 0x14: 소지금과 그 선수(팀 레코드 칸)의 장비 니블을 **한 번에** 커밋한다.
   * `recordIndex` 는 선수 고르기 0xdf 목록(레코드 차례 — 투수는 로테이션으로 섞인 차례)의 칸이다.
   */
  readonly equipSeasonPlayer: (purchase: SeasonEquipPurchase) => void
  /**
   * 서브아이템 상점 0xdc(종류 1) 구매 확정 — 0x7d90 결과 0xc: 소지금 − 값 × 10 · SR[0x58 + k] = 1 · 저장.
   * 돌려주는 글은 팝업 StrMODE[92] (가드는 화면이 `checkSeasonSubItem` 으로 먼저 본다)
   */
  readonly buySeasonSubItem: (slot: number) => string
  /**
   * GP 상점 0xdc(종류 2) 구매 확정 — 0x7d90 결과 0xd. 칸 3(십전대보탕)은 G 를 안 빼고 null(→ 상태 0xe8),
   * 그 밖은 G 차감 · 0x22c29(3, 값) · 효과 0xa310c · 0x22e35(2, 칸) · 저장 뒤 효과 글을 돌려준다
   */
  readonly buySeasonGpItem: (slot: number) => string | null
  /**
   * 상태 0xe8 키 0x7c00 — 투수(레코드 차례 칸)의 스태미나가 가득이면 StrMODE[211] 만, 아니면 G 차감 · 0x22c29(3, 값) ·
   * 0x22e35(2, 3) · 스태미나 10000 · 저장 뒤 StrMODE[178]. `recovered` 가 참이면 결과 0x1d(→ 0xdc)
   */
  readonly recoverSeasonPitcherStamina: (recordIndex: number) => { readonly notice: string; readonly recovered: boolean }
  readonly playNextGame: () => void
  /** 관리 메뉴의 "다음경기" — 다음경기 화면 0xd8 로 (들어옴 0x4cb8: phase = 4 · 저장) */
  readonly openNextGame: () => void
  /** 다음경기 화면의 확인 (0x48d0) — 포스트시즌이면 결산 0xef, 아니면 경기로 */
  readonly confirmNextGame: () => void
  /** 다음경기 화면의 취소 (0x48ea) — 관리 메뉴에서 왔을 때만 관리 메뉴로 돌아간다 */
  readonly cancelNextGame: () => void
  /** 0xd7 경기 전 마선수 고르기의 OK — 마투수 → 마타자 → 0xdd (0xa734) */
  readonly choosePreGameAce: (cell: number) => void
  /** 0xd7 의 CLR — 마타자 → 마투수, 마투수 → 포스트시즌 0xef · 그 밖 0xd8 (0xa900) */
  readonly cancelPreGameAce: () => void
  /** 0xdd 의 OK — 평판 16칸을 지우고 경기로 (0x847e → 0xe1) */
  readonly startPendingGame: () => void
  /** 0xdd 의 CLR — 국가대항전이면 대회 쪽, 아니면 0xd7 (0x844e) */
  readonly cancelMatchInfo: () => void
  /** 0xdd 의 '0' — 경기진행 설정 창 열고 닫기 (0x857a) */
  readonly toggleMatchSettings: () => void
  /** 설정 창 확인 "예" — 시즌 칸에 되쓰고 닫는다 (0x60376) */
  readonly applyMatchSettings: (settings: MatchProgressSettings) => void
  /** 0xdd 의 '4'/왼(유저 팀 · this+0x120 = 1) · '6'/오른(CPU 팀 · 0) → 0xe0 엔트리 편집 */
  readonly openEntryEdit: (isUserTeam: boolean) => void
  /** 0xe0 의 키 — 편집기 0x55864 를 돌리고 끝 코드면 0xdd 로 (0x7044) */
  readonly pressEntryKey: (key: EntryKey) => void
  /** 0xe0 — 웹 전용, 줄을 눌러 커서를 옮긴다 */
  readonly pointEntryCursor: (index: number) => void
  /** 0xe0 — 마선수 잠금 팝업을 닫는다 */
  readonly closeEntryAceLocked: () => void
  readonly confirmIncome: (record: SeasonRecord) => void
  /** 경기 뒤 마무리(0xf1) 결과판의 확인 — 키 0x49a4 (포스트시즌 0xef · 짝수 경기 0xc9 · 홀수 0xd8) */
  readonly confirmDayResults: () => void
  /**
   * 관리 메뉴의 요청 알림 [203] 에 답했다 — 0x73b8 의 팝업 0x27 갈래(7422~749e):
   * 예(0) → 상태 0xe5(트레이드 영입 선수)로 · 관리·구단관리 메뉴 커서를 칸 1 로 / 아니오(1)·취소(0x14) → this+0x148 = 0
   */
  readonly answerTradeRequest: (accept: boolean) => void
  /** 요청 트레이드 0xe5 의 [216] 에 "예" — 0x712a: this+0x148 = 0 · 구단관리 0xce */
  readonly cancelTradeRequest: () => void
  /** 관리 메뉴·구단관리 커서를 옮겼다 */
  readonly moveMenuCursor: (menu: keyof SeasonMenuCursors, index: number) => void
  /** 트레이드 결과 알림을 닫았다 — 0xc7ba: this+0x148 = 0 · 관리 메뉴 0xc9 (보통 트레이드도 같다) */
  readonly closeTradeResult: () => void
  /** 국가대항전 한 경기 — 사람이 대표팀을 조작한다 */
  readonly playCupGame: (myTeam: number, opponent: number) => void
  readonly finishCup: (finish: NationalCupFinish) => void
  /** 팀 트레이닝 한 번 — 굴리고 적용한 뒤 결과 팝업을 띄운다 (연출 0xde → 굴림 0xc074 → 적용 0xa2f24 → 팝업) */
  readonly runTraining: (slot: number) => void
  /** 훈련 결과 팝업 키 0xf2c8 의 확인 · 취소 — 팝업을 닫고(0x742a9) 관리 메뉴 0xc9 */
  readonly closeTrainingResult: () => void
  /** 외출 지도 확인 팝업 0x16 에 "예" — 0x4a94: 장소를 넘기고 연출 0xe3 으로 */
  readonly enterOuting: (place: number) => void
  /** 외출 결과 0xc81c — 연출이 끝난 틀에 굴리고 적용 · SR+4 = 1 · 저장하고 결과 팝업 0x17 을 띄운다 */
  readonly runOuting: (place: number) => void
  /** 결과 팝업 0x17 을 닫았다 — 0xce0c: SR+4 = 1 · 0xc9 */
  readonly closeOutingResult: () => void
  /**
   * 경기 결과 화면 확인 — 정산 진입(`enterGameSettlement`)이 정해 둔 장면으로 간다(정규는 관중수입 0xe9). 정산 진입을
   * 거치지 않았으면 여기서 정산한다
   */
  readonly finishGame: (summary: TeamGameSummary) => void
  /**
   * 시즌모드로 들어와 장면 0x105 를 새로 세웠다(메인 메뉴 시즌모드 · [최근게임] 의 3284e — 중간 저장 경기가 없을 때). 상태 1 의
   * 적재 0x75fc 가 로딩 판에 팁 rand(0, 73) 을 굴린다(76cc `0x53dbd`) — `SeasonRoute` 가 들어올 때 한 번 부른다
   */
  readonly constructScene: () => void
  /** 관리 메뉴 0xc9 의 확인 키 — 0x8f82 가 mgr+0x304 = 0 (490 쿨다운 검사가 다시 선다) */
  readonly pressManagementConfirm: () => void
  /**
   * 경기 화면이 이어하기 저장을 썼다 — 0xdd OK(0x847e: +0x4e = 1 · 칸 0xc 두 팀 · 0xd st · 파일) · 반 이닝 0x4f928(모드 2:
   * 칸 0xb SR · 0xc · 0xd) · 경기 장면 진입 0x3a426(+0x4e = 1 · 파일). +0x4e 를 세우고 블록을 시즌 저장에 쓴다.
   */
  readonly saveGameProgress: (progress: TeamGameProgress) => void
  /**
   * 경기 끝 정산 진입 0x4ea0c — 정산을 다 하고 +0x4e = 0(0x4f3d6, 블록도 비운다) · 저장. 화면은 결과 화면 확인(`finishGame`)이
   * 넘긴다
   */
  readonly enterGameSettlement: (summary: TeamGameSummary) => void
  /**
   * **시즌모드에 들어온다** — 0x327b8(this, 2) 의 모드 2 갈래(3284e): `(+0x42 && +0x4e)` 면 0x213c0(앱, 2, 0) 으로 시즌 저장을
   * 올려 곧장 경기 장면 0x104 로, 아니면 장면 0x105(시즌 관리). 메인 메뉴 시즌모드(하위 14 → 0x24698)와 [최근게임] 모드 2 가
   * 같은 길이다. 경기로 갔으면 참.
   */
  readonly resumeSavedGame: () => boolean
  /**
   * 경기 중 메뉴 "나가기" — 경기 상태 0x22 0x40140 은 모드를 가리지 않고 메인 메뉴(장면 0x103, 하위 4)로 나가며
   * +0x4e 를 안 건드린다. 그래서 다음에 시즌모드로 들어오면 마지막 반 이닝 저장에서 다시 선다.
   */
  readonly leaveGame: () => void
  /** 결산 화면에서 포스트시즌을 한 걸음 진행시킨다 (0xef — 내 차례면 경기, 아니면 CPU 구간) */
  readonly continuePostseason: () => void
  /** 리그 1위 G 를 지급하고 받은 비트를 남긴다 (0x6900 · 0x87e8) */
  readonly awardLeagueFirst: (award: LeagueFirstAward) => void
  /** 경기 중 자동진행 값 등 G 를 쓴다 (모자라면 화면이 먼저 막는다) */
  readonly spendGamePoint: (cost: number) => void
  /** 구장 히든 아이템을 연다 (0x81d0 컬렉터 해금 — `app[0xe0 + …] = 1`) */
  readonly openStadiumItems: (unlockIds: readonly number[]) => void
  /**
   * 국가대항전 0xf3 갱신 0xe684 가 처음 연 히든 팀 — 0x65de5(전역, 0) 대한민국, 우승(SR+0x144 == 10)이면 결승 상대도.
   * 0x65de4 가 전역 `+0x7a+k = 1` · 전역 저장 0x1f1b9 · StrCOMMON[138] 팝업 0x22 (팝업은 `NationalCupScreen` 이 띄운다)
   */
  readonly openCupHiddenTeams: (teams: readonly number[]) => void
  /**
   * 엔딩 보너스 팝업 0x2b 를 닫았다 — 0x8bd8 의 8bf4~8c84: G += 0xcbc2e[e] × 1000(99999 상한) · 전역기록 저장 · SR+0x7b = 1 ·
   * 저장 · `0x22c7d(보너스, 2)` 통계. 이미 받았으면 아무것도 안 한다
   */
  readonly receiveEndingBonus: () => void
  /**
   * 엔딩을 넘겼다 — 키 0x6b3c 가 SR+0x7b 가 선 채로 단계 1 로 넘기고, 0x8bd8 의 8ccc~8d2c 가 그 화면 전환이 끝나면
   * SR+0x1bc = 1 · 저장 · 관리 메뉴 0xc9
   */
  readonly finishEnding: () => void
  /**
   * 결산을 닫았다(`0x87b4`) — 국가대항전 연차면 대회, 아니면 새 해 (afterKoreanSeries).
   * `reward` 는 [197]/[198] 팝업이 닫힐 때 0x85ec 가 더하는 한국시리즈 보상 — 더하기와 0x87b4 가 한 덩어리다
   */
  readonly finishSeason: (reward?: SeasonReward | null) => void
  /**
   * 이벤트 재생 0xd3 이 끝났다 — 지나온 보상(명령 7)과 본 이벤트를 받아 적용하고, 392 면 목표 결과 393~396 을
   * 이어 틀고, 아니면 돌아갈 상태로 간다.
   */
  readonly finishSeasonEvent: (rewards: readonly SeasonEventReward[], viewedEventIds: readonly number[], endingEventId?: number | null) => void
  /**
   * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 2 갈래). 그 끝이 본 표시
   * (지금 이벤트 · 떠나온 이벤트 0x8b0e4) · 이벤트별 phase(8ccc8)를 하고 저장한다. `StoryScreen.onReward` 로 잇는다.
   */
  readonly giveSeasonEventReward: (rewards: readonly SeasonEventReward[], eventId: number, viewedEventIds?: readonly number[]) => void
  /**
   * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 → 저장(0x1fded · 0x22755). 0x8b12c 의 외출 갈래는
   * [[mgr+0xb4]+0x174] 가 나리 외출 상태(0x70 · 0x71)일 때라 시즌에서는 안 탄다. `StoryScreen.onChoiceConfirm` 으로 잇는다.
   */
  readonly confirmSeasonEventChoice: (eventId: number, leftEventIds: readonly number[]) => void
  /**
   * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: 시즌모드라 기록 +0x187 = 1 ·
   * 저장(0x22755). 하위와 상관없이 모든 system 창이다.
   */
  readonly confirmEventSystemWindow: () => void
  readonly clearNotice: () => void
  readonly quit: () => void
}
