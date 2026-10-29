import { atom } from 'jotai'
import type { LeaderKind } from '@/entities/awards/model/leaderboard'
import { type SeasonEventCursor, START_SEASON_EVENT_CURSOR } from '@/entities/season-mode/model/seasonEventFlow'

/**
 * 이벤트 관리자 칸 atom — 그림에 안 쓰고 콜백 · effect 만 읽고 쓰는 칸(옛 ref). 구독하지 않으므로 써도 다시 그리지 않는다.
 */

/**
 * 이벤트 관리자 읽기 객체의 커서(+0x28 · +0x2c) — 관리자는 장면 0x105 를 만들 때(0x3b14) 새로 생긴다.
 * 웹은 세션이 서는 때와 경기를 마치고 돌아오는 때(`finishGame`)를 그 자리로 본다.
 */
export const eventCursorAtom = atom<SeasonEventCursor>(START_SEASON_EVENT_CURSOR)
/** 이벤트 재생 일련번호 — 같은 이벤트를 다시 틀어도 화면이 새 재생으로 본다 */
export const playbackSerialAtom = atom(0)
/** 결산 진입 일련번호 (`SeasonSummaryEntry.serial`) */
export const summaryEntrySerialAtom = atom(0)
/**
 * 새 선수 플래그 this+0xf9 — 장면을 만들 때 0(0x401e), 진입 분기 0xcb 가 **새 시즌 초기화 0xcc 에서 왔을 때만** 1
 * (4c5a~4c78). 웹은 팀을 고른 직후(`chooseTeam`)가 그 자리다. 관리 메뉴 첫 폴링이 400 을 틀고 지운다.
 */
export const newPlayerFlagAtom = atom(false)
/**
 * mgr+0x304 — 장면 0x105 셋업 0x3b14 가 1, 관리 메뉴 0xc9 의 확인 키(0x8f82 — −5 · '5')만 0. 폴링 0x8be80 이 reader+0x34 로
 * 베껴 판정의 490 쿨다운 검사(ad00e~ad054)를 건너뛰게 한다. 웹은 세션이 서는 때 · 들어와 장면을 세울 때(`constructScene`) ·
 * 경기를 마치고 돌아오는 때를 셋업으로 본다
 */
export const freshSceneAtom = atom(true)
/** 0xed 진입 0xe7ac → 0x8dd60 이 굴린 시즌 MVP 순위 종류(표 0xd4f34 의 rand(0..6)) — 376 창 · 378/379 가 읽는다 */
export const seasonMvpKindAtom = atom<LeaderKind | null>(null)
