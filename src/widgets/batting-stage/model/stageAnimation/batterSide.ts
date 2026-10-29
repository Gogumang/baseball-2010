import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/**
 * 손 0xb63c0 (0 우타 · 1 좌타) — 그림 반전과 앵커·존 칸을 고른다 (R6 4절). 타석 교대 0x47d58~0x47d70 이 장면 +0x17e1 ·
 * 그림 +0x48 · +0x60 에 같은 0xb63c1(타자)를 쓴다 — 마타자는 표 0xd88b0, 그 밖은 폼 & 1
 */
export function batterSideNow(loop: StageLoop): number {
  const latest = loop.refs.latestRef.current
  return latest.batterHand ?? batterSideOfForm(latest.batterForm)
}
