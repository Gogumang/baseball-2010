# 공통 지침 (binary.mod 역분석)

프로젝트: /Users/evan123/Desktop/code/baseball-2010 — 2009년 WIPI 폰게임 "게임빌 2010 프로야구"를 웹(React/TS)으로 이식 중.
원본 실행 파일: base/work/jar/binary.mod (ARM ELF, 심볼 없음, Thumb 코드). 원본 데이터: base/work/jar/data/*, 문자열표 JSON: base/extracted/*.json
웹판 원본 데이터: src/shared/config/original/ (events.json = r_event 해독 결과, 이미 끝남)
그간의 해독 기록: RALPH_PROGRESS.md (1000줄). 주제 관련 부분을 grep 해서 먼저 읽고, 이미 알아낸 주소에서 출발할 것.

## 도구
디스어셈 도우미: /private/tmp/claude-501/-Users-evan123-Desktop-code-baseball-2010/a8d7dac6-6002-4b07-af77-039dbed151f1/scratchpad/re
  re dis <VA> [줄수] · re func <VA> · re xref <VA> (BL 호출지 + 리터럴 풀 참조) · re xval <상수>
  re bytes <VA> [n] · re u8|s8|u16|s16|u32 <VA> <개수> · re str <VA> · re findstr <한글>
주소: .text VA = 파일오프셋 + 0xfcc. .data VA 0x1400000 (파일 0x101d4c). .bss 0x1500000~.
CP949 문자열 상당수는 .text 안(0xd4000 부근 등)에 있다. 파이썬 capstone 이 필요하면 같은 폴더 venv/bin/python 을 쓴다.
스위치는 흔히 `add pc` 나 표 점프 — 점프테이블 주소를 찾아 u16/u8 로 읽을 것.

## 규칙
- **저장소 파일(src/, tools/, RALPH_PROGRESS.md 등)을 고치거나 git 명령으로 상태를 바꾸지 말 것.** 다른 세션이 main 에서 작업 중이다. 읽기만 한다.
- 결과는 지정된 스크래치패드 파일 하나에만 쓴다. 임시 파일도 스크래치패드 안에.
- **지어내지 말 것.** 항목마다 판정을 붙인다: 확정(디스어셈으로 식·표까지 확인) / 유력(정황은 있으나 한 고리 미확인) / 미해결(시도한 방법과 막힌 지점).
- 확정·유력 항목엔 근거를 붙인다: 함수 주소, 핵심 디스어셈 몇 줄, 표 주소와 값.
- 웹판이 지금 무엇을 쓰는지(파일:줄)와 원본이 다른 점도 한 줄씩 적는다. 고치는 건 하지 않는다.
- 결과 파일 첫머리에 한 단락 요약(무엇이 풀렸고 무엇이 남았나).
