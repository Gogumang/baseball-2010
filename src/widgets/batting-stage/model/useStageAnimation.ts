import { useEffect, useRef } from 'react'
import {
  CPU_PITCH_TYPE_TICKS,
  DEFAULT_REPERTOIRE,
  cpuPitchAimOf,
  cpuPitchTypeTickOf,
  releaseCpuPitch,
  windUpCpuPitchOf,
} from '@/entities/pitching/model/selectPitch'
import type { CpuPitchArgs } from '@/entities/pitching/model/selectPitch'
import { aceOrderOfMagicNumber, createMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'
import { renderBattingStage, renderSettlementLayer } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import { particleSignatureOf } from '@/widgets/particles/lib/particleSignature'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameNow, pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, ballFrameStartTime, pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { NO_STAGE_EFFECTS, fireworksPortOf, stepStageFrame } from '@/widgets/batting-stage/lib/homeRunEffects'
import { tickParticles } from '@/entities/particle/model/particleScene'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { clearSceneResultCodeOnPitch, sceneResultCodeNow, writeSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { enterSettlementEffect, tickSettlementEffect, type SettlementEffect } from '@/entities/batting/model/settlementEffect'
import { skyColorsOf, skyColumnOfInning } from '@/widgets/batting-stage/lib/stageScenery'
import { settlementSkyColumnOf } from '@/widgets/batting-stage/lib/settlementSky'
import { frozenClockNowOf, observeFrozenClock, startFrozenClock } from '@/widgets/batting-stage/lib/frozenClock'
import type { FrozenClock } from '@/widgets/batting-stage/lib/frozenClock'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { homeRunTextFrameAt } from '@/widgets/batting-stage/lib/homeRunBanner'
import { preloadPtcParts } from '@/widgets/particles/lib/renderParticles'
import { activeSound } from '@/shared/api/audio/soundPort'
import { gameSceneNow, gameSceneTimeOf, isCommonWindowShown, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { isBuntJudgeFrame } from '@/widgets/batting-stage/lib/buntStance'
import type { StageRefs, SwingReservation } from '@/widgets/batting-stage/model/stageRefs'
import { isBallInSwingReach, nextFlightEvent, swingReleaseTickOf } from '@/widgets/batting-stage/lib/swingWindow'
import { DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'
import { resultBackdropOffsetAt, SKY_ROW_COUNT } from '@/widgets/batting-stage/lib/stageScenery'
import { PRE_PITCH_TICKS } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import { createRunnerAnimationClock, stepRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel'
import { createSkillPanelDriver } from '@/widgets/batting-stage/model/skillPanelDriver'
import type { SkillPanelSituation, SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'

/** 홈런더비 = 원본 전역 모드 7 */
const HOME_RUN_DERBY_GAME_MODE = 7
/** 타자 스킬 22 압도 (skills.json 22) — 상대 투수 실투율 +5 */
const INTIMIDATE_SKILL_ID = 22
/** 0x10 의 목표 고르기 틱 — 0x53824 는 상태 틱 > 5 인 첫 틱(6)에 0x645 를 보낸다 */
const CPU_AIM_TICK_IN_0X10 = 6
/** 0x11 의 공 놓기 틱 — 0x4e078 은 상태 틱 > 9 인 첫 틱(10)에 0x4dc78 을 부른다 */
const CPU_RELEASE_TICK_IN_0X11 = 10

/** 수비 투수 레코드 +0x14 — 번호를 직접 든 능력치(마투수)면 번호 − 16, 아니면 비트 그대로 (`resolvePitch.pitcherSkillIdsOf` 와 같은 고름) */
function pitcherSkillBitsOf(pitcher: PitcherAbility): number {
  return pitcher.skillIds !== undefined ? skillBitsOfIds(pitcher.skillIds, true) : pitcher.skillBits ?? 0
}

/** 투구 단계가 부르는 고리 — 타석 화면(`BattingStage`)이 채운다 */
export interface StageHandlers {
  /** 판정 0x6aa(0x51226) — 맞은 공이면 곧 0x13, 아니면 결과를 들고 공 끝까지 기다린다 */
  readonly judgePitch: (swing: BattingSwing, now: number) => void
  /** 공 끝(틱 N + 1, 0x4e24e) — 0x12 결과를 세운다 */
  readonly endPitch: (now: number) => void
  /** 상태 0x13 을 끝내고 인플레이로 넘기는 고리 */
  readonly commitHit: (now: number) => void
  /** 스윙이 나가는 틱(F + 1, 0x4e0ce) */
  readonly releaseSwing: (swing: SwingReservation) => void
}

/** 마투수 순번 0xb63a1 — 붕붕머신(XlsACE_PIT_DATA +0x18 = 7, 순번 = 번호 − 5) */
const BOONGBOONG_MACHINE_ORDER = 2

/** 캔버스 애니메이션 루프와 투구 단계 진행. */
export function useStageAnimation(refs: StageRefs, handlers: StageHandlers) {
  const {
    canvasRef,
    pitchRef,
    pitchTypeNumberRef,
    phaseRef,
    phaseStartedAtRef,
    resultTextRef,
    homeRunStartedAtRef,
    swingStartedAtRef,
    pitcherStartedAtRef,
    shiftRef,
    buntRef,
    pendingHitRef,
    resultTicksRef,
    isInPlayResultRef,
    swingRef,
    pitchJudgedRef,
    heldResultRef,
    particlesRef,
    inPlayEnteredAtRef,
    latestRef,
  } = refs
  // 고리는 남은 필살 횟수 같은 props 로 자주 바뀐다 — 루프를 다시 세우면 투구 시작 시각이 지워지므로 ref 로 읽는다
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const canvas = canvasRef.current
    const context = effectContextOf(canvas)
    if (!canvas || !context) return

    let animationHandle = 0
    /** 그림 입력이 바뀐 틀에서만 다시 그린다 — 루프를 다시 세우면 새로 그린다 */
    const drawMemo = createDrawMemo()
    // 장면의 모든 시각은 경기 장면 시계로 잰다 — 공용 창이 떠 있는 동안 서고 닫히면 이어 흐른다(`gameSceneTimeOf`)
    const openedAt = gameSceneNow()
    /**
     * 루상 주자 애니 시계(장면 +0xf24 의 애니 0~2) — 부르는 쪽이 경기 장면 수명의 칸을 넘기면 그것, 아니면 이 화면이 사는 동안.
     * `runnerTick` 은 이 화면에서 마지막으로 센 틱 — 첫 그림이 0x35b94 첫 부름이다
     */
    const localRunnerClock = createRunnerAnimationClock()
    let runnerTick = -1
    // 파티클 파트 그림은 연출이 뜨기 전에 받아 둬야 첫 연출이 보인다
    preloadPtcParts()

    /**
     * 마구 상태 — 원본이 **팀 +0x28**(남은 횟수)과 **공 +0x10**(이번 공에 실린 번호)을
     * 제자리에서 고치듯, 경기 하나 동안 같은 객체를 계속 넘긴다.
     * 안 넘기면 남은 횟수가 늘 0 이라 마구가 아예 안 나가고, 매 투구 새로 만들면
     * 마구 조건(0x344dc)이 볼카운트 48칸 중 36칸에서 참이라 **투구마다 마구**가 된다.
     *
     * 마운드에 선 투수가 바뀌면 새로 만든다 — 남은 횟수는 원본도 그렇다: 교체 가지가 팀+0x28 을 −1 로
     *    비우고(0xaebe4 aec7a) 같은 함수 끝이 새 투수로 채운다. ⚠️ 다만 공+0x10 은 경기에 하나라 원본은
     *    이어지는데 여기서는 0 으로 돌아가고, 화면이 내려가면(반 이닝) 둘 다 잃는다 — 그래서 경기를 드는 진행기는
     *    `cpuMagic` 으로 넘긴다(팀 경기 · 나리 타자편 · 타자 미션 — 0xaebe4 aeea8 은 +0x28 이 음수일 때만 채운다).
     *    안 넘기는 화면(투수편 · 홈런더비 · 결과 배경)만 이 자리 상태를 쓴다.
     */
    let magic: { readonly magicId: number; readonly state: MagicPitchGameState } | null = null
    const magicStateOf = (repertoire: PitcherRepertoireInfo | undefined): MagicPitchGameState => {
      // 부르는 쪽이 팀+0x28·공+0x10 을 들면 그 사본 — 고친 값은 버리고 부르는 쪽이 같은 차례로 다시 고친다
      const held = latestRef.current.cpuMagic
      if (held !== undefined) return { remaining: held.remaining, ballMagicNumber: held.ballMagicNumber }
      const info = repertoire ?? DEFAULT_REPERTOIRE
      if (magic === null || magic.magicId !== info.magicId) {
        // 0xaebe4: 마투수(0xb633d)면 횟수 = 0xd8509[mgr[0x13a + 순번(0xb63a1)]] — 레벨은 상태를 세울 때 한 번 읽는다
        const order = aceOrderOfMagicNumber(info.magicId)
        const aceLevel = order < 0 ? 0 : aceLevelOf(latestRef.current.aceLevels, aceLevelSlotOf('투수', order + 1))
        magic = { magicId: info.magicId, state: createMagicPitchGameState(info, { aceLevel }) }
      }
      return magic.state
    }
    /** 투구 순간 소리를 이미 낸 공 — 0x3f378 은 투수 단계가 놓는 칸에 **닿는 틱 한 번만** 낸다(`cmp r6,r4 ; bne`) */
    let releaseSoundPitch: object | null = null
    // 하늘 줄 = 구장 +0x10 (0x783b0 — `stadiumSkyRowOf`). 원본은 경기 장면을 세울 때 한 번 고른다 — 부르는 쪽이 그 줄을 넘긴다
    // (미션 · 홈런더비도 세션이 장면마다 한 번 굴린 rand(0, 6) 을 넘긴다 — 홈런더비는 결과 진입 0x4f574 에서 한 번 더).
    // 그리는 그림마다 넘겨받은 줄을 읽는다. ⚠️ 안 넘기는 화면만 예전대로 그림을 세울 때 여기서 굴린다(장면당 한 번이 아니다) —
    // r112 확인: 타석 화면을 세우는 일곱 곳(팀 경기 · 나리 타자편 · 미션 · 투수 미션 · 투수편 · 홈런더비 · 결과 배경)이 모두 넘기고,
    // 결과 배경(CareerRoutes)만 정산 기록에 하늘 줄이 없을 때 안 넘긴다
    const fallbackSkyRow =
      latestRef.current.skyRow === undefined ? latestRef.current.random.rand(0, SKY_ROW_COUNT) : 0
    const skyRowNow = () => latestRef.current.skyRow ?? fallbackSkyRow

    /** 이번 0xf~0x10 의 CPU 투구 굴림 — 대기에 든 시각이 바뀌면(새 공 · 견제 뒤 · 쉼) 새로 센다 */
    let cpuPitchCycle: { startedAt: number; typeRolls: number; typeNumber: number; target: WorldPoint | null } | null = null
    /** 0x11 에 들어서 놓기(틱 10)를 기다리는 공 — 0xf 의 마지막 구질과 0x10 의 목표점 */
    let releasePending: { typeNumber: number; target: WorldPoint } | null = null
    /** 실투로 놓은 공 — 놓기 0x4dc78 이 투구 객체 +8 = 4 (4deae), 투수 그리기 0x38d1c 가 그림마다 1 줄이며 "!" 를 그린다 */
    let mistakeMarkPitch: object | null = null
    /**
     * 0x11 의 마지막 갱신 틱(투수 틱 셈) — 0x4e060 이 0x12 · 0x13 으로 넘긴 그림. 투수 단계 갱신 0x9e004 는 0xf · 0x11 갱신에서만
     * 불리므로(`stageScenery` 투수 그림 객체) 그 뒤 단계가 굳는다. 아직 0x11 이면 null
     */
    let pitcherTickEnd: number | null = null
    /**
     * 결과 코드 [경기+0xfd4] — 경기 장면 객체 칸이라 장면 부품이 바뀌어도 이어 든다(`sceneResultCodeStore`). 0x11 진입(3deea)이 공마다
     * 0 으로 지우고 메시지 0x6aa(스윙 · 번트 판정, 5130e)가 쓴다. 이 부품은 0x11 진입 때의 값(늘 0)과 이 공의 판정 틱 · 값을 든다
     * (`pitcherFatigue` 홈런 갈래). 부품이 새로 서면 장면 객체에 남은 값부터 본다
     */
    let resultCodeBeforePitch: number | null = sceneResultCodeNow()
    let judgedResultCode: { readonly tick: number; readonly code: number | null } | null = null
    /** 그 틱에 원본이 읽는 재료 — 볼카운트 · 주자 · 마구 · 투수 (`selectPitch` 와 같은 인자) */
    const cpuPitchArgsNow = (): CpuPitchArgs => {
      const { pitcherAbility, hud, onPickoff } = latestRef.current
      const bases = hud?.bases ?? { first: false, second: false, third: false }
      return {
        pitcher: pitcherAbility,
        situation: pitchSituationOf(hud, latestRef.current.batterForm, latestRef.current.batterHand),
        difficulty: 'hard',
        magic: magicStateOf(pitcherAbility.repertoire),
        // 견제를 받아 줄 쪽이 있을 때만 켠다 — 주자 루는 HUD 루 그대로 (원본 0xa9878 자리)
        cpuPickoff:
          onPickoff === undefined
            ? undefined
            : {
                hasRunnerOnBase: (base) =>
                  base === 1 ? bases.first : base === 2 ? bases.second : base === 3 ? bases.third : false,
              },
        // 실투 판정 0x33cbc 의 타자 비트 22 압도 — 0xb62b4 는 **장착** 비트라 장착 스킬 번호로 본다
        batterIntimidates: latestRef.current.batterSkillIds.includes(INTIMIDATE_SKILL_ID),
        // 홈런더비(모드 7)는 0x344ea 가 구질을 굴리지 않고(마투수가 나왔으면 22, 아니면 1),
        // 0x345fc 가 종류·목표점을 굴리지 않고 존 한가운데를 노리며(0x3460e) 마구 소모(0x34894)도 건너뛴다
        derbyPitchType:
          latestRef.current.gameMode === HOME_RUN_DERBY_GAME_MODE
            ? latestRef.current.derbyPitchType ?? DERBY_ORDINARY_PITCH_TYPE
            : undefined,
      }
    }

    const advancePhase = (now: number) => {
      if (phaseRef.current === '대기') {
        if (latestRef.current.isPaused) {
          // 타석이 끝나 쉬는 동안 — 다음 타석 준비(0x48d50)처럼 좌우 이동을 되돌린다
          shiftRef.current = 0
          phaseStartedAtRef.current = now
          return
        }
        // 0xf(9 그림) + 0x10(7 그림) 뒤 0x11 — 틱으로 센다 (`PRE_PITCH_TICKS`). CPU 투구 굴림은 원본 틱 차례로 나눠
        // 그 틱의 파티클 틱(프레임 끝 0x6de84)보다 앞에 굴린다 — 조작 0x498d4 는 매 틱 그리기보다 먼저 돈다:
        //   0xf 틱 0~8 구질 0x344dc(틱마다 한 번) · 0x10 틱 6 목표 0x345fc(또는 견제) · 0x11 틱 10 놓기 0x4dc78
        const tick = pitchTickAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
        if (cpuPitchCycle === null || cpuPitchCycle.startedAt !== phaseStartedAtRef.current) {
          cpuPitchCycle = { startedAt: phaseStartedAtRef.current, typeRolls: 0, typeNumber: 0, target: null }
        }
        const cycle = cpuPitchCycle
        const { random } = latestRef.current
        // 0xf 틱 0~8 — 그림을 건너뛴 틱도 센다(따라잡기)
        while (cycle.typeRolls < Math.min(CPU_PITCH_TYPE_TICKS, tick + 1)) {
          cycle.typeNumber = cpuPitchTypeTickOf(cpuPitchArgsNow(), random)
          cycle.typeRolls += 1
        }
        if (cycle.target === null && tick >= CPU_PITCH_TYPE_TICKS + CPU_AIM_TICK_IN_0X10) {
          const aim = cpuPitchAimOf(cpuPitchArgsNow(), random)
          if (aim.kind === '견제') {
            // 0x34848 → 메시지 0x10: 공을 안 던진다(상태 0x11 예약 0x34888 을 안 지난다).
            // 견제 판(상태 0x17)이 끝나면 원본은 같은 타석 다음 공(0xf)으로 돌아온다 — 여기서는 다시 대기로 둔다
            pitchRef.current = null
            phaseStartedAtRef.current = now
            latestRef.current.onPickoff?.(aim.base)
            return
          }
          cycle.target = aim.target
        }
        if (tick >= PRE_PITCH_TICKS && cycle.target !== null) {
          // 0x11 진입 — 놓기(틱 10) 전에는 와인드업 자리만 세운다 (`windUpCpuPitchOf`)
          pitchRef.current = windUpCpuPitchOf(cpuPitchArgsNow(), cycle.typeNumber, cycle.target)
          pitchTypeNumberRef.current = cycle.typeNumber
          releasePending = { typeNumber: cycle.typeNumber, target: cycle.target }
          // 0x11 진입 0x3de10 — 스윙 예약 · 판정 칸(+0xfd8 · +0xfe0 · +0xfe5)을 공마다 지운다
          swingRef.current = null
          pitchJudgedRef.current = false
          heldResultRef.current = null
          // 새 투구가 시작하면 홈런 글자 연출을 끈다 (원본 +0x1960 을 다음 플레이가 지우는 자리)
          homeRunStartedAtRef.current = -1
          phaseRef.current = '투구중'
          phaseStartedAtRef.current = now
          // 3de7c — 투수 그림 객체 상태 1(투구 동작)
          pitcherStartedAtRef.current = now
          pitcherTickEnd = null
          // 3de42~3de66 — 0x11 진입: 구질 +0xfc8 == 22 이고 수비 팀 지금 투수의 순번 0xb63a1 == 2(붕붕머신)면 파티클 관리자를
          // 비운다(0x6dee4, 굴림 없음). 이 프레임의 파티클 틱보다 앞이다
          if (cycle.typeNumber === MAGIC_PITCH_TYPE_NUMBER && latestRef.current.acePitcher?.order === BOONGBOONG_MACHINE_ORDER) {
            clearParticles(particlesRef.current)
          }
          // 3deea — 0x11 진입이 +0xfd4 를 0 으로 지운다(0xfe0 − 0xc 로 만든 주소라 `xval 0xfd4` 에 안 잡혔다 — r100 정정)
          clearSceneResultCodeOnPitch()
          resultCodeBeforePitch = sceneResultCodeNow()
          judgedResultCode = null
        } else {
          return
        }
      }

      // 0x11 틱 10 — 0x4dc78: 제구 등급 · 제구 오차 · 실투 · 곡선을 굴려 와인드업 자리를 진짜 공으로 바꾼다
      if (phaseRef.current === '투구중' && releasePending !== null) {
        if (pitchTickAt(now, phaseStartedAtRef.current, millisecondsPerFrame()) < CPU_RELEASE_TICK_IN_0X11) return
        const choice = releaseCpuPitch(
          cpuPitchArgsNow(),
          releasePending.typeNumber,
          releasePending.target,
          latestRef.current.random,
        )
        releasePending = null
        // 4de9c +8 = 0 · 4deae 실투면 +8 = 4 — 공마다 다시 적는다
        mistakeMarkPitch = choice.isMistakePitch ? choice.pitch : null
        pitchRef.current = choice.pitch
        pitchTypeNumberRef.current = choice.pitchTypeNumber
      }

      const pitch = pitchRef.current
      if (phaseRef.current === '투구중' && pitch !== null) {
        const frame = ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame(), latestRef.current.acePitcher?.order)
        // 투구 순간 소리 12 / 28 (0x3f378) — 공 프레임이 서는 틱(릴리스 단계 도달, `ballFrameAt` 0)에 한 번.
        // 사람이 칠 때 CPU 투수가 던지는 공이다 — 원본 식은 던지는 쪽을 가르지 않는다(사람 투구는 각 진행 고리가 낸다)
        if (frame >= 0 && releaseSoundPitch !== pitch) {
          releaseSoundPitch = pitch
          activeSound().play(
            pitchReleaseSoundIdOf({
              typeNumber: pitchTypeNumberRef.current ?? 0,
              pitcherMagicNumber: pitch.pitcherMagicNumber ?? 0,
              ballMagicNumber: pitch.magicNumber ?? 0,
            }),
          )
        }
        const frameCount = pitch.frameCount
        const tickLength = millisecondsPerFrame()
        const zoneDepth = (ZONE_CENTERS[pitch.stageSide] ?? ZONE_CENTERS[0]).z
        // 0x4e060 한 갱신의 차례대로 — 예약 풀기(F + 1) → 번트 · 스윙 판정(F + 2 · N − 1) → 공 끝(N + 1) (`nextFlightEvent`)
        for (;;) {
          const swing = swingRef.current
          const bunt = buntRef.current
          const event = nextFlightEvent(
            {
              frameCount,
              swing,
              bunt,
              isJudged: pitchJudgedRef.current,
              isInReach: (tick) => isBallInSwingReach(pitch.worldPath, frameCount, tick, zoneDepth),
              // 번트 자세는 공이 N−1 틱에 닿는 그 틱에 깊이 조건 없이 판정한다 (0x4e15c r7 → 0x4e1fe 메시지 0x6aa, 확정)
              isBuntJudgeTick: (at) => bunt !== null && isBuntJudgeFrame(at, frameCount, bunt),
            },
            frame,
          )
          if (event === null) break
          const { judgePitch, endPitch, releaseSwing } = handlersRef.current
          if (event.kind === '스윙나감' && swing !== null) {
            // 0xb9374 — 그림의 스윙도 그 틱부터
            const released = { ...swing, isReleased: true }
            swingRef.current = released
            swingStartedAtRef.current = ballFrameStartTime(
              swingReleaseTickOf(swing.frame),
              phaseStartedAtRef.current,
              tickLength,
              latestRef.current.acePitcher?.order,
            )
            releaseSwing(released)
          } else if (event.kind === '판정없는헛스윙' && swing !== null) {
            swingRef.current = { ...swing, isUnjudgedWhiff: true }
          } else if (event.kind === '판정') {
            pitchJudgedRef.current = true
            judgePitch(
              {
                frame: event.frame,
                shift: shiftRef.current,
                buntKind: event.buntKind,
                ...(event.isSpecial ? { isSpecial: true } : {}),
              },
              now,
            )
            // 0x6aa → 0x5130e 가 판정 결과를 +0xfcc~+0xfd7 에 쓴다 — 맞은 공이면 그 코드, 헛맞음이면 홈런성이 아닌 코드
            const pitcherTickNow = pitchTickAt(now, pitcherStartedAtRef.current, tickLength)
            // 맞은 공만 0x13('타격')으로 넘어간다 — 헛맞음은 0x11 에 남아 공 끝을 기다린다
            const isContact = phaseRef.current !== '투구중'
            judgedResultCode = { tick: pitcherTickNow, code: isContact ? (pendingHitRef.current?.detail.resultCode ?? null) : null }
            writeSceneResultCode(judgedResultCode.code)
            if (isContact) {
              // 0x6aa 가 0x13 을 예약한 그림 — 이 그림의 0x4e060 이 투수를 마지막으로 센다
              pitcherTickEnd = pitcherTickNow
              return
            }
          } else {
            // 0x4e24e — 공 틱 > N 이고 맞지 않았으면 0x12. 이 그림의 0x4e060 이 투수를 마지막으로 센다
            pitcherTickEnd = pitchTickAt(now, pitcherStartedAtRef.current, tickLength)
            endPitch(now)
            return
          }
        }
      }

      // 상태 0x13 — 큰 타구면 낙구할 때까지, 아니면 틱 8 만에 인플레이로 넘어간다 (R10 4절)
      if (phaseRef.current === '타격') {
        const pending = pendingHitRef.current
        const held = pitchTickAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
        if (pending === null || held >= pending.ticks) handlersRef.current.commitHit(now)
        return
      }

      // 0x12 는 16 그림(볼넷 · 사구 · 삼진 32) — 결과를 세울 때 정한 틱 수(`resultPhaseTicksOf`)
      if (
        phaseRef.current === '결과' &&
        pitchTickAt(now, phaseStartedAtRef.current, millisecondsPerFrame()) >= resultTicksRef.current
      ) {
        phaseRef.current = '대기'
        phaseStartedAtRef.current = now
        pitchRef.current = null
        // 0xf 진입 0x3d954 → 0x35650 → 0xb9318 이 스윙 객체를 대기(상태 5)로 되돌린다 — 그때까지 스윙 끝 칸에 머문다 (`batterFrameAt`)
        swingStartedAtRef.current = -1
        // 같은 0x35650 → 0x340c0 이 투수 그림 객체를 상태 0(선 자세)으로 — 그때까지 투구 마지막 자세에 머문다
        pitcherStartedAtRef.current = -1
      }
    }

    /**
     * 파티클은 **원본 틱**에 맞춰 굴린다 — rAF 가 60fps 라도 갱신은 틱마다 한 번이다.
     * 탭이 쉬다 돌아오면 밀린 틱이 한꺼번에 쌓이므로 따라잡기는 몇 틱으로 끊는다.
     */
    let particleTick = 0
    const PARTICLE_CATCH_UP_LIMIT = 4
    /** 홈런 효과 객체 [0x1400064] — 글자 창(`homeRunText`)이 몬다 (`lib/homeRunEffects`) */
    let stageEffects = NO_STAGE_EFFECTS
    /** 경기 정산 효과 — 결과 배경의 첫 그림에서 한 번 깐다(0x4ea0c). 깔기 전이면 undefined, 끈 효과면 null */
    let settlementEffect: SettlementEffect | null | undefined
    /**
     * 결과 창 뒤 배경(`isResultBackdrop`)으로 바뀐 시각 — 그때부터 +0x17e2 를 센다. 타석이면 null.
     * 공용 창이 떠 있으면 경기 장면 0x52c50 이 52cc6 에서 갱신 0x4b100 을 건너뛰어 +0x17e2 가 안 오르므로 시계가 선다
     * (`frozenClock`). ⚠️ 정정(r106): 그리기도 52efe 에서 창이 선 첫 그림 말고는 건너뛰어 구름 · 정산 효과도 멈춘다 — 경기 장면이
     * 서 있으면 아래 `frame` 머리의 `isGameSceneFrozen` 이 그림을 통째로 세우고, 이 시계는 경기 장면 셈 밖에서 히든 오픈 알림 문맥만
     * 선 경우(`isSceneFrozen`)에 남는다
     */
    let backdropClock: FrozenClock | null = null
    /**
     * '대기' 에서 쉬기 시작한 시각 — 쉬는 동안은 단계 시작 시각을 그림마다 되밀어 틱이 늘 0 이라 따로 센다.
     * 0xe 진입 0x50674 가 필살 횟수 표시의 애니(game_ui 애니 5)를 되감아 거는 자리다 (`specialSwingBadge`).
     */
    let pausedSince: number | null = null

    /**
     * **경기 스킬 표시 판** (`model/skillPanelDriver`) — 사람이 치는 타석의 0xf 는 쉬지 않는 '대기', 0xf 진입은 그 단계에 든 시각
     * (`phaseStartedAtRef`)이 바뀔 때, 0x10 · 0x11 은 '투구중'이다.
     */
    const stepSkillPanel = createSkillPanelDriver()
    const skillPanelSituationNow = (): SkillPanelSituation => {
      const latest = latestRef.current
      const hud = latest.hud
      const bases = hud?.bases ?? { first: false, second: false, third: false }
      const repertoire = latest.pitcherAbility.repertoire
      return {
        ...(latest.gameMode === undefined ? {} : { gameMode: latest.gameMode }),
        inning: hud?.inning ?? 1,
        // 사람이 치는 타석 — 공격 측이 사람 팀이다
        attackScore: hud?.ourScore ?? 0,
        defenseScore: hud?.opponentScore ?? 0,
        runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
        hasSecondBaseRunner: bases.second,
        pitcherHand: pitcherHandOfPitch({ pitcherForm: repertoire?.form ?? 0, pitcherMagicNumber: repertoire?.magicId ?? 0 }),
        batterHand: latest.batterHand ?? batterSideOfForm(latest.batterForm),
        batterRecordSlot: latest.batterRecordSlot,
        recentAtBatCodes: latest.recentAtBatCodes,
      }
    }
    /** 이 그림의 판 — 0xd · 0xf 진입을 보고 원본 틱마다 0x4b5b4 를 한 번 돌린다. 그리지 않는 상태면 null */
    const stepSkillPanelNow = (nowTick: number): SkillPanelView | null => {
      const latest = latestRef.current
      const source = latest.skillPanel
      if (source === undefined) return null
      const isStateF = phaseRef.current === '대기' && !latest.isPaused
      return stepSkillPanel({
        source,
        isStateF,
        stateFMark: phaseStartedAtRef.current,
        isDrawnState: isStateF || phaseRef.current === '투구중',
        nowTick,
        batterSkillBits: skillBitsOfIds(latest.batterSkillIds, false),
        pitcherSkillBits: pitcherSkillBitsOf(latest.pitcherAbility),
        strikes: latest.hud?.strikes ?? 0,
        batterRecordSlot: latest.batterRecordSlot,
        batterHand: latest.batterHand ?? batterSideOfForm(latest.batterForm),
        situation: skillPanelSituationNow,
      })
    }

    /** 0x4c4bc 의 상태 갈래 재료 — 쉬는 '대기' 면 쉬기 시작한 뒤 틱(⚠️ 근사: 웹 쉬기는 0xd 두 그림부터라 0xe 진입보다 두 그림 이르다) */
    const specialSwingEffectNow = (now: number, tickLength: number) => {
      const effect = pendingHitRef.current?.specialEffect ?? null
      if (phaseRef.current !== '타격' || effect === null) return null
      return { ...effect, drawCall: pitchTickAt(now, phaseStartedAtRef.current, tickLength) + 1 }
    }

    const stagePhaseNow = (now: number, tickLength: number) => {
      const isPaused = latestRef.current.isPaused
      const pausedWaiting = phaseRef.current === '대기' && isPaused
      if (!pausedWaiting) pausedSince = null
      else if (pausedSince === null) pausedSince = now
      return {
        kind: phaseRef.current,
        tick: pitchTickAt(now, pausedSince ?? phaseStartedAtRef.current, tickLength),
        isPaused,
        isInPlay: phaseRef.current === '결과' && isInPlayResultRef.current,
      }
    }

    const frame = (rawNow: number) => {
      // 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신(장면 틱 · 키 · 갱신 표)을, 52efe 가 상태 그리기를,
      // 53048 이 파티클 틱 · 그리기를 건너뛴다. 창이 선 첫 그림([창+0x250])은 장면을 한 번 더 그리지만 갱신이 없어 앞 그림과 같은
      // 모습이라, 웹은 그 그림부터 캔버스를 그대로 둔다(굳은 화면). 시계도 서 있다가 창이 닫히면 이어 흐른다 — 따라잡지 않는다.
      // ⚠️ 미구현(원본 확인 — R10 7절 r107 보강): [+0x250] 그림은 갱신 없이 그리기만 한 번 돌아 그리기 쪽 셈(0x10 조준 애니 0 칸 ·
      // 0x11 커서 0x4d708 / 결과 원 0x4d700 · 점수판 0x36714 목표 줄)이 한 번 오른다 — 웹은 그 한 그림을 그리지 않아 안 오른다
      if (isGameSceneFrozen()) {
        animationHandle = requestAnimationFrame(frame)
        return
      }
      const now = gameSceneTimeOf(rawNow)
      const isBackdrop = latestRef.current.isResultBackdrop === true
      if (!isBackdrop) {
        if (settlementEffect !== undefined) {
          // 정산을 나가 같은 타석 화면이 다시 경기로 돈다(미션 재도전) — 0x4b100 4b3b6 이 나갈 때 파티클을 다 치운다(0x6dee4,
          // 굴림 없음). 효과 객체는 경기 중에 안 돌고(0x901a0 은 정산 그림 · 홈런 글자만 부른다) 다음 정산 진입 0x4ea0c 가 다시 깐다
          clearParticles(particlesRef.current)
          settlementEffect = undefined
        }
        backdropClock = null
      } else {
        backdropClock = observeFrozenClock(backdropClock ?? startFrozenClock(now), now, latestRef.current.isSceneFrozen === true)
      }
      // 결과 창 뒤 배경(0x19 · 0x1a)에는 투구 갱신이 없다 — 투구 단계를 멈춘다(파티클 틱은 아래 — 프레임 끝 0x6de85 는 돈다)
      if (!isBackdrop) advancePhase(now)

      const pitch = pitchRef.current
      const tickLength = millisecondsPerFrame()
      // 몸통 종류 t = 폼 >> 1 (0 balancer · 1 sluger, 0x78ab0) — 자세표도 이걸로 갈린다
      const bodyType = bodyTypeOf(latestRef.current.batterForm)
      // 손 0xb63c0 (0 우타 · 1 좌타) — 그림 반전과 앵커·존 칸을 고른다 (R6 4절). 타석 교대 0x47d58~0x47d70 이 장면 +0x17e1 ·
      // 그림 +0x48 · +0x60 에 같은 0xb63c1(타자)를 쓴다 — 마타자는 표 0xd88b0, 그 밖은 폼 & 1
      const side = latestRef.current.batterHand ?? batterSideOfForm(latestRef.current.batterForm)
      const isPitching = phaseRef.current === '투구중' && pitch !== null
      const ballFrame = isPitching ? ballFrameAt(now, phaseStartedAtRef.current, tickLength, latestRef.current.acePitcher?.order) : -1
      const pitcherStartedAt = pitcherStartedAtRef.current
      const pendingHit = phaseRef.current === '타격' ? pendingHitRef.current : null
      // 홈런 연출은 결과 문구 시간(1150ms)보다 길다 — 날아 들어오기만 22틱이라 따로 센다
      const homeRunStartedAt = homeRunStartedAtRef.current
      const isHomeRun = homeRunStartedAt >= 0

      const nowTick = pitchTickAt(now, openedAt, tickLength)
      if (particleTick === 0) particleTick = nowTick
      const settlement = isBackdrop ? latestRef.current.settlement : undefined
      // 경기 장면 프레임 0x52c50 의 파티클 게이트 53048~5304c — 공용 창 [0x140005c]+9 가 서 있으면 관리자 틱 0x6de85 · 그리기 0x6dd69 를
      // 둘 다 건너뛴다. 그동안 상태 갱신(52cc6 → 52ef2)과 상태 그리기(52f0e~52f24 → 53032, 장면을 다시 그리는 첫 그림 [+0x250] 말고)도
      // 건너뛰므로 그 안의 효과 틱(0x40faa · 정산 0x4a384)도 없다 — 이 그림들의 틱은 따라잡지 않고 버린다(원본 틀이 돌지 않은 것과 같다)
      const isParticleGated = isCommonWindowShown()
      const steps = isParticleGated ? 0 : Math.min(PARTICLE_CATCH_UP_LIMIT, nowTick - particleTick)
      if (settlement !== undefined && settlementEffect === undefined) {
        settlementEffect = enterSettlementEffect(
          {
            isWin: settlement.isWin,
            // 0x4f42c 는 구장 +0x14(지금 하늘 칸 = 경기 상태 +0x6b, 0부터)로 하늘 색을 본다
            skyColorIndex: skyColorsOf(skyRowNow(), skyColumnOfInning(settlement.inning)).colorIndex,
            side0Score: settlement.side0Score,
            side1Score: settlement.side1Score,
          },
          settlement.random,
        )
      }
      // 틱마다 원본 프레임 차례 — (치우기) → (홈런 효과 깔기) → 글자 유지 그림의 효과 틱 0x40faa → 파티클 틱 0x6de84
      const firstSteppedTick = nowTick - steps
      for (let step = 0; step < steps && settlement !== undefined; step += 1) {
        if (settlementEffect !== null && settlementEffect !== undefined) {
          tickSettlementEffect(settlementEffect, fireworksPortOf(particlesRef.current, particleConfigOf), settlement.random)
        }
        tickParticles(particlesRef.current, settlement.random)
      }
      // 정산 효과가 없는 결과 배경(홈런더비 결과 창 0x1a — 갱신 0x3c0b8 · 그리기 0x45c18 는 구름 0x78449 · 배경 0x78579 · 창뿐, 효과 틱 없음)도
      // 프레임 끝 관리자 틱 0x6de85 는 돈다(53048 의 게이트는 공용 창만 본다 — 경기 상태를 안 가린다). 굴림은 경기 난수
      for (let step = 0; step < steps && isBackdrop && settlement === undefined; step += 1) {
        tickParticles(particlesRef.current, latestRef.current.random)
      }
      for (let step = 0; step < steps && !isBackdrop; step += 1) {
        const stepTime = openedAt + (firstSteppedTick + step + 1) * tickLength
        // 0x17 진입 0x46418 의 4673e — 0x13 을 끝낸 틱(그 틱의 파티클 틱 · 그리기는 0x13 끝에 쏜 016 까지 한 번 돈다) 다음 틱에 비운다
        const inPlayEnteredAt = inPlayEnteredAtRef.current
        if (inPlayEnteredAt !== null && stepTime > inPlayEnteredAt) {
          inPlayEnteredAtRef.current = null
          clearParticles(particlesRef.current)
        }
        stageEffects = stepStageFrame(stageEffects, {
          time: stepTime,
          millisecondsPerTick: tickLength,
          window: latestRef.current.homeRunText ?? null,
          effectsClearedAt: latestRef.current.effectsClearedAt ?? null,
          particles: particlesRef.current,
          random: latestRef.current.random,
          configOf: particleConfigOf,
        })
      }
      particleTick = nowTick

      // 마운드 투수의 폼·손 — 던진 공이 실은 값(그 투수 레코드)을 먼저, 없으면 레퍼토리(같은 레코드의 폼·+0x18)
      const repertoire = latestRef.current.pitcherAbility.repertoire
      const pitcherForm = pitch?.pitcherForm ?? repertoire?.form ?? 0
      const pitcherHand = pitcherHandOfPitch({
        pitcherForm,
        pitcherMagicNumber: pitch?.pitcherMagicNumber ?? repertoire?.magicId ?? 0,
      })

      const settlementRain = settlementEffect?.kind === 'rain' ? settlementEffect.rain : null
      // 0x35b94 는 타석 상태 그림(0x13 포함)마다 한 번 — 루에 (숨김 없이) 주자가 선 애니만 한 칸씩 (`stepRunnerAnimationClock`)
      const runnerFrames = runnerTick < 0 ? 1 : nowTick - runnerTick
      runnerTick = nowTick
      const stageHud = latestRef.current.hud
      const runnerAnimationSteps =
        stageHud === null || isBackdrop
          ? undefined
          : stepRunnerAnimationClock(
              latestRef.current.runnerAnimationClock?.current ?? localRunnerClock,
              stageHud.bases,
              stageHud.hiddenRunnerBases ?? [],
              runnerFrames,
            )
      const stageScene: StageScene = {
        pitcherForm,
        pitcherHand,
        pitch,
        frame: ballFrame,
        shift: shiftRef.current,
        isEagleEyeEnabled: latestRef.current.isEagleEyeEnabled && phaseRef.current === '투구중',
        resultText: phaseRef.current === '결과' ? resultTextRef.current : '',
        isHomeRun,
        homeRunTick: isHomeRun ? pitchTickAt(now, homeRunStartedAt, tickLength) : 0,
        // 부르는 쪽이 모는 글자 창이 있으면 그 칸대로만 그린다 (홈런더비 — `BattingStage` 의 `homeRunText`)
        homeRunFrame:
          latestRef.current.homeRunText === undefined
            ? undefined
            : latestRef.current.homeRunText === null
              ? null
              : homeRunTextFrameAt(latestRef.current.homeRunText, now, tickLength),
        swingFrame: batterFrameNow(now, swingStartedAtRef.current, buntRef.current !== null, bodyType, latestRef.current.aceBatterOrder),
        // 필살 스윙 연출 그림 0x49aec — 상태 0x13('타격') 동안 그림마다 한 번 불린다 (k = 단계 틱 + 1, `specialSwingEffect`)
        specialSwingEffect: specialSwingEffectNow(now, tickLength),
        bodyType,
        ...(latestRef.current.aceBatterOrder === undefined ? {} : { aceBatterOrder: latestRef.current.aceBatterOrder }),
        batterSkinIndex: latestRef.current.batterSkinIndex,
        batterTeamIndex: latestRef.current.batterTeamIndex,
        batterEquipment: latestRef.current.batterEquipment,
        side,
        hud: latestRef.current.hud,
        pitcherStaminaPercent: latestRef.current.pitcherStaminaPercent ?? null,
        // 실투 "!" — 놓은 0x11 틱 10 의 그림이 첫 그림(1)이다 (`pitcherFatigue` 의 실투 "!")
        pitcherMistakeMarkDraw:
          isPitching && pitch !== null && pitch === mistakeMarkPitch
            ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) - CPU_RELEASE_TICK_IN_0X11 + 1
            : null,
        ...(latestRef.current.runnerAces === undefined ? {} : { runnerAces: latestRef.current.runnerAces }),
        acePitcher: latestRef.current.acePitcher,
        ...(latestRef.current.pitcherEquipment === undefined ? {} : { pitcherEquipment: latestRef.current.pitcherEquipment }),
        pitcherTick: pitcherStartedAt < 0 ? null : pitchTickAt(now, pitcherStartedAt, tickLength),
        pitcherTickEnd: pitcherStartedAt < 0 ? null : pitcherTickEnd,
        // 투수 그리기의 홈런 갈래(0x3908a)가 결과 코드 [+0xfd4] · 감상 플래그 +0x199a 를 본다 — 투수를 그리는 0x11 · 0x12 · 0x13 에서.
        // 맞은 공의 인플레이(웹 '결과' isInPlay = 원본 0x17)는 그리기 0x46c88 이 0x38d1c 를 안 불러 없다
        pitcherHitMark:
          pitcherStartedAt < 0 || (phaseRef.current === '결과' && isInPlayResultRef.current)
            ? null
            : {
                codeBeforePitch: resultCodeBeforePitch,
                judgedTick: judgedResultCode?.tick ?? null,
                judgedCode: judgedResultCode?.code ?? null,
                isBigHit: pendingHit?.watchesBigHit ?? false,
              },
        tick: nowTick,
        ...(runnerAnimationSteps === undefined ? {} : { runnerAnimationSteps }),
        // 판이 효과 층을 깔았으면 배경 캔버스에는 배경만 — 비 · 파티클은 아래에서 그 층에 그린다
        particles: settlement?.layers === undefined && !isParticleGated ? particlesRef.current : null,
        rain: settlement?.layers === undefined ? settlementRain : null,
        // 정산 결과 배경의 하늘 칸 — 0x4a384 는 +0x14 를 안 바꾸므로 경기 끝 이닝 그대로, 지면 진입 0x4ea0c 4f4fe~4f506 이
        // 구장객체 +0x18 = 12 → 0x76fc5(구장, 0) 으로 마지막 칸(밤)에 둔다
        skyColumn: settlement === undefined ? null : settlementSkyColumnOf(settlement),
        resultBackdropOffsetY:
          backdropClock === null
            ? null
            : (latestRef.current.resultBackdropOffsetOf ?? resultBackdropOffsetAt)(
                pitchTickAt(frozenClockNowOf(backdropClock, now), backdropClock.startedAt, tickLength),
              ),
        resultTick: phaseRef.current === '결과' ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : 0,
        // 0x4c4bc 의 상태 갈래 재료 — 웹 단계 · 그 단계에 든 뒤 틱 · 쉬는 중(0xd · 0xe 대기 따위)
        stagePhase: stagePhaseNow(now, tickLength),
        timeKeyCount: latestRef.current.timeKeyCount ?? null,
        specialSwingRemaining: latestRef.current.specialSwingRemaining ?? null,
        // 0x4cad4 → 0x4b5b4 — 경기 스킬 표시 판 (결과 창 뒤 배경에는 안 그린다)
        skillPanel: isBackdrop ? null : stepSkillPanelNow(nowTick),
        // 구장 번호(구장 +0x70)는 장면 셋업 0x39fdc 가 채운다 — 모드 1·8·9 만 넘어오고, 그 밖은 0 번 구장이다.
        // 시즌 구장 세 칸이 넘어오면 배경 묶음 자체가 0x77494 쪽으로 갈린다 (0x40ff0).
        scenery: {
          skyRow: skyRowNow(),
          stadium: latestRef.current.stadium ?? 0,
          fieldPalette: latestRef.current.fieldPalette ?? null,
          seasonStadium: latestRef.current.seasonStadium,
          // 하늘 조명 0x78490 은 모드 5·6·7(미션·홈런더비)에서 안 그린다
          gameMode: latestRef.current.gameMode,
          // 환경설정 전광판(+0x3a) OFF 면 흐르는 글자를 안 그린다 (0x77726)
          isScoreboardOn: latestRef.current.isScoreboardOn,
        },
      }
      // 정산 효과 층 — 비는 효과 틱 0x4a452 자리(진 판 덮개 위 · 띠 아래), 파티클은 프레임 끝 0x6dd69 자리(판 맨 위)
      const layers = settlement?.layers
      const rainLayer = layers?.rain.current ?? null
      const particleLayer = layers?.particles.current ?? null
      // 위까지가 이 틀의 상태 갱신이다(틱 · 굴림은 틀마다 그대로). 그림은 입력이 앞 틀과 같으면 캔버스에 남은 그림이 곧 이 틀의
      // 그림이라 건너뛴다(`createDrawMemo`) — 파티클 관리자 · 비는 제자리에서 고쳐 쓰므로 그 모습(`particleSignatureOf` · 틱)으로 견준다
      const shouldDraw = drawMemo.needsDraw(canvas, {
        scene: { ...stageScene, particles: particleSignatureOf(stageScene.particles) },
        layerParticles: layers === undefined || isParticleGated ? null : particleSignatureOf(particlesRef.current),
        rainLayer,
        rainLayerSize: rainLayer === null ? null : [rainLayer.width, rainLayer.height],
        particleLayer,
        particleLayerSize: particleLayer === null ? null : [particleLayer.width, particleLayer.height],
      })
      if (shouldDraw) renderBattingStage(context, stageScene)
      if (shouldDraw && layers !== undefined) {
        const rainContext = layers.rain.current?.getContext('2d') ?? null
        if (rainContext !== null) renderSettlementLayer(rainContext, { rain: settlementRain })
        const particleContext = effectContextOf(layers.particles.current)
        if (particleContext !== null) renderSettlementLayer(particleContext, { particles: isParticleGated ? null : particlesRef.current })
      }

      animationHandle = requestAnimationFrame(frame)
    }

    phaseStartedAtRef.current = gameSceneNow()
    animationHandle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationHandle)
    // ref 묶음은 값이 바뀌지 않는다. 고리는 handlersRef 로 읽는다 — 루프를 다시 세우는 때는 예전처럼 판정 · 0x13 고리가 바뀔 때뿐이다
    // (타자가 바뀌면 판정 고리가 바뀐다). 필살 횟수로 바뀌는 고리(releaseSwing · endPitch)는 투구 도중이라 다시 세우지 않는다
  }, [handlers.judgePitch, handlers.commitHit])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // 탭이 숨겨진 동안 requestAnimationFrame이 멈춘다. 돌아왔을 때 경과 시간이
      // 통째로 쌓여 있으면 진행 중이던 투구가 곧바로 스트라이크로 처리되므로
      // 타석을 다시 준비 상태로 되돌린다.
      phaseRef.current = '대기'
      phaseStartedAtRef.current = gameSceneNow()
      pitchRef.current = null
      buntRef.current = null
      swingRef.current = null
      swingStartedAtRef.current = -1
      pitcherStartedAtRef.current = -1
      pitchJudgedRef.current = false
      heldResultRef.current = null
      pendingHitRef.current = null
      resultTextRef.current = ''
      homeRunStartedAtRef.current = -1
      // 쉬는 동안 밀린 연출은 버린다 (원본도 상태가 바뀔 때 목록을 비운다, 0x6dee4)
      clearParticles(particlesRef.current)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
