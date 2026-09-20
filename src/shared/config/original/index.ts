/**
 * 원본 데이터 공개 API. 바깥 레이어는 이 배럴에서 꺼내 쓴다.
 *
 * 데이터 본문은 `data/*.json` 에 있고, 여기 TS 모듈은 타입만 입힌다.
 * 모두 tools/generate_game_data.py 가 원본 패키지에서 만든다 — 직접 고치지 말 것.
 */
export * from '@/shared/config/original/acePlayers'
export * from '@/shared/config/original/battedBallPatterns'
export * from '@/shared/config/original/burstMissions'
export * from '@/shared/config/original/bursts'
export * from '@/shared/config/original/endings'
export * from '@/shared/config/original/eventMeta'
export * from '@/shared/config/original/eventTypes'
export * from '@/shared/config/original/events'
export * from '@/shared/config/original/howto'
export * from '@/shared/config/original/items'
export * from '@/shared/config/original/mainMenu'
export * from '@/shared/config/original/missions'
export * from '@/shared/config/original/modeMenus'
export * from '@/shared/config/original/pitchPatterns'
export * from '@/shared/config/original/pitchRecords'
export * from '@/shared/config/original/pitchTypes'
export * from '@/shared/config/original/pitcherRepertoires'
export * from '@/shared/config/original/roster'
export * from '@/shared/config/original/skills'
export * from '@/shared/config/original/stadiumScene'
export * from '@/shared/config/original/teams'
export * from '@/shared/config/original/tips'
export * from '@/shared/config/original/titles'
export * from '@/shared/config/original/trainingAnimation'
export * from '@/shared/config/original/trigonometryTables'
export * from '@/shared/config/original/userEvents'
export * from '@/shared/config/original/yearGoals'
