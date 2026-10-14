import * as styles from '@/widgets/game-scene/ui/GameScene.css'

interface OkTapAreaProps {
  readonly onTap: () => void
  /** 원본이 OK 를 안 받는 동안(경기 끝 판 처음 10틱 등) */
  readonly disabled?: boolean
}

/**
 * **OK 키 대신 화면을 누르는 칸** — 원본은 OK 키(−5 · '5')만 받고 화면에 단추가 없다.
 * 마우스 · 손가락으로도 넘길 수 있게 화면 전체를 덮는 투명한 칸을 둔다(웹 전용, 그리는 것은 없다).
 */
export function OkTapArea({ onTap, disabled = false }: OkTapAreaProps) {
  return (
    <button type="button" className={styles.okTapArea} disabled={disabled} onClick={onTap}>
      확인
    </button>
  )
}
