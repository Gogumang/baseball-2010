# 원본 데이터 (JSON)

원본 패키지에서 뽑은 대사·에피소드·문자열 데이터다. `tools/generate_game_data.py` 가 만든다 —
**직접 고치지 말고 생성기를 고칠 것.** 같은 폴더의 TS 모듈은 이 JSON 을 읽어 타입만 입힌다.

| 파일 | 원본 | 내용 |
|---|---|---|
| `events.json` | `data/r_event.zt1` + `r_event_txt` | 이벤트(에피소드) 스크립트 — 대사·화자·초상화·선택지·조건·보상 |
| `userEvents.json` | `StrUSER_EVT` | 경기 후 평가·목표·연속 기록 문구 |
| `howto.json` | `StrHOWTO` | 게임 내 설명서 |
| `tips.json` | `StrTIP` | 불러오기 화면 도움말 |
| `titles.json` | `StrNICKNAME` | 칭호 이름과 획득 조건 문구 |
| `endings.json` | `StrENDING` | 엔딩 대사 |
| `items.json` | `StrITEM` | 아이템 이름·효과·히든 힌트 |
| `skills.json` | `StrCOMMON` + `StrSKILL` | 스킬 40종 (이름·소개·효과·대상) |
| `roster.json` | `XlsBATTER_DATA` · `XlsPITCHER_DATA` | 일반 선수 명단과 능력치 |
| `burstMissions.json` | `Xls{BATTER,PITCHER,SEASON}_BURST` + `_TEXT` | 돌발미션 140행 (조건·목표·보상 원시 16바이트, 대사 4줄) |

## events.json 한 편의 모양

```jsonc
{
  "id": 451,
  "audience": 0,      // 0 코드가 직접 부름 · 1 공통 · 2 타자 · 3 투수
  "repeatable": false,
  "trigger": 0,       // 0 관리 화면 · 1 외출 지도 · 2~6 장소
  "requiresEvent": 0, // 이 이벤트를 본 뒤에만
  "dateFrom": [0, 0], // [연차, 경기 번호] 범위. [0,0]~[0,0] 이면 언제든
  "dateTo": [0, 0],
  "conditions": [{ "type": 18, "value": 600 }], // 0~3 능력치 · 18 인기도 · 19 평판 · 22 질병 · 24/25 봤음/안봤음
  "commands": [
    { "op": "say", "text": "...", "speaker": 24, "format": 1, "portraits": [] },
    { "op": "choice", "choices": [{ "text": "...", "gotoEvent": 452 }], "portraits": [] },
    { "op": "yesno", "text": "...", "yesEvent": 1, "noEvent": 2 },
    { "op": "reward", "items": [{ "kind": 10, "value": 500 }] },
    { "op": "match", "team": 16, "resultEvents": [114, 115] }
  ]
}
```

명령 종류와 보상 종류의 뜻은 `src/shared/config/original/eventTypes.ts` 와
`src/entities/story/model/eventReward.ts` 주석에 원본 주소와 함께 적어 두었다.

## 쓰는 쪽

바깥 레이어는 배럴 하나로 꺼내 쓴다.

```ts
import { ORIGINAL_EVENTS, ORIGINAL_SKILLS, BATTERS } from '@/shared/config/original'
```
