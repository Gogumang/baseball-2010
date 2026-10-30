import { MessageBox } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_AUTOBOT_BAT_HIDDEN_ID, koreanSeriesRewardOf } from '@/entities/season-mode/model/seasonRewards'
import type { LeagueFirstAward, SeasonReward } from '@/entities/season-mode/model/seasonRewards'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'

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

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
const NO_CHAMPION = 0xf

/** 우승팀 이름 — 시리즈의 우승팀(없으면 저장 SR+0xb7, 0xf 면 미정 — 빈 글) */
export function championNameOf(series: PostseasonSeries | null, record: SeasonRecord): string {
  const championId = series?.champion ?? (record.postseasonChampion === NO_CHAMPION ? null : record.postseasonChampion)
  return championId === null ? '' : (TEAMS[championId]?.name ?? '')
}

/** 0x29 "오토봇 배트" 해금 알림(꼬리표 0) — 닫히면 0x87e8 리그 1위 G 검사를 한 번 (1·5·10 중 아직 안 받은 첫 칸 하나) */
export function unlockNoticeOf(onClose: () => void) {
  return <MessageBox text={hiddenOpenNoticeTextOf(SEASON_AUTOBOT_BAT_HIDDEN_ID) ?? ''} buttons={['OK']} onAnswer={onClose} />
}

/** 리그 1위 G 팝업 StrMODE[223] */
export function leagueFirstNoticeOf(pendingAward: LeagueFirstAward | null, onClose: () => void) {
  if (pendingAward === null) return null
  return <MessageBox text={formatted(TEXT.leagueFirst, [pendingAward.threshold, pendingAward.gamePoint])} buttons={['OK']} onAnswer={onClose} />
}

/** 우승 문구 StrMODE[137] (팝업 7) */
export function championNoticeOf(championName: string, onClose: () => void) {
  return <MessageBox text={formatted(TEXT.champion, [championName])} buttons={['OK']} onAnswer={onClose} />
}

/** 한국시리즈 보상 [197]/[198](꼬리표 9·10) — 닫히면 보상을 더하고(0x86dc~ · 0x8752~) 곧장 0x87b4(리그 1위 G 검사 없이 결산 닫기) */
export function koreanSeriesNoticeOf(reward: ReturnType<typeof koreanSeriesRewardOf>, onFinish: (reward: SeasonReward | null) => void) {
  return (
    <MessageBox
      text={formatted(TEXT.koreanSeries[reward.messageId] ?? '', [
        reward.popularity,
        reward.reputation,
        // 문구의 소지금은 **만원** 단위다 (표값 40 → 4000만)
        reward.money * MILLION_TO_TEN_THOUSAND,
      ])}
      buttons={['OK']}
      onAnswer={() => onFinish(reward)}
    />
  )
}
