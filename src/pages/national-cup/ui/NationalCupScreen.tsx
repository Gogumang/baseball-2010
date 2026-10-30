import { useEffect, useEffectEvent, useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { confirmNationalCupStandings, finishNationalCup, nationalCupEditionOf } from '@/entities/national-cup/model/nationalCupFlow'
import { NationalCupBracket } from '@/pages/national-cup/ui/NationalCupBracket'
import { NationalCupStandings } from '@/pages/national-cup/ui/NationalCupStandings'
import { entryStateOf } from '@/pages/national-cup/ui/nationalCupScreen/nationalCupEntry'
import type { EntryState } from '@/pages/national-cup/ui/nationalCupScreen/nationalCupEntry'
import { nationalCupKeyActionOf, shownCupOf } from '@/pages/national-cup/ui/nationalCupScreen/nationalCupKeys'
import { NationalCupFrame } from '@/pages/national-cup/ui/nationalCupScreen/NationalCupFrame'
import { NationalCupPopups } from '@/pages/national-cup/ui/nationalCupScreen/NationalCupPopups'
import type { NationalCupScreenProps } from '@/pages/national-cup/ui/nationalCupScreen/nationalCupScreenProps'

type Step = '대진' | '순위' | '결과' | '보상' | '끝'

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
  mode,
  cup,
  yearIndex,
  gamePoint = 0,
  random,
  onStartGame,
  onFinish,
  initialStep = '대진',
  underlay,
  edition: nariEdition = '타자편',
  openedHiddenIds,
  onOpenHiddenTeams,
  entryTitle,
  onConfirmEntryTitle,
}: NationalCupScreenProps) {
  const [step, setStep] = useState<Step>(initialStep)
  /** 들어선 그 순간의 팝업 — 진입은 한 번이라 처음 그린 때의 값으로 굳힌다 */
  const [entry] = useState<EntryState>(() => entryStateOf(cup, initialStep === '대진', openedHiddenIds, entryTitle))
  const [entryPopupIndex, setEntryPopupIndex] = useState(0)
  const entryPopup = entry.popups[entryPopupIndex] ?? null

  // 0x65de4 — 처음 열린 팀은 팝업을 띄우는 그 자리에서 전역 해금표에 쓰고 저장한다.
  // 진입 한 번에 한 번만(entry 는 굳힌 값) — 이 화면이 새로 설 때가 134 진입이다. 넘길 곳은 최신 것을 읽기만 한다
  const saveOpenedTeams = useEffectEvent((teams: EntryState['openedTeams']) => onOpenHiddenTeams?.(teams))
  useEffect(() => {
    if (entry.openedTeams.length > 0) saveOpenedTeams(entry.openedTeams)
  }, [entry])

  /** 띄운 팝업이 닫혔다 — 대기 칸의 다음 팝업(0x75440) */
  const closeEntryPopup = () => setEntryPopupIndex((index) => index + 1)
  /** 동전 던지기(`0xb858c`)가 우승국을 바꿀 수 있어 확인 뒤 대회를 따로 들고 있는다 */
  const [resolved, setResolved] = useState<NationalCup>(cup)

  const edition = nationalCupEditionOf(yearIndex)
  const matchup = nationalCupMatchupOf(cup)
  const finish = finishNationalCup(mode, resolved)

  const confirmBracket = () => {
    const next = confirmNationalCupStandings(cup, random)
    if (next.kind === '다음경기') return setStep('순위')
    setResolved(next.cup)
    setStep('결과')
  }

  /**
   * 대회 끝 — 팝업이 닫힌 틀에 (나리는) 새 시즌 0x1b768(1bb28)을 부른다. 나리 134 는 그 뒤에도 대진판을 그리며
   * 효과기 끝을 기다린다(1bb2c~1bb64) — 팝업 없이 대진판만 남긴다(`YearCoverHoldLayer`)
   */
  const finishCup = () => {
    setStep('끝')
    onFinish(finish, resolved)
  }

  const closeResult = () => {
    // 보상이 없으면(탈락·나리 준우승) 보상 팝업 없이 곧장 끝난다 — 원본도 그렇다
    if (finish.reward.messageId === 0) return finishCup()
    setStep('보상')
  }

  // 화면 탭(대진판 · 순위표의 투명 누름 칸)은 OK 와 같다 — 키 길은 `nationalCupKeyActionOf` 머리말
  const handleKey = useEffectEvent((key: string): boolean => {
    const action = nationalCupKeyActionOf(key, step, entryPopup !== null, matchup !== null, mode)
    if (action === '대진확인') confirmBracket()
    else if (action === '경기시작' && matchup !== null) onStartGame(matchup, cup)
    else if (action === '대진으로') setStep('대진')
    return action !== null
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (handleKey(event.key)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen>
      {underlay}
      {step === '순위' && matchup !== null ? (
        // 135 키 0x10680 · 0xf4 키 0x4a18: 확인 → 142 경기 준비 / 0xdd 경기정보
        <NationalCupStandings cup={cup} onConfirm={() => onStartGame(matchup, cup)} />
      ) : (
        // 팝업이 떠 있는 동안은 팝업 관리자가 키를 먹는다 — 대진판 확인은 팝업이 다 닫힌 뒤
        <NationalCupBracket cup={shownCupOf(step, cup, resolved)} onConfirm={confirmBracket} isConfirmable={step === '대진' && entryPopup === null} />
      )}

      <NationalCupFrame
        mode={mode}
        gamePoint={gamePoint}
        nariEdition={nariEdition}
        isStandings={step === '순위'}
        onBackToBracket={() => setStep('대진')}
      />

      <NationalCupPopups
        entryPopup={entryPopup}
        entryPopupIndex={entryPopupIndex}
        onConfirmEntryTitle={onConfirmEntryTitle}
        onCloseEntryPopup={closeEntryPopup}
        step={step}
        edition={edition}
        finish={finish}
        champion={resolved.champion}
        onCloseResult={closeResult}
        onCloseReward={finishCup}
      />
    </RawScreen>
  )
}
