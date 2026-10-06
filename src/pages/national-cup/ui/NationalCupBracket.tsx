import { useId } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import { FINAL_STAGE, matchTeamOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import {
  BRACKET_END_BOXES, BRACKET_FINAL_BOXES, BRACKET_FINAL_TITLE_FRAME, BRACKET_FRAME, BRACKET_LEAGUE_BOXES,
  BRACKET_LEAGUE_TITLE_BASE, TEAM_LABEL_BASE_FRAME, TEAM_LOGO_SIZES, frameCenterOf, imageCenterOf,
} from '@/pages/national-cup/lib/nationalCupLayout'
import type { BracketBox } from '@/pages/national-cup/lib/nationalCupLayout'
import * as styles from '@/pages/national-cup/ui/NationalCupStandings.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const TEAM_LOGO = './sprites/team_logo'

interface NationalCupBracketProps {
  readonly cup: NationalCup
  /** 확인(−5/0x35) — 134 키 0x19fdc · 0xf3 키 0xe6f8 */
  readonly onConfirm: () => void
  /** 확인 칸을 받는가 — 결과 팝업이 떠 있는 동안에는 키를 팝업이 가져간다 */
  readonly isConfirmable?: boolean
}

/** 한 칸: 로고 박스 · 이름표 박스 · 팀 */
interface Slot {
  readonly team: number
  readonly logoBox: BracketBox
  readonly labelBox: BracketBox
}

/**
 * 국가대항전 첫 화면 = **대진판 `0x85af4`** (나리 134 그림 0x19fc8 · 시즌 0xf3 그림 0xe6e4 가 그대로 부른다).
 *
 * 단계(`L+0xad`)마다 mode_ui 프레임 66(풀리그 두 경기) · 67(결승) · 68(끝 — 우승국 하나)을 통째로 그리고
 * 박스에 제목 글자·팀 로고·팀 이름표를 얹는다 (`nationalCupLayout.ts` 의 `BRACKET_*` 머리 주석).
 * 제목 글자는 img_text 팔레트 3(짙은 파랑)으로 그린다 — 웹은 흰 글자 그림 한 장을 색 행렬로 바꿔 칠한다
 * (img_text.mpl 팔레트 0 → 3: #FFFFFF → #2949A5 · #EFEFEF → #10246B, S10 7절).
 */
export function NationalCupBracket({ cup, onConfirm, isConfirmable = true }: NationalCupBracketProps) {
  const modeOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const navyFilterId = `navy-${useId().replace(/:/g, '')}`
  const textSizeOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')] ?? null

  const stage = cup.stage
  const frame = stage > FINAL_STAGE ? BRACKET_FRAME.풀리그 : stage === FINAL_STAGE ? BRACKET_FRAME.결승 : BRACKET_FRAME.끝
  const titleFrame = stage > FINAL_STAGE
    ? BRACKET_LEAGUE_TITLE_BASE - stage
    : stage === FINAL_STAGE ? BRACKET_FINAL_TITLE_FRAME : null
  const slots: readonly Slot[] = stage > FINAL_STAGE
    ? [0, 1, 2, 3].map((i) => ({
        team: matchTeamOf(cup, stage, i), logoBox: BRACKET_LEAGUE_BOXES[i + 1], labelBox: BRACKET_LEAGUE_BOXES[i + 5],
      }))
    : stage === FINAL_STAGE
      ? [0, 1].map((i) => ({
          team: matchTeamOf(cup, stage, i), logoBox: BRACKET_FINAL_BOXES[i + 1], labelBox: BRACKET_FINAL_BOXES[i + 3],
        }))
      // n ≤ 0: S+0x12c(대회 중) 이면 S+0x144 우승국 — 이 화면은 대회 중에만 뜬다
      : [{ team: cup.champion, logoBox: BRACKET_END_BOXES[0], labelBox: BRACKET_END_BOXES[1] }]
  const titleBox = stage > FINAL_STAGE ? BRACKET_LEAGUE_BOXES[0] : BRACKET_FINAL_BOXES[0]

  const textAt = (textFrame: number, box: BracketBox, filter?: string) => {
    const size = textSizeOf(textFrame)
    if (size === null) return null
    const at = frameCenterOf(box, size.width, size.height)
    return (
      <FrameSprite folder={IMG_TEXT} frame={textFrame} origins={textOrigins} x={at.x} y={at.y}
        style={filter === undefined ? undefined : { filter }} />
    )
  }

  return (
    <div role="group" aria-label="국가대항전 대진" data-stage={stage}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={navyFilterId} colorInterpolationFilters="sRGB">
          {/* 흰 글자(R=G=B) → 팔레트 3 두 색. 255 → 41·73·165, 239 → 16·36·107 이 되는 1차식 */}
          <feColorMatrix type="matrix"
            values={'1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'} />
        </filter>
      </svg>

      <FrameSprite folder={MODE_UI} frame={frame} origins={modeOrigins} x={0} y={0} />

      {titleFrame !== null && (
        <span data-testid="대진제목" data-frame={titleFrame}>
          {textAt(titleFrame, titleBox, `url(#${navyFilterId})`)}
        </span>
      )}

      {slots.map((slot, index) => {
        const size = TEAM_LOGO_SIZES[slot.team]
        const logo = size === undefined ? null : imageCenterOf(slot.logoBox, size[0], size[1])
        return (
          <span key={index} data-slot={index} data-team={slot.team}>
            {logo !== null && (
              <img className={styles.layer} alt={TEAMS[slot.team]?.name ?? ''}
                src={`${TEAM_LOGO}/${String(slot.team).padStart(3, '0')}.png`}
                style={{ left: logo.x, top: logo.y }} />
            )}
            {textAt(TEAM_LABEL_BASE_FRAME + slot.team, slot.labelBox)}
          </span>
        )
      })}

      {isConfirmable && <button type="button" className={styles.confirm} aria-label="확인" onClick={onConfirm} />}
    </div>
  )
}
