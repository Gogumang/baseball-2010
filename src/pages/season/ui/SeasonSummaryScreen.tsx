import { useState } from 'react'
import { Button, MessageBox, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { koreanSeriesRewardOf, nextLeagueFirstAward } from '@/entities/season-mode/model/seasonRewards'
import type { LeagueFirstAward, SeasonReward } from '@/entities/season-mode/model/seasonRewards'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'
import { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

/**
 * 원본 문구 (`base/extracted/StrMODE.json` 그대로 — 번호는 P4 4b 확정).
 *   137 한국시리즈 우승 팀 알림(팝업 id 7)
 *   197 우승 보상(팝업 9) · 198 준우승 보상(팝업 10) — `%d` 셋은 인기도·평판·**만원** 소지금
 *   223 리그 1위 누적 G 지급 — `%d` 둘은 문턱 횟수·G
 */
const TEXT = {
  champion: '!C한국시리즈 우승!!N[!cFFFF00%s!cFFFFFF]', // StrMODE[137]
  koreanSeries: {
    197: '!C[!c00FF00한국시리즈 우승!!!cFFFFFF]!N!N인기도 +%d / 평판 +%d!N소지금 +%d만',
    198: '!C[!c00FF00한국시리즈 준우승!!!cFFFFFF]!N!N인기도 +%d / 평판 +%d!N소지금 +%d만',
  } as Readonly<Record<number, string>>,
  leagueFirst: '!C시즌모드 리그 1위 %d회!N달성!N[!cFFFF00%d G포인트!cFFFFFF] 지급', // StrMODE[223]
}

/** `%d`·`%s` 를 앞에서부터 하나씩 바꾼다 (원본 sprintf 와 같은 차례) */
function formatted(raw: string, values: readonly (string | number)[]): string {
  let index = 0
  return raw.replace(/%[ds]/g, () => String(values[index++] ?? ''))
}

export interface SeasonSummaryScreenProps {
  readonly record: SeasonRecord
  /** 포스트시즌 시리즈 (`entities/league`). `round === '종료'` 가 원본 **L+0x36(끝남)** 이다 */
  readonly series: PostseasonSeries | null
  /**
   * **내 팀의 포스트시즌 순위** `0xb7aa0(리그, 팀, 0)` — 0 우승 · 1 준우승 · 그 밖은 보상 없음.
   *
   * ⚠️ 웹 `entities/league` 에는 아직 이 함수가 없다(순위표 `rankingOf` 는 정규시즌 승패로만 센다).
   * 그래서 값을 지어내지 않고 **부르는 쪽에서 받는다** — 한국시리즈 우승팀이면 0,
   * 한국시리즈에서 진 팀이면 1 을 넘기면 된다.
   */
  readonly postseasonRank: number
  /** 저장(전역) **+0x145** — 리그 1위 G 를 이미 받은 문턱 비트 (시즌을 새로 시작해도 유지된다) */
  readonly leagueFirstAwardedBits: number
  /** 한국시리즈 보상 적용 (`0x85ec` — 팝업 7 이 닫힐 때 인기도·평판·소지금을 더한다) */
  readonly onApplyKoreanSeriesReward: (reward: SeasonReward) => void
  /** 리그 1위 G 지급 (`0x87e8` — 한 번에 하나, 팝업이 닫히면 다음 문턱을 다시 본다) */
  readonly onLeagueFirstAward: (award: LeagueFirstAward) => void
  /**
   * 포스트시즌이 아직 안 끝났다 — 원본은 라운드 `SR+0xb5` 의 대진에 내 팀이 있으면
   * `this+0x11c = 1` 로 **0xd7(선수단) → 경기**, 없으면 `0xc2760`(한 경기 시뮬)을 라운드가 바뀔
   * 때까지 돌린다. 둘 다 난수·경기가 필요해 이 화면에서 하지 않는다.
   */
  readonly onContinuePostseason?: () => void
  /**
   * 보상까지 다 끝났다 — 다음은 `afterKoreanSeries(record)` 가 고른다
   * (연차 idx **짝수** → 0xf2 국가대항전 안내 · 홀수 → 새 해 `0x6e0c`).
   */
  readonly onFinish: () => void
}

type Phase = '대진표' | '우승문구' | '한국시리즈보상' | '리그1위'

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
const NO_CHAMPION = 0xf

/**
 * 시즌 결산 (장면 0x105 상태 **0xef**, 갱신 `0x6900` · 키 `0x9dc8` · 그리기 `0xb7b8` — P4 1a·4b 확정).
 *
 * `phase = 0xf` 를 세우고 **포스트시즌 대진표 0x853ac** 를 그린다 (R13 1절: 0xef 의 그리기가
 * 바로 대진표다). 시리즈가 끝났으면 우승 팝업 → 보상 → 리그 1위 G 순서로 이어진다:
 *
 * 1. **StrMODE[137]** "한국시리즈 우승! [우승팀]" 팝업(id 7)
 * 2. 팝업이 닫히면 `0x85ec` 가 내 팀 포스트시즌 순위로 보상을 준다 —
 *    0 우승 **[197]** 인기도 +25 · 평판 +30 · 소지금 +40(4000만) / 1 준우승 **[198]** +15 · +15 · +15(1500만)
 * 3. 이어 `0x87e8` 이 **리그 1위 누적 G [223]** 를 한 번에 하나씩 준다
 *    (문턱 3·10·20회 → 1000·5000·10000 G, 비트가 **전역 저장**이라 다시 못 받는다)
 * 4. 끝나면 연차 idx 짝수 → 국가대항전, 홀수 → 새 해 (`afterKoreanSeries`)
 *
 * ⚠️ **준우승 문구의 소지금 표시는 1500만인데 실제로 더하는 값도 15(=1500만) 다** — 표시와 코드가
 * 어긋나는 것은 국가대항전 준우승 쪽(StrMODE[200])이고, 그 버그는 `seasonRewards.ts` 가 이미
 * 그대로 옮겨 두었다. 여기서는 표시값을 **실제로 더하는 보상값에서 뽑아** 두 값이 늘 같게 했다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 아래 설명 줄과 단추는 원본에 없다(소프트키 몫).
 * 대진표 좌표는 P6 4a-1 확정값이라 근사하지 않았다.
 */
export function SeasonSummaryScreen(props: SeasonSummaryScreenProps) {
  const {
    record, series, postseasonRank, leagueFirstAwardedBits,
    onApplyKoreanSeriesReward, onLeagueFirstAward, onContinuePostseason, onFinish,
  } = props

  const [phase, setPhase] = useState<Phase>('대진표')
  const [awardedBits, setAwardedBits] = useState(leagueFirstAwardedBits)
  const [pendingAward, setPendingAward] = useState<LeagueFirstAward | null>(null)

  const isFinished = series !== null && series.round === '종료'
  const championId = series?.champion ?? (record.postseasonChampion === NO_CHAMPION ? null : record.postseasonChampion)
  const championName = championId === null ? '' : TEAMS[championId]?.name ?? ''
  const reward = koreanSeriesRewardOf(postseasonRank)

  /** 리그 1위 G 는 한 번에 하나다 — 줄 것이 없으면 결산이 끝난다 (`0x87e8`) */
  const goToLeagueFirst = (bits: number) => {
    const award = nextLeagueFirstAward(record, bits)
    if (award === null) {
      onFinish()
      return
    }
    setPendingAward(award)
    setPhase('리그1위')
  }

  const onPressNext = () => {
    if (!isFinished) {
      onContinuePostseason?.()
      return
    }
    setPhase('우승문구')
  }

  return (
    <RawScreen>
      <PostseasonBracketWindow series={series} />

      <div className={styles.caption} style={{ left: 0, top: 276, width: 240 }}>
        {isFinished
          ? `한국시리즈 우승 ${championName}`
          : `포스트시즌 ${series === null ? '' : series.round} 진행 중`}
      </div>

      <Button variant="corner" className={styles.cornerButton} onClick={onPressNext}>
        {isFinished ? '결과' : '경기'}
      </Button>

      {phase === '우승문구' && (
        <MessageBox
          text={formatted(TEXT.champion, [championName])}
          buttons={['OK']}
          onAnswer={() => {
            // 팝업 7 이 닫힐 때 보상이 붙는다 (0x85ec). 3위 아래는 문구도 보상도 없다
            if (reward.messageId === 0) {
              goToLeagueFirst(awardedBits)
              return
            }
            onApplyKoreanSeriesReward(reward)
            setPhase('한국시리즈보상')
          }}
        />
      )}

      {phase === '한국시리즈보상' && (
        <MessageBox
          text={formatted(TEXT.koreanSeries[reward.messageId] ?? '', [
            reward.popularity,
            reward.reputation,
            // 문구의 소지금은 **만원** 단위다 (표값 40 → 4000만)
            reward.money * MILLION_TO_TEN_THOUSAND,
          ])}
          buttons={['OK']}
          onAnswer={() => goToLeagueFirst(awardedBits)}
        />
      )}

      {phase === '리그1위' && pendingAward !== null && (
        <MessageBox
          text={formatted(TEXT.leagueFirst, [pendingAward.threshold, pendingAward.gamePoint])}
          buttons={['OK']}
          onAnswer={() => {
            onLeagueFirstAward(pendingAward)
            const next = awardedBits | (1 << pendingAward.bit)
            setAwardedBits(next)
            goToLeagueFirst(next)
          }}
        />
      )}
    </RawScreen>
  )
}
