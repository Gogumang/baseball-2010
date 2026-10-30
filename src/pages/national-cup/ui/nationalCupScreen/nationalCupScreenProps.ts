import type { ReactNode } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { NationalCup, NationalCupMatchup as Matchup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCupFinish, NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'

export interface NationalCupScreenProps {
  readonly mode: NationalCupMode
  /** 지금 대회 상태 (`createNationalCup()` 으로 시작한다) */
  readonly cup: NationalCup
  /** 연차 idx — 제 n 회 계산에 쓴다 (`SeasonRecord.yearIndex` = `S+0xb3`) */
  readonly yearIndex: number
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
  readonly random: RandomPort
  /**
   * 경기 시작 — 나리 상태 142 / 시즌 221 로 넘어가는 자리다.
   * 경기가 끝나면 `advanceNationalCupDay` 로 대회를 진행시키고 이 화면을 다시 띄우면 된다.
   */
  readonly onStartGame: (matchup: Matchup, cup: NationalCup) => void
  /**
   * 대회 끝 — 결과 팝업과 보상 팝업을 모두 닫았을 때. `finish.reward` 를 `applySeasonReward` 로 넣고,
   * `finish.openedTeams` 로 히든 팀을 열면 된다.
   *
   * 국가대항전 플래그(`SeasonRecord.nationalCup`)는 이 화면이 내리지 않는다 — 시즌모드는 대회 끝이 곧장 새 해
   * `0x6e0c` 로 가서 리그 초기화 memset 이 함께 지우고(588b201), 나만의리그는 제 세션이 내린다
   * (`finishNationalCup` 주석 참고).
   */
  readonly onFinish: (finish: NationalCupFinish, cup: NationalCup) => void
  /** 처음 그릴 단계 — 나리 142 취소(0x13c72 의 S+0x12c 갈래)는 135(순위)로 돌아온다. 안 주면 134(대진) */
  readonly initialStep?: '대진' | '순위'
  /**
   * 화면 맨 밑에 먼저 깔 것 — 시즌 장면 0x105 는 상태별 그리기 앞에 늘 공통 앞그림 0xb810 을 부르고, 0xf3 국가대항전은 0xdd · 0xe0 · 0xe1 밖이라
   * 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 깐다(0xe9ac 0xefaa). 이 화면을 쓰는 다른 모드는 넘기지 않는다.
   */
  readonly underlay?: ReactNode
  /**
   * 나만의리그 편 — 나리 틀 0x16928 의 머리띠 제목(0x169ea~0x16a00)이 `장면+0xcc == 4 ? 8 : 9` 다.
   * 모드 4(타자편)면 제목 8 "나만의리그타자편", 모드 3(투수편)이면 제목 9 "나만의리그투수편". 시즌모드는 안 본다
   */
  readonly edition?: '타자편' | '투수편'
  /**
   * 나리 134 진입 `0x19f30` 의 히든 팀 열기 — 지금 열려 있는 히든 id(전역 해금표 `+0x7a+k`, 웹 `openedHiddenIds`).
   * 주면 대진(134)으로 들어설 때마다 대한민국 · (우승이면) 결승 상대 중 **처음 열리는 팀**마다 StrCOMMON[138]
   * "히든 팀 오픈!!" 팝업(0x22)을 띄우고 `onOpenHiddenTeams` 로 연다. 안 주면(시즌모드) 열지 않는다.
   * 142 취소로 135 부터 들어오면(`initialStep` 순위) 134 진입이 아니라 열지 않는다.
   */
  readonly openedHiddenIds?: readonly number[]
  /** 134 진입이 처음 연 히든 팀 — 원본은 그 자리에서 전역 `+0x7a+k = 1` · 전역 저장 `0x1f1b9` */
  readonly onOpenHiddenTeams?: (teams: readonly number[]) => void
  /**
   * 나리 134 첫 틀 `0x1b92c` 머리(1b92e~1b958)의 칭호 8 "국가 대표" — 비트 8 이 없을 때의 칭호 이름(`nationalCupStandingsTitleOf`).
   * 주면 들어설 때 칭호 팝업(0x1274c — 0x741a1 높이 0x78)을 띄우고, 확인(0x1b1e4)에서 `onConfirmEntryTitle` 이 주고 곧바로 장착한다.
   */
  readonly entryTitle?: string | null
  readonly onConfirmEntryTitle?: () => void
}
