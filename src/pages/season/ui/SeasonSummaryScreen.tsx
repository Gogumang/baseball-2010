import { useEffect, useRef, useState } from 'react'
import { Button, MessageBox, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_AUTOBOT_BAT_HIDDEN_ID, koreanSeriesRewardOf, nextLeagueFirstAward,
} from '@/entities/season-mode/model/seasonRewards'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import type {
  LeagueFirstAward, SeasonReward, SeasonSummaryEntry,
} from '@/entities/season-mode/model/seasonRewards'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'
import { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

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
  /**
   * 지금 결산 진입(`0x6900`). `serial` 이 바뀔 때마다 진입 몫을 **한 번** 띄운다 — 0x29 "오토봇 배트" 가 새로 열렸으면
   * 해금 알림 창(0x62368 → 0x74ef5, 꼬리표 0)과 그 창이 닫힐 때 `0x87e8` 의 G 검사 하나, 아니면 진입의 G 검사 하나.
   * null 이면 진입 효과가 아직 안 돌았다 — 아무것도 띄우지 않고 기다린다.
   */
  readonly entry: SeasonSummaryEntry | null
  /** 한국시리즈 보상 적용 (`0x85ec` — 팝업 7 이 닫힐 때 인기도·평판·소지금을 더한다) */
  readonly onApplyKoreanSeriesReward: (reward: SeasonReward) => void
  /**
   * 리그 1위 G 지급 — 원본은 StrMODE[223] 팝업을 띄우는 **그 자리에서** G·비트·저장을 한다(0x6a5e 팝업 뒤 0x6a64~,
   * 0x8892 뒤 0x8896~). 그래서 팝업이 뜰 때 부른다.
   */
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
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
}

type Phase = '대진표' | '해금알림' | '리그1위' | '우승문구' | '한국시리즈보상'

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
const NO_CHAMPION = 0xf

/**
 * 시즌 결산 (장면 0x105 상태 **0xef**, 진입 `0x6900` · 키 `0x9dc8` · 갱신 `0x85ec` · 그리기 `0xb7b8` — P4 1a·4b,
 * 팝업 꼬리표 흐름은 0x6900 · 0x85ec · 0x9dc8 을 직접 떴다).
 *
 * `phase = 0xf` 를 세우고 **포스트시즌 대진표 0x853ac** 를 그린다 (R13 1절: 0xef 의 그리기가 바로 대진표다).
 *
 * **진입마다 하나** (`0x6900`, 포스트시즌 경기를 치르고 돌아와도 다시 들어온다):
 * - 0x29 "오토봇 배트" 가 새로 열리면 해금 알림 창(꼬리표 0) → 닫히면 `0x87e8` 이 **리그 1위 G [223]** 하나
 * - 아니면 진입이 곧장 **리그 1위 G [223]** 하나 (1·5·10회 → 3000·10000·20000 G, 비트가 **전역 저장**이라 다시 못 받는다)
 * - G 팝업은 꼬리표 1 이라 닫혀도 아무 가지에도 안 걸린다 — 다음 문턱은 **다음 진입**에서 준다
 *
 * **시리즈가 끝났으면 "결과" 키** (`0x9dc8`):
 * 1. **StrMODE[137]** "한국시리즈 우승! [우승팀]" 팝업(꼬리표 7)
 * 2. 닫히면 `0x85ec` 가 내 팀 포스트시즌 순위로 보상 — 0 우승 **[197]**(꼬리표 9) 인기도 +25 · 평판 +30 ·
 *    소지금 +40(4000만) / 1 준우승 **[198]**(꼬리표 10) +15 · +15 · +15(1500만) / 그 밖은 곧장 4
 * 3. 보상 팝업이 닫힐 때 더하고(0x86dc~ · 0x8752~) 곧장 4 — **여기에는 G 검사가 없다**
 * 4. `0x87b4`: 연차 idx 짝수 → 국가대항전, 홀수 → 새 해 (`onFinish`)
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
    record, series, postseasonRank, leagueFirstAwardedBits, entry,
    onApplyKoreanSeriesReward, onLeagueFirstAward, onContinuePostseason, onFinish, gamePoint = 0,
  } = props

  const [phase, setPhase] = useState<Phase>('대진표')
  const [pendingAward, setPendingAward] = useState<LeagueFirstAward | null>(null)

  /** 리그 1위 G 검사 한 번 (0x69d4~0x6ac0 = 0x8802~0x88fc) — 줄 것이 있으면 팝업을 띄우며 그 자리에서 준다 */
  const checkLeagueFirst = () => {
    const award = nextLeagueFirstAward(record, leagueFirstAwardedBits)
    if (award === null) {
      setPhase('대진표')
      return
    }
    onLeagueFirstAward(award)
    setPendingAward(award)
    setPhase('리그1위')
  }

  // 진입 몫은 그 진입에 한 번 — 세션이 진입 효과(0x6900)에서 `entry` 를 세우므로 화면이 선 뒤에 온다
  const handledEntry = useRef<number | null>(null)
  useEffect(() => {
    if (entry === null || handledEntry.current === entry.serial) return
    handledEntry.current = entry.serial
    if (entry.opensAutobotBat) setPhase('해금알림')
    else checkLeagueFirst()
    // 진입(serial)마다 한 번만 — 다른 값이 바뀌어도 다시 돌지 않는다
  }, [entry])

  const isFinished = series !== null && series.round === '종료'
  const championId = series?.champion ?? (record.postseasonChampion === NO_CHAMPION ? null : record.postseasonChampion)
  const championName = championId === null ? '' : TEAMS[championId]?.name ?? ''
  const reward = koreanSeriesRewardOf(postseasonRank)

  const onPressNext = () => {
    // 팝업이 떠 있는 동안 키는 팝업이 받는다
    if (phase !== '대진표') return
    if (!isFinished) {
      onContinuePostseason?.()
      return
    }
    setPhase('우승문구')
  }

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xef 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <PostseasonBracketWindow series={series} />
      {/* 대진표 0x853ac 끝의 0x7f4ec — 공통 틀 0xb810 이 0xef 에 맡긴 (제목 10 시즌모드, 바닥 1 — 되돌아가기 없음) */}
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={null} footer={1} />

      <div className={styles.caption} style={{ left: 0, top: 276, width: 240 }}>
        {isFinished
          ? `한국시리즈 우승 ${championName}`
          : `포스트시즌 ${series === null ? '' : series.round} 진행 중`}
      </div>

      <Button variant="corner" className={styles.cornerButton} onClick={onPressNext}>
        {isFinished ? '결과' : '경기'}
      </Button>

      {phase === '해금알림' && (
        <MessageBox
          text={hiddenOpenTextOf(SEASON_AUTOBOT_BAT_HIDDEN_ID) ?? ''}
          buttons={['OK']}
          // 꼬리표 0 이 닫히면 0x87e8 — 리그 1위 G 검사를 한 번 (1·5·10 중 아직 안 받은 첫 칸 하나)
          onAnswer={checkLeagueFirst}
        />
      )}

      {phase === '리그1위' && pendingAward !== null && (
        <MessageBox
          text={formatted(TEXT.leagueFirst, [pendingAward.threshold, pendingAward.gamePoint])}
          buttons={['OK']}
          onAnswer={() => {
            // G 팝업(0xbbef9(…, 1, 1, 1), 꼬리표 1)은 닫혀도 0x85ec 의 어느 가지에도 안 걸린다 — 대진표로 돌아간다
            setPendingAward(null)
            setPhase('대진표')
          }}
        />
      )}

      {phase === '우승문구' && (
        <MessageBox
          text={formatted(TEXT.champion, [championName])}
          buttons={['OK']}
          onAnswer={() => {
            // 팝업 7 이 닫힐 때 보상이 붙는다 (0x85ec). 3위 아래는 문구도 보상도 없이 곧장 0x87b4
            if (reward.messageId === 0) {
              onFinish()
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
          // 꼬리표 9·10 이 닫히면 0x87b4 — 리그 1위 G 검사 없이 결산을 닫는다
          onAnswer={onFinish}
        />
      )}
    </RawScreen>
  )
}
