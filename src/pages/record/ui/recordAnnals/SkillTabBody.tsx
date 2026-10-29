import { FrameSprite, InsetBox } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { isMinusSkill } from '@/entities/career/model/playerCareer'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { annalsSkillOfCell, isAnnalsSkillGained } from '@/entities/collection/model/annalsStats'
import { CELL_FRAMES, SKILL_BADGE, SKILL_DESCRIPTION, SKILL_NOT_GAINED_TEXT, skillGradeOf } from '@/pages/record/lib/recordAnnalsLayout'
import { hasDownMark } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { IMG_TEXT, SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/record/ui/recordAnnals/annalsAssets'
import { CellGrid } from '@/pages/record/ui/recordAnnals/CellGrid'
import type { RecordAnnalsState } from '@/pages/record/ui/recordAnnals/useRecordAnnals'

/** 얻은 스킬 그림 두 장 (0x2f3b0~0x2f488) — img_text 등급(팔레트 0) · slt_frame 이미지 0x7c/0x7d 화살(깜박이면 1 아래) */
function SkillBadge({ state, collection }: { readonly state: RecordAnnalsState; readonly collection: Collection }) {
  const { cursor, textFrames, isBlinking } = state
  const arrowImage = isMinusSkill(annalsSkillOfCell(collection.stats, cursor)) ? SKILL_BADGE.minusImage : SKILL_BADGE.plusImage
  return (
    <>
      <FrameSprite
        folder={IMG_TEXT}
        frame={SKILL_BADGE.gradeFrames[skillGradeOf(cursor)]}
        origins={textFrames}
        x={SKILL_BADGE.gradeX}
        y={SKILL_BADGE.gradeY}
      />
      <img
        className={styles.sprite}
        alt=""
        data-testid="스킬-화살"
        src={imageSrc(SLT_FRAME, arrowImage)}
        style={{ left: SKILL_BADGE.arrowX, top: SKILL_BADGE.arrowY + (isBlinking ? 1 : 0) }}
      />
    </>
  )
}

/** 설명 글 — 얻었으면 `"%s!N효과 : !cFFFF00%s"`(0xcf978) — StrSKILL[i] · StrSKILL[i + 40], 못 얻었으면 안내 */
function skillDescriptionOf(collection: Collection, cursor: number): string {
  if (!isAnnalsSkillGained(collection.stats, cursor)) return SKILL_NOT_GAINED_TEXT
  return `${ORIGINAL_SKILLS[cursor]?.description ?? ''}!N효과 : !cFFFF00${ORIGINAL_SKILLS[cursor]?.effect ?? ''}`
}

/** 0xba269(글, 39, 202, 폭 −1) — 날 글 폭이라 `!N` 에서만 줄이 끊긴다 (0x2f3a0 · 0x2f4d8 → 0x2fb8e) */
function SkillDescriptionText({ text }: { readonly text: string }) {
  return (
    <div className={styles.descriptionText} data-testid="스킬-설명" style={{ left: SKILL_DESCRIPTION.text.x, top: SKILL_DESCRIPTION.text.y }}>
      {parseGameMarkup(text).map((line, lineIndex) => (
        <div key={lineIndex}>
          {line.segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 탭 2 스킬 — 칸 격자 · 설명 탭 · 설명 상자 · 얻은 스킬 등급 · 화살 · 설명 글 (0x2efa4~0x2f4ec) */
export function SkillTabBody({ state, collection }: { readonly state: RecordAnnalsState; readonly collection: Collection }) {
  const { frames, cursor, gridTop, isTabFocused, isBlinking, cursorShake, selectCell } = state
  return (
    <>
      <CellGrid
        frames={frames}
        gainedFrame={CELL_FRAMES.skill}
        cursor={cursor}
        top={gridTop}
        hasDownMark={hasDownMark(2, gridTop)}
        isCursorShown={!isTabFocused && isBlinking}
        isBlinking={isBlinking}
        cursorShake={cursorShake}
        onSelect={selectCell}
        // 얻음 = 표 [+0x13c](0x58a3c) 가 −1 이 아님 — 켠 스킬 비트 +0xf4/+0xf8 (0x2f150~0x2f162)
        items={ORIGINAL_SKILLS.map((skill) => ({
          name: skill.name,
          isGained: isAnnalsSkillGained(collection.stats, skill.id),
        }))}
      />
      <FrameSprite folder={SLT_FRAMES} frame={SKILL_DESCRIPTION.tabFrame} origins={frames} x={SKILL_DESCRIPTION.tabX} y={SKILL_DESCRIPTION.tabY} />
      {/* 설명 상자 0xbb28d(W/2, …, 0xad, 0x3c, 정렬 2) — 왼쪽 = 120 − (173 >> 1) = 34 (0x2f35e~0x2f36e) */}
      <InsetBox
        x={SKILL_DESCRIPTION.box.centerX - (SKILL_DESCRIPTION.box.width >> 1)}
        y={SKILL_DESCRIPTION.box.y}
        width={SKILL_DESCRIPTION.box.width}
        height={SKILL_DESCRIPTION.box.height}
      />
      {isAnnalsSkillGained(collection.stats, cursor) && <SkillBadge state={state} collection={collection} />}
      <SkillDescriptionText text={skillDescriptionOf(collection, cursor)} />
    </>
  )
}
