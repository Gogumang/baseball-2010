import { useEffect, useRef, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { MAP_FRAMES, OUTING_PLACES } from '@/shared/config/outingPlaces'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_OUTING_PLACES, checkSeasonOuting, seasonOutingConfirmTextOf, seasonOutingRefusalTextOf,
} from '@/widgets/season/lib/seasonOuting'
import type { SeasonOutingPlace } from '@/widgets/season/lib/seasonOuting'
import { moveOutingMapCursor, outingMapDirectionOf } from '@/pages/season/lib/seasonOutingMap'
import { SeasonOutingMap } from '@/pages/season/ui/SeasonOutingMap'

/** 지도 원점 y (프레임 0 = 240×297 → (0, 11)) */
const MAP_TOP = 11

export interface SeasonOutingScreenProps {
  readonly state: SeasonState
  /** 고른 칸 this+0xf8 — 장면 객체 칸이라 지도를 오가도 남는다(진입 0xbd24 는 지도 그림만 싣는다) */
  readonly cursor: number
  readonly onCursorChange: (place: number) => void
  /**
   * 확인 팝업 0x16 에 "예" — 원본 `0x4a94` 가 장소를 UI 에 넘기고 **0xe3 연출**(0x85074)로 간다.
   * 굴림(0xc81c)은 연출이 끝난 뒤다.
   */
  readonly onRun: (place: SeasonOutingPlace, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 시즌 외출 지도 (장면 0x105 상태 **0xd1**, 진입 0xbd24 · 키 **0xbf50** · 그리기 0xa04c).
 *
 * 그림은 `0x7ea64(gfx, p, 0)` — 고른 칸이 있는 지도(`SeasonOutingMap`). 키 0xbf50:
 * ```
 * −16       → 0xc9 (0x7ff21)
 * −5 · '5'  → 가드 0xbd38 (거절 팝업 1 · 확인 팝업 0x16)
 * 그 밖     → this+0xf8 = 0x7f3e4(gfx, this+0xf8, 키)   ; 방향 이동 표 0xd491c
 * ```
 * 장소 5곳(경기장·번화가·병원·학교·방송국)과 가드 `0xbd38` 는 P4 **3 절 확정**이다.
 * ⚠️ 나만의리그 외출(`pages/outing-map`, `shared/config/outingPlaces.ts`)과는 **값도 가드도 다르다** — 지도 그림만 같다.
 *
 * 외출 지도에서도 이벤트 폴링은 돌지만 **s_event 는 하나도 뜨지 않는다**(화면코드 209 를 받는
 * trigger 가 없다 — 무해한 원본 이상, `seasonEventFlow.ts` 의 `acceptsSeasonEvents`).
 * 건물 누르기는 웹 입력이다 — 그 칸으로 옮겨 확인 키와 같게 가드를 탄다.
 */
export function SeasonOutingScreen({ state, cursor, onCursorChange, onRun, onBack }: SeasonOutingScreenProps) {
  const { record, teamMorale } = state
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<number | null>(null)
  const origins = useFrameOrigins(MAP_FRAMES)

  const select = (index: number) => {
    const checked = checkSeasonOuting(record, teamMorale, index)
    if (!checked.ok) return setNotice(seasonOutingRefusalTextOf(checked))
    setQuestion(index)
  }

  const latest = useRef({ cursor, select, onBack, onCursorChange })
  latest.current = { cursor, select, onBack, onCursorChange }
  const isEnabled = notice === null && question === null

  useEffect(() => {
    if (!isEnabled) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        return current.select(current.cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        return current.onBack()
      }
      const direction = outingMapDirectionOf(event.key)
      if (direction === null) return
      event.preventDefault()
      current.onCursorChange(moveOutingMapCursor(current.cursor, direction))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEnabled])

  return (
    <RawScreen>
      <SeasonOutingMap selected={cursor} hour={new Date().getHours()} />
      <div role="group" aria-label="외출">
        {OUTING_PLACES.map((place, index) => {
          // 건물 프레임 자리(원점 = 지도 좌표, 지도 원점 (0, 11)) — 원점을 못 읽었으면 화살표 박스로
          const frame = origins?.[String(place.frame).padStart(3, '0')]
          const area = frame === undefined
            ? { left: place.cursorBox.x, top: place.cursorBox.y + MAP_TOP, width: place.cursorBox.width, height: place.cursorBox.height }
            : { left: frame.x, top: frame.y + MAP_TOP, width: frame.width, height: frame.height }
          return (
          <button key={place.id} type="button" aria-label={SEASON_OUTING_PLACES[index]} aria-pressed={index === cursor}
            style={{ position: 'absolute', ...area, background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            onClick={() => {
              if (!isEnabled) return
              onCursorChange(index)
              select(index)
            }} />
          )
        })}
      </div>

      {notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
      {notice === null && question !== null && (
        <MessageBox
          // 0xbd38 의 0xbdf8~0xbf00 — 비용 줄 [162] 이 먼저, [161] 원문 안 !N 그대로
          text={seasonOutingConfirmTextOf(question)}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            const place = question
            setQuestion(null)
            if (answer === 0) onRun(SEASON_OUTING_PLACES[place], place)
          }}
        />
      )}
    </RawScreen>
  )
}
