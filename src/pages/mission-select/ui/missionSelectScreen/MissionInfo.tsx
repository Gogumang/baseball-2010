import { FrameSprite, InsetBox, MarkupText } from '@/shared/ui'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { missionRewardOf, missionRewardTierOf } from '@/entities/mission/model/missionReward'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  BOTTOM_FRAME,
  DESCRIPTION_BOX,
  DESCRIPTION_TEXT,
  EVENT_MISSION_CELL,
  EVENT_TAB_LABEL,
  GRADE_MARKS,
  NO_MISSION_TEXT,
  REWARD_ROW,
  SUCCESS_ROW,
  TAB_LABEL,
} from '@/pages/mission-select/lib/missionSelectLayout'
import * as styles from '@/pages/mission-select/ui/MissionSelectScreen.css'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { IMG_TEXT, SLT_FRAME, imageSrc } from './missionSelectAssets'

/**
 * 판 아래 — slt_frame 프레임 1 틀과 "MISSION"/"EVENT" 탭, 설명 상자, 보상 "%dG" · 성공 "%d회" 칸, 등급 네모.
 * 보상 G 는 다시 깰수록 줄어서 클리어 횟수(0xa51d0)를 함께 보여 준다
 */
export function MissionInfo({
  cursor,
  selected,
  clearCounts,
  frames,
  textFrames,
}: {
  readonly cursor: number
  /** 고른 칸의 미션 — 칸 14(이벤트)나 빈 칸이면 undefined */
  readonly selected: OriginalMission | undefined
  readonly clearCounts: Readonly<Record<string, number>>
  readonly frames: FrameOrigins | null
  readonly textFrames: FrameOrigins | null
}) {
  const clears = selected === undefined ? 0 : (clearCounts[missionKeyOf(selected)] ?? 0)
  const reward = selected === undefined ? 0 : missionRewardOf(selected.stage, clears)
  return (
    <>
      <FrameSprite folder={`${SLT_FRAME}/frames`} frame={BOTTOM_FRAME.frame} origins={frames} x={BOTTOM_FRAME.x} y={BOTTOM_FRAME.y} />
      {/* 0x1e018: 고른 칸이 14 면 이미지 52, 아니면 51 */}
      {cursor === EVENT_MISSION_CELL ? (
        <img
          className={styles.sprite}
          alt="EVENT"
          src={imageSrc(SLT_FRAME, EVENT_TAB_LABEL.image)}
          style={{ left: EVENT_TAB_LABEL.x, top: EVENT_TAB_LABEL.y }}
        />
      ) : (
        <img className={styles.sprite} alt="MISSION" src={imageSrc(SLT_FRAME, TAB_LABEL.image)} style={{ left: TAB_LABEL.x, top: TAB_LABEL.y }} />
      )}

      {/* 1dfe0 칸 0xbb28d(W/2, H/2 + 0x21, 173, 65, 정렬 2) — 왼쪽 = 120 − (173 >> 1) = 34 */}
      <InsetBox
        x={DESCRIPTION_BOX.centerX - (DESCRIPTION_BOX.width >> 1)}
        y={DESCRIPTION_BOX.y}
        width={DESCRIPTION_BOX.width}
        height={DESCRIPTION_BOX.height}
        testId="미션-설명-칸"
      />
      <div className={styles.descriptionText} style={{ left: DESCRIPTION_TEXT.x, top: DESCRIPTION_TEXT.y, width: DESCRIPTION_TEXT.width }}>
        {/* 1e5e8~1e624: sprintf("%s"(0xd09bc), 레코드 +0x4e 설명) → 0xba269(45, 197, 폭 0x96, 흰 글). 잠김 0xa520d 는 이 그리기에서
          안 본다(부르는 곳은 진입 1da6c · 키 1db26 · 격자 칸 0x7a690 뿐) — 잠긴 칸도 그 미션 설명이 그대로 나온다.
          원문 StrMAINMENU[60] "오픈 되지 않은 미션입니다…" 은 OK 팝업(1db84)에만 쓴다 */}
        {selected === undefined ? <MarkupText raw={NO_MISSION_TEXT} /> : stripGameMarkup(selected.briefing)}
      </div>

      <FrameSprite folder={IMG_TEXT} frame={REWARD_ROW.labelFrame} origins={textFrames} x={REWARD_ROW.labelX} y={REWARD_ROW.y} />
      <div className={styles.value} style={{ left: REWARD_ROW.valueX, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {reward}G
      </div>
      <FrameSprite folder={IMG_TEXT} frame={SUCCESS_ROW.labelFrame} origins={textFrames} x={SUCCESS_ROW.labelX} y={REWARD_ROW.y} />
      <div className={styles.value} style={{ left: SUCCESS_ROW.valueX, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {clears}회
      </div>
      {/* 0x1e6ce~0x1e722 — 등급 표시 네모 (byte1 >> 1) & 7 개를 (165 + 8i, 183) */}
      {selected !== undefined &&
        Array.from({ length: missionRewardTierOf(selected.stage) }, (_, index) => (
          <img
            key={index}
            className={styles.sprite}
            alt=""
            data-testid="미션-등급-네모"
            src={imageSrc(SLT_FRAME, GRADE_MARKS.image)}
            style={{ left: GRADE_MARKS.x + GRADE_MARKS.step * index, top: GRADE_MARKS.y }}
          />
        ))}
    </>
  )
}
