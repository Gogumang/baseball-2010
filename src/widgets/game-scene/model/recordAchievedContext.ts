import { createContext } from 'react'

/**
 * **경기 중 기록 달성 한 건** — 0xa77f0 이 기록 k 를 세는 그 자리 끝(a7922)에서 `0x62234(ui, k)`(기록달성 누계 해금)를 부른다.
 * 경기 화면들(`useRecordAlert` 를 쓰는 곳)은 앱이 아는 해금표·마선수 칸을 모르니 앱이 이 문맥으로 받는 쪽을 꽂는다.
 * 안 꽂으면 아무것도 안 한다.
 */
export const RecordAchievedContext = createContext<(recordId: number) => void>(() => {})
