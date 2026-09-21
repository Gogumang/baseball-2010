#!/usr/bin/env python3
"""r_event.zt1 / s_event.zt1 이벤트 스크립트 해독기.

    python3 tools/decode_events.py   # base/extracted/r_event.json, s_event.json

바이트를 남김없이 읽고, 대사·애니메이션 번호가 범위 안인지 매번 검증한다.

Format recovered from binary.mod (Thumb):
  record walker      0xacb20 (u16 len @+0), 0xacb60 (u16 id @+2), 0xacb4c (advance)
  header getters     0xacb8c..0xacd80 (fields +4..+0xe, conditions @+0xf+3i)
  command count      0xadcb8 (byte @ +0xf+3*nCond)
  command parser     0xadd10 (switch on type 0..8, jump table 0xd84a0)
  command executor   0x8cf64 (switch on type, jump table 0xd4ec0)
  portraits          0x7f54c (set), 0x63a04 (load event_char_N anim), 0x7f998 (draw)
"""
import json, struct, sys, zlib, os
from pathlib import Path

BASE = str(Path(__file__).resolve().parent.parent / 'base')
DATA = BASE + '/work/jar/data'

# 0xd0ae6 (== 0xd4774): s16 animation base per character id; -1 = no portrait
ANIM_BASE = [-1, -1, 16, 23, 30, 37, 44, 51, 58, 65, 0, 7, 15, 23, 72, 79, 86, 40, 16, 8, 0, 24, 32, -1, -1]
# 0xd4770: slot target x offsets (slide-in), left: x=off, right: x=screenW-off
SLOT_X = [45, 75, 105]


def char_file(char_id):
    """0x63a04: 10..13 -> event_char_1, 17..22 -> event_char_2, else event_char_0."""
    if 10 <= char_id <= 13:
        return 'event_char_1'
    if 17 <= char_id <= 22:
        return 'event_char_2'
    return 'event_char_0'


def load_zt1(path):
    raw = open(path, 'rb').read()
    usize = struct.unpack_from('<I', raw, 4)[0]
    out = zlib.decompress(raw[8:])
    assert len(out) == usize, (path, len(out), usize)
    return out


def load_text_table(path):
    d = load_zt1(path)
    count, size = struct.unpack_from('<II', d, 0)
    offs = struct.unpack_from('<%dI' % count, d, 8)
    base = 8 + 4 * count
    out = []
    for i in range(count):
        s = base + offs[i]
        e = base + (offs[i + 1] if i + 1 < count else size)
        out.append(d[s:e].split(b'\0')[0].decode('cp949', 'replace'))
    return out


class Reader:
    def __init__(self, buf, pos):
        self.b, self.p = buf, pos

    def u8(self):
        v = self.b[self.p]; self.p += 1; return v

    def u16(self):
        v = struct.unpack_from('<H', self.b, self.p)[0]; self.p += 2; return v

    def s16(self):
        v = struct.unpack_from('<h', self.b, self.p)[0]; self.p += 2; return v


def portraits(rd, n):
    out = []
    for _ in range(n):
        cid, side, unused, expr = rd.u8(), rd.u8(), rd.u8(), rd.u8()
        p = {'char': cid, 'side': 'left' if side else 'right', 'expr': expr}
        if unused:
            p['byte2'] = unused  # never read by 0x7f54c
        base = ANIM_BASE[cid] if cid < len(ANIM_BASE) else -1
        if cid == 1:
            p['file'], p['anim'] = 'event_char_0', expr  # player: base 0 (or 8 in alt mode)
        elif base >= 0:
            p['file'], p['anim'] = char_file(cid), base + expr
        else:
            p['hidden'] = True  # 0x7f54c skips ids whose base is -1
        out.append(p)
    return out


def parse_command(rd, txt, names):
    t = rd.u8()
    if t == 0:
        n = rd.u8(); por = portraits(rd, n)
        text, speaker, fmt = rd.u16(), rd.u8(), rd.u8()
        c = {'op': 'say', 'portraits': por, 'text': text, 'speaker': speaker, 'fmt': fmt}
    elif t == 1:
        n = rd.u8(); por = portraits(rd, n)
        m = rd.u8()  # 0xadee6 loop: per choice u16 text(+0x1e) then u16 goto(+0x24)
        ch = [{'text': rd.u16(), 'gotoEvent': rd.u16()} for _ in range(m)]
        c = {'op': 'choice', 'portraits': por, 'choices': ch}
    elif t == 2:
        c = {'op': 'system', 'sub': rd.u8(), 'arg': rd.u16()}
    elif t == 3:
        c = {'op': 'yesno', 'sub': rd.u8(), 'text': rd.u16(), 'yesEvent': rd.u16(), 'noEvent': rd.u16()}
    elif t == 4:
        sub, arg, m = rd.u8(), rd.u16(), rd.u8()
        pairs = [(rd.u16(), rd.u16()) for _ in range(m)]  # 0xae00a: interleaved
        c = {'op': 'op4', 'sub': sub, 'arg': arg, 'pairs': pairs}
    elif t == 5:
        c = {'op': 'effect', 'id': rd.u8()}
    elif t == 6:
        c = {'op': 'sound', 'id': rd.u8()}
    elif t == 7:
        m = rd.u8()
        items = []  # 0xae0d8: interleaved u8 kind(+5+i), s16 value(+0xa+2i)
        for _ in range(m):
            k = rd.u8(); items.append({'kind': k, 'value': rd.s16()})
        c = {'op': 'reward', 'items': items}
    elif t == 8:
        # 0x8d734: [4]-1 -> match opponent slot, [6]/[8] stored on game obj (+0xec/+0xee)
        c = {'op': 'match', 'team': rd.u8(), 'arg1': rd.u16(), 'arg2': rd.u16()}
    else:
        raise ValueError('unknown command type %d at %d' % (t, rd.p - 1))
    # resolve text
    if c['op'] in ('say', 'yesno'):
        c['textStr'] = txt[c['text']] if c['text'] < len(txt) else None
    if c['op'] == 'choice':
        for ch in c['choices']:
            ch['textStr'] = txt[ch['text']] if ch['text'] < len(txt) else None
    if c['op'] == 'say':
        sp = c['speaker']
        c['speakerName'] = None if sp == 0 else ('<player>' if sp == 1 else names[sp + 91])
    return c


def parse_file(buf, txt, names):
    events, p = [], 0
    while p < len(buf) - 1:  # 0xacf60 loop bound: pos < size-1
        rd = Reader(buf, p)
        length, eid = rd.u16(), rd.u16()
        h = buf[p + 4:p + 15]
        ev = {
            'offset': p, 'id': eid, 'length': length,
            'enabled': h[0],            # +4  0xacb8c: 0 -> never fires
            'repeatable': h[1],         # +5  0xacbb8: ==1 -> done-flag cleared at load (0xacf60)
            'trigger': h[2],            # +6  0xacbec: 0/1/2+ gate on caller context
            'requiresEvent': struct.unpack_from('<H', buf, p + 7)[0],  # +7 0xacc18: must be done
            'dateFrom': [h[5], h[6]],   # +9,+10  (a*45+b-45) <= now
            'dateTo': [h[7], h[8]],     # +11,+12 now <= (a*45+b-45)
            'byte13': h[9],             # +13 0xaccf4 (read, result unused in 0xacfbc)
        }
        nc = buf[p + 14]
        rd.p = p + 15
        ev['conditions'] = [{'type': rd.u8(), 'value': rd.s16()} for _ in range(nc)]
        ncmd = rd.u8()
        ev['commands'] = [parse_command(rd, txt, names) for _ in range(ncmd)]
        ev['_consumed'] = rd.p - p
        events.append(ev)
        p += length
    return events, p


def main():
    out_dir = BASE + '/extracted'
    names = json.load(open(BASE + '/extracted/StrMODE.json'))
    # 스프라이트 추출 결과는 base/sprites_v2/ 로 옮겨졌다 (예전 base/sprites/ 는 없다)
    anim_counts = {n: len(json.load(open(BASE + '/sprites_v2/%s/frames/animations.json' % n)))
                   for n in ('event_char_0', 'event_char_1', 'event_char_2')}
    report = {}
    for name in ('r_event', 's_event'):
        buf = load_zt1('%s/%s.zt1' % (DATA, name))
        txt = load_text_table('%s/%s_txt.zt1' % (DATA, name))
        events, end = parse_file(buf, txt, names)
        bad_len = [e['id'] for e in events if e['_consumed'] != e['length']]
        text_ids, bad_anim = [], []
        for e in events:
            for c in e['commands']:
                if 'text' in c: text_ids.append(c['text'])
                for ch in c.get('choices', []): text_ids.append(ch['text'])
                for pr in c.get('portraits', []):
                    if 'anim' in pr and pr['anim'] >= anim_counts[pr['file']]:
                        bad_anim.append((e['id'], pr))
        for e in events:
            assert e.pop('_consumed') == e['length']
        stats = {
            'bytes': len(buf), 'parsedTo': end, 'leftover': len(buf) - end, 'events': len(events),
            'commands': sum(len(e['commands']) for e in events),
            'recordLengthMismatches': bad_len, 'textCount': len(txt),
            'maxTextIndex': max(text_ids), 'textOutOfRange': [t for t in text_ids if t >= len(txt)],
            'textIndicesUsed': len(set(text_ids)), 'animOutOfRange': bad_anim[:10],
        }
        report[name] = stats
        json.dump(events, open('%s/%s.json' % (out_dir, name), 'w'), ensure_ascii=False, indent=1)
        json.dump(txt, open('%s/%s_txt.json' % (out_dir, name), 'w'), ensure_ascii=False, indent=0)
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
