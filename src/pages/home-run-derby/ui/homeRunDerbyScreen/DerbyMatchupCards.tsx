import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'
import { pitcherCardStatsOf, pitcherLineOfRecord } from '@/widgets/matchup-cards/lib/matchupRecord'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import type { StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * 상태 0xe 의 소개 판 (0x4d9ec → 0x44944) — 0xe 에 들어설 때마다 새로 띄워 틱 0 부터 센다.
 * 홈런더비에서 원본이 채우는 값 중 웹이 아는 것만 넣는다:
 * - 팀 글자: 0x39fdc 모드 7 갈래가 `0xb6c19(st, 0, 0)` · `0xb6c19(st, 1, 1)`(3a4a6~3a4bc) — 내 타자편 팀 0 은 PLAYER,
 *   상대 팀 1 은 COM 이다. 타자 판(st[9])이 모드 타자가 든 팀 0, 투수 판(st[0xa])이 팀 1 이다.
 * - 손: 타자 판 좌타/우타 · 판 자리 모두 0xb63c0(지금 타자 0xae89c — 볼넷 · 사구 뒤 넘어간 마스터 줄이면 그 줄) — `DerbyHud` 와 같은 폼 값.
 * - 투수 이름: 단계 ≥ 1 마투수는 0x48d50 이 마투수 기록 0x30 바이트를 통째로 복사하므로 그 기록의 이름이다
 *   — 확정: 0xb62c0 은 `0x20498 → 0xaa458(이름표, rec[0], 0xb6278(rec))` 가 null 이면 기록 +1 을 준다. 0xaa458 은 투수 id ≤ 0x4f ·
 *   타자 id ≤ 0x77 만 에디트 이름표를 주고(aa464 · aa470) 마투수 행 id 는 0xf0~0xf4(XlsACE_PIT_DATA 행 바이트 0)라 늘 null →
 *   기록 +1 = Xls 행 이름 그대로(`ACE_PLAYERS` 의 name).
 * - 단계 0 투수 이름: 상대 팀 v(장면 시작 굴림 3a454)의 마스터 투수 줄 2 (`derbyPitcherOf` · `DERBY_ORDINARY_PITCHER_ROW`).
 * - 투수 보직 · 좌우 · 방어율 · 탈삼진: 그 레코드의 +0xb · +0x20/+0x22/+0x26(`DerbyPitcher.record` — 마스터 줄 2 · 마투수 모두 Xls 행 줄,
 *   게이트 0xa56dc 는 모드 7 에서 거짓).
 * - 체력 막대: 길이 0x66e44(마스터 팀 v 레코드, 지금 투수, f = 늘 참) · % 0xaebb0 = 100 (`derbyStaminaGaugeOf`, U-133).
 */
export function DerbyMatchupCards({
  batterHand,
  pitcherName,
  pitcherRecord,
  isAcePitcher,
  pitcherStamina,
  batter,
}: {
  readonly batterHand: number
  readonly pitcherStamina: StaminaGauge | undefined
  readonly pitcherName: string | undefined
  readonly pitcherRecord: DerbyPitcher['record']
  readonly isAcePitcher: boolean
  readonly batter: Omit<MatchupBatterCard, 'isComputer'> | undefined
}) {
  const tick = useGameSceneUpdateCounter()
  return (
    <MatchupCards
      tick={tick}
      batterHand={batterHand}
      pitcher={{
        isComputer: true,
        ...(pitcherName === undefined ? {} : { name: pitcherName }),
        ...(pitcherStamina === undefined ? {} : { stamina: pitcherStamina }),
        ...(pitcherRecord === undefined
          ? {}
          : {
              role: pitcherRecord.profile & 3,
              throwsLeft: pitcherHandOf(pitcherRecord.profile >> 4, isAcePitcher) === 1,
              ...pitcherCardStatsOf(pitcherLineOfRecord(pitcherRecord.recordLine)),
            }),
      }}
      batter={{ ...batter, isComputer: false }}
    />
  )
}
