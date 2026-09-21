import { useState } from 'react'
import { Button, MessageBox } from '@/shared/ui'
import {
  MATCH_SETTING_KIND,
  hasAnyDetailSelection,
} from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  CHANCE_VALUE_TEXTS,
  DETAIL_CONFIRM_ROW,
  DETAIL_ROW_TEXTS,
  INNING_VALUE_TEXTS,
  SETTINGS_CONFIRM_TEXT,
  SETTINGS_EMPTY_TEXT,
  SETTING_KIND_TEXTS,
} from '@/pages/general-mode/lib/matchSettingsText'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

export interface MatchSettingsWindowProps {
  /** 창을 열 때 저장(모드 칸 m = 0, 일반)에서 복사해 온 값 — 0x5fef4 */
  readonly settings: MatchProgressSettings
  /** 확인창에서 "예" — 저장 칸에 되쓴다 (0x60376) */
  readonly onConfirm: (settings: MatchProgressSettings) => void
  /** CLR — 창만 닫는다. **저장하지 않는다** */
  readonly onCancel: () => void
}

/** 상세 네 줄이 건드리는 칸 — 줄 번호 0~3 순서다 */
const DETAIL_FIELDS = [
  'battingOrderBits',
  'offenseRunnerBits',
  'pitchingInningBits',
  'defenseRunnerBits',
] as const

const toggleBit = (value: number, bit: number) => value ^ (1 << bit)

/**
 * **경기진행 설정 창** — 경기정보(상태 22)에서 `0`, **일반모드(모드 1)에서만** 열린다
 * (0x31432 `cmp r3,#1`. 여는 함수 0x5fef4 · 그리기 0x6042c · 키 0x5ffcc. R4 4절 확정).
 *
 * 두 단계다:
 *   - 단계 0 — 종류 고르기 (0 찬스 · 1 이닝 · 2 상세). OK 로 단계 1 로 가며 **값을 0 으로 되돌린다**
 *   - 단계 1 — 값 고르기. OK 면 StrMAINMENU[125] 확인창, 예 → 저장
 *     상세는 줄 4(확인)에서 네 값이 모두 0 이면 StrMAINMENU[126] 로 막는다
 *
 * ⚠️ 원본 배치 미해독 — 근사: 창 좌표 `0x6042c` 는 R4 "남은 것" 에 있다. 글과 규칙만 옮기고
 *    배치는 공용 판 192 폭만 빌렸다.
 * ⚠️ 설정의 **뜻**(어느 타석을 사람이 잡는가)은 여기가 아니라
 *    `features/play-team-game/model/matchSettings.ts` 가 가진다 — 이 창은 값만 고친다.
 */
export function MatchSettingsWindow({ settings, onConfirm, onCancel }: MatchSettingsWindowProps) {
  const [draft, setDraft] = useState<MatchProgressSettings>(settings)
  const [phase, setPhase] = useState(0)
  const [detailRow, setDetailRow] = useState(0)
  /** 뜨는 팝업 — 확인창 또는 "최소 한가지" 안내 */
  const [popup, setPopup] = useState<'확인' | '최소한가지' | null>(null)

  const chooseKind = (kind: number) => {
    // 단계 1 로 갈 때 값을 0 으로 되돌린다 (0x5ffcc 단계 0 의 OK)
    setDraft((previous) => ({ ...previous, kind, value: 0 }))
    setDetailRow(0)
    setPhase(1)
  }

  const askConfirm = () => {
    if (draft.kind === MATCH_SETTING_KIND.상세 && !hasAnyDetailSelection(draft)) {
      return setPopup('최소한가지')
    }
    setPopup('확인')
  }

  const back = () => {
    if (phase === 1) return setPhase(0)
    onCancel()
  }

  return (
    <div className={styles.settingsWindow} role="dialog" aria-label="경기진행 설정">
      {phase === 0 ? (
        <>
          <h2 className={styles.settingsHeading}>경기진행 설정</h2>
          {SETTING_KIND_TEXTS.map((kindText, kind) => (
            <div key={kindText.name} className={styles.settingsRow}>
              <button
                type="button"
                aria-pressed={draft.kind === kind}
                className={`${styles.settingsOption} ${draft.kind === kind ? styles.settingsOptionSelected : ''}`}
                onClick={() => chooseKind(kind)}
              >
                {kindText.name}
              </button>
              <span className={styles.settingsDescription}>{kindText.description}</span>
            </div>
          ))}
        </>
      ) : draft.kind === MATCH_SETTING_KIND.찬스 ? (
        <>
          <h2 className={styles.settingsHeading}>{SETTING_KIND_TEXTS[MATCH_SETTING_KIND.찬스].name}</h2>
          {CHANCE_VALUE_TEXTS.map((description, value) => (
            <div key={description} className={styles.settingsRow}>
              <button
                type="button"
                aria-pressed={draft.value === value}
                className={`${styles.settingsOption} ${draft.value === value ? styles.settingsOptionSelected : ''}`}
                onClick={() => setDraft((previous) => ({ ...previous, value }))}
              >
                {value === 0 ? '공격' : '수비'}
              </button>
              <span className={styles.settingsDescription}>{description}</span>
            </div>
          ))}
        </>
      ) : draft.kind === MATCH_SETTING_KIND.이닝 ? (
        <>
          <h2 className={styles.settingsHeading}>{SETTING_KIND_TEXTS[MATCH_SETTING_KIND.이닝].name}</h2>
          {INNING_VALUE_TEXTS.map((inning, value) => (
            <div key={inning.name} className={styles.settingsRow}>
              <button
                type="button"
                aria-pressed={draft.value === value}
                className={`${styles.settingsOption} ${draft.value === value ? styles.settingsOptionSelected : ''}`}
                onClick={() => setDraft((previous) => ({ ...previous, value }))}
              >
                {inning.name}
              </button>
              <span className={styles.settingsDescription}>{inning.description}</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <h2 className={styles.settingsHeading}>{SETTING_KIND_TEXTS[MATCH_SETTING_KIND.상세].name}</h2>
          {DETAIL_ROW_TEXTS.map((row, rowIndex) => {
            const field = DETAIL_FIELDS[rowIndex]
            const bits = draft[field]
            return (
              <div key={row.name} className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>{row.name}</span>
                {Array.from({ length: row.cells }, (_unused, cell) => {
                  const isOn = ((bits >> cell) & 1) !== 0
                  return (
                    <button
                      key={cell}
                      type="button"
                      aria-label={`${row.name} ${cell + 1}`}
                      aria-pressed={isOn}
                      className={`${styles.settingsOption} ${isOn ? styles.settingsOptionOn : ''}`}
                      onClick={() => {
                        setDetailRow(rowIndex)
                        setDraft((previous) => ({ ...previous, [field]: toggleBit(previous[field], cell) }))
                      }}
                    >
                      {cell + 1}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <p className={styles.settingsDescription}>
            {DETAIL_ROW_TEXTS[detailRow]?.meaning ?? DETAIL_ROW_TEXTS[0].meaning}
          </p>
        </>
      )}

      <div className={styles.settingsActions}>
        {phase === 1 && (
          <Button variant="corner" onClick={() => { setDetailRow(DETAIL_CONFIRM_ROW); askConfirm() }}>
            확인
          </Button>
        )}
        <Button variant="corner" onClick={back}>되돌아가기</Button>
      </div>

      {popup === '최소한가지' && (
        <MessageBox text={SETTINGS_EMPTY_TEXT} buttons={['OK']} onAnswer={() => setPopup(null)} />
      )}
      {popup === '확인' && (
        <MessageBox
          text={SETTINGS_CONFIRM_TEXT}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            setPopup(null)
            if (index === 0) onConfirm(draft)
          }}
        />
      )}
    </div>
  )
}
