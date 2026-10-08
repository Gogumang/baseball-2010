import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import * as styles from '@/pages/title/ui/BootScreen.css'

/** 0xce904 — 원문 그대로 (CP949) */
export const USAGE_NOTICE_TEXT =
  '!C !cFF0000<이용안내>!N!N이 게임은 게임 이용 시!N별도의 비용이 발생하지!N않는 단독형 게임입니다.!N안심하고 이용하세요.!N!N'
  + '단, 서버 접속 시 통화료!N와 G포인트, 명예의전당!N슬롯 구매 시 정보이용료!N가 발생합니다.'
/** 0xce8e4 — 원문 그대로 */
export const USAGE_NOTICE_PROMPT = '!C !cFF0000아무키나 누르세요!!'

/** 본문 y = H/2 − 0x50 = 80 · 안내 y = H − 40 = 280 (0x2cb1e · 0x2cb6c) */
const BODY_Y = 80
const PROMPT_Y = 280
/** 안내는 상태 틱 [this+0x2c] 를 5 로 나눈 나머지가 0 이 아닐 때만 그린다 (0x2cb3c `0xca911(틱, 5)`) */
const PROMPT_PERIOD = 5

interface UsageNoticeScreenProps {
  /** 갱신 0x245dc — 키가 있으면 0xbcb49(this+0x18, 2) 로고 화면으로 */
  readonly onNext: () => void
}

/**
 * **켤 때 첫 화면 `<이용안내>`** — 장면 0x103 하위 0x2a. 생성자 0x234d4 가 `[0x140006c]` = −1(켤 때) 이고 앞 상태가 0 이면 여기서 연다
 * (그 밖에는 곧장 하위 2 로고). 진입 함수는 없다(진입 표 0xcf06c 는 0x27 까지).
 * 그리기 0x2cabc: 흰 바탕 → 0xba269(0xce904, x 20, y 80, 폭 200, 검정) → 틱 % 5 ≠ 0 이면 0xba269(0xce8e4, x 20, y 280, 폭 200).
 * ⚠️ 근사: 글꼴·줄 간격은 웹 글자로 둔다 (원본 줄 배치 0x6ef4d 는 안 옮겼다 — 줄은 원문 !N 그대로다).
 */
export function UsageNoticeScreen({ onNext }: UsageNoticeScreenProps) {
  const tick = useUpdateCounter()
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  useEffect(() => {
    // 갱신 0x245dc 는 키 값이 0 이 아니기만 하면 넘어간다 — 아무 키나
    const onKeyDown = () => onNextRef.current()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen onPress={() => onNextRef.current()}>
      <div className={styles.whiteBackground} />
      <div className={styles.textBox} style={{ top: BODY_Y }}>
        <MarkupText raw={USAGE_NOTICE_TEXT} />
      </div>
      {tick % PROMPT_PERIOD !== 0 && (
        <div className={styles.textBox} style={{ top: PROMPT_Y }}>
          <MarkupText raw={USAGE_NOTICE_PROMPT} />
        </div>
      )}
    </RawScreen>
  )
}
