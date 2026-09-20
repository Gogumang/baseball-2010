#!/bin/sh
# 사용: assemble.sh <글자>  — docs-head/<글자>.md + re-notes 노트(제목 한 단계 내림) → docs/re/
S=/private/tmp/claude-501/-Users-evan123-Desktop-code-baseball-2010/a8d7dac6-6002-4b07-af77-039dbed151f1/scratchpad
W=/Users/evan123/Desktop/code/baseball-2010-re/docs/re
k=$1; n=$(ls $S/re-notes/$k-*.md); b=$(basename $n)
{ cat $S/docs-head/$k.md; awk 'BEGIN{f=0} /^```/{f=!f} { if(!f && /^#/) print "##" $0; else print }' $n; } > $W/$b
echo "$b $(wc -l < $W/$b)줄"
