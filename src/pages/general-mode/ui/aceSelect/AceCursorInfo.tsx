import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'
import { ACE_LAYOUT, LOCKED_CIRCLES, NAME_BAR, TAG } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PHASE, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'
import { acePlayerOfCell } from '@/pages/general-mode/lib/aceSelectCells'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { IMG_TEXT_FRAME, LOCK_LABEL, SLT_IMAGE, abilityValuesOf, imageSrc } from './aceSelectRules'
import { ABILITY_RADAR_LABELS, AbilityRadarPanel } from './otherSlices'

/**
 * 커서 칸 마선수의 정보 — B 딱지(ABILITY) · ABILITY 판 · A 얼굴(잠겼으면 원 두 개) · 이름 막대 · 줄 딱지(PITCHER / BATTER).
 *
 * ⚠️ **A 딱지는 그리지 않는다 — 원본도 마선수 고르기(k 2·11)에서는 안 그린다.**
 * 공용 목록 0x63b15 는 A 딱지 플래그 `[sp+0xb4]` 를 기본 1 로 두는데(0x63cea `movs r2,#1`
 * → 0x63cfa), 마선수 갈래가 0x63d62~0x63d68 에서 0 으로 끈다. 그리는 쪽 0x65764~0x65768 이
 * `ldr r2,[sp,#0xb4]; cmp r2,#0; beq 0x657e0` 로 통째로 건너뛴다.
 * (플래그를 0 으로 쓰는 곳은 셋 — 0x63d68 마선수 · 0x63da6 k 6~9 · 0x63dbc k 10.
 *  즉 A 딱지가 그려지는 k 는 **0·1·3·4·5 뿐**이다. 직접 디스어셈해 전수 확인했다.)
 * 어느 단계인지는 아래 안내 줄이 알려 준다. B 딱지(ABILITY)는 원본도 그린다.
 */
export function AceCursorInfo({
  cursor,
  cursorLevel,
  isCursorOpen,
  isCoachMode,
  imgTextOrigins,
}: {
  readonly cursor: number
  readonly cursorLevel: number
  readonly isCursorOpen: boolean
  readonly isCoachMode: boolean
  readonly imgTextOrigins: FrameOrigins | null
}) {
  const { anchorA, anchorB } = ACE_LAYOUT
  const cursorPlayer = acePlayerOfCell(cursor)
  /** 열린 칸이면 그 마선수 — 잠겼으면 원 두 개 + LOCK */
  const openPlayer = isCursorOpen ? cursorPlayer : undefined
  return (
    <>
      {/*
        B 딱지 — 파란 막대(117) 에 ABILITY, k 2 는 기본값 43 위다. 코치채용(k 10)은 그리지 않는다: 0x63cdc 가 B 글 [sp+0xc0] 을 −1 로
        두고 k 10 갈래 0x63daa~0x63dc0 는 그 칸을 안 고쳐(k 2 갈래 0x63d64 만 0x9f) 0x657e0~0x657e4 가 B 딱지를 통째로 건너뛴다(r263 직접 뜸)
      */}
      {!isCoachMode && (
        <>
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, TAG.blueBar)}
            style={{ left: anchorB.x + TAG.dx, top: anchorB.y + TAG.bDyDefault }}
          />
          <FrameSprite
            folder={IMG_TEXT_FRAME}
            frame={ACE_LAYOUT.tagFrames.ability}
            origins={imgTextOrigins}
            centerX
            x={anchorB.x}
            y={anchorB.y + TAG.bDyDefault + TAG.textDdy}
          />
        </>
      )}

      {/*
        ABILITY 판 — k 2(고르기) · k 11(레벨업)만 0x64b6e~0x64bac 에서 0x5aefc(skin, 레이더 [skin+0xd4], B.x, B.y + 8,
        종류 **1**, 기록 0, 순번 = [skin+0xd0] == 0 ? 칸 − 5 : 칸, 반지름 30) 을 부른다(직접 떴다). 코치채용(k 10)은 안 부른다.
        종류 1 은 0x5b090: [skin+0xd0] == 1 이면 마투수 기록 0x1f825(저장, 순번) · 이름 0~3, 아니면 마타자 0x1f84d · 이름 4~7,
        값 = 0xb6415(기록, i, 1)(레벨 배율 뒤 장착 스킬까지 = `aceRecordAbilityAtLevel`). 축 최대치는 틀 표 0xd1b2c 그대로 999.
        잠긴 칸도 거르지 않는다. 단계 [skin+0xd0] 은 커서 줄과 늘 같다(21 은 줄을 못 옮기고 28 은 위아래가 줄과 함께 뒤집는다).
      */}
      {!isCoachMode && cursorPlayer !== undefined && (
        <AbilityRadarPanel
          center={{ x: anchorB.x + ACE_LAYOUT.abilityChart.dx, y: anchorB.y + ACE_LAYOUT.abilityChart.dy }}
          radius={ACE_LAYOUT.abilityChart.radius}
          maximumLength={ACE_LAYOUT.abilityChart.radius}
          labelFrames={aceRoleOfCell(cursor) === ACE_PHASE.마투수 ? ABILITY_RADAR_LABELS.pitcher : ABILITY_RADAR_LABELS.batter}
          targets={abilityValuesOf(aceRecordAbilityAtLevel(cursorPlayer, cursorLevel))}
          restartKey={`${cursor}:${cursorLevel}`}
        />
      )}

      {/* A — 커서가 짚은 마선수. 잠겼으면 원 두 개 + LOCK */}
      {openPlayer !== undefined ? (
        <img className={styles.layer} alt={openPlayer.name} src={openPlayer.stillUrl} style={{ left: anchorA.x - 20, top: anchorA.y - 20 }} />
      ) : (
        LOCKED_CIRCLES.map((circle) => (
          <span
            key={circle.diameter}
            className={styles.lockedCircle}
            style={{
              left: anchorA.x - circle.diameter / 2,
              top: anchorA.y - circle.diameter / 2,
              width: circle.diameter,
              height: circle.diameter,
              background: circle.color,
            }}
          />
        ))
      )}

      {/* 이름 막대 (slt_frame 이미지 9) + 이름 + 노란 LV */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: anchorA.x + NAME_BAR.dx, top: anchorA.y + NAME_BAR.dy }}
      />
      <span
        className={styles.centeredText}
        data-testid="마선수-이름"
        style={{ left: anchorA.x + NAME_BAR.dx, top: anchorA.y + NAME_BAR.textDy, width: NAME_BAR.width }}
      >
        {openPlayer !== undefined ? `${openPlayer.name} LV.${cursorLevel + 1}` : LOCK_LABEL}
      </span>

      {/* 줄 딱지 — PITCHER / BATTER */}
      {ACE_LAYOUT.rowTags.map((tag) => (
        <span key={tag.label}>
          <span
            className={styles.fillPanel}
            style={{
              left: tag.panel.x,
              top: tag.panel.y,
              width: tag.panel.width,
              height: tag.panel.height,
              background: ACE_LAYOUT.panelColor,
              borderRadius: 2,
            }}
          />
          <img className={styles.layer} alt={tag.label} src={imageSrc(SLT_IMAGE, tag.image)} style={{ left: tag.imageAt.x, top: tag.imageAt.y }} />
        </span>
      ))}
    </>
  )
}
