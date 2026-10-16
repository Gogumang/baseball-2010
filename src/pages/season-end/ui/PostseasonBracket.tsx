import type { ReactNode } from 'react'
import { PressArea, RawScreen } from '@/shared/ui'
import { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
import type { PostseasonSeries } from '@/entities/league/model/league'

interface PostseasonBracketProps {
  readonly series: PostseasonSeries | null
  readonly onNext?: () => void
  readonly nextLabel?: string
  /**
   * 머리띠·바닥띠 — 0x853ac 는 끝(0x8585c)에서 `0x7f4ec(판)` 으로 판에 맡겨 둔 제목·바닥비트(+0xc · +0x14,
   * 장면 공통 틀이 0x7f53c 로 넣는다)를 0x54d95 로 그린다. 제목이 −1 이면 안 그린다. 대진 위·누름 칸 아래에 둔다.
   */
  readonly frame?: ReactNode
}

/**
 * 나만의리그 포스트시즌 대진표 (상태 128 의 그리기 0x168e8 → **0x853ac**).
 *
 * 시즌모드 상태 0xef(0xb7b8)와 **같은 원본 함수**라 그림은 위젯 `PostseasonBracketWindow` 하나로 그린다
 * (대진 칸은 두 길 모두 0x8533c 가 깐다 — 부르는 곳 0x693e 시즌 · 0x12110 나리).
 *
 * 다음(확인 키 0x13da0)은 원본 화면에 그림 자리가 없어 화면 전체 투명 누름 칸으로 둔다.
 */
export function PostseasonBracket({ series, onNext, nextLabel = '다음', frame }: PostseasonBracketProps) {
  return (
    <RawScreen>
      <PostseasonBracketWindow series={series} />
      {onNext !== undefined && <PressArea label={nextLabel} onPress={onNext} />}
      {frame}
    </RawScreen>
  )
}
