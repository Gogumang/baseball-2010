import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { renderBattingStage, STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { bodyTypeOf, NO_EQUIPMENT, NO_PITCHER_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { describePitchResolution } from '@/widgets/batting-stage/lib/stageText'
import { batterFrameAt } from '@/widgets/batting-stage/lib/batterLayers'
import {
  cpuSwingTickOf, hitEndTickOf, HUMAN_PITCH_RELEASE_STATE_TICK, passesHeldResult, pitcherSideStageFrameOf, pitcherSideStateEntriesOf,
} from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherHitClock, PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { HIT_STOP_TICKS, canSkipHitPause } from '@/widgets/batting-stage/lib/hitPause'
import { BIG_HIT_PARTICLE, HIT_PARTICLE_IMAGE } from '@/widgets/batting-stage/lib/hitParticles'
import { ballPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { createSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { KEY_OK, originalKeyCodeOf } from '@/features/play-pitcher-game/model/pitchAim'
import { SCENE_STATE, markSceneStateEntries, sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { AcePitcherFrames, PitcherSideSkillPanelSource } from '@/widgets/batting-stage/model/stageRefs'
import { createSkillPanelDriver } from '@/widgets/batting-stage/model/skillPanelDriver'
import {
  createCloudFrameCursor, observeSceneCloudFrame, sceneCloudFrameOf, sceneScoreboardTickOf,
} from '@/widgets/batting-stage/model/sceneCloudClock'
import { skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import * as styles from '@/widgets/batting-stage/ui/PitcherSideStage.css'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { gameSceneTickOf, gameSceneTimeOf, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { stageCastSpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'

interface PitcherSideStageProps {
  /** 이 화면에서 마지막으로 던진 공(진행기 `lastPitch`). 화면이 설 때 이미 있던 공은 다시 날리지 않는다 */
  readonly pitch: Pitch | null
  /** 그 공의 판정 — 0x12 를 지나는지 · 판정 글자 */
  readonly resolution: PitchResolution | null
  /**
   * 그 공에 CPU 타자가 휘둘렀으면 스윙 프레임 F(+0xfd8) · 번트 종류(+0xfdc). 0x11 갱신 0x4e0dc 가 공 틱 ≥ F 인 틱에
   * 스윙 객체 vtable +0x14(스윙) · +0x18(번트)을 건다 — 타자 그림 0x49e64 가 그 자세를 그린다
   */
  readonly cpuSwing?: CpuSwingPose | null
  /** 0x12 대기 틱 (0x4e6d4 — `resultWaitTicksOf`) */
  readonly resultTicks: number
  readonly hud: HudState | null
  /**
   * 마운드 투수 체력 % — 34 이하면 투수 자리에 체력 그림(player_effect 애니 9 · 10, 0x38d1c)을 그린다. 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /**
   * `pitch` 가 실투였나 — 놓기 0x4dc78 의 4deae 가 투구 객체 +8 = 4 를 적어 투수 그리기 0x38d1c 38ee0 이 놓은 그림부터 네 번
   * 머리 위 "!"(player_effect 애니 13)를 그린다 (`pitcherFatigue` 의 실투 "!"). 안 넘기면 안 그린다
   */
  readonly isMistakePitch?: boolean
  /**
   * 타자 · 루 주자의 마선수 번호(0~4, 주자 +0x9c) — 루상 마선수 주자를 실린 ace/defender 그림으로 그린다(0x35c62 · 0x79da9,
   * `renderBattingStage` 의 같은 이름). 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /** 타석에 선 (CPU) 타자의 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 팀 */
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /**
   * 타자 손 0xb63c0 (화면 배치 +0x17e1) — 안 주면 폼의 낮은 비트. 마타자는 폼이 아니라 표 0xd88b0 이라 부르는 쪽이 준다
   */
  readonly batterSide?: number
  /**
   * 마타자 순번 `0xb63a0(타자)` (0~4) — 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에 넘겨 `ace/batter_*` 한 장을 싣고, 스윙 객체
   * +0x24(0x35686)로 자세표 0xb905c 의 마타자 갈래를 고른다. 없으면 일반 타자
   */
  readonly aceBatterOrder?: number
  /**
   * 타자 장비 겹 — 타석 교대 0x47cc8 이 타자 그림(장면 +0xf18)을 0x768b4 로 비운 뒤, 마타자(0xb63a0 ≥ 0)가 아니면 47e80~47eb6 에서
   * 지금 타자 레코드(0xae89c(공격 팀)) +0x19 · +0x1a 의 니블 네 칸 − 1 을 장비 적재 0x78fd8 로 싣는다 — 모드를 가리지 않는다(직접 떴다).
   * 안 주면 맨몸
   */
  readonly batterEquipment?: BatterEquipment
  /** 마운드의 내 투수 — 폼(단계 표) · 손(좌투 뒤집기) · 장비 겹(0x79790) */
  readonly pitcherForm: number
  readonly pitcherHand: number
  readonly pitcherEquipment?: PitcherEquipment
  /**
   * 마운드의 마투수 그림 — 타석 교대 0x482fc 의 적재 0x793b0 이 순번 0xb63a0 으로 `ace/pitcher_*` 를 싣는다. 없으면 평범한 투수
   */
  readonly acePitcher?: AcePitcherFrames | null
  /** 구장 +0x70 · 바닥 줄 +0xc · 하늘 줄 +0x10 */
  readonly stadium: number
  readonly fieldPalette: number | null
  readonly skyRow: number
  /** 시즌 홈경기 구장 (0x77494) — 있으면 배경이 시즌 구장으로 갈린다 */
  readonly seasonStadium?: SeasonStadium
  readonly gameMode: number
  readonly isScoreboardOn?: boolean
  /** 0xd · 0xe 대기(확인 · 소개 판) — 쉬는 '대기' */
  readonly isPaused: boolean
  /** 일시정지 팝업(0x741a0) — 장면 틱이 멈춘다(0x52cc6). 그림은 그 자리에 둔다 */
  readonly isFrozen?: boolean
  /**
   * 사람 투구 UI 의 그림 재료 — 구질 · 조준 · 게이지 단추가 싣는다(`pitchInputOverlay`). 그림마다 읽어 장면 안에 그린다
   * (원본 0x4c4bc · 0x4d780 · 0x4d2ac). 공이 날거나 0x12 인 동안은 안 그린다
   */
  readonly inputOverlayRef?: { readonly current: PitchInputOverlay | null }
  /**
   * "#TIME" 의 벤치 수 n — 사람 수비면 수비팀[+0x33](벤치 투수, 0x4c940). '#' 교체 검사 0x38984 가 거짓인 화면(미션)은 null.
   * 상태 0xe(쉬는 대기) · 0xf(구질 목록이 실린 동안)에만 그린다
   */
  readonly timeKeyCount?: number | null
  /**
   * **경기 스킬 표시 판** (장면 +0x19b0, 0xd 진입 48fa4 · 0xf 진입 3dd78 · 그리기 0x4b5b4) — CPU 타자 · 사람 투수가 장착한 스킬 중
   * 지금 걸리는 이름을 20 그림 동안 보이고, 그 CPU 타자가 전국구 · 먹튀면 함성 29 를 낸다. 공용 HUD 0x4c4bc 꼬리라 누가 던지든 같다.
   * 0xf = 구질 목록이 실린 대기 · 0x10 = 조준 · 0x11 = 게이지 또는 공이 나는 동안. 안 넘기면 안 그린다
   */
  readonly skillPanel?: PitcherSideSkillPanelSource
  /**
   * 0xd 진입(0x48d50)마다 바뀌는 표지(`useSceneConfirm` 의 `sceneDEntryMark`) — 48ee4 0x35650 → 0x340c0 이 투수 그림 객체를 상태 0 으로
   * 되돌린다. 0xf → 0xb('#' 교체 창) → '#' · CLR → 곧장 0xe(0x4984a) 길은 0xd 가 없어 안 바뀐다 — 그동안(0xb · 0xe) 투수 갱신
   * 0x9e004 가 안 불려(0xf 0x39c1c · 0x11 0x4e060 만 부른다) 대기 동작이 굳은 채 남고, OK 뒤 0xf 진입 0x3d954 가 되돌린다.
   * 교체를 확정한 길(0xb → 0x16 → 0xd)은 0x16 동안 굳어 있다가 0xd 에서 되돌린다. 안 넘기면 0xf 진입만 본다
   */
  readonly sceneDEntryMark?: number
  /**
   * `pitch` 를 CPU 타자가 맞혔으면 그 0x11 끝 · 0x13 재료(`pitcherHitSceneOf`) — 이 장면이 판정 틀까지 0x11 을, 이어 0x13 을 그리고
   * 0x17 이 서는 틀에 `onHitSceneEnd` 를 부른다(부르는 화면이 그때 수비 판을 띄운다). 안 넘기면 맞은 공은 공 틱 N + 1 에서 대기다
   */
  readonly hitScene?: PitcherHitScene | null
  /** 0x13 이 끝나 0x17 이 선 틀 — 이 장면이 그 공을 날리지 않았으면(화면이 설 때 이미 있던 공) 첫 그림에 부른다 */
  readonly onHitSceneEnd?: () => void
  /** 장면 위에 얹는 UI (소개 판 · 교체 연출 · 조준 그림 따위) — 원본도 상태 그리기가 장면 다음에 그린다 */
  readonly children?: ReactNode
}

/**
 * **사람이 던지는 타석의 캔버스 장면** — 타자편 `BattingStage` 와 같은 그리기(`renderBattingStage`)로 구장 · 하늘 · 관중 ·
 * 투수 · 타자 · 주자 · HUD · 존 · 소프트키를 그린다 (`lib/pitcherSideStage` 머리말: 0x52c50 의 그리기 표는 모드를 안 가린다).
 * 공 판정 · 스윙 키는 받지 않는다 — 진행기가 이미 정한 공을 그림으로만 다시 날린다(굴림 없음).
 *
 * 구질 목록 · 조준 · 게이지는 `inputOverlayRef` 로 받아 장면 안에 그린다 · "#TIME" 은 `timeKeyCount` ·
 * 필살 남은 횟수(0x38a30)는 사람 수비면 원본도 안 그린다(38a42).
 * CPU 타자는 `cpuSwing` 의 스윙 프레임에 닿은 틱부터 스윙(번트면 번트) 자세다.
 */
export function PitcherSideStage(props: PitcherSideStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestRef = useRef(props)
  latestRef.current = props

  // 지금 타자의 장비 겹 그림(타석 교대 0x47cc8 47e80 → 0x78fd8) — 경기 진입 때 받은 목록이 놓친 타자(대타 · 굴린 장비)를 잡는다.
  // 아무도 안 기다린다 (타자편 `useStageCastPreload` 와 같다)
  const { batterForm, batterEquipment, aceBatterOrder } = props
  const head = batterEquipment?.head
  const hand = batterEquipment?.hand
  const leg = batterEquipment?.leg
  useEffect(() => {
    if (aceBatterOrder !== undefined || head === undefined || hand === undefined || leg === undefined) return
    preloadSprites(
      stageCastSpritePreloadsOf({ bodyTypes: [], equippedBatters: [{ bodyType: bodyTypeOf(batterForm), equipment: { head, hand, leg } }] }),
      'scene',
    )
  }, [batterForm, aceBatterOrder, head, hand, leg])

  useEffect(() => {
    const context = effectContextOf(canvasRef.current)
    if (!context) return
    // 장면의 때는 경기 장면 틱 하나로 센다(`gameSceneTickOf`) — 공용 창이 떠 있는 동안 서고 닫히면 이어 흐른다.
    // 공을 놓은 틱 · 쉬기 시작한 틱 · 대기 동작 틱이 모두 이 격자 위에 선다
    /** 화면이 설 때 있던 공 — 수비 화면에서 돌아와 다시 서도 같은 공을 또 날리지 않는다 */
    let shownPitch: Pitch | null = latestRef.current.pitch
    let releaseTick: number | null = null
    /** 지금 공의 CPU 스윙 — 화면이 설 때 있던 공은 다시 날리지 않으므로 그 스윙도 없다 */
    let shownSwing: CpuSwingPose | null = null
    /** 지금 공이 실투인가 — 화면이 설 때 있던 공은 다시 날리지 않으므로 "!" 도 없다 */
    let shownMistake = false
    let pausedSinceTick = 0
    let wasPaused = false
    /** 상태 경계를 마지막으로 적은 공(놓은 장면 틱 · 0x12 문턱) */
    let markedStateEntries = ''
    /** 빈 구질 칸 키(0x50de8 → 투수 그림 상태 2)를 본 표지와 그 장면 틱 — 새 공(상태 1)이 들면 지운다 */
    let seenIdlePress = 0
    let idleStartTick: number | null = null
    /** 대기 동작의 마지막 갱신 틱 — 0xf 를 떠나면(0x10 조준 따위) 0x39c1c 가 안 불려 그 단계에 굳는다. 아직 0xf 면 null */
    let idleEndTick: number | null = null
    /** 팝업(`isFrozen`) 동안 멈춘 틱 수 — 장면 틱에서 뺀다 */
    let frozenTicks = 0
    let frozenSinceTick: number | null = null
    let handle = 0
    /** 그림 입력이 바뀐 틀에서만 다시 그린다(`createDrawMemo`) — 위 갱신은 틀마다 그대로 돈다 */
    const drawMemo = createDrawMemo()
    /** 구름 셈(`sceneCloudClock`)에서 이 루프가 마지막으로 본 그림 */
    const cloudCursor = createCloudFrameCursor()
    /** 경기 스킬 표시 판 — 0xf 에 들 때마다 하나씩 올리는 표지(구질 목록이 새로 실리면 새 0xf 진입) */
    const stepSkillPanel = createSkillPanelDriver()
    let skillPanelStateFSerial = 0
    let wasSkillPanelStateF = false
    /** 마지막으로 본 0xd 진입 표지 */
    let seenSceneDEntryMark = latestRef.current.sceneDEntryMark
    /** 0x13 재료 — 지금 공의 맞은 장면(공이 바뀌면 그때 받은 값) · 불꽃 · 016 · 끝 알림을 공마다 한 번 */
    let shownHit: PitcherHitScene | null = null
    let hitSparkShot = false
    let hitStopShot = false
    let hitEndNotified = false
    /** OK · '5' 를 읽은 0x13 상태 틱 (0x406e8 40708) */
    let hitSkipTick: number | null = null
    /** 0x13 동안 받은 OK · '5' — 다음 틀 머리의 키 처리(0x498d4)가 꺼낸다(`sceneKeyLatch`) */
    const hitKeyLatch = createSceneKeyLatch()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || shownHit === null || hitEndNotified || !canSkipHitPause(shownHit.watchesBigHit)) return
      const code = originalKeyCodeOf(event.key)
      // 0x406e8 40708~40712 — [장면+0x40](이 틀 키)가 OK(−5) · '5'(0x35) 면 넘긴다. 공격 측을 안 본다
      if (code !== KEY_OK && code !== 0x35) return
      event.preventDefault()
      hitKeyLatch.push(() => {
        // 키 처리는 진입 뒤 · 갱신 앞 — 이 틀의 0x13 갱신이 읽는다. 0x13 을 예약한 틀(J)에 누른 키도 다음 틀(틱 0)이 읽는다
        if (hitSkipTick === null && keyHitTick !== null) hitSkipTick = keyHitTick
      })
    }
    /** 키를 꺼내는 틀의 0x13 상태 틱 — 0x13 이 아니면 null */
    let keyHitTick: number | null = null
    window.addEventListener('keydown', onKeyDown)

    const frame = (rawNow: number) => {
      // 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신을, 52efe 가 상태 그리기를 건너뛴다(창이 선 첫 그림
      // [창+0x250] 의 다시 그리기는 갱신이 없어 앞 그림과 같다) — 캔버스를 그대로 두고 시계도 세운다
      if (isGameSceneFrozen()) {
        handle = requestAnimationFrame(frame)
        return
      }
      const sceneTick = gameSceneTickOf(gameSceneTimeOf(rawNow))
      const current = latestRef.current
      if (current.isFrozen === true) {
        if (frozenSinceTick === null) frozenSinceTick = sceneTick
      } else if (frozenSinceTick !== null) {
        frozenTicks += sceneTick - frozenSinceTick
        frozenSinceTick = null
      }
      const nowTick = (frozenSinceTick ?? sceneTick) - frozenTicks
      if (current.pitch !== shownPitch) {
        shownPitch = current.pitch
        releaseTick = current.pitch === null ? null : nowTick
        shownSwing = current.cpuSwing ?? null
        shownMistake = current.pitch !== null && current.isMistakePitch === true
        // 0x11 진입 3de7c — 상태 1 이 대기 동작을 덮는다
        idleStartTick = null
        shownHit = current.pitch === null ? null : (current.hitScene ?? null)
        hitSparkShot = false
        hitStopShot = false
        hitEndNotified = false
        hitSkipTick = null
        hitKeyLatch.clear()
      }
      // 맞은 장면 재료가 공보다 한 그림 늦게 들면 그때 받는다
      if (releaseTick !== null && shownHit === null && current.hitScene != null) shownHit = current.hitScene
      if (releaseTick === null && current.hitScene != null && !hitEndNotified) {
        // 이 장면이 날리지 않은 공(화면이 설 때 이미 있던 공)의 0x13 — 다시 그리지 않고 곧장 넘긴다
        hitEndNotified = true
        current.onHitSceneEnd?.()
      }
      // 0xd 진입 0x48d50 48ee4 → 0x35650 → 0x340c0 — 투수 그림 객체를 상태 0 으로 (굳은 대기 동작도 지운다)
      if (current.sceneDEntryMark !== seenSceneDEntryMark) {
        seenSceneDEntryMark = current.sceneDEntryMark
        idleStartTick = null
        idleEndTick = null
      }
      if (current.isPaused && !wasPaused) pausedSinceTick = nowTick
      wasPaused = current.isPaused

      const pitch = releaseTick === null ? null : shownPitch
      const resolution = current.resolution
      const aceOrder = current.acePitcher?.order ?? null
      // 52d9e 키 0x498d4 — 앞 틀 뒤에 받은 OK · '5' 를 이 틀의 0x13 갱신 앞에서 꺼낸다
      const hitBase = pitch === null ? null : shownHit
      const hitTickNow =
        hitBase === null || releaseTick === null
          ? null
          : pitcherSideStageFrameOf({
              nowTick, releaseTick, frameCount: pitch?.frameCount ?? 0, resultTicks: 0, isPaused: false, pausedSinceTick: 0, aceOrder,
              hit: hitBase,
            }).phase
      keyHitTick = hitTickNow?.kind === '타격' ? hitTickNow.tick : null
      // 팝업(0x52cc6)이 선 틀의 키는 버린다
      if (current.isFrozen === true) hitKeyLatch.clear()
      else runSceneKeys(hitKeyLatch, sceneTick)
      const hit: PitcherHitClock | null = hitBase === null ? null : { ...hitBase, skipTick: hitSkipTick }
      const stage = pitcherSideStageFrameOf({
        nowTick,
        releaseTick,
        frameCount: pitch?.frameCount ?? 0,
        resultTicks: resolution !== null && passesHeldResult(resolution) ? current.resultTicks : 0,
        isPaused: current.isPaused,
        pausedSinceTick,
        aceOrder,
        hit,
      })
      if (hit !== null && hitBase !== null && pitch !== null && releaseTick !== null) {
        const stateTickNow = nowTick - releaseTick + HUMAN_PITCH_RELEASE_STATE_TICK
        /** 판정 틀 J 의 0x11 상태 틱 — 그 틀의 갱신이 0x6aa 로 0x13 을 예약한다 */
        const judgeStateTick = pitcherReleaseTicksOf(aceOrder) + hitBase.judgeBallTick
        // 판정 틀 J 의 그리기 0x49e64 가 타격점에 불꽃을 쏜다 (타자편 `BattingStage` 와 같은 근사 — 판정 순간에 쏜다)
        if (stateTickNow >= judgeStateTick && !hitSparkShot) {
          hitSparkShot = true
          if (hitBase.particleId !== null) {
            const contact = ballPixelAt(pitch, hitBase.contactFrame)
            emitParticles(sceneParticleScene(), particleConfigOf(hitBase.particleId), contact.x, contact.y, HIT_PARTICLE_IMAGE)
          }
        }
        const hitTickRaw = stateTickNow - judgeStateTick - 1
        const endTick = hitEndTickOf(hit)
        // 0x4cb1c 4ccba~4cd14 — 큰 타구 멈춤이 풀리는 0x13 그림(틱 7)이 공 자리에 016 을 쏜다. 그 전에 0x13 이 끝나면 안 쏜다
        if (hitBase.watchesBigHit && !hitStopShot && hitTickRaw >= HIT_STOP_TICKS && endTick >= HIT_STOP_TICKS) {
          hitStopShot = true
          const contact = ballPixelAt(pitch, hitBase.contactFrame)
          emitParticles(sceneParticleScene(), particleConfigOf(BIG_HIT_PARTICLE.id), contact.x, contact.y, BIG_HIT_PARTICLE.img)
        }
        // 0x13 틱 endTick 의 갱신 0x406e8 이 0x17 을 예약 — 다음 틀(0x17 틱 0)에 부르는 화면이 수비 판으로 넘긴다
        if (hitTickRaw > endTick && !hitEndNotified) {
          hitEndNotified = true
          current.onHitSceneEnd?.()
        }
      }
      // 이 공의 원본 상태 경계(0x11 · 0x12 · 그 끝, 맞은 공은 0x11 · 0x13 · 0x17) — 장면 틱(팝업으로 뺀 틱을 되돌린 값)으로 적는다
      // (`sceneStateEntries`)
      if (releaseTick !== null && pitch !== null && stage.phase.kind !== '대기') {
        const resultTicks = resolution !== null && passesHeldResult(resolution) ? current.resultTicks : 0
        // 판정 · 0x12 문턱은 공보다 한 그림 늦게 들 수 있다 · 0x13 은 건너뛰기 키로 짧아진다 — 바뀔 때만 다시 적는다
        const marked = `${releaseTick + (sceneTick - nowTick)}-${resultTicks}-${hit === null ? '' : hitEndTickOf(hit)}`
        if (marked !== markedStateEntries) {
          markedStateEntries = marked
          markSceneStateEntries(
            ...pitcherSideStateEntriesOf(releaseTick + (sceneTick - nowTick), pitch.frameCount, resultTicks, aceOrder, hit),
          )
        }
      }
      const bodyType = bodyTypeOf(current.batterForm)
      const isIdle = stage.phase.kind === '대기'
      // 스윙은 이 공이 날거나 0x12 인 동안만 — 대기로 돌아오면 대기 자세
      const swingTick =
        releaseTick === null || shownSwing === null || isIdle
          ? null
          : cpuSwingTickOf(releaseTick, shownSwing.frame, current.acePitcher?.order ?? null)
      const pitchInput = isIdle ? (current.inputOverlayRef?.current ?? null) : null
      // 0x4b5b4 — 상태 0xf(구질 목록) · 0x10(조준) · 0x11(게이지 · 공이 나는 동안)만 그린다(4b5ca)
      const inputKind = isIdle && !current.isPaused ? (current.inputOverlayRef?.current?.kind ?? null) : null
      const isSkillPanelStateF = inputKind === '구질'
      const entersStateF = isSkillPanelStateF && !wasSkillPanelStateF
      // 0xf 진입 0x3d954 → 0x35650 → 0x340c0 — 투수 그림 객체를 상태 0 으로 (진입 표가 키보다 먼저 돈다)
      if (entersStateF) {
        idleStartTick = null
        idleEndTick = null
      }
      // 0x50de8 — 구질 목록(0xf)의 빈 칸 키. 누를 때마다 처음부터 한 바퀴(9dff8 이 단계 · 틱을 0 으로)
      const idlePress = pitchInput?.kind === '구질' ? (pitchInput.pitcherIdlePress ?? 0) : 0
      if (idlePress !== 0 && idlePress !== seenIdlePress) {
        seenIdlePress = idlePress
        idleStartTick = nowTick
        idleEndTick = null
      }
      // 0x9e004 는 0xf 갱신 0x39c1c 에서만 대기 동작을 센다 — 0xf 를 떠난 그림의 앞 틱에서 굳는다
      if (idleStartTick !== null && idleEndTick === null && !isSkillPanelStateF) idleEndTick = Math.max(idleStartTick, nowTick - 1)
      // 0x4c92e — "#TIME" 은 상태 0xe · 0xf 만
      // 쉬는 대기의 앞 두 그림은 0xd(타석 준비) — 확인 대기가 적은 상태 경계로 가른다(`sceneStateEntries`)
      const isSceneD = isIdle && current.isPaused && sceneStateEntryAt(sceneTick)?.state === SCENE_STATE.준비
      const isTimeState = isIdle && ((current.isPaused && !isSceneD) || pitchInput?.kind === '구질')
      const isResult = stage.phase.kind === '결과'
      const side = current.batterSide ?? batterSideOfForm(current.batterForm)
      if (entersStateF) skillPanelStateFSerial += 1
      wasSkillPanelStateF = isSkillPanelStateF
      const skillPanel = current.skillPanel
      const skillPanelView: SkillPanelView | null =
        skillPanel === undefined
          ? null
          : stepSkillPanel({
              source: { ...skillPanel, isDefenseCpu: skillPanel.isDefenseCpu ?? false },
              isStateF: isSkillPanelStateF,
              stateFMark: skillPanelStateFSerial,
              isDrawnState: isSkillPanelStateF || inputKind === '조준' || inputKind === '게이지' || stage.phase.kind === '투구중',
              nowTick,
              batterSkillBits: skillBitsOfIds(skillPanel.batterSkillIds, false),
              pitcherSkillBits: skillBitsOfIds(skillPanel.pitcherSkillIds, true),
              strikes: current.hud?.strikes ?? 0,
              batterRecordSlot: skillPanel.batterRecordSlot,
              batterHand: side,
              // 0xd 진입 상황 — 사람이 던지는 타석이라 공격 측(CPU)이 hud 의 상대 점수다. 주자 0xa9888 은 1~3 루(타자는 0x17 진입에
              // 목록에 든다 — 0x46418 4650e)
              situation: () => {
                const bases = current.hud?.bases ?? { first: false, second: false, third: false }
                return {
                  gameMode: current.gameMode,
                  inning: current.hud?.inning ?? 1,
                  attackScore: current.hud?.opponentScore ?? 0,
                  defenseScore: current.hud?.ourScore ?? 0,
                  runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
                  hasSecondBaseRunner: bases.second,
                  pitcherHand: current.pitcherHand,
                  batterHand: side,
                  batterRecordSlot: skillPanel.batterRecordSlot,
                  recentAtBatCodes: skillPanel.recentAtBatCodes,
                }
              },
            })
      const stageScene: StageScene = {
        pitch: stage.phase.kind === '대기' ? null : pitch,
        frame: stage.ballFrame,
        pitcherTick: stage.pitcherTick,
        pitcherTickEnd: stage.pitcherTickEnd,
        pitcherIdleTick: idleStartTick === null ? null : nowTick - idleStartTick,
        pitcherIdleTickEnd: idleStartTick === null || idleEndTick === null ? null : idleEndTick - idleStartTick,
        tick: nowTick,
        resultTick: isResult ? stage.phase.tick : 0,
        resultText: isResult && resolution !== null ? describePitchResolution(resolution) : '',
        // CPU 홈런도 판정 v = 8 · 12 → 0x51cd8 이 +0x1960 을 켜 HOMERUN 글자(0x40b18)가 나간다 — 판정 글자는 없다 (타자편 `BattingStage` 와 같은 길).
        // ⚠️ 맞은 공은 0x12 를 안 지나(`passesHeldResult`) 이 장면에서는 '결과' 가 서지 않는다 — 원본도 0x13 → 0x17(수비 판)이라
        //    글자는 수비 판 그리기 0x46c88 이 띄운다(`pages/defense` 의 `DefenseHomeRunText`). 여기서는 같은 판정이 '결과' 로 들어올 때만 탄다
        isHomeRun: isResult && resolution !== null && resolution.kind === '타구' && resolution.outcome.kind === '홈런',
        homeRunTick: isResult ? stage.phase.tick : 0,
        isEagleEyeEnabled: false,
        shift: 0,
        swingFrame: batterFrameAt({
          tick: nowTick,
          swingTick: swingTick,
          isBunting: swingTick !== null && shownSwing !== null && shownSwing.buntKind !== 0 && nowTick >= swingTick && !isIdle,
          bodyType,
          ...(current.aceBatterOrder === undefined ? {} : { aceOrder: current.aceBatterOrder }),
        }),
        bodyType,
        ...(current.aceBatterOrder === undefined ? {} : { aceBatterOrder: current.aceBatterOrder }),
        batterSkinIndex: current.batterSkinIndex,
        batterTeamIndex: current.batterTeamIndex,
        batterEquipment: current.batterEquipment ?? NO_EQUIPMENT,
        side,
        hud: current.hud,
        pitcherStaminaPercent: current.pitcherStaminaPercent ?? null,
        // 실투 "!" — 놓은 틱(0x11 틱 10)의 그림이 첫 그림(1)이다. 그림 한 번 = 장면 틱 하나로 센다(타자편과 같다 — `pitcherFatigue`)
        pitcherMistakeMarkDraw:
          shownMistake && releaseTick !== null && stage.phase.kind === '투구중' ? nowTick - releaseTick + 1 : null,
        ...(current.runnerAces === undefined ? {} : { runnerAces: current.runnerAces }),
        acePitcher: current.acePitcher ?? null,
        pitcherEquipment: current.pitcherEquipment ?? NO_PITCHER_EQUIPMENT,
        pitcherForm: current.pitcherForm,
        pitcherHand: current.pitcherHand,
        stagePhase: isSceneD ? { ...stage.phase, isSceneD } : stage.phase,
        pitchInput,
        timeKeyCount: isTimeState ? (current.timeKeyCount ?? null) : null,
        // 필살 남은 횟수 0x38a30 은 38a42 에서 0x33fe4(수비 조작 사람)면 바로 끝 — 사람이 던지는 장면엔 없다
        specialSwingRemaining: null,
        // 0x4cad4 → 0x4b5b4 — 경기 스킬 표시 판
        skillPanel: skillPanelView,
        scenery: {
          // 구름 0x78448 — 0x3f060 은 '대기'(0xd~0x10)에서만 센다. 팝업으로 장면이 선 동안(`isFrozen`)은 안 센다
          cloudCalls: observeSceneCloudFrame(sceneCloudFrameOf(rawNow), isIdle && current.isFrozen !== true, cloudCursor),
          // 전광판 글자 [구장+0x8c] — 이 장면에서 배경을 처음 그린 틱이 0 (`sceneScoreboardTickOf`)
          scoreboardTick: sceneScoreboardTickOf(sceneTick),
          skyRow: current.skyRow,
          stadium: current.stadium,
          fieldPalette: current.fieldPalette,
          gameMode: current.gameMode,
          isScoreboardOn: current.isScoreboardOn,
          ...(current.seasonStadium === undefined ? {} : { seasonStadium: current.seasonStadium }),
        },
      }
      if (drawMemo.needsDraw(canvasRef.current, stageScene)) renderBattingStage(context, stageScene)
      handle = requestAnimationFrame(frame)
    }
    handle = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div className={styles.frame}>
      <canvas ref={canvasRef} className={styles.canvas} width={STAGE_WIDTH} height={STAGE_HEIGHT} />
      {props.children}
    </div>
  )
}
