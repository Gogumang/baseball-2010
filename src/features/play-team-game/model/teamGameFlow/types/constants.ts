/** 팀 사기 = 팀 레코드 s16 +2 = XlsTEAM_DATA 둘째 u16 (전 팀 100, `teamRecordMoraleOf`) */
export const DEFAULT_TEAM_MORALE = 100

/** 자동 진행이 끝나지 않는 상황을 막는 안전장치 (원본에는 없다) */
export const MAXIMUM_AUTO_STEPS = 2_000

export const MAXIMUM_LOG_LENGTH = 40

export const BATTING_ORDER_SIZE = 9

/** 정규 마지막 이닝의 0-기준 번호 (상태 +0x69, 기본 8) */
export const REGULATION_LAST_INNING_INDEX = 8
