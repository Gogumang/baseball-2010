import { useEffect, useRef, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import {
  SETTLEMENT_BAND, SETTLEMENT_LOSE_DIM_STEP, SETTLEMENT_RESULT_SPRITE, SETTLEMENT_TITLE_BAR,
} from '@/pages/team-game/lib/settlementBoard'
import {
  MISSION_GP_FRAME, MISSION_POINT_BOX, MISSION_POINT_GP_X, MISSION_POINT_LABEL_X, MISSION_POINT_ROWS,
  MISSION_POINT_VALUE, MISSION_RESULT_TITLE, MISSION_RESULT_WINDOW, MISSION_RETRY_BOX, MISSION_RETRY_BUTTONS,
  MISSION_RETRY_DEFAULT_ANSWER, MISSION_RETRY_QUESTION, MISSION_RETRY_TEXT, missionResultKeyActionOf, missionResultStepOf,
} from '@/pages/mission-play/lib/missionResultBoard'
import type { MissionResultExit, MissionResultKeyAction } from '@/pages/mission-play/lib/missionResultBoard'
import * as styles from '@/pages/mission-play/ui/MissionResultBoard.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const RESULT_FRAMES = './sprites/result/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const POPUP_FRAMES = './sprites/popup/frames'
const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`

export interface MissionResultBoardProps {
  /** [미션+0xbc] — 0xa5368(obj, 목표 달성?) 이 적은 성공 여부 */
  readonly isSuccess: boolean
  /**
   * 마선수 대결(전역 기록 g[0x11f] 타자편 · g[0x176] 투수편)인가 — 그리면 앞부분(띠 · YOU WIN/LOSE)만, 키는 커서를 안 뒤집는다.
   * `flag11f` · `flag176` 은 어느 칸이 섰는지다 (키 0x407f0 의 OK 는 둘 다 서야 대결 끝 길로 간다).
   */
  readonly aceMatch?: { readonly flag11f: boolean; readonly flag176: boolean }
  /** [+0x17f4] — 진입 0x4ea0c 가 적은 이번에 번 G (`missionResultEarnedOf`) */
  readonly earnedGamePoint: number
  /** g[0x64] — 진입이 보상을 더한 뒤의 보유 G (`missionResultHeldOf`). 안 주면 그 줄 숫자를 비운다 */
  readonly heldGamePoint?: number
  /**
   * 판을 나간다 — '다시'(0x140006c = 3, 같은 미션 곧바로) · '목록'(1, 미션 목록) · '대결끝'(0x4090e).
   * 마선수 대결은 0x4b100 이 원래 모드로 돌려보내므로 부르는 쪽이 어느 값이든 대결 끝으로 다룬다.
   */
  readonly onExit: (exit: MissionResultExit) => void
}

/**
 * **미션 결과 판** (경기 상태 0x19 그리기 0x4a384 의 모드 5·6 갈래 · 키 0x407f0) — 좌표·흐름은 `lib/missionResultBoard` 머리말.
 * 앞부분(실패 덮개 · 띠 · game_ui 프레임 8 · YOU WIN/LOSE)은 팀경기 정산 판과 같은 그림이라 그 자리 값을 쓴다.
 * ⚠️ 미해결 — 배경: 0x4a384 첫머리의 구름 0x78448 · 0x40ff0(장면, +0x17e2) 는 정산 판처럼 안 옮겼다(UNRESOLVED U-97) —
 *    판은 밑에 깔린 타석 화면 위 240×320 에 겹친다.
 */
export function MissionResultBoard({ isSuccess, aceMatch, earnedGamePoint, heldGamePoint, onExit }: MissionResultBoardProps) {
  const [answer, setAnswer] = useState(MISSION_RETRY_DEFAULT_ANSWER)
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const resultOrigins = useFrameOrigins(RESULT_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const doneRef = useRef(false)
  const flags = { flag11f: aceMatch?.flag11f ?? false, flag176: aceMatch?.flag176 ?? false }
  const isAce = flags.flag11f || flags.flag176

  const act = (action: MissionResultKeyAction, current: boolean) => {
    if (doneRef.current) return
    const step = missionResultStepOf(action, current, flags)
    setAnswer(step.answer)
    if (step.exit !== null) {
      doneRef.current = true
      exitRef.current(step.exit)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const action = missionResultKeyActionOf(event.key)
      if (action === null) return
      event.preventDefault()
      act(action, answer)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const question = parseGameMarkup(MISSION_RETRY_QUESTION)[0]

  return (
    <div className={styles.layer} data-testid="미션-결과-판">
      {/* 4a404 실패 — 색 덮기 검정 단계 8 */}
      {!isSuccess && (
        <div className={styles.fill}
          style={{ background: '#000000', opacity: colorStepCoverOpacityOf(SETTLEMENT_LOSE_DIM_STEP) }} />
      )}
      {/* 4a448 — 띠 · game_ui 프레임 8 · result 0 "YOU WIN" / 1 "YOU LOSE" */}
      <div className={styles.block} style={{
        left: SETTLEMENT_BAND.x, top: SETTLEMENT_BAND.y, width: SETTLEMENT_BAND.width, height: SETTLEMENT_BAND.height,
        background: SETTLEMENT_BAND.color,
      }} />
      <FrameSprite folder={GAME_UI_FRAMES} frame={SETTLEMENT_TITLE_BAR.frame} origins={gameUiOrigins}
        x={SETTLEMENT_TITLE_BAR.centerX - (SETTLEMENT_TITLE_BAR.width >> 1)} y={SETTLEMENT_TITLE_BAR.y} />
      <span data-testid="미션-결과-그림" data-frame={isSuccess ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}>
        <FrameSprite folder={RESULT_FRAMES}
          frame={isSuccess ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}
          origins={resultOrigins} x={SETTLEMENT_RESULT_SPRITE.x} y={SETTLEMENT_RESULT_SPRITE.y} />
      </span>

      {/* 4a576 마선수 대결(g[0x11f] · g[0x176])은 여기서 끝 */}
      {!isAce && (
        <>
          <div className={styles.window} style={{
            left: MISSION_RESULT_WINDOW.x, top: MISSION_RESULT_WINDOW.y,
            width: MISSION_RESULT_WINDOW.width, height: MISSION_RESULT_WINDOW.height,
          }} />
          <img className={styles.sprite} alt="RESULT" src={imageSrc(GAME_UI, MISSION_RESULT_TITLE.image)}
            style={{ left: MISSION_RESULT_TITLE.x, top: MISSION_RESULT_TITLE.y }} />

          <div className={styles.innerBox} style={{
            left: MISSION_POINT_BOX.x, top: MISSION_POINT_BOX.y, width: MISSION_POINT_BOX.width, height: MISSION_POINT_BOX.height,
          }} />
          {MISSION_POINT_ROWS.map((row, index) => {
            const value = index === 0 ? earnedGamePoint : heldGamePoint
            return (
              <div key={row.name}>
                <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins}
                  x={MISSION_POINT_LABEL_X} y={row.labelY} />
                <FrameSprite folder={IMG_TEXT_FRAMES} frame={MISSION_GP_FRAME} origins={textOrigins}
                  x={MISSION_POINT_GP_X} y={row.labelY} />
                {value !== undefined && (
                  <GamePointBadge testId={`미션-${row.name}-G`} value={value} x={MISSION_POINT_VALUE.x} y={row.valueY}
                    width={MISSION_POINT_VALUE.width} align={MISSION_POINT_VALUE.align} plus={row.plus}
                    plate={MISSION_POINT_VALUE.plate} />
                )}
              </div>
            )
          })}

          <div className={styles.innerBox} style={{
            left: MISSION_RETRY_BOX.x, top: MISSION_RETRY_BOX.y, width: MISSION_RETRY_BOX.width, height: MISSION_RETRY_BOX.height,
          }} />
          {question !== undefined && (
            <span className={styles.text} data-testid="미션-재도전-글" style={{
              left: MISSION_RETRY_TEXT.x, top: MISSION_RETRY_TEXT.y, width: MISSION_RETRY_TEXT.width,
              textAlign: question.isCentered ? 'center' : 'left',
            }}>
              {question.segments.map((segment, index) => (
                <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
              ))}
            </span>
          )}
          {MISSION_RETRY_BUTTONS.map((button) => (
            <FrameSprite key={button.name} folder={POPUP_FRAMES} frame={button.frame} origins={popupOrigins}
              x={button.x} y={button.y} />
          ))}
          {MISSION_RETRY_BUTTONS.filter((button) => button.answer === answer).map((button) => (
            <span key={button.name} data-testid="미션-재도전-커서" data-answer={button.name}>
              <FrameSprite folder={POPUP_FRAMES} frame={button.selectedFrame} origins={popupOrigins} x={button.x} y={button.y} />
            </span>
          ))}
          {/* 원본에 없는 웹 단추 — 누르면 그 쪽으로 옮겨 OK 와 같다 */}
          {MISSION_RETRY_BUTTONS.map((button) => (
            <button key={button.name} type="button" className={styles.hitArea} aria-label={button.name}
              style={{ left: button.x, top: button.y, width: 41, height: 15 }}
              onClick={() => act('확인', button.answer)} />
          ))}
        </>
      )}
      {isAce && (
        // 원본에 없는 웹 단추 — OK 와 같다
        <button type="button" className={styles.hitArea} aria-label="확인"
          style={{ left: 0, top: 0, width: 240, height: 320 }} onClick={() => act('확인', answer)} />
      )}
    </div>
  )
}
