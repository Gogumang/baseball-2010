import { useState } from 'react'
import { MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { MAP_FRAME, MAP_FRAMES } from '@/shared/config/outingPlaces'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { ENDING_BONUS_GAME_POINTS } from '@/entities/season-mode/model/seasonRewards'
import {
  ENDING_BACKDROP_COLOR, ENDING_IRIS, ENDING_IRIS_STAGES, ENDING_MAP, ENDING_SCREEN,
  SEASON_ENDING_TEXT, endingIrisRadiusOf, seasonEndingTextIndexOf,
} from '@/widgets/season/lib/seasonEndingLayout'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'

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
 *   화면 검정 → **외출 지도 `0x7ea65(…, 1)`** 를 배경으로 → 같은 **원형 전환**(S9 8-2 식) →
 *   `StrENDING[15 + 결과]` 흰 글을 **(0, H/2 + 55, 폭 W)** 가운데.
 * 이어서 **엔딩 보너스 StrMODE[214]** (표 0xcbc2e × 1000 G) 를 알린다.
 *
 * 타자편 엔딩(`pages/ending/ui/EndingScreen.tsx`, `0x882b4`)과 다른 점만 만들었다:
 *   - 띠 창 + `ending.pzx` 두 조각이 아니라 **지도 한 장**이 배경이다
 *   - 걸어 들어오는 캐릭터·선수 그림이 없다
 *   - 글이 `StrENDING[결과]` 가 아니라 **`StrENDING[15 + 결과]`** 다
 *   - 명예의 전당 등록·이어하기 질문이 없다 (시즌모드에는 육성 선수가 없다)
 *
 * ⚠️ **안 옮긴 것 — 제작진 `StrENDING[21]`**: P6 4b 는 제작진 흐름을 나리 엔딩 `0x882b4` 에만
 * 적어 두었다. 시즌 엔딩에서도 흐르는지는 문서에 없어 지어내지 않았다
 * (`widgets/season/lib/seasonEndingLayout.ts` 의 `CREDITS_TEXT_INDEX` 주석 참고).
 * ⚠️ **근사**: 지도 그리기 인자 `1` 의 뜻을 몰라 장소 표시·커서 없이 지도 한 장만 깐다.
 */
export function SeasonEndingScreen({ endingIndex, isBonusReceived = false, onBonusReceived, onFinish }: SeasonEndingScreenProps) {
  const [phase, setPhase] = useState<Phase>('엔딩')
  /**
   * 효과기 — 진입 0x6be8 6c32~6c42 가 종류 2(검정에서 밝아짐), 키 0x6b3c 6b52~6b6e 가 단계 + 1 · 종류 1(어두워짐)을 건다
   * (전역 하나라 새로 걸면 앞 것을 덮는다). 종류 1 의 끝을 본 틀에 `0x8bd8` 이 넘긴다(`onFinish`).
   * 효과기가 도는 동안은 키가 안 먹는다(`SeasonScreenFade` — 0x4b18 · 0x4b34).
   */
  const [isLeaving, setLeaving] = useState(false)

  /** 원이 화면을 다 덮으면(t ≥ 7) 연출이 끝난다 — 그 뒤로는 움직이는 것이 없다 */
  const tick = Math.min(useUpdateCounter(), ENDING_IRIS.fullTick)
  const isOpening = tick < ENDING_IRIS.fullTick
  const stage = isOpening ? ENDING_IRIS_STAGES.open : ENDING_IRIS_STAGES.reveal
  const radius = isOpening ? endingIrisRadiusOf(tick, stage.diameter) : stage.diameter
  const irisX = ENDING_IRIS.centerX + stage.dx
  const irisY = ENDING_IRIS.centerY + stage.dy

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

      {/* 배경 = 외출 지도 한 장 (0x7ea65) */}
      <img
        className={styles.sprite}
        alt=""
        src={`${MAP_FRAMES}/${String(MAP_FRAME).padStart(3, '0')}.png`}
        style={{ left: 0, top: ENDING_MAP.top }}
      />

      {/* 원형 전환 — 검정 판에 원을 뚫어 덮는다 (S9 8-2). evenodd 라 원 안쪽이 구멍이 된다 */}
      <svg
        className={styles.overlay}
        aria-label="원형 전환"
        viewBox={`0 0 ${ENDING_SCREEN.width} ${ENDING_SCREEN.height}`}
        width={ENDING_SCREEN.width}
        height={ENDING_SCREEN.height}
      >
        <path
          fillRule="evenodd"
          fill={ENDING_IRIS.cover}
          d={`M0,0H${ENDING_SCREEN.width}V${ENDING_SCREEN.height}H0Z`
            + `M${irisX - radius},${irisY}`
            + `a${radius},${radius} 0 1,0 ${radius * 2},0`
            + `a${radius},${radius} 0 1,0 ${-radius * 2},0`}
        />
      </svg>

      <div
        className={styles.endingText}
        style={{ left: SEASON_ENDING_TEXT.x, top: SEASON_ENDING_TEXT.y, width: SEASON_ENDING_TEXT.width }}
      >
        <MarkupText raw={text} />
      </div>

      {phase === '엔딩' && (
        <button
          type="button"
          className={styles.pressArea}
          aria-label="확인"
          // 키 0x6b3c — SR+0x7b 만 본다(보너스 값은 안 본다). 서 있으면 단계 1 · 종류 1 — 끝은 아래 효과기가 알린다.
          // ⚠️ 종류 1 이 끝을 세운 뒤 0x8bd8 이 그 끝을 보기 전 한 틀 사이의 키(단계 2 가 되어 넘어가지 않는다)는 옮기지 않았다
          onClick={() => {
            if (isLeaving) return
            if (isBonusReceived) setLeaving(true)
            else setPhase('보너스')
          }}
        />
      )}

      {isLeaving
        ? <SeasonScreenFade key="종류1" kind="검정에서밝아짐" onEnd={onFinish} />
        : <SeasonScreenFade key="종류2" kind="검게어두워짐" />}

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
