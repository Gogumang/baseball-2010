import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'

/** 트레이닝·외출·다음경기 칸 번호 (점프표 0xcbe40 의 2·3·5) */
const TRAINING_INDEX = 2
const OUTING_INDEX = 3
const NEXT_GAME_INDEX = 5

/**
 * 0x4efc 가 끄는 칸 — 메뉴 켬 표(메뉴 +0x28) 를 0 으로: SR+4(행동함) 면 칸 2·3, SR+0x1bc(엔딩 본 시즌) 면 칸 2·3·5.
 * 꺼진 칸은 커맨드 줄이 흑백(0xc37a8)으로 그린다.
 *
 * **다시 켜는 곳은 장면을 새로 지을 때뿐이다**(직접 떴다): 장면 0x105 생성 0xfe58 → 0xf684 가 메뉴 [this+0x70] 을 만들고
 * vt+0x1c = 0x6c4bc 가 켬 표를 (행 × 열) 바이트로 새로 잡아 memset(1) 한다. 0x4efc 는 끄기만 한다. SR+4 는 경기 정산
 * (0x4f158 — 장면 0x104)에서 지워지고 경기 뒤에는 장면 0x105 를 새로 지으므로, 들어올 때 레코드로 정하는 이 식과 같다.
 */
export function disabledManagementIndexesOf(record: SeasonState['record']): readonly number[] {
  const disabled = new Set<number>()
  if (record.acted) [TRAINING_INDEX, OUTING_INDEX].forEach((index) => disabled.add(index))
  if (record.endingSeen) [TRAINING_INDEX, OUTING_INDEX, NEXT_GAME_INDEX].forEach((index) => disabled.add(index))
  return [...disabled].sort((a, b) => a - b)
}
