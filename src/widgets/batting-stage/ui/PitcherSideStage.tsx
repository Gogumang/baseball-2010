import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { renderBattingStage, STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { bodyTypeOf, NO_EQUIPMENT, NO_PITCHER_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import type { PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameNow, describePitchResolution } from '@/widgets/batting-stage/lib/stageText'
import { passesHeldResult, pitcherSideStageFrameOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import * as styles from '@/widgets/batting-stage/ui/PitcherSideStage.css'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'

interface PitcherSideStageProps {
  /** 이 화면에서 마지막으로 던진 공(진행기 `lastPitch`). 화면이 설 때 이미 있던 공은 다시 날리지 않는다 */
  readonly pitch: Pitch | null
  /** 그 공의 판정 — 0x12 를 지나는지 · 판정 글자 */
  readonly resolution: PitchResolution | null
  /** 0x12 대기 틱 (0x4e6d4 — `resultWaitTicksOf`) */
  readonly resultTicks: number
  readonly hud: HudState | null
  /** 타석에 선 (CPU) 타자의 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 팀 */
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /** 마운드의 내 투수 — 폼(단계 표) · 손(좌투 뒤집기) · 장비 겹(0x79790) */
  readonly pitcherForm: number
  readonly pitcherHand: number
  readonly pitcherEquipment?: PitcherEquipment
  /** 구장 +0x70 · 바닥 줄 +0xc · 하늘 줄 +0x10 */
  readonly stadium: number
  readonly fieldPalette: number | null
  readonly skyRow: number
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
 * ⚠️ 미이식: CPU 타자의 스윙 자세(0x49e64 의 스윙 객체)는 대기 자세로만 그린다.
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
    let pausedSinceTick = 0
    let wasPaused = false
    /** 팝업 동안 멈춘 시간 — 장면 틱에서 뺀다 */
    let frozenTotal = 0
    let frozenSince: number | null = null
    let handle = 0

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
      const pitchInput = isIdle ? (current.inputOverlayRef?.current ?? null) : null
      // 0x4c92e — "#TIME" 은 상태 0xe · 0xf 만
      const isTimeState = isIdle && (current.isPaused || pitchInput?.kind === '구질')
      const isResult = stage.phase.kind === '결과'
      renderBattingStage(context, {
        pitch: stage.phase.kind === '대기' ? null : pitch,
        frame: stage.ballFrame,
        pitcherTick: stage.pitcherTick,
        tick: nowTick,
        resultTick: isResult ? stage.phase.tick : 0,
        resultText: isResult && resolution !== null ? describePitchResolution(resolution) : '',
        isHomeRun: false,
        homeRunTick: 0,
        isEagleEyeEnabled: false,
        shift: 0,
        swingFrame: batterFrameNow(sceneNow, -1, false, bodyType),
        bodyType,
        batterSkinIndex: current.batterSkinIndex,
        batterTeamIndex: current.batterTeamIndex,
        batterEquipment: NO_EQUIPMENT,
        side: batterSideOfForm(current.batterForm),
        hud: current.hud,
        acePitcher: null,
        pitcherEquipment: current.pitcherEquipment ?? NO_PITCHER_EQUIPMENT,
        pitcherForm: current.pitcherForm,
        pitcherHand: current.pitcherHand,
        stagePhase: stage.phase,
        pitchInput,
        timeKeyCount: isTimeState ? (current.timeKeyCount ?? null) : null,
        // 필살 남은 횟수 0x38a30 은 38a42 에서 0x33fe4(수비 조작 사람)면 바로 끝 — 사람이 던지는 장면엔 없다
        specialSwingRemaining: null,
        scenery: {
          skyRow: current.skyRow,
          stadium: current.stadium,
          fieldPalette: current.fieldPalette,
          gameMode: current.gameMode,
          isScoreboardOn: current.isScoreboardOn,
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
