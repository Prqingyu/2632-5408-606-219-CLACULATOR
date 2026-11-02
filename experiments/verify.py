# -*- coding: utf-8 -*-
"""
Second feasibility check:
  A. universal integer construction  n = -log2( log2( 2^(1/2^n) ) )
     (three digit-2 pieces: from 26, 32, 219)
  B. universal integer construction with a *different* seed digit (6),
     using the correction factor log_6(2), 2 = 3-1 (3 from 32, 1 from 219)
  C. digit pool after splitting: subset sums
  D. exact check of a curated example table
"""

from decimal import Decimal, getcontext
from fractions import Fraction as F

getcontext().prec = 120


def nested(seed, n):
    x = Decimal(seed)
    for _ in range(n):
        x = x.sqrt()
    return x


def G2(n):
    """n = -log2(log2(2^(1/2^n))), n>=0, needs three digit-2 seeds"""
    x = nested(2, n)
    LN2 = Decimal(2).ln()
    return -((x.ln() / LN2).ln() / LN2)


def G6(n):
    """n = -log6(log6(6^(1/2^n))) / log6(2), n>=0, needs three 6s and a way to build 2"""
    x = nested(6, n)
    LN6 = Decimal(6).ln()
    LN2 = Decimal(2).ln()
    inner = x.ln() / LN6                 # 2^-n
    outer = inner.ln() / LN6             # -n*log6(2)
    return -(outer / (LN2 / LN6))        # n


print("-" * 70)
print("A/B  universal integer constructions (huge precision)")
okA = all(abs(G2(n) - n) < Decimal("1e-40") for n in list(range(0, 31)) + [40, 60, 100])
okB = all(abs(G6(n) - n) < Decimal("1e-40") for n in list(range(0, 21)) + [30])
print("  G2(n) == n  for n in 0..30,40,60,100 :", okA)
print("  G6(n) == n  for n in 0..20,30        :", okB)
print("  sample:", [(n, str(G2(n).quantize(Decimal('1e-80')))) for n in (1, 2, 5)])

print("-" * 70)
print("C  digit pool after splitting every number into single digits")
digits = [2, 6, 3, 2, 2, 1, 9, 5, 4, 0, 8, 6, 0, 6]
sums = {0}
for d in digits:
    sums |= {s + d for s in list(sums)}
missing = [i for i in range(0, sum(digits) + 1) if i not in sums]
print("   digits:", digits, " count:", len(digits), " sum:", sum(digits))
print("   subset sums cover 0..%d:" % sum(digits), "yes" if not missing else "missing=%s" % missing[:20])

print("-" * 70)
print("D  exact arithmetic check of example table")
# (target, shown expression, exact expression using F())
examples = [
    (0,     "2-2",                                  "2-2"),
    (1,     "2/2",                                  "F(2,2)"),
    (2,     "2",                                    "2"),
    (3,     "3",                                    "3"),
    (4,     "4",                                    "4"),
    (5,     "5",                                    "5"),
    (6,     "6",                                    "6"),
    (7,     "6+1",                                  "6+1"),
    (8,     "8",                                    "8"),
    (9,     "9",                                    "9"),
    (10,    "9+1",                                  "9+1"),
    (12,    "6+6",                                  "6+6"),
    (15,    "9+6",                                  "9+6"),
    (22,    "26-4",                                 "26-4"),
    (25,    "32-6-1",                               "32-6-1"),
    (27,    "26+1",                                 "26+1"),
    (30,    "26+4",                                 "26+4"),
    (33,    "32+1",                                 "32+1"),
    (37,    "32+5",                                 "32+5"),
    (45,    "6*8-3",                                "6*8-3"),
    (48,    "6*8",                                  "6*8"),
    (49,    "6*8+1",                                "6*8+1"),
    (54,    "6*9",                                  "6*9"),
    (64,    "(9-1)*8",                              "(9-1)*8"),
    (100,   "(9+1)*(8+2)",                          "(9+1)*(8+2)"),
    (101,   "(9+1)*(8+2)+6/6",                      "(9+1)*(8+2)+F(6,6)"),
    (1000,  "(9+1)*(8+2)*(6+4)",                    "(9+1)*(8+2)*(6+4)"),
    (2025,  "(9*5)**2",                             "(9*5)**2"),
    (2026,  "(9*5)**2+2/2",                         "(9*5)**2+F(2,2)"),
    (1729,  "(9+3)**3+1",                           "(9+3)**3+1"),
    (2048,  "2**(9+2)",                             "2**(9+2)"),
]
bad = []
for t, shown, code in examples:
    val = eval(code, {"F": F})
    if F(val) != F(t):
        bad.append((t, shown, F(val)))
print("   checked %d examples, mismatches: %s" % (len(examples), bad))

# decimal / fraction examples
dec = [
    (F(314, 100), "3+.1+.04", "3+F(1,10)+F(4,100)"),
    (F(1, 2),     ".5",       "F(5,10)"),
    (F(1, 3),     "1/3",      "F(1,3)"),
    (F(-22, 1),   "-26+4",    "-26+4"),
]
bad2 = [(t, s, eval(c, {"F": F})) for t, s, c in dec if F(eval(c, {"F": F})) != t]
print("   decimal/fraction examples checked %d, mismatches: %s" % (len(dec), bad2))
