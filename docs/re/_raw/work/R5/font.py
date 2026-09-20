# 원본 synGak9_11.ft2 한글 합성 (0x9bb28 옮김) + 영문 synGulimAsc5_11
JAR='/Users/evan123/Desktop/code/baseball-2010/base/work/jar/'
G=open(JAR+'synGak9_11.ft2','rb').read(); A=open(JAR+'synGulimAsc5_11.ft2','rb').read()
W,H=G[0],G[1]; BPG=(W*H+7)>>3
CHO0=2; JUNG0=CHO0+12*19*BPG; JONG0=JUNG0+7*21*BPG; TAB=JONG0+4*27*BPG
jungT=list(G[TAB:TAB+21]); choT=list(G[TAB+21:TAB+40]); jongT=list(G[TAB+40:TAB+67])
CHO5=[-1,-1]+list(range(19))+[-1]*11
JUNG5=[-1,-1,-1,0,1,2,3,4,-1,-1,5,6,7,8,9,10,-1,-1,11,12,13,14,15,16,-1,-1,17,18,19,20,-1,-1]
JONG5=[-1,-1]+list(range(16))+[-1]+list(range(16,27))+[-1,-1]
ROW=[[6,2,1],[10,5,1],[6,4,3],[8,3,2],[5,1,0]]
SHAPE=[0,1,0,1,0,1,0,1,2,4,4,4,2,3,5,5,5,3,2,4,0]
HZ=[0]*8+[1]*12+[0]
CX=[0,0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0,1,0]
def orr(buf,off,s):
    acc=0
    for i in range(BPG):
        acc=(acc<<8)|G[off+i]; buf[i]|=(acc>>s)&0xff
def compose(c5,j5,k5):
    buf=bytearray(BPG)
    if c5==0 and j5==0 and k5==0: return buf
    cho,j,k=CHO5[c5],JUNG5[j5],JONG5[k5]
    ci=max(cho,0); ji=j
    if ji<0 and k<0: ji=0
    if HZ[ji] and k>=0:
        a,b=choT[ci],jongT[k]
        t=0 if a+b>4 else 1 if (a==1 and b==3) else 2 if (a==3 and b==1) else 3
        cs=ROW[t][0]+CX[ji]; js=ROW[t][1]; ks=ROW[t][2]
    elif k<0:
        cs=SHAPE[ji]; cs=cs-1 if cs>0 else cs; js=0; ks=0
    else:
        cs,js,ks=ROW[4][0],ROW[4][1],0
    if cho<0 and k<0: js=6
    if cho>=0: orr(buf,CHO0+(cho+cs*19)*BPG, 2 if (j<0 and k<0) else 0)
    if j>=0: orr(buf,JUNG0+(j+js*21)*BPG,0)
    if k>=0: orr(buf,JONG0+(k+ks*27)*BPG,jungT[ji])
    return buf
import struct as _st
_BIN=open('/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod','rb').read()
KS2JOHAB=_st.unpack('<2350H',_BIN[0xd602e-0xfcc:0xd602e-0xfcc+4700])   # 원본 표 0xd602e
JAMO2JOHAB=_st.unpack('<51H',_BIN[0xd5fc8-0xfcc:0xd5fc8-0xfcc+102])
def to_johab(ch):
    b=ch.encode('cp949'); l,t=b[0],b[1]
    if 0xB0<=l<=0xC8: return KS2JOHAB[(l-0xB0)*94+(t-0xA1)]
    if l==0xA4 and 0xA1<=t<=0xD3: return JAMO2JOHAB[t-0xA1]
    return None
def hangul(ch):
    v=to_johab(ch)
    return compose((v>>10)&31,(v>>5)&31,v&31)
def ascii_glyph(c):
    b=2+(ord(c)-0x21)*7; return A[b:b+7]
def bits(buf,w,h):
    s=''.join(f'{x:08b}' for x in buf); return [[s[y*w+x]=='1' for x in range(w)] for y in range(h)]
def layout(text,gap=2):
    """(x,glyph bitmap,w) 목록과 전체 폭. 한글 9+2, 영문 5+2, 공백 5+2."""
    out=[];x=0
    for ch in text:
        if ch==' ': x+=A[0]+gap; continue
        if ord(ch)<0x80: out.append((x,bits(ascii_glyph(ch),A[0],A[1]))); x+=A[0]+gap; continue
        if ch=='·': out.append((x,bits(ascii_glyph('.'),A[0],A[1]))); x+=A[0]+gap; continue
        if to_johab(ch) is None: continue   # 원본: 변환 실패 → 초성31 → 폭0 → 안 그리고 안 전진
        out.append((x,bits(hangul(ch),W,H))); x+=W+gap
    return out,x-gap
