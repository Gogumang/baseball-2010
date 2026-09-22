/**
 * 원작 메인 메뉴 구성.
 *
 * - 글자 그림: ui/main_ui.pzx 합성 프레임 (frames/NNN.png)
 * - 설명 문구: data/StrMAINMENU.zt1 — 대괄호 안 번호가 원본 인덱스다
 * - 순서: StrMAINMENU 의 설명 순서를 그대로 따른다
 *
 * isAvailable 은 원작 여부가 아니라 **이 웹판에서 아직 만들었는지**다.
 *
 * ⚠️ `TOP_MENU` 는 지금 **아무 데서도 안 쓴다.** 웹판 메인 메뉴(`MainMenuScreen`)는 원작의 두 단
 * (처음 메뉴 → 게임시작 목록) 중 아랫단인 `GAME_START_MENU` 만 그리고, 스페셜·도움말·환경설정은
 * 화면 구석의 임시 버튼으로 연다. 그래서 여기 플래그를 켜도 아직 화면에 보이는 것은 없다 —
 * 원작대로 처음 메뉴 한 단을 되살리는 일은 따로 남아 있다.
 */
export interface MainMenuEntry {
  readonly id: string
  readonly labelFrame: number
  readonly description: string
  readonly isAvailable: boolean
}

export const TOP_MENU: readonly MainMenuEntry[] = [
  { id: '게임시작', labelFrame: 0, isAvailable: true, description: '원하는 게임모드를 선택하여!N플레이 할 수 있습니다' }, // [0]
  { id: '스페셜', labelFrame: 1, isAvailable: true, description: 'G포인트 구매 및 각종 유용한!N기능을 사용할 수 있습니다' }, // [1]
  { id: '도움말', labelFrame: 2, isAvailable: true, description: '게임에 대한 각종 도움말을!N살펴볼 수 있습니다' }, // [2]
  { id: '환경설정', labelFrame: 3, isAvailable: true, description: '게임 환경 및 조작 범위!N데이터를 관리할 수 있습니다' }, // [3]
  { id: '랭킹', labelFrame: 4, isAvailable: false, description: '게임모드 별 랭킹과 자신의!N현재 랭킹을 확인합니다' }, // [4]
  { id: '게임문의', labelFrame: 5, isAvailable: false, description: '게임문의처 및 주의사항!N을 확인할 수 있습니다' }, // [209]
]

export const GAME_START_MENU: readonly MainMenuEntry[] = [
  { id: '최근게임', labelFrame: 6, isAvailable: true, description: '마지막으로 진행한 게임!N모드를 재시작합니다' }, // [6]
  { id: '일반모드', labelFrame: 7, isAvailable: true, description: '원하는 팀을 선택해 자유롭게!N플레이하는 모드입니다' }, // [7]
  { id: '나만의리그', labelFrame: 8, isAvailable: true, description: '나만의 선수를 자유롭게 육성!N할 수 있는 모드입니다' }, // [8]
  { id: '시즌모드', labelFrame: 9, isAvailable: true, description: '우승을 목표로 1개 팀을 직접!N관리할 수 있는 모드입니다' }, // [9]
  { id: '대전모드', labelFrame: 10, isAvailable: false, description: '다른 유저의 시즌모드 팀과!N경쟁할 수 있는 모드입니다' }, // [10]
  { id: '홈런더비', labelFrame: 13, isAvailable: true, description: '홈런더비를 통해 타격감을!N향상 시킬 수 있는 모드입니다' }, // [11]
  { id: '미션모드', labelFrame: 12, isAvailable: true, description: '상황에 따라 주어진 목표를!N달성하는 모드입니다' }, // [12]
]

/** [15] 나만의리그를 새로 시작할 때 기존 저장이 있으면 묻는다. */
export const NEW_GAME_CONFIRM = '!C새로하시겠습니까?!N기존 데이터는 사라집니다.'
