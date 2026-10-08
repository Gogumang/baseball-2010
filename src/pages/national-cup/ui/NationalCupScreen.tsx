import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup, NationalCupMatchup as Matchup } from '@/entities/national-cup/model/nationalCup'
import {
  confirmNationalCupStandings,
  finishNationalCup,
  hiddenTeamOpenText,
  nationalCupEditionOf,
  nationalCupResultText,
  nationalCupRewardText,
  newlyOpenedHiddenTeamsOf,
  queuedPopupsOf,
} from '@/entities/national-cup/model/nationalCupFlow'
import { conditionTextOf } from '@/entities/career/model/titles'
import type { NationalCupFinish, NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'
import { NationalCupBracket } from '@/pages/national-cup/ui/NationalCupBracket'
import { NationalCupStandings } from '@/pages/national-cup/ui/NationalCupStandings'

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
   * 주면 들어설 때 칭호 팝업(0x1274c, 종류 0x78)을 띄우고, 확인(0x1b1e4)에서 `onConfirmEntryTitle` 이 주고 곧바로 장착한다.
   */
  readonly entryTitle?: string | null
  readonly onConfirmEntryTitle?: () => void
}

/** 134 에 들어설 때 걸리는 팝업 — 히든 팀 오픈(0x22) · 칭호(0x78) */
type EntryPopup =
  | { readonly kind: '히든팀'; readonly text: string }
  | { readonly kind: '칭호'; readonly text: string }

interface EntryState {
  /** 이번 진입이 처음 연 히든 팀 (팝업이 대기 칸에서 밀려도 열기는 다 일어난다) */
  readonly openedTeams: readonly number[]
  readonly popups: readonly EntryPopup[]
}

/**
 * 134 진입 한 번의 팝업 — 진입 `0x19f30` 이 먼저 `0x65de4` 로 히든 팀 팝업을 걸고(대한민국 → 결승 상대), 같은 진입의 첫 틀
 * `0x1b92c`(장면+0x2c == 1)가 칭호 8 팝업을 건다. 팝업 관리자는 띄운 것 하나 + 대기 한 칸이라 `queuedPopupsOf` 로 거른다.
 */
function entryStateOf(
  cup: NationalCup,
  isEntering: boolean,
  openedHiddenIds: readonly number[] | undefined,
  entryTitle: string | null | undefined,
): EntryState {
  if (!isEntering) return { openedTeams: [], popups: [] }
  const openedTeams = openedHiddenIds === undefined ? [] : newlyOpenedHiddenTeamsOf(cup, openedHiddenIds)
  const hiddenPopups: EntryPopup[] = openedTeams.map((team) => ({ kind: '히든팀', text: hiddenTeamOpenText(TEAMS[team]?.name ?? '') }))
  const titlePopups: EntryPopup[] = entryTitle === null || entryTitle === undefined
    ? []
    // 칭호 팝업 그림 0x1afe8 — 이름 StrNICKNAME[i] 와 조건 문구 [i+64] (관리 화면 칭호 팝업과 같은 근사 — 알림 상자)
    : [{ kind: '칭호', text: `!C${entryTitle}!N${conditionTextOf(entryTitle) ?? ''}` }]
  return { openedTeams, popups: queuedPopupsOf([...hiddenPopups, ...titlePopups]) }
}

type Step = '대진' | '순위' | '결과' | '보상'

/**
 * 국가대항전 화면 한 벌 — 대진 → 순위 → (경기) → … → 결과 → 보상.
 *
 * 원본 한 바퀴 (나만의리그, P5 5절):
 * ```
 * 133 → 114(이벤트 461) → 134[대진판 0x85af4] → 키 → 135[순위표 0x7f070] → 키 → 142[경기 준비] → 사람 경기
 *     → 결과 장면 0x4ea0c (같은 라운드 CPU 경기 0xc2dac · 하루 끝 0xb818c)
 *     → 101 재진입(0x1c154, S+0x12c 면) → 134 …  (4번)
 *     → 대회 끝이면 134 키에서 결과 팝업 0x25 → 0x1b92c → 우승이면 보상 팝업 0x26 → 새 시즌
 * ```
 * 시즌모드는 `0xf2 → 0xd3 → 0xf3[대진판] → 0xf4[순위표] → 0xdd → … → 0xf3 …` 로 상태 번호만 다르다.
 *
 * **그림** (직접 떴다): 134 · 0xf3 그림(0x19fc8 · 0xe6e4)은 둘 다 `0x85af4` 하나만 부른다 — 단계(`S+0x12d`)별
 * mode_ui 프레임 66/67/68 대진판(`NationalCupBracket`). 135 · 0xf4 그림(0x168dc → 0x168a4 · 0xae5c → 0xae24)은
 * `0x7f070(ui, L)` 순위표 4줄 + 0x7f4ec(`NationalCupStandings`). 예전 웹은 이 둘을 거꾸로("순위 → 매치업") 두고
 * 매치업 자리에 원본에 없는 "VS" 판(근사)을 그렸다 — 원본 차례·그림대로 바로잡았다.
 * 대회가 끝나 결과 팝업이 뜨는 동안에도 뒤 그림은 134 · 0xf3 의 대진판이다(단계 0 → 프레임 68 우승국,
 * 결승 동전 던지기면 단계 1 그대로 프레임 67).
 *
 * **134 진입 팝업** (나리만): 진입 0x19f30 이 처음 열리는 히든 팀마다 StrCOMMON[138] 팝업(0x22)을, 같은 진입의 첫 틀
 * 0x1b92c 머리가 칭호 8 "국가 대표" 팝업(0x78)을 건다 — 히든 팀이 먼저, 닫으면 칭호(`queuedPopupsOf`). 135 로 바로 오는
 * 142 취소 길은 134 진입이 아니라 없다.
 *
 * ⚠️ 이벤트 461~464(선발·거절)와 경기 자체는 이 화면 밖이다 — 앱이 잇는다.
 *
 * **머리띠·바닥** (직접 떴다): 두 그림 모두 끝에서 0x7f4ec(판)로 판에 맡긴 제목·바닥을 0x54d95 에 넘긴다 —
 * 대진(134 0x19fc8 / 0xf3 0xe6e4 → 0x85af4, 끝 0x85e36) · 순위(135 0x168dc → 0x168a4 / 0xf4 0xae5c → 0xae24, 끝 0x7f4ed).
 * - 시즌 틀 0xb810: 0xf3 → 제목 10 · **바닥 1**(0xb88e~0xb8a6), 0xf4 는 "그 밖" → 10 · **5**.
 * - 나리 틀 0x16928: 0x86 · 0x87 둘 다 "그 밖"(0x169ea~0x16a08) → 제목 [장면+0xcc] == 4 ? 8 : 9 · **5**.
 *   나리 135 키 0x10680 은 확인만 본다 — 취소 길이 없어 되돌아가기 표시는 그려도 눌리지 않는다.
 *   시즌 0xf4 키 0x4a18 은 −16 → 0xf3 이 있다. 134 · 0xf3 키(0x19fdc · 0xe6f8)도 확인만 본다.
 */
export function NationalCupScreen({
  mode, cup, yearIndex, gamePoint = 0, random, onStartGame, onFinish, initialStep = '대진', underlay, edition: nariEdition = '타자편',
  openedHiddenIds, onOpenHiddenTeams, entryTitle, onConfirmEntryTitle,
}: NationalCupScreenProps) {
  const [step, setStep] = useState<Step>(initialStep)
  /** 들어선 그 순간의 팝업 — 진입은 한 번이라 처음 그린 때의 값으로 굳힌다 */
  const [entry] = useState<EntryState>(() => entryStateOf(cup, initialStep === '대진', openedHiddenIds, entryTitle))
  const [entryPopupIndex, setEntryPopupIndex] = useState(0)
  const entryPopup = entry.popups[entryPopupIndex] ?? null

  // 0x65de4 — 처음 열린 팀은 팝업을 띄우는 그 자리에서 전역 해금표에 쓰고 저장한다
  useEffect(() => {
    if (entry.openedTeams.length > 0) onOpenHiddenTeams?.(entry.openedTeams)
    // 진입 한 번에 한 번만 — 이 화면이 새로 설 때가 134 진입이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry])

  const closeEntryPopup = () => {
    // 칭호 팝업 확인 0x1b1e4 — 비트 · 곧바로 장착(+0x1c4) · 저장
    if (entryPopup?.kind === '칭호') onConfirmEntryTitle?.()
    setEntryPopupIndex((index) => index + 1)
  }
  /** 동전 던지기(`0xb858c`)가 우승국을 바꿀 수 있어 확인 뒤 대회를 따로 들고 있는다 */
  const [resolved, setResolved] = useState<NationalCup>(cup)

  const edition = nationalCupEditionOf(yearIndex)
  const current = step === '대진' || step === '순위' ? cup : resolved
  const matchup = nationalCupMatchupOf(cup)
  const finish = finishNationalCup(mode, resolved)
  const championName = TEAMS[resolved.champion]?.name ?? ''

  const confirmBracket = () => {
    const next = confirmNationalCupStandings(cup, random)
    if (next.kind === '다음경기') return setStep('순위')
    setResolved(next.cup)
    setStep('결과')
  }

  const closeResult = () => {
    // 보상이 없으면(탈락·나리 준우승) 보상 팝업 없이 곧장 끝난다 — 원본도 그렇다
    if (finish.reward.messageId === 0) return onFinish(finish, resolved)
    setStep('보상')
  }

  return (
    <RawScreen>
      {underlay}
      {step === '순위' && matchup !== null ? (
        // 135 키 0x10680 · 0xf4 키 0x4a18: 확인 → 142 경기 준비 / 0xdd 경기정보
        <NationalCupStandings cup={cup} onConfirm={() => onStartGame(matchup, cup)} />
      ) : (
        // 팝업이 떠 있는 동안은 팝업 관리자가 키를 먹는다 — 대진판 확인은 팝업이 다 닫힌 뒤
        <NationalCupBracket cup={current} onConfirm={confirmBracket} isConfirmable={step === '대진' && entryPopup === null} />
      )}

      {/* 시즌 0xf3 은 제목 10 · 바닥 1, 0xf4 는 10 · 5. 나리 134·135 는 제목 장면+0xcc == 4 ? 8(타자편) : 9(투수편) · 5 — 되돌아가기는 표시만 */}
      {mode === '시즌모드'
        ? <ScreenFrame title="시즌모드" gamePoint={gamePoint}
            // 0xf4 키 0x4a18 만 −16 → 0xf3. 나리 0x10680 은 확인만 본다
            onBack={step === '순위' ? () => setStep('대진') : null} />
        : <ScreenFrame title={nariEdition === '투수편' ? '나만의리그투수편' : '나만의리그타자편'} gamePoint={gamePoint} onBack={null} footer={5} />}

      {entryPopup !== null && (
        <MessageBox text={entryPopup.text} buttons={['확인']} onAnswer={closeEntryPopup} />
      )}

      {step === '결과' && (
        <MessageBox
          text={nationalCupResultText(edition, finish.isKoreaChampion, championName)}
          buttons={['확인']}
          onAnswer={closeResult}
        />
      )}

      {step === '보상' && (
        <MessageBox
          text={nationalCupRewardText(finish.reward)}
          buttons={['확인']}
          onAnswer={() => onFinish(finish, resolved)}
        />
      )}
    </RawScreen>
  )
}
