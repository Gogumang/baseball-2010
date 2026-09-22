import { useEffect } from 'react'
import { DEFAULT_REPERTOIRE, selectPitch } from '@/entities/pitching/model/selectPitch'
import { createMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { lastSwingFrameOf } from '@/entities/batting/model/swingTiming'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'
import { renderBattingStage } from '@/widgets/batting-stage/lib/renderBattingStage'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameNow, pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 다음 투구까지의 준비 시간 */
const WIND_UP_MILLISECONDS = 850
/** 결과 문구를 보여주는 시간 */
const RESULT_DISPLAY_MILLISECONDS = 1150
const SPECIAL_PITCH = 'SPECIAL'
const SKY_ROW_COUNT = 6

type FinishPitch = (swing: BattingSwing | null, now: number) => void
/** 상태 0x13 을 끝내고 인플레이로 넘기는 고리 */
type CommitHit = (now: number) => void

/** 캔버스 애니메이션 루프와 투구 단계 진행. */
export function useStageAnimation(refs: StageRefs, finishPitch: FinishPitch, commitHit: CommitHit) {
  const {
    canvasRef,
    pitchRef,
    phaseRef,
    phaseStartedAtRef,
    resultTextRef,
    homeRunStartedAtRef,
    swingStartedAtRef,
    shiftRef,
    buntRef,
    pendingHitRef,
    latestRef,
  } = refs

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let animationHandle = 0
    const openedAt = performance.now()

    /**
     * 마구 상태 — 원본이 **팀 +0x28**(남은 횟수)과 **공 +0x10**(이번 공에 실린 번호)을
     * 제자리에서 고치듯, 경기 하나 동안 같은 객체를 계속 넘긴다.
     * 안 넘기면 남은 횟수가 늘 0 이라 마구가 아예 안 나가고, 매 투구 새로 만들면
     * 마구 조건(0x344dc)이 볼카운트 48칸 중 36칸에서 참이라 **투구마다 마구**가 된다.
     *
     * ⚠️ **근사**: 마운드에 선 투수가 바뀌면 새로 만든다. 원본 칸은 팀 것이라
     *    구원 투수가 남은 횟수를 물려받는지 새로 받는지가 **확인되지 않았다** —
     *    그 칸을 세우는 자리를 아직 못 읽었다.
     */
    let magic: { readonly magicId: number; readonly state: MagicPitchGameState } | null = null
    const magicStateOf = (repertoire: PitcherRepertoireInfo | undefined) => {
      const info = repertoire ?? DEFAULT_REPERTOIRE
      if (magic === null || magic.magicId !== info.magicId) {
        magic = { magicId: info.magicId, state: createMagicPitchGameState(info) }
      }
      return magic.state
    }
    // 하늘 표 행 = 구장 팀 데이터 +0xb2 — 웹은 팀 데이터에 그 칸이 없어 원본의 대체 규칙 rand(0,6) 을 쓴다 (추정)
    const skyRow = randomIntegerBelow(latestRef.current.random, 0, SKY_ROW_COUNT)

    const advancePhase = (now: number) => {
      const elapsed = now - phaseStartedAtRef.current

      if (phaseRef.current === '대기') {
        if (latestRef.current.isPaused) {
          // 타석이 끝나 쉬는 동안 — 다음 타석 준비(0x48d50)처럼 좌우 이동을 되돌린다
          shiftRef.current = 0
          phaseStartedAtRef.current = now
          return
        }
        if (elapsed >= WIND_UP_MILLISECONDS) {
          const { pitcherAbility, random } = latestRef.current
          pitchRef.current = selectPitch(
            pitcherAbility,
            pitchSituationOf(latestRef.current.hud, latestRef.current.batterForm),
            random,
            'hard',
            magicStateOf(pitcherAbility.repertoire),
          )
          // 새 투구가 시작하면 홈런 글자 연출을 끈다 (원본 +0x1960 을 다음 플레이가 지우는 자리)
          homeRunStartedAtRef.current = -1
          phaseRef.current = '투구중'
          phaseStartedAtRef.current = now
        }
        return
      }

      const pitch = pitchRef.current
      if (phaseRef.current === '투구중' && pitch !== null) {
        const frame = ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
        const bunt = buntRef.current
        // 번트 자세는 공이 플레이트에 닿는 순간(N−1) 판정한다 — 판정 시점은 추정
        if (bunt !== null && frame >= pitch.frameCount - 1) {
          finishPitch({ frame: bunt.frame, shift: shiftRef.current, buntKind: bunt.kind }, now)
          return
        }
        if (frame > lastSwingFrameOf(pitch.frameCount, pitch.type === SPECIAL_PITCH)) {
          finishPitch(null, now)
          return
        }
      }

      // 상태 0x13 — 큰 타구면 낙구할 때까지, 아니면 틱 8 만에 인플레이로 넘어간다 (R10 4절)
      if (phaseRef.current === '타격') {
        const pending = pendingHitRef.current
        const held = pitchTickAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
        if (pending === null || held >= pending.ticks) commitHit(now)
        return
      }

      if (phaseRef.current === '결과' && elapsed >= RESULT_DISPLAY_MILLISECONDS) {
        phaseRef.current = '대기'
        phaseStartedAtRef.current = now
        pitchRef.current = null
      }
    }

    const frame = (now: number) => {
      advancePhase(now)

      const pitch = pitchRef.current
      const tickLength = millisecondsPerFrame()
      // 몸통 종류 t = 폼 >> 1 (0 balancer · 1 sluger, 0x78ab0) — 자세표도 이걸로 갈린다
      const bodyType = bodyTypeOf(latestRef.current.batterForm)
      // 손 = 폼 & 1 (0 우타 · 1 좌타) — 그림 반전과 앵커·존 칸을 고른다 (R6 4절)
      const side = batterSideOfForm(latestRef.current.batterForm)
      const isPitching = phaseRef.current === '투구중' && pitch !== null
      const ballFrame = isPitching ? ballFrameAt(now, phaseStartedAtRef.current, tickLength) : -1
      // 홈런 연출은 결과 문구 시간(1150ms)보다 길다 — 날아 들어오기만 22틱이라 따로 센다
      const homeRunStartedAt = homeRunStartedAtRef.current
      const isHomeRun = homeRunStartedAt >= 0

      renderBattingStage(context, {
        pitch,
        frame: ballFrame,
        shift: shiftRef.current,
        isEagleEyeEnabled: latestRef.current.isEagleEyeEnabled && phaseRef.current === '투구중',
        resultText: phaseRef.current === '결과' ? resultTextRef.current : '',
        isHomeRun,
        homeRunTick: isHomeRun ? pitchTickAt(now, homeRunStartedAt, tickLength) : 0,
        swingFrame: batterFrameNow(now, swingStartedAtRef.current, buntRef.current !== null, bodyType),
        bodyType,
        batterSkinIndex: latestRef.current.batterSkinIndex,
        batterTeamIndex: latestRef.current.batterTeamIndex,
        batterEquipment: latestRef.current.batterEquipment,
        side,
        hud: latestRef.current.hud,
        acePitcher: latestRef.current.acePitcher,
        pitcherTick: isPitching ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : null,
        tick: pitchTickAt(now, openedAt, tickLength),
        resultTick: phaseRef.current === '결과' ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : 0,
        // 구장 번호를 고르는 규칙(st+0x70)이 미확인이라 0 번 구장으로 둔다 (추정)
        scenery: { skyRow, stadium: 0 },
      })

      animationHandle = requestAnimationFrame(frame)
    }

    phaseStartedAtRef.current = performance.now()
    animationHandle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationHandle)
    // ref 묶음은 값이 바뀌지 않는다. finishPitch·commitHit만 바뀔 수 있다.
  }, [commitHit, finishPitch])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // 탭이 숨겨진 동안 requestAnimationFrame이 멈춘다. 돌아왔을 때 경과 시간이
      // 통째로 쌓여 있으면 진행 중이던 투구가 곧바로 스트라이크로 처리되므로
      // 타석을 다시 준비 상태로 되돌린다.
      phaseRef.current = '대기'
      phaseStartedAtRef.current = performance.now()
      pitchRef.current = null
      buntRef.current = null
      pendingHitRef.current = null
      resultTextRef.current = ''
      homeRunStartedAtRef.current = -1
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
