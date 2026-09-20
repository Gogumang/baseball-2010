import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import { derbyBallCountOf, derbyBallNumberOf } from '@/entities/home-run-derby/model/derbyRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import * as styles from '@/pages/home-run-derby/ui/HomeRunDerbyScreen.css'

interface HomeRunDerbyScreenProps {
  /**
   * 치는 선수의 능력치. 원본은 모드 7 로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 **나리 타자편 저장**을
   * 올린다 — 선수 고르기 창 결과 2 = 육성 타자 · 4 = 명예 타자다(H-2, Q2 확정).
   * 웹에는 아직 명예의 전당 선수를 경기에 넣는 길이 없어 부르는 쪽이 육성 선수를 넘긴다.
   */
  readonly ability: BatterAbility
  readonly random: RandomPort
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 보유 G (app+0x64) — 결과 화면 "보유 GP" 칸 */
  readonly gamePoint: number
  /** 한 판이 끝났을 때. 최고 기록 갱신과 G 지급은 부르는 쪽이 한다 */
  readonly onFinish?: (result: DerbyResult) => void
  /** 결과 화면에서 "아니오" — 메인 메뉴로 (전역 0x140006c = 4) */
  readonly onExit: () => void
}

/**
 * 홈런더비 (게임 모드 7) — `docs/re/H-modes.md` H-2 절의 규칙 전체를 옮긴 화면이다.
 *
 * 10구(+보너스) 동안 타석만 치고, 결과는 `entities/home-run-derby` 의 순수 모델이 센다.
 * 타석 연출은 다른 모드와 똑같이 `widgets/batting-stage` 를 쓰되 **일반 점수판 대신
 * 홈런더비 HUD(0x45a54)** 를 겹친다 — 원본도 `0x4c4bc` 에서 그렇게 갈린다.
 *
 * 판정 모드는 `'일반'` 이다: `0xab214` 의 "내 선수" 보너스는 원본 모드 3·4(나만의리그)에서만
 * 켜지고 홈런더비는 모드 7 이라 그 갈래에 안 들어간다.
 */
export function HomeRunDerbyScreen({
  ability,
  random,
  bestDistance,
  gamePoint,
  onFinish,
  onExit,
}: HomeRunDerbyScreenProps) {
  const session = useHomeRunDerby({ random, bestDistance, onFinish })
  const tick = useUpdateCounter()

  if (session.result !== null) {
    return (
      <DerbyResultWindow
        result={session.result}
        heldGamePoint={gamePoint}
        onRetry={session.restart}
        onExit={onExit}
      />
    )
  }

  const { run, pitcher } = session
  const ace = pitcher.ace

  return (
    <PixelScreen
      title="홈런더비"
      badge={`${derbyBallNumberOf(run)} / ${derbyBallCountOf(run)}구${run.isBonusGame ? ' · 보너스' : ''}`}
      rightKey={{ label: '나가기', onPress: onExit }}
    >
      <div className={styles.stageArea}>
        <BattingStage
          batterAbility={ability}
          pitcherAbility={pitcher.ability}
          swingMode="일반"
          isEagleEyeEnabled={false}
          // 홈런더비는 일반 점수판을 안 그린다 (0x4c4bc 가 0x373d0 대신 0x45a54 로 간다)
          hud={null}
          acePitcher={
            ace === null
              ? null
              : { framesUrl: ace.framesUrl, frameCount: ace.frameCount, stillUrl: ace.stillUrl }
          }
          isPaused={session.isPaused}
          random={random}
          onPitchResolved={(detail) => session.onPitchResolved(detail)}
        />

        <DerbyHud
          run={run}
          bestDistance={bestDistance}
          aceName={ace?.name ?? null}
          isEventZoneShown={session.isEventZoneShown}
          tick={tick}
        />

        <div className={styles.overlay}>
          {session.banner === '' ? (
            <Hint>
              {run.isBonusGame ? '보너스 게임' : '10구 안에 멀리 쳐라'} · 누적 {run.totalDistance}M
            </Hint>
          ) : (
            <BigResult>{session.banner}</BigResult>
          )}
        </div>
      </div>
    </PixelScreen>
  )
}
