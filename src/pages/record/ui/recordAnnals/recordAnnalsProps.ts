import type { ReactNode } from 'react'
import type { Collection } from '@/entities/collection/model/collection'
import type { SecretCodeState } from '@/pages/record/lib/statCells'

export interface RecordAnnalsProps {
  readonly collection: Collection
  readonly onBack: () => void
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
  /**
   * 비밀 번호 상태 — 원본은 메뉴 객체에 있어 이 화면보다 오래 산다(메뉴 생성 0x234d4 만 지운다).
   * 들고 있는 쪽이 넘기며, 이 화면은 들어올 때 버퍼만 비운다(0x2407c). 안 넘기면 화면 안에서 센다.
   */
  readonly secretCode?: SecretCodeState
  readonly onSecretCodeChange?: (next: SecretCodeState) => void
  /**
   * 판 아래 바탕 — 그리기 0x2e29c 는 맨 앞(0x2e2b6)에 메뉴 바탕 0x58371(skin, [this+0x90], 0) 을 깐다.
   * 그 그림은 스페셜 쪽(`SkinBackdrop` "메뉴바탕")이 들고 있어 부르는 쪽이 넘긴다. 안 넘기면 검정이다
   */
  readonly underlay?: ReactNode
}
