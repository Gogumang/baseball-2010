import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup, NationalCupMatchup as Matchup } from '@/entities/national-cup/model/nationalCup'
import {
  confirmNationalCupStandings,
  finishNationalCup,
  nationalCupEditionOf,
  nationalCupResultText,
  nationalCupRewardText,
} from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish, NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'
import { NationalCupMatchup } from '@/pages/national-cup/ui/NationalCupMatchup'
import { NationalCupStandings } from '@/pages/national-cup/ui/NationalCupStandings'

export interface NationalCupScreenProps {
  readonly mode: NationalCupMode
  /** 지금 대회 상태 (`createNationalCup()` 으로 시작한다) */
  readonly cup: NationalCup
  /** 연차 idx — 제 n 회 계산에 쓴다 (`SeasonRecord.yearIndex` = `S+0xb3`) */
  readonly yearIndex: number
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
   * ⚠️ **국가대항전 플래그(`SeasonRecord.nationalCup`)를 내릴지 말지가 여기서 갈린다.**
   * 원본 시즌모드는 내리지 않아 다음 시즌이 막힌다 — `finishNationalCup` 의 큰 주석 참고
   * (사용자 판단 대기라 이 화면은 아무것도 하지 않는다).
   */
  readonly onFinish: (finish: NationalCupFinish, cup: NationalCup) => void
}

type Step = '순위' | '매치업' | '결과' | '보상'

/**
 * 국가대항전 화면 한 벌 — 순위 → 매치업 → (경기) → … → 결과 → 보상.
 *
 * 원본 한 바퀴 (나만의리그, P5 5절):
 * ```
 * 133 → 114(이벤트 461) → 134[순위] → 키 → 135[매치업] → 키 → 142[경기 준비] → 사람 경기
 *     → 결과 장면 0x4ea0c (같은 라운드 CPU 경기 0xc2dac · 하루 끝 0xb818c)
 *     → 101 재진입(0x1c154, S+0x12c 면) → 134 …  (4번)
 *     → 대회 끝이면 134 키에서 결과 팝업 0x25 → 0x1b92c → 우승이면 보상 팝업 0x26 → 새 시즌
 * ```
 * 시즌모드는 `242 → 211 → 243[순위] → 244[매치업] → 221 → 0x4b50 → 243 …` 로 상태 번호만 다르다.
 *
 * ⚠️ 이벤트 461~464(선발·거절)와 경기 자체는 이 화면 밖이다 — 앱이 잇는다.
 */
export function NationalCupScreen({ mode, cup, yearIndex, random, onStartGame, onFinish }: NationalCupScreenProps) {
  const [step, setStep] = useState<Step>('순위')
  /** 동전 던지기(`0xb858c`)가 우승국을 바꿀 수 있어 확인 뒤 대회를 따로 들고 있는다 */
  const [resolved, setResolved] = useState<NationalCup>(cup)

  const edition = nationalCupEditionOf(yearIndex)
  const current = step === '순위' || step === '매치업' ? cup : resolved
  const matchup = nationalCupMatchupOf(cup)
  const finish = finishNationalCup(mode, resolved)
  const championName = TEAMS[resolved.champion]?.name ?? ''

  const confirmStandings = () => {
    const next = confirmNationalCupStandings(cup, random)
    if (next.kind === '다음경기') return setStep('매치업')
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
      {step === '매치업' && matchup !== null ? (
        <NationalCupMatchup
          cup={cup}
          matchup={matchup}
          edition={edition}
          onStart={() => onStartGame(matchup, cup)}
          onBack={() => setStep('순위')}
        />
      ) : (
        <NationalCupStandings cup={current} onConfirm={confirmStandings} isConfirmable={step === '순위'} />
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
