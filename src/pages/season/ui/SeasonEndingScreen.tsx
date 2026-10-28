import { useEffect, useRef, useState } from 'react'
import { MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { ENDING_BONUS_GAME_POINTS } from '@/entities/season-mode/model/seasonRewards'
import {
  ENDING_BACKDROP_COLOR,
  ENDING_IRIS,
  ENDING_SCREEN,
  SEASON_ENDING_TEXT,
  isSeasonEndingTextShown,
  seasonEndingIrisOf,
  seasonEndingTextIndexOf,
} from '@/widgets/season/lib/seasonEndingLayout'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'
import { SeasonOutingMap } from '@/pages/season/ui/SeasonOutingMap'
import { isBugFixed } from '@/shared/config/bugfixes'

/** 엔딩 보너스 안내 — StrMODE[214] 원문 그대로 (J 4-8) */
const BONUS_TEXT = '!C엔딩 보너스 획득!N[!cFFFF00%d G포인트!cFFFFFF]'

/** 엔딩 보너스 표는 **× 1000 G** 다 (0xcbc2e) */
const GAME_POINT_UNIT = 1000

export interface SeasonEndingScreenProps {
  /**
   * 엔딩 번호 0~4 — `judgeSeasonEnding`(`entities/season-mode/model/seasonRewards.ts`, 0xa3084) 결과.
   * 0 비인기 · 1 지역 인기 · 2 한국 최고 · 3 세계 일류 · 4 역사상 최고 구단.
   */
  readonly endingIndex: number
  /**
   * SR+0x7b — 엔딩 보너스를 받았는가. 키 `0x6b3c` 는 서 있으면 보너스 팝업 없이 넘기고(6b52~6b6e), 아니면 팝업 0x2b 를 띄운다.
   * 판정 0 은 진입 `0x6be8` 이 이미 세워 둔다(6c12~6c2e).
   */
  readonly isBonusReceived?: boolean
  /** 보너스 팝업 0x2b 를 닫았다 — G · SR+0x7b · 저장 · 통계는 부르는 쪽 (`0x8bd8` 8bf0~8c84) */
  readonly onBonusReceived?: () => void
  /**
   * 엔딩을 넘겼다 — SR+0x7b 가 선 채로 키를 누르면 단계 1 · 효과기 종류 1(어두워짐) — 그 끝을 본 틀의 `0x8bd8` 8ccc~8d2c 가
   * SR+0x1bc = 1 · 저장 · 관리 메뉴 0xc9 · 효과기 종류 2(검정에서 밝아짐 — 부르는 쪽이 0xc9 위에 `SeasonScreenFade` 로 건다)
   */
  readonly onFinish: () => void
}

type Phase = '엔딩' | '보너스'

/**
 * 시즌모드 엔딩 (장면 0x105 상태 **0xf5**, 갱신 `0x6be8` · 키 `0x6b3c` · 그리기 `0xb7e0` →
 * **`0x87a1c`** — P4 1a·1c · P6 4b **확정**).
 *
 * 10년차(연차 idx 9) 새 해 처리 `0x6e0c` 가 엔딩 판정 `0xa3084` 를 ≥0 으로 받으면
 * `저장+0xa0+e = 1`(본 엔딩) · `phase = 6` 을 세우고 이벤트 **500**(10년 종료)을 튼 뒤 여기로 온다.
 *
 * 화면 (P6 4b 마지막 항목 확정):
 *   화면 검정 → **외출 지도 `0x7ea65(…, 1)`** 를 배경으로 → **원형 전환**(n > 10, `seasonEndingIrisOf`) → (n > 15)
 *   `StrENDING[15 + 결과]` 흰 글을 **(0, H/2 + 55, 폭 W)** 가운데.
 * 이어서 **엔딩 보너스 StrMODE[214]** (표 0xcbc2e × 1000 G) 를 알린다.
 *
 * 타자편 엔딩(`pages/ending/ui/EndingScreen.tsx`, `0x882b4`)과 다른 점만 만들었다:
 *   - 띠 창 + `ending.pzx` 두 조각이 아니라 **지도 한 장**이 배경이다
 *   - 걸어 들어오는 캐릭터·선수 그림이 없다
 *   - 글이 `StrENDING[결과]` 가 아니라 **`StrENDING[15 + 결과]`** 다
 *   - 명예의 전당 등록·이어하기 질문이 없다 (시즌모드에는 육성 선수가 없다)
 *
 * **제작진 `StrENDING[21]` 은 시즌 엔딩에 없다** (직접 떴다): 그리기 0x87a1c 가 StrENDING 표 [this+0x2e8] 에서 꺼내는 글은
 * 0x87be2~0x87bf4 의 `0x702b5(표, [this+0x2e4] + 15)` 하나뿐이다 — 제작진 흐름은 나리 엔딩 `0x882b4` 에만 있다.
 * 지도는 `0x7ea64(gfx, −1, 1)` — 고른 칸 없음 · 이름숨김 1 (0x87a30~0x87a38, `SeasonOutingMap` 머리말).
 *
 * **닿지 않는 갈래** — 그리기 `0x8bd8` 의 8c86~8cc8 은 팝업 0x2c 가 답 0 으로 닫히면 단계 + 1 · 효과기 종류 1 을 건다. 그러나 팝업 번호
 * [app+0x248] 을 적는 0xbbef8(글, 종류, 번호, …)를 부르는 62 곳(re.py xval 0xbbef9)의 번호는 모두 0x2c 가 아닌 상수이거나 −1 이고,
 * [app+0x248] 을 직접 적는 곳은 0xbbef8 의 bbf30 · 대기 팝업을 옮기는 0x754b6 뿐이다(대기 칸 [app+0x3ac] 도 0xbbef8 bbf10 만 적는다).
 * 곧 팝업 0x2c 는 어디서도 안 뜬다 — 옮기지 않는다.
 */
export function SeasonEndingScreen({ endingIndex, isBonusReceived = false, onBonusReceived, onFinish }: SeasonEndingScreenProps) {
  const [phase, setPhase] = useState<Phase>('엔딩')
  /**
   * 단계 [this+0x140] — 효과기: 진입 0x6be8 6c32~6c42 가 종류 2(검정에서 밝아짐), 키 0x6b3c 6b52~6b6e 가 단계 + 1 · 종류 1(어두워짐)을
   * 새로 건다(전역 하나라 새로 걸면 앞 것을 덮는다 — 웹은 단계마다 새로 마운트). 그리기 `0x8bd8` 8cd2~8cee 는 **단계 == 1** 이고
   * 효과기가 살아 있고(+4 ≠ 0) 끝(+0x10 == 2)일 때만 넘긴다(`onFinish`).
   * 효과기가 도는 동안(+0x10 == 0)은 키가 안 먹는다(`SeasonScreenFade` — 0x4b18 · 0x4b34). 그러나 종류 1 이 마지막 칠하기에 끝을
   * 세운 틀과 `0x8bd8` 이 그 끝을 보는 다음 틀 사이에는 키가 먹는다 — 그 키는 SR+0x7b 가 선 0x6b3c 라 **단계 2** · 종류 1 을 다시
   * 걸고, 그 틀의 `0x8bd8` 은 단계 ≠ 1 이라 넘기지 않는다. 그 뒤로도 키마다 단계만 오르고 효과기가 다시 돌 뿐 영영 넘어가지 않는다
   * (원본 버그 B-34 — 고친 길은 `press`). 끝을 본 다음 틀에 효과기가 비워져(0xbd85e) 어두워진 화면은 걷힌다.
   */
  const [leaveStage, setLeaveStage] = useState(0)

  /**
   * 상태 틱 `[장면+0x2c]`(0xb7e0 이 0x87a1c 에 넘긴다) — n ≤ 10 은 지도만 · n > 10 부터 원 · n > 15 부터 글.
   * 원은 t ≥ 14 에 지름 100 으로 서므로 그 뒤로는 움직이는 것이 없다(틱을 거기서 세운다 — 글 문턱 15 보다 크다).
   */
  const tick = Math.min(useUpdateCounter(), ENDING_IRIS.firstTickAfter + 1 + 14)
  const circle = seasonEndingIrisOf(tick)

  /** 키 0x6b3c — SR+0x7b 만 본다(보너스 값도 단계도 안 본다). 서 있으면 단계 + 1 · 종류 1 — 끝은 아래 효과기가 알린다 */
  const press = () => {
    // 고침(`bugfixes.json` B-34, 기본 켬): 단계는 1 에서 멈춘다 — 끝을 본 틀 사이의 키가 단계 2 로 넘겨 영영 안 넘어가던 길(원본 버그)을
    // 막는다. 이미 단계 1 이면 키를 버리고 도는 효과기의 끝이 그대로 넘긴다. 굴림 없음
    if (isBonusReceived) setLeaveStage((stage) => (isBugFixed('B-34') && stage >= 1 ? stage : stage + 1))
    else setPhase('보너스')
  }
  const pressRef = useRef(press)
  pressRef.current = press
  /**
   * **키 길** — 시즌 장면 0xe9ac 의 키 갈래(ec6a~ec9a)는 공용 창 0x754f9 가 키를 안 먹고 이 틀에 누름([this+0x34])이 있으면
   * 상태 표 0xcbf6c[상태 − 0xc8] 로 간다. [0x2d](0xf5) = 0xed60 → `bl 0x6b3c` 이고, 0x6b3c 는 키 값([this+0x40])을 읽지 않는다 —
   * **어느 키든** 같다(직접 떴다). 보너스 팝업(0x2b)이 떠 있는 동안은 창이 키를 먹는다(`MessageBox`). 효과기가 도는 동안의 키는
   * `SeasonScreenFade` 가 잡기 단계에서 삼킨다. 되풀이(+0x38)는 누름이 아니라 거른다
   */
  useEffect(() => {
    if (phase !== '엔딩') return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      event.preventDefault()
      pressRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  const bonus = (ENDING_BONUS_GAME_POINTS[endingIndex] ?? 0) * GAME_POINT_UNIT
  const text = ORIGINAL_ENDINGS[seasonEndingTextIndexOf(endingIndex)] ?? ''

  return (
    <RawScreen>
      {/* 화면 검정 (0x6a735) */}
      <svg
        className={styles.overlay}
        viewBox={`0 0 ${ENDING_SCREEN.width} ${ENDING_SCREEN.height}`}
        width={ENDING_SCREEN.width}
        height={ENDING_SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={ENDING_SCREEN.width} height={ENDING_SCREEN.height} fill={ENDING_BACKDROP_COLOR} />
      </svg>

      {/* 배경 = 외출 지도 0x7ea64(gfx, −1, 1) — 건물 다섯 보통 · 이름 숨김 · 밤이면 어둡게 */}
      <SeasonOutingMap selected={-1} hidesNames />

      {/* 원형 전환 — 검정 판에 원을 뚫어 덮는다 (0x87a1c). evenodd 라 원 안쪽이 구멍이 된다. n ≤ 10 은 판도 없다 */}
      <svg
        className={styles.overlay}
        aria-label="원형 전환"
        viewBox={`0 0 ${ENDING_SCREEN.width} ${ENDING_SCREEN.height}`}
        width={ENDING_SCREEN.width}
        height={ENDING_SCREEN.height}
      >
        {circle !== null && (
          <path
            fillRule="evenodd"
            fill={ENDING_IRIS.cover}
            d={
              `M0,0H${ENDING_SCREEN.width}V${ENDING_SCREEN.height}H0Z` +
              `M${circle.x},${circle.y + circle.diameter / 2}` +
              `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${circle.diameter},0` +
              `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${-circle.diameter},0`
            }
          />
        )}
      </svg>

      {isSeasonEndingTextShown(tick) && (
        <div className={styles.endingText} style={{ left: SEASON_ENDING_TEXT.x, top: SEASON_ENDING_TEXT.y, width: SEASON_ENDING_TEXT.width }}>
          <MarkupText raw={text} />
        </div>
      )}

      {phase === '엔딩' && (
        <button
          type="button"
          className={styles.pressArea}
          aria-label="확인"
          // 화면 탭 = 키 하나 (0x6b3c). 효과기가 도는 동안은 덮개(`SeasonScreenFade`)가 누름을 받아 여기까지 안 온다
          onClick={press}
        />
      )}

      {leaveStage > 0 ? (
        // 단계 1 의 종류 1 끝만 넘긴다(0x8bd8 8cdc `cmp r1, #1`) — 단계 2 부터는 끝나도 아무 일이 없다
        <SeasonScreenFade key={`종류1:${leaveStage}`} kind="검정에서밝아짐" {...(leaveStage === 1 ? { onEnd: onFinish } : {})} />
      ) : (
        <SeasonScreenFade key="종류2" kind="검게어두워짐" />
      )}

      {phase === '보너스' && (
        <MessageBox
          text={BONUS_TEXT.replace('%d', String(bonus))}
          buttons={['OK']}
          // 팝업 0x2b 닫힘 — 보너스를 받고 엔딩 화면으로 돌아온다. 다음 키가 SR+0x7b 가 선 0x6b3c 로 넘긴다
          onAnswer={() => {
            onBonusReceived?.()
            setPhase('엔딩')
          }}
        />
      )}
    </RawScreen>
  )
}
