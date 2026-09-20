import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  HELL_TRAINING_GAME_POINT, HELL_TRAINING_INDEX, TEAM_ABILITY_LABELS, TRAINING_SLOTS,
  checkSeasonTraining,
} from '@/widgets/season/lib/seasonTraining'
import type { TrainingRefusal, TrainingSlot } from '@/widgets/season/lib/seasonTraining'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

/**
 * 가드 거절 글 — 원본 StrMODE id 는 주석에 적었다.
 * ⚠️ **문구는 근사**다: 웹에 StrMODE 표가 없고 문서도 번호와 뜻만 적었다 (J 4-6).
 */
const REFUSAL_TEXT: Readonly<Record<TrainingRefusal, (names: readonly string[]) => string>> = {
  사기없음: () => '사기가 0이라 트레이닝을 할 수 없습니다', // StrMODE[193]
  G부족: () => `G포인트가 부족합니다!N지옥훈련에는 ${HELL_TRAINING_GAME_POINT}G가 필요합니다`, // StrMODE[65]
  능력치최대: (names) => `[${names.join(', ')}] 능력치가 최대입니다`, // StrMODE[192]
}

/**
 * 확인 팝업 — 원본은 `0xbbef8(buf, 2, 0x11, 1)`(칸 0~3) · `0xbbef8(buf, 2, 0x12, 1)`(지옥훈련)
 * 로 예/아니오 두 칸짜리를 띄운다 (R13 5절). 지옥훈련 쪽은 앞줄에 **StrMODE[141] "지옥훈련 500G"**
 * 를 채워 넣는 것까지 확정이고, ⚠️ **나머지 문구는 근사**다.
 */
const CONFIRM_TEXT = (slot: TrainingSlot): string =>
  slot === '지옥훈련'
    ? `!C지옥훈련 ${HELL_TRAINING_GAME_POINT}G!N진행하시겠습니까?`
    : `!C[${slot}] 트레이닝을 진행하시겠습니까?`

export interface SeasonTrainingScreenProps {
  readonly state: SeasonState
  /**
   * 저장+0x64 **G 포인트**. 시즌 레코드(SR)가 아니라 전역 저장 칸이라 `SeasonState` 에 없다 —
   * 지옥훈련 가드(StrMODE[65])와 값 표시에만 쓴다. 저장 쪽 모델이 생기면 그것을 넘기면 된다.
   */
  readonly gamePoints: number
  /**
   * 칸을 골라 확인까지 마쳤다.
   *
   * 원본은 여기서 **연출 0xde**(훈련 애니, R13 5절)로 넘어가 애니가 끝나면 굴림 `0xc074` →
   * 적용 `0xa2f24` → 결과 팝업 0x13 → 관리 메뉴 0xc9 로 돌아온다. 굴림에는 난수가 필요해
   * 이 화면에서 하지 않는다 — 표(`widgets/season/lib/seasonTraining.ts`)를 보고 부르는 쪽이 한다.
   */
  readonly onTrain: (slot: TrainingSlot, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 시즌 팀 트레이닝 화면 (장면 0x105 상태 **0xcf**, 갱신 0x4740 · 키 **0x9108** · 그리기 0xa0e4).
 *
 * 칸 0~3 = 팀 능력치 투구·타격·집중·근성(팀 레코드 +4..+0xa), 칸 4 = **지옥훈련 500G**
 * (J 4-6 확정). 가드 순서·값은 `widgets/season/lib/seasonTraining.ts` 가 가진다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xcf 의 그리기(0xa0e4)는 **공통 틀**(커맨드 줄 0x7e418 +
 * 상태판 0x7d34c + 가운데 판 0x7f814 + 바탕 0x7f4ec, R13 1절) 뿐이라 칸 줄의 좌표가 없다.
 * 그래서 다른 시즌 화면들과 같은 공용 판 (24, 54, 192, 212) 목록으로 그린다.
 *
 * ⚠️ **SR+4(행동함)를 세우는 자리는 문서에 없다**: 외출은 결과 0xc81c 끝에서 세우는 것이 확정인데
 * (P4 3절), 트레이닝 적용 `0xa2f24` 에는 그런 줄이 적혀 있지 않다. 관리 메뉴 갱신 0x4efc 가
 * SR+4 로 **트레이닝·외출 두 칸을 함께** 끄는 것을 보면 트레이닝도 세우는 것이 맞겠지만,
 * 그 자리를 확인하지 못해 이 화면은 손대지 않는다 — 부르는 쪽이 정한다.
 */
export function SeasonTrainingScreen({ state, gamePoints, onTrain, onBack }: SeasonTrainingScreenProps) {
  const { record, teamMorale, teamAbilities } = state
  const abilities = teamAbilities[record.teamId] ?? []
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<number | null>(null)

  const rows: readonly SeasonListRow[] = TRAINING_SLOTS.map((label, index) => ({
    id: label,
    label,
    // 능력치 칸은 지금 값을, 지옥훈련 칸은 StrMODE[141] 의 값(500G)을 오른쪽에 적는다
    value: index === HELL_TRAINING_INDEX ? `${HELL_TRAINING_GAME_POINT}G` : String(abilities[index] ?? 0),
  }))

  const select = (index: number) => {
    const checked = checkSeasonTraining({ abilities, teamMorale, gamePoints }, index)
    if (!checked.ok) {
      setNotice(REFUSAL_TEXT[checked.reason ?? '사기없음'](checked.maxedAbilities ?? []))
      return
    }
    // ⚠️ 지옥훈련은 일부 능력치가 최대여도 그대로 진행한다 (넷 다 최대일 때만 거절) — 원본 그대로.
    // 최대인 칸을 알려 주기만 하고 확인 팝업으로 넘어간다.
    if (checked.maxedAbilities !== undefined && checked.maxedAbilities.length > 0) {
      setNotice(REFUSAL_TEXT.능력치최대(checked.maxedAbilities))
    }
    setQuestion(index)
  }

  const { cursor, moveTo } = useSeasonCursor({
    count: rows.length,
    onSelect: select,
    onCancel: onBack,
    isEnabled: notice === null && question === null,
  })

  return (
    <RawScreen>
      <SeasonListWindow
        title="트레이닝"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onBack}
        footer={
          `${TEAM_ABILITY_LABELS.join('·')} 는 팀 전체 능력치에 영향을 준다` +
          `\n지옥훈련은 네 능력치를 한꺼번에 올린다 (${HELL_TRAINING_GAME_POINT}G)` +
          `\nG포인트 : ${gamePoints}`
        }
      />
      <SeasonStatusBar record={record} teamMorale={teamMorale} />

      {notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
      {notice === null && question !== null && (
        <MessageBox
          text={CONFIRM_TEXT(TRAINING_SLOTS[question])}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            const slot = question
            setQuestion(null)
            if (answer === 0) onTrain(TRAINING_SLOTS[slot], slot)
          }}
        />
      )}
    </RawScreen>
  )
}
