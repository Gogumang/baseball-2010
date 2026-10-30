/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱을 0 으로 세어 틱 0·1·2 셋을 거른다 (홈런더비 `CONFIRM_LOCK_FRAMES` 와 같은 값·같은 근거).
 */
export const SCENE_CONFIRM_LOCK_FRAMES = 3

/**
 * 0xd(타석 준비)에 머무는 갱신 수 — 갱신 0x39e14 는 `틱 > 0 && 점수판 [+0xf10]+0x6c ≠ 1` 이면 0xe 를 예약하고(다음 틱에 옮긴다),
 * 점수판 +0x6c 는 1 이 되는 일이 없어 늘 두 그림 머문다 (4c09530 확정). 0xd 의 OK 는 사람 조작 0x536bc 의 점프표(0xe~0x1a)
 * 밖이라 아무 일도 없다.
 */
export const SCENE_PREPARE_FRAMES = 2

/** 대기가 보이기 시작해 OK 를 처음 받을 수 있게 되기까지 — 0xd 두 그림 + 0xe 잠금 세 그림 */
export const SCENE_CONFIRM_READY_FRAMES = SCENE_PREPARE_FRAMES + SCENE_CONFIRM_LOCK_FRAMES

/** 강판 지나감의 0xe — 그리기 표가 0x4d9ec 를 한 번 돈 뒤 다음 틀 0xbc9c8 이 0x23 으로 옮긴다 */
export const HOOK_PASSAGE_CONFIRM_FRAMES = 1
