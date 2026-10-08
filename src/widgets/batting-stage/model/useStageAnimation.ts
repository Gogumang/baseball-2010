import { useEffect } from 'react'
import { DEFAULT_REPERTOIRE, selectPitch } from '@/entities/pitching/model/selectPitch'
import { aceOrderOfMagicNumber, createMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import { lastSwingFrameOf } from '@/entities/batting/model/swingTiming'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'
import { renderBattingStage, renderSettlementLayer } from '@/widgets/batting-stage/lib/renderBattingStage'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameNow, pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { NO_STAGE_EFFECTS, fireworksPortOf, stepStageFrame } from '@/widgets/batting-stage/lib/homeRunEffects'
import { tickParticles } from '@/entities/particle/model/particleScene'
import { enterSettlementEffect, tickSettlementEffect, type SettlementEffect } from '@/entities/batting/model/settlementEffect'
import { skyColorsOf } from '@/widgets/batting-stage/lib/stageScenery'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { homeRunTextFrameAt } from '@/widgets/batting-stage/lib/homeRunBanner'
import { preloadPtcParts } from '@/widgets/particles/lib/renderParticles'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { activeSound } from '@/shared/api/audio/soundPort'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { isBuntJudgeFrame } from '@/widgets/batting-stage/lib/buntStance'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import { DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'
import { resultBackdropOffsetAt } from '@/widgets/batting-stage/lib/stageScenery'

/** 홈런더비 = 원본 전역 모드 7 */
const HOME_RUN_DERBY_GAME_MODE = 7
/** 다음 투구까지의 준비 시간 */
const WIND_UP_MILLISECONDS = 850
/** 결과 문구를 보여주는 시간 */
const RESULT_DISPLAY_MILLISECONDS = 1150
const SPECIAL_PITCH = 'SPECIAL'
const SKY_ROW_COUNT = 6
/** 타자 스킬 22 압도 (skills.json 22) — 상대 투수 실투율 +5 */
const INTIMIDATE_SKILL_ID = 22

type FinishPitch = (swing: BattingSwing | null, now: number) => void
/** 상태 0x13 을 끝내고 인플레이로 넘기는 고리 */
type CommitHit = (now: number) => void

/** 캔버스 애니메이션 루프와 투구 단계 진행. */
export function useStageAnimation(refs: StageRefs, finishPitch: FinishPitch, commitHit: CommitHit) {
  const {
    canvasRef,
    pitchRef,
    pitchTypeNumberRef,
    phaseRef,
    phaseStartedAtRef,
    resultTextRef,
    homeRunStartedAtRef,
    swingStartedAtRef,
    shiftRef,
    buntRef,
    pendingHitRef,
    particlesRef,
    latestRef,
  } = refs

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let animationHandle = 0
    const openedAt = performance.now()
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
     *    이어지는데 여기서는 0 으로 돌아가고, 화면이 내려가면(반 이닝) 둘 다 잃는다 — 그래서 사람 투구와 공을
     *    함께 드는 진행기는 `cpuMagic` 으로 넘긴다(팀 경기).
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
          const { pitcherAbility, random, hud, onPickoff } = latestRef.current
          const bases = hud?.bases ?? { first: false, second: false, third: false }
          const choice = selectPitch(
            pitcherAbility,
            pitchSituationOf(hud, latestRef.current.batterForm),
            random,
            'hard',
            magicStateOf(pitcherAbility.repertoire),
            // 견제를 받아 줄 쪽이 있을 때만 켠다 — 주자 루는 HUD 루 그대로 (원본 0xa9878 자리)
            onPickoff === undefined
              ? undefined
              : {
                  hasRunnerOnBase: (base) =>
                    base === 1 ? bases.first : base === 2 ? bases.second : base === 3 ? bases.third : false,
                },
            // 실투 판정 0x33cbc 의 타자 비트 22 압도 — 0xb62b4 는 **장착** 비트라 장착 스킬 번호로 본다
            latestRef.current.batterSkillIds.includes(INTIMIDATE_SKILL_ID),
            // 홈런더비(모드 7)는 0x344ea 가 구질을 굴리지 않고(마투수가 나왔으면 22, 아니면 1),
            // 0x345fc 가 종류·목표점을 굴리지 않고 존 한가운데를 노리며(0x3460e) 마구 소모(0x34894)도 건너뛴다
            latestRef.current.gameMode === HOME_RUN_DERBY_GAME_MODE
              ? latestRef.current.derbyPitchType ?? DERBY_ORDINARY_PITCH_TYPE
              : undefined,
          )
          if (choice.kind === '견제') {
            // 0x34848 → 메시지 0x10: 공을 안 던진다(상태 0x11 예약 0x34888 을 안 지난다).
            // 견제 판(상태 0x17)이 끝나면 원본은 같은 타석 다음 공(0xf)으로 돌아온다 — 여기서는 다시 대기로 둔다
            pitchRef.current = null
            phaseStartedAtRef.current = now
            onPickoff?.(choice.base)
            return
          }
          pitchRef.current = choice.pitch
          pitchTypeNumberRef.current = choice.pitchTypeNumber
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
        const bunt = buntRef.current
        // 번트 자세는 공이 N−1 틱에 닿는 그 틱에 깊이 조건 없이 판정한다 (0x4e15c r7 → 0x4e1fe 메시지 0x6aa, 확정)
        if (bunt !== null && isBuntJudgeFrame(frame, pitch.frameCount)) {
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
    /** 결과 창 뒤 배경(`isResultBackdrop`)으로 바뀐 시각 — 그때부터 +0x17e2 를 센다. 타석이면 null */
    let backdropStartedAt: number | null = null

    const frame = (now: number) => {
      const isBackdrop = latestRef.current.isResultBackdrop === true
      if (!isBackdrop) backdropStartedAt = null
      else if (backdropStartedAt === null) backdropStartedAt = now
      // 결과 창(상태 0x1a)에는 투구·파티클 갱신이 없다 — 투구 단계를 멈추고 파티클 틱도 그 자리에 묶어 둔다
      if (!isBackdrop) advancePhase(now)

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

      const nowTick = pitchTickAt(now, openedAt, tickLength)
      if (particleTick === 0) particleTick = nowTick
      const settlement = isBackdrop ? latestRef.current.settlement : undefined
      // 결과 배경은 정산 효과가 있을 때만 틱을 돈다 — 0x4a384 의 효과 틱 → 프레임 끝 파티클 틱 (둘 다 경기 난수)
      const steps =
        isBackdrop && settlement === undefined ? 0 : Math.min(PARTICLE_CATCH_UP_LIMIT, nowTick - particleTick)
      if (settlement !== undefined && settlementEffect === undefined) {
        settlementEffect = enterSettlementEffect(
          {
            isWin: settlement.isWin,
            skyColorIndex: skyColorsOf(skyRow, settlement.inning).colorIndex,
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
      for (let step = 0; step < steps && settlement === undefined; step += 1) {
        stageEffects = stepStageFrame(stageEffects, {
          time: openedAt + (firstSteppedTick + step + 1) * tickLength,
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
      renderBattingStage(context, {
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
        swingFrame: batterFrameNow(now, swingStartedAtRef.current, buntRef.current !== null, bodyType),
        bodyType,
        batterSkinIndex: latestRef.current.batterSkinIndex,
        batterTeamIndex: latestRef.current.batterTeamIndex,
        batterEquipment: latestRef.current.batterEquipment,
        side,
        hud: latestRef.current.hud,
        acePitcher: latestRef.current.acePitcher,
        pitcherTick: isPitching ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : null,
        tick: nowTick,
        // 판이 효과 층을 깔았으면 배경 캔버스에는 배경만 — 비 · 파티클은 아래에서 그 층에 그린다
        particles: settlement?.layers === undefined ? particlesRef.current : null,
        rain: settlement?.layers === undefined ? settlementRain : null,
        resultBackdropOffsetY:
          backdropStartedAt === null
            ? null
            : (latestRef.current.resultBackdropOffsetOf ?? resultBackdropOffsetAt)(
                pitchTickAt(now, backdropStartedAt, tickLength),
              ),
        resultTick: phaseRef.current === '결과' ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : 0,
        // 일반 구장 번호를 고르는 규칙(st+0x70)이 미확인이라 0 번 구장으로 둔다 (추정).
        // 시즌 구장 세 칸이 넘어오면 배경 묶음 자체가 0x77494 쪽으로 갈린다 (0x40ff0).
        scenery: {
          skyRow,
          stadium: 0,
          seasonStadium: latestRef.current.seasonStadium,
          // 하늘 조명 0x78490 은 모드 5·6·7(미션·홈런더비)에서 안 그린다
          gameMode: latestRef.current.gameMode,
          // 환경설정 전광판(+0x3a) OFF 면 흐르는 글자를 안 그린다 (0x77726)
          isScoreboardOn: latestRef.current.isScoreboardOn,
        },
      })
      // 정산 효과 층 — 비는 효과 틱 0x4a452 자리(진 판 덮개 위 · 띠 아래), 파티클은 프레임 끝 0x6dd69 자리(판 맨 위)
      const layers = settlement?.layers
      if (layers !== undefined) {
        const rainContext = layers.rain.current?.getContext('2d') ?? null
        if (rainContext !== null) renderSettlementLayer(rainContext, { rain: settlementRain })
        const particleContext = layers.particles.current?.getContext('2d') ?? null
        if (particleContext !== null) renderSettlementLayer(particleContext, { particles: particlesRef.current })
      }

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
      // 쉬는 동안 밀린 연출은 버린다 (원본도 상태가 바뀔 때 목록을 비운다, 0x6dee4)
      clearParticles(particlesRef.current)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
