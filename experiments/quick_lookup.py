# -*- coding: utf-8 -*-
"""quick targeted lookup on top of probe.py's tier-1 reachable set"""
import probe
from fractions import Fraction as F

variants = [probe.number_variants(s) for s in probe.NUMBERS]
V = probe.build_reachable(variants)
full = (1 << len(probe.NUMBERS)) - 1


def parse(t):
    if "." in t:
        a, b = t.split(".")
        return F(int((a or "0") + b), 10 ** len(b))
    return F(int(t))


def find(v):
    for m in range(1, full + 1):
        if v in V[m]:
            used = [probe.NUMBERS[i] for i in range(len(probe.NUMBERS)) if m >> i & 1]
            return V[m][v], used
    return None, None


targets = ["0.5", "1.5", "2.5", "3.14", "3.1416", "26.32", "219.5", "6.06",
           "0.1", "2025", "2026", "1729", "2048", "1000", "888", "1234"]
for t in targets:
    e, used = find(parse(t))
    print("%-8s -> %s   %s" % (t, e if e else "MISS", used if used else ""))
