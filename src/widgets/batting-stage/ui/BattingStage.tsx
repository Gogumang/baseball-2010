import { useCallback, useMemo, useRef } from 'react'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { createPatternDeck, lastDrawnPattern } from '@/entities/batting/model/battedBallOutcome'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { batterEquipmentOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { hitPauseTicksOf, isBigHit, pauseInputOf } from '@/widgets/batting-stage/lib/hitPause'
import {
  BIG_HIT_PARTICLE,
  HIT_PARTICLE_IMAGE,
  hitParticleIdOf,
  hitParticleInputOf,
  specialSwingParticlesOf,
} from '@/widgets/batting-stage/lib/hitParticles'
import { ballPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import { batterSideOfForm, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { describeResolution, isHomeRunResolution, situationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, StageHud } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import { rollSpecialSwing } from '@/entities/batting/model/specialSwing'
import * as styles from '@/widgets/batting-stage/ui/BattingStage.css'

interface BattingStageProps {
  readonly batterAbility: BatterAbility
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  /** 화면에 겹쳐 그릴 경기 상황 */
  readonly hud: StageHud | null
  /** 등판한 마선수의 합성 프레임. 없으면 평범한 투수다. */
  readonly acePitcher: AcePitcherFrames | null
  /** 번트를 쓸 수 있는지 */
  readonly canBunt?: boolean
  /** 판정 모드 — 나만의리그는 "내 선수" 보너스가 붙는다 (0xab214) */
  readonly swingMode?: SwingMode
  /**
   * **타자 폼** = 원본 선수 레코드 `rec[0xb]` 의 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a).
   * 몸통 파일(balancer/sluger)과 자세표를 `폼 >> 1` 로 고른다 (0x78ab0).
   * 안 넘기면 0 = 타격형·우타라 예전과 같은 밸런스형 몸통이다.
   */
  readonly batterForm?: number
  /**
   * **피부** (선수 레코드 `rec[0xb]` bit2-3 — 0 황인 · 1 백인 · 2 흑인) 와 **소속 팀 번호**.
   * 원본은 타자 그림 객체를 세울 때 이 둘을 같이 넘겨 몸통 팔레트 `피부 × 15 + 팀`,
   * 헬멧 팔레트 `팀` 을 고른다 (0x10810 → 0x78be8·0x78c14, C-1).
   *
   * 안 넘기면 피부는 0(황인 — 구운 PNG 가 쓰는 벌도 피부 0 이다), 팀은 `hud.ourTeamId` 다.
   * ⚠️ 팀을 hud 에서 꺼내는 것은 **근사**다 — "타석에 선 쪽이 내 팀" 이라고 본 것이라
   * 상대 팀 공격을 그리는 화면이 생기면 `batterTeamIndex` 를 따로 넘겨야 한다.
   */
  readonly batterSkinIndex?: number
  readonly batterTeamIndex?: number
  /**
   * **장착 장비 니블** = `career.equipmentLevels` (0 미장착 · 1~11 = 레벨+1, 부위 순서는
   * 히트·파워·수비·주루 = 헬멧·배트·밴드·슈즈). 원본도 이 니블에서 `등급 − 1` 을 꺼내
   * 머리·손·다리 그림 슬롯을 채운다 (0x10866 → 0x78fd8).
   * 안 넘기면 아무것도 장착하지 않은 선수로 그린다.
   */
  readonly batterEquipmentLevels?: BatterAbility
  readonly batterSkillIds?: readonly number[]
  readonly recentAtBatCodes?: readonly number[]
  /**
   * **시즌 구장 세 값** — `{ stand: 관중석 칸, crowd: 관중 단계, board: 전광판 칸 }`.
   * 넘기면 배경을 시즌 구장 0x77494 로 그려 **장착한 전광판**이 뒤에 선다.
   *
   * 원본 `0x40ff0` 은 **모드 2(시즌)이고 내 팀 == 홈팀**일 때만 이 묶음을 쓴다 — 원정이면
   * 안 넘겨야 원본과 같다. 값은 `0x353ac~0x353e6` 이 시즌 기록에서 그대로 옮기므로
   * `stand = record.stadiumEquipped[0]` · `board = record.stadiumEquipped[1]` 이다.
   * `crowd` 는 아이템이 아니라 **관중 수 그림 단계**다 — 시즌 홈경기면 만원 판정 `SR[0x65]` + 1,
   * 대전 모드면 3 고정이다 (`SeasonStadium` 주석 참고). 잔디 칸은 이 길로 들어가지 않는다.
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * **게임 모드** = 원본 전역 `0x1552d10` (1 일반 · 2 시즌 · 4 나리 타자편 · 6 타자 미션 · 7 홈런더비 · 8·9 대전).
   * 지금은 하늘 조명 `0x78490` 만 본다 — 모드 5·6·7 이면 조명을 안 그린다 (0x784a2~0x784b0).
   * 안 넘기면 그 셋이 아닌 것으로 본다.
   */
  readonly gameMode?: number
  /** 참이면 새 공을 던지지 않는다. 타석 결과 연출 중에 쓴다. */
  readonly isPaused: boolean
  readonly random: RandomPort
  /**
   * **고른 필살타법 번호** (선수 레코드 +0x18, 1~4). 레벨(+0x201)이 아니다 — 경기는 이 번호만 본다
   * (H2 1-2 "레벨은 여기서 직접 쓰이지 않는다"). 0 이면 '0' 키가 무시된다(0x51e14: 0xaea30 이
   * `+0x18 == 0 → 0` 을 준다). 성공 확률은 표 `0xcfdbe[번호−1]` (0x34c74) — 장타형 메테오도 저장 번호가
   * 4 라 넷째 값 25% 다. 마타자는 번호와 무관하게 30% 라 `aceBatterIndex` 로 따로 알린다 (H2 2-2).
   */
  readonly specialSwingNumber?: number
  /**
   * **마타자 순번** (0~4). `ACE_PLAYERS` 중 `role === '타자'` 다섯의 배열 색인 그대로다
   * (medica 0 · kao 1 · roze 2 · death 3 · tiger 4). 마타자가 아니면 −1 이거나 안 넘긴다.
   *
   * 원본은 `0xb63a0(타자)` 가 같은 값을 준다 — 마선수(`rec[0xa]` 비트 0x40)면 `rec[0xa] & 0x1f`,
   * 아니면 −1 이다. 필살 연출 점프표 `0xd01e4` 가 이 순번으로 파티클을 고른다 (0x49b7c).
   * 확률 쪽은 순번을 안 보고 "마타자인가" 만 본다 (H2 2-2 — 번호 무관 30%).
   */
  readonly aceBatterIndex?: number
  /**
   * 세 번째 인자는 **필살타법이 성공한 타구인가** — 성공하면 야수가 쥐지 않고 지나친다
   * (0x51800 → `features/defense-play` 의 `isUncatchable`).
   */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean) => void
  /**
   * **CPU 투수의 견제** — 투구 AI 목표점 고르기 `0x345fc` 가 종류 4 를 뽑고 주자가 1·2명이면 `0x34848` 이
   * 주자 있는 루(1·2·3)를 굴려 메시지 0x10 을 보낸다. 그 투구는 **공이 없다** — 이 콜백만 부르고 다시 대기로 간다.
   * 주자 루는 `hud.bases` 로 본다.
   *
   * ⚠️ **안 넘기면 CPU 견제가 꺼진다**(`selectPitch` 의 옵션 없음) — 종류 4 를 예전처럼 모서리 투구로 던져
   *    원본과 난수 차례·결과가 어긋난다(미해결). 원본은 홈런더비(모드 7)만 빼고 견제하므로
   *    나만의리그 타자편(`pages/game`)·미션(`pages/mission-play`)도 진행기에 견제 판이 생기면 넘겨야 한다.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
}

/** 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. */
export function BattingStage({ canBunt = false, swingMode = '일반', batterForm = 0, batterSkinIndex = 0, batterTeamIndex, batterEquipmentLevels, batterSkillIds = [], recentAtBatCodes = [], specialSwingNumber = 0, aceBatterIndex = -1, ...props }: BattingStageProps) {
  const refs = useStageRefs({
    ...props,
    canBunt,
    swingMode,
    batterForm,
    batterSkinIndex,
    batterEquipment: batterEquipmentLevels === undefined ? NO_EQUIPMENT : batterEquipmentOf(batterEquipmentLevels),
    // 팀을 안 넘기면 HUD 의 내 팀 번호를 쓴다 (근사 — props 주석 참고)
    batterTeamIndex: batterTeamIndex ?? props.hud?.ourTeamId ?? 0,
    batterSkillIds,
    recentAtBatCodes,
  })
  /**
   * 이번 공에 필살타법을 걸어 두었는가 (`S+0x10`).
   * 새 투구 준비 `0x34334` 가 0 으로 되돌리므로 **공마다 다시 눌러야 한다** (H2 2-2).
   */
  const specialArmedRef = useRef(false)
  const { pitchRef, pitchTypeNumberRef, phaseRef, phaseStartedAtRef, resultTextRef, homeRunStartedAtRef, swingStartedAtRef, shiftRef, buntRef, deckRef, pendingHitRef, particlesRef, latestRef } = refs

  const finishPitch = useCallback((swing: BattingSwing | null, now: number) => {
    const pitch = pitchRef.current
    if (pitch === null) return
    const latest = latestRef.current
    const deck = deckRef.current ?? createPatternDeck(latest.random)
    const context = {
      batter: latest.batterAbility,
      pitcher: latest.pitcherAbility,
      mode: latest.swingMode,
      batterSkillIds: latest.batterSkillIds,
      situation: situationOf(latest.hud, latest.recentAtBatCodes, latest.batterForm),
      // 마선수가 등판했으면 원본 isAce 가 켜진 것과 같다 (0xab214 의 마선수 계수·보너스)
      isPitcherAce: latest.acePitcher !== null,
    }
    // 걸어 둔 필살은 스윙 객체 +0x10 에 실린다 (0x51e40) — 헛스윙 바람 소리 27 이 이걸 본다 (0x5132e)
    const judgedSwing = swing !== null && specialArmedRef.current ? { ...swing, isSpecial: true } : swing
    const resolved = resolvePitch(pitch, judgedSwing, context, deck, latest.random)
    // 구질 번호(game+0xfc8)를 실어 보낸다 — 받는 쪽이 0xa5e14 처럼 상대 투수 투구 수·스태미나를 깎는다
    const pitchTypeNumber = pitchTypeNumberRef.current
    const result =
      pitchTypeNumber === null ? resolved : { ...resolved, detail: { ...resolved.detail, pitchTypeNumber } }
    // 필살 스윙이면 여기서 굴린다 (0x34c74). 걸어 두지 않았으면 굴리지 않는다
    const isUncatchable = specialArmedRef.current
      && rollSpecialSwing(specialSwingNumber, latest.random, aceBatterIndex >= 0)
    // 필살 연출 파티클은 **성공 여부와 무관**하게 `S+0x10` 이 켜져 있으면 나간다 (0x49aec).
    // ⚠️ 원본은 상태 0x13 그리기에서 한 번(경기+0x196b) 쏘는데, 웹은 그 자리를 따로 두지 않아
    //    스윙이 판정되는 이 시점에 쏜다 — **때는 근사**고 고르는 번호만 원본 그대로다.
    if (specialArmedRef.current && swing !== null) {
      // 한 줄이 파티클을 두 개까지 쏜다 — 원본 0x49dbc·0x49de0 의 차례 그대로다
      const specials = specialSwingParticlesOf(specialSwingNumber, latest.batterForm, aceBatterIndex)
      const anchor = stageLayoutOf(batterSideOfForm(latest.batterForm)).batterAnchor
      for (const special of specials) {
        emitParticles(
          particlesRef.current,
          particleConfigOf(special.id),
          anchor.x + shiftRef.current,
          anchor.y + special.offsetY,
          special.img,
        )
      }
    }
    specialArmedRef.current = false
    deckRef.current = result.deck
    buntRef.current = null
    const resultText = describeResolution(result.detail)
    // 홈런이면 판정 글자 대신 HOMERUN 글자 연출을 켠다 (원본 0x51cd8 의 +0x1960, 사운드 11 은 웹에 없음)
    const isHomeRun = isHomeRunResolution(result.detail)

    // 맞은 공이면 인플레이(0x17) 앞에 **상태 0x13** 을 한 번 거친다. 헛스윙·볼은 0x12 라 그냥 결과다.
    if (result.detail.resultCode !== null) {
      const pauseInput = pauseInputOf(result.detail.resultCode, result.deck)
      const watchesBigHit = isBigHit(pauseInput)
      // 타격 순간 불꽃 (0x49e64 → 0x4a0ca) — 타격점은 맞은 틱의 공 자리로 본다 (근사)
      const pattern = lastDrawnPattern(result.deck, result.detail.resultCode)
      const contact = swing === null ? null : ballPixelAt(pitch, swing.frame)
      if (pattern !== null && contact !== null) {
        const particleId = hitParticleIdOf(hitParticleInputOf(pattern, result.detail.resultCode, watchesBigHit))
        if (particleId !== null) {
          emitParticles(particlesRef.current, particleConfigOf(particleId), contact.x, contact.y, HIT_PARTICLE_IMAGE)
        }
      }
      pendingHitRef.current = {
        ticks: hitPauseTicksOf(pauseInput),
        detail: result.detail,
        pitch,
        isUncatchable,
        isHomeRun,
        // 큰 타구 감상이 끝나는 자리에 016 을 쏜다 (0x4cb1c → 0x4cd14)
        bigHitAt: watchesBigHit ? contact : null,
        resultText,
      }
      phaseRef.current = '타격'
      phaseStartedAtRef.current = now
      return
    }

    resultTextRef.current = resultText
    homeRunStartedAtRef.current = isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latest.onPitchResolved(result.detail, pitch, isUncatchable)
  }, [aceBatterIndex, specialSwingNumber])

  /** 상태 0x13 을 끝내고 인플레이(0x17)로 넘긴다 — 시간이 다 됐거나 OK/'5' 로 건너뛸 때 */
  const commitHit = useCallback((now: number) => {
    const pending = pendingHitRef.current
    if (pending === null) return
    pendingHitRef.current = null
    // 상태 19 카운터가 다 되면 타격점에 016 (id 15, 프레임 10) 을 쏜다 (R2 3-4)
    if (pending.bigHitAt !== null) {
      emitParticles(
        particlesRef.current,
        particleConfigOf(BIG_HIT_PARTICLE.id),
        pending.bigHitAt.x,
        pending.bigHitAt.y,
        BIG_HIT_PARTICLE.img,
      )
    }
    resultTextRef.current = pending.resultText
    homeRunStartedAtRef.current = pending.isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latestRef.current.onPitchResolved(pending.detail, pending.pitch, pending.isUncatchable)
  }, [])

  const actions = useMemo(() => {
    const frameNow = (now: number) => ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
    // 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다
    const isFlying = (now: number) => phaseRef.current === '투구중' && pitchRef.current !== null && frameNow(now) >= 0
    return {
      swing: (now: number) => {
        // 상태 0x13 은 OK(−5)·'5' 로 건너뛴다 (0x406e8). 그때 스윙 키는 건너뛰기로만 쓰인다
        if (phaseRef.current === '타격') return commitHit(now)
        if (!isFlying(now)) return
        swingStartedAtRef.current = now
        finishPitch({ frame: frameNow(now), shift: shiftRef.current, buntKind: 0 }, now)
      },
      toggleBunt: (kind: number, now: number) => {
        if (!isFlying(now)) return
        buntRef.current = buntRef.current === null ? { kind, frame: frameNow(now) } : null
      },
      moveBatter: (direction: -1 | 1) => {
        shiftRef.current = nextBatterShift(shiftRef.current, direction)
      },
      /** '0' 은 **이번 공에** 필살타법을 건다 — 스윙은 따로 해야 한다 (0x535a4 → 0x6a6) */
      specialSwing: (now: number) => {
        if (!isFlying(now)) return
        // 0x51e14: 남은 횟수 0xaea30 이 0 이면 무시 — 번호(+0x18)가 0 이면 늘 0 이다.
        // 마선수 레코드 +0x18 은 늘 5~9 라 마타자는 이 가드에 안 걸린다 (H2 5절).
        // ⚠️ 한 경기 횟수(표 0xd84f0 · 0xd84fa, 소모 0x4e136)는 아직 안 옮겼다 — 번호만 있으면 무제한이다.
        if (specialSwingNumber === 0 && aceBatterIndex < 0) return
        specialArmedRef.current = true
      },
    }
  }, [commitHit, finishPitch, specialSwingNumber, aceBatterIndex])

  useStageAnimation(refs, finishPitch, commitHit)
  const pointerHandlers = useStageControls(refs, actions)

  return (
    <canvas
      ref={refs.canvasRef}
      className={styles.stage}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      {...pointerHandlers}
    />
  )
}
