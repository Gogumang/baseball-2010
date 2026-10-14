import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { renderBattingStage, STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { bodyTypeOf, NO_EQUIPMENT, NO_PITCHER_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import type { PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { describePitchResolution } from '@/widgets/batting-stage/lib/stageText'
import { batterFrameAt } from '@/widgets/batting-stage/lib/batterLayers'
import { cpuSwingTickOf, passesHeldResult, pitcherSideStageFrameOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, PitcherSideSkillPanelSource } from '@/widgets/batting-stage/model/stageRefs'
import { createSkillPanelDriver } from '@/widgets/batting-stage/model/skillPanelDriver'
import { skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import * as styles from '@/widgets/batting-stage/ui/PitcherSideStage.css'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'

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

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const tickLength = millisecondsPerFrame()
    const openedAt = performance.now()
    /** 화면이 설 때 있던 공 — 수비 화면에서 돌아와 다시 서도 같은 공을 또 날리지 않는다 */
    let shownPitch: Pitch | null = latestRef.current.pitch
    let releaseTick: number | null = null
    /** 지금 공의 CPU 스윙 — 화면이 설 때 있던 공은 다시 날리지 않으므로 그 스윙도 없다 */
    let shownSwing: CpuSwingPose | null = null
    /** 지금 공이 실투인가 — 화면이 설 때 있던 공은 다시 날리지 않으므로 "!" 도 없다 */
    let shownMistake = false
    let pausedSinceTick = 0
    let wasPaused = false
    /** 팝업 동안 멈춘 시간 — 장면 틱에서 뺀다 */
    let frozenTotal = 0
    let frozenSince: number | null = null
    let handle = 0
    /** 경기 스킬 표시 판 — 0xf 에 들 때마다 하나씩 올리는 표지(구질 목록이 새로 실리면 새 0xf 진입) */
    const stepSkillPanel = createSkillPanelDriver()
    let skillPanelStateFSerial = 0
    let wasSkillPanelStateF = false

    const frame = (now: number) => {
      const current = latestRef.current
      if (current.isFrozen === true) {
        if (frozenSince === null) frozenSince = now
      } else if (frozenSince !== null) {
        frozenTotal += now - frozenSince
        frozenSince = null
      }
      const sceneNow = (frozenSince ?? now) - frozenTotal
      const nowTick = pitchTickAt(sceneNow, openedAt, tickLength)
      if (current.pitch !== shownPitch) {
        shownPitch = current.pitch
        releaseTick = current.pitch === null ? null : nowTick
        shownSwing = current.cpuSwing ?? null
        shownMistake = current.pitch !== null && current.isMistakePitch === true
      }
      if (current.isPaused && !wasPaused) pausedSinceTick = nowTick
      wasPaused = current.isPaused

      const pitch = releaseTick === null ? null : shownPitch
      const resolution = current.resolution
      const stage = pitcherSideStageFrameOf({
        nowTick,
        releaseTick,
        frameCount: pitch?.frameCount ?? 0,
        resultTicks: resolution !== null && passesHeldResult(resolution) ? current.resultTicks : 0,
        isPaused: current.isPaused,
        pausedSinceTick,
      })
      const bodyType = bodyTypeOf(current.batterForm)
      const isIdle = stage.phase.kind === '대기'
      // 스윙은 이 공이 날거나 0x12 인 동안만 — 대기로 돌아오면 대기 자세
      const swingTick =
        releaseTick === null || shownSwing === null || isIdle ? null : cpuSwingTickOf(releaseTick, shownSwing.frame)
      const pitchInput = isIdle ? (current.inputOverlayRef?.current ?? null) : null
      // 0x4c92e — "#TIME" 은 상태 0xe · 0xf 만
      const isTimeState = isIdle && (current.isPaused || pitchInput?.kind === '구질')
      const isResult = stage.phase.kind === '결과'
      const side = current.batterSide ?? batterSideOfForm(current.batterForm)
      // 0x4b5b4 — 상태 0xf(구질 목록) · 0x10(조준) · 0x11(게이지 · 공이 나는 동안)만 그린다(4b5ca)
      const inputKind = isIdle && !current.isPaused ? (current.inputOverlayRef?.current?.kind ?? null) : null
      const isSkillPanelStateF = inputKind === '구질'
      if (isSkillPanelStateF && !wasSkillPanelStateF) skillPanelStateFSerial += 1
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
      renderBattingStage(context, {
        pitch: stage.phase.kind === '대기' ? null : pitch,
        frame: stage.ballFrame,
        pitcherTick: stage.pitcherTick,
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
        batterEquipment: NO_EQUIPMENT,
        side,
        hud: current.hud,
        pitcherStaminaPercent: current.pitcherStaminaPercent ?? null,
        // 실투 "!" — 놓은 틱(0x11 틱 10)의 그림이 첫 그림(1)이다. ⚠️ 근사: 그림마다가 아니라 장면 틱으로 센다(타자편과 같다)
        pitcherMistakeMarkDraw:
          shownMistake && releaseTick !== null && stage.phase.kind === '투구중' ? nowTick - releaseTick + 1 : null,
        ...(current.runnerAces === undefined ? {} : { runnerAces: current.runnerAces }),
        acePitcher: current.acePitcher ?? null,
        pitcherEquipment: current.pitcherEquipment ?? NO_PITCHER_EQUIPMENT,
        pitcherForm: current.pitcherForm,
        pitcherHand: current.pitcherHand,
        stagePhase: stage.phase,
        pitchInput,
        timeKeyCount: isTimeState ? (current.timeKeyCount ?? null) : null,
        // 필살 남은 횟수 0x38a30 은 38a42 에서 0x33fe4(수비 조작 사람)면 바로 끝 — 사람이 던지는 장면엔 없다
        specialSwingRemaining: null,
        // 0x4cad4 → 0x4b5b4 — 경기 스킬 표시 판
        skillPanel: skillPanelView,
        scenery: {
          skyRow: current.skyRow,
          stadium: current.stadium,
          fieldPalette: current.fieldPalette,
          gameMode: current.gameMode,
          isScoreboardOn: current.isScoreboardOn,
          ...(current.seasonStadium === undefined ? {} : { seasonStadium: current.seasonStadium }),
        },
      })
      handle = requestAnimationFrame(frame)
    }
    handle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(handle)
  }, [])

  return (
    <div className={styles.frame}>
      <canvas ref={canvasRef} className={styles.canvas} width={STAGE_WIDTH} height={STAGE_HEIGHT} />
      {props.children}
    </div>
  )
}
