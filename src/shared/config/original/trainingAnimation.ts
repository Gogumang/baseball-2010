/**
 * 훈련 팝업 연출 — binary.mod 에서 읽은 표 그대로다.
 *
 * 0x84664(popup, 메뉴칸) 가 로더 0xb998c(path, 2, 애니메이션번호, 0, -1) 로 PZX 애니메이션을 고른다.
 * 나만의리그 타자편(모드 4, 표 0xd497c):
 *   칸0 히트 → raise_traning_ani 1 · 칸1 파워 → raise 0 · 칸2 수비 → team_traning_ani 4
 *   칸3 주루 → team 3 · 칸4 필살타법 → raise 2
 *
 * 캐릭터(팝업+0x16c)는 칸 0·1·4 에만 겹친다 (그리기 0x848d0). 위치는 팝업 가운데 기준:
 *   칸0·4: 동작표 0xd49e8 = 0,4,5,…,12,12,12 · x = 가운데 + 0x34 · y = 바닥 − 10
 *   칸1  : 동작표 0xd4a48 = 0,4,5,6,7,7,7,7,7 · x = 가운데 + 0x37 · y = 바닥 − 2
 * 동작표는 연출의 몇 번째 칸인지(currentFrame)로 고른다: pose = table[min(칸, 길이−1)].
 * 수비·주루 연출(team)은 선수가 프레임 그림 안에 들어 있어 따로 그리지 않는다.
 *
 * **아직 못 읽은 것**: 팝업 사각형 크기·배경(0x94a65), 연출의 세로 보정값,
 * 동작표 번호 → 캐릭터 그림 대응(0x79525), 갱신 한 번의 밀리초.
 */
export type TrainingAnimationFile = 'raise_traning_ani' | 'team_traning_ani'

export interface TrainingFigure {
  /** 연출 칸 번호로 고르는 캐릭터 동작 번호 */
  readonly poses: readonly number[]
  /** 팝업 가운데에서 오른쪽으로 */
  readonly offsetX: number
  /** 팝업 바닥에서 위로 */
  readonly liftY: number
}

export interface TrainingPresentation {
  readonly file: TrainingAnimationFile
  readonly animation: number
  readonly figure: TrainingFigure | null
}

const HIT_FIGURE: TrainingFigure = { poses: [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12], offsetX: 0x34, liftY: 10 }
const POWER_FIGURE: TrainingFigure = { poses: [0, 4, 5, 6, 7, 7, 7, 7, 7], offsetX: 0x37, liftY: 2 }

export const TRAINING_PRESENTATION_OF: Readonly<Record<string, TrainingPresentation>> = {
  히트: { file: 'raise_traning_ani', animation: 1, figure: HIT_FIGURE },
  파워: { file: 'raise_traning_ani', animation: 0, figure: POWER_FIGURE },
  수비: { file: 'team_traning_ani', animation: 4, figure: null },
  주루: { file: 'team_traning_ani', animation: 3, figure: null },
  필살타법: { file: 'raise_traning_ani', animation: 2, figure: HIT_FIGURE },
}

/**
 * 팝업이 떠 있는 갱신 횟수. 0x84634(this, 31, 60) 가 게이지 끝을 60 으로 두고
 * 갱신마다 60/31(=1) 씩 채운다 — 60번 갱신하면 가득 차서 팝업이 닫힌다.
 */
export const TRAINING_POPUP_UPDATES = 60

export function animationFolderOf(file: TrainingAnimationFile): string {
  return `./sprites/${file}/frames`
}
