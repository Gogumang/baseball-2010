import { MarkupText, PressArea } from '@/shared/ui'
import { useWholeScreenOffset } from '@/shared/lib/screenShake/useWholeScreenOffset'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import {
  BURST_NEXT_MARK_IMAGE,
  burstLineIndexOf,
  burstNextMarkAt,
  burstPortraitAnchorOf,
  burstShakeOffsetOf,
  burstSpeakerPrefixOf,
  burstTextBoxOf,
  isBurstWindowOpen,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import * as styles from '@/widgets/burst-mission/ui/BurstMissionWindow.css'
import { BurstPortrait } from '@/widgets/burst-mission/ui/burstMissionWindow/BurstPortrait'
import { BurstWindowBand } from '@/widgets/burst-mission/ui/burstMissionWindow/BurstWindowBand'
import { useBurstWindowClock } from '@/widgets/burst-mission/ui/burstMissionWindow/useBurstWindowClock'
import { useBurstWindowClose } from '@/widgets/burst-mission/ui/burstMissionWindow/useBurstWindowClose'

interface BurstMissionWindowProps {
  /**
   * 그 행의 `_TEXT` 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효.
   * `ORIGINAL_BURST_TABLES[표].lines[행]` 을 그대로 넘기면 된다.
   */
  readonly lines: readonly OriginalBurstLine[]
  /**
   * `null` 이면 **제안** 모습(발동한 순간, 줄 0), 아니면 **결과** 모습이다.
   * `resolveBurst` 가 돌려주는 판정을 그대로 넘긴다.
   */
  readonly judgement: BurstJudgement | null
  /**
   * 판정이 난 행 — 결과를 닫을 때 공용 창에 띄울 보상 글(0x8e5b8)을 짓는다. 없으면 창을 안 띄운다.
   * `resolveBurst` 의 `row` 를 그대로 넘긴다.
   */
  readonly row?: BurstMissionRow | null
  /** 지금 타자가 좌타인가 — 0xb63c0(지금 타자). 초상이 왼쪽에 뒤집혀 선다. 안 넘기면 우타 */
  readonly isBatterLeftHanded?: boolean
  /** 대사 안 %s 를 순서대로 채울 값 */
  readonly replacements?: readonly string[]
  /** 창을 닫고 다음으로 간다 — 제안이면 타석(상태 0xf), 결과면 보상 적용 뒤 원래 흐름 */
  readonly onClose: () => void
}

/**
 * **돌발미션 창** — 경기 장면 상태 0x1b (그리기 0x8f3c0 · 갱신 0x8e5b8 — 배치 · 차례는 `lib/burstMissionWindowLayout` 머리글).
 *
 * 대사를 실은 뒤 판이 아래에서 오르고(0 → 2 → 6 → 14 → 30 → 55), 다 오르면 화면이 세 그림 위아래로 흔들린 뒤(+1 · −1 · +1)
 * 화자 이름 머리와 대사 · 넘김 표시가 나온다. 그때부터 아무 키나 받아 닫는다(원본 키 [장면+0x40] 은 키를 가리지 않는다).
 * 결과(성공 · 실패)를 닫을 때 보상 글을 공용 창 [0x140005c] 에 띄운다(0x74ef5).
 *
 * 효과음(제안 0x2a · 성공 0x24 · 실패 0x20 · 무효 0x25)은 싣는 쪽(발동 0x8f000 · 판정 0x8f414)이 낸다 — 이 창 몫이 아니다.
 *
 * 넘김 표시 위아래 차례 [+0x224] 는 경기 내내 이어 센다 — 창은 `burstObjectTicks` 에서 이어 받고 돌려 적는다(r181 확정).
 * ⚠️ 유력: 초상 깃발 0x11 을 좌우 뒤집기로 본 것(엔딩 · 제작진과 같은 읽기, `FramePiece`).
 */
export function BurstMissionWindow({
  lines,
  judgement,
  row = null,
  isBatterLeftHanded = false,
  replacements = [],
  onClose,
}: BurstMissionWindowProps) {
  const line = lines[burstLineIndexOf(judgement)]
  const { state, draws, stateRef } = useBurstWindowClock()
  useWholeScreenOffset(burstShakeOffsetOf(state))
  const closeRef = useBurstWindowClose(stateRef, judgement, row, onClose)

  const isOpen = isBurstWindowOpen(state)
  const textBox = burstTextBoxOf(state.height)
  const nextMark = burstNextMarkAt(state.ticks)

  return (
    // 겹 차례 — 경기 화면의 누름 칸(PressArea 7: 다음 타석 OK 대기 0xe 의 '확인' · 도루 · '*')보다 위다. 결과 창이 설 때 다음 타석의
    // 0xe 대기가 이미 실려 화면 전체 '확인' 칸(창 동안은 꺼짐)이 서는데, 이 창(예전 5)이 그 아래라 클릭 · 탭이 꺼진 칸에 먹혔다(r195)
    <div
      className={styles.overlay}
      style={{ zIndex: SCREEN_LAYERS.SCENE_WINDOW }}
      role="dialog"
      aria-label="돌발미션"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {line !== undefined && (
        <BurstPortrait
          speaker={line.speaker}
          expression={line.expression}
          draws={draws}
          anchor={burstPortraitAnchorOf(state.height, isBatterLeftHanded)}
        />
      )}
      <BurstWindowBand height={state.height} />
      {isOpen && line !== undefined && (
        <>
          <div className={styles.dialogue} style={{ left: textBox.x, top: textBox.y, width: textBox.width }}>
            <MarkupText raw={burstSpeakerPrefixOf(line.speaker) + line.text} replacements={replacements} />
          </div>
          <img className={styles.sprite} style={{ left: nextMark.x, top: nextMark.y }} src={BURST_NEXT_MARK_IMAGE} alt="" />
        </>
      )}
      {/* 0x8e60c — 열린 뒤(c = −1)에는 키를 가리지 않고 닫는다. 누름도 아무 키와 같은 길이라 화면 어디를 눌러도 닫는다(Enter 와 같다) */}
      <PressArea label="돌발미션 넘기기" onPress={() => closeRef.current()} isDisabled={!isOpen} testId="돌발미션-넘기기" />
    </div>
  )
}
