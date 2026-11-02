# -*- coding: utf-8 -*-
"""
Feasibility probe for the puzzle:
  given numbers: 26, 32, 219, 5408, 606
  allowed: any operations, arbitrary decimal points, splitting numbers into adjacent pieces
Question: can any target number be built?

This script checks two things:
  1) a rigorous "any integer" construction using logarithms + nested square roots
     (needs "any operations", three digit-2 pieces from 26 / 32 / 219)
  2) exhaustive reachability for the *plain* rule tier:
     each of the five numbers used at most once, a decimal point may be inserted
     anywhere in a used number, operations + - * / and parentheses.
"""

from fractions import Fraction as F
import math
import time

NUMBERS = ["26", "32", "219", "5408", "606"]


# ---------------------------------------------------------------- tier 1: DP
def number_variants(s):
    """all readings of one whole provided number with one optional decimal point"""
    L = len(s)
    out = {}
    cand = [(F(int(s)), s), (F(int(s), 10 ** L), "." + s)]
    for p in range(1, L):
        cand.append((F(int(s[:p])) + F(int(s[p:]), 10 ** (L - p)), s[:p] + "." + s[p:]))
    for v, lab in cand:
        if v not in out or len(lab) < len(out[v]):
            out[v] = lab
    return out


OPS = ["+", "-", "*", "/"]


def build_reachable(variants, cap_per_mask=600_000, max_den=10 ** 7, max_num=10 ** 12):
    """DP over all subsets of the five numbers, exact Fractions."""
    n = len(variants)
    full = (1 << n) - 1
    V = [dict() for _ in range(full + 1)]
    for i in range(n):
        V[1 << i] = dict(variants[i])

    def put(out, v, expr):
        if len(out) >= cap_per_mask:
            return
        if v.denominator > max_den or abs(v.numerator) > max_num:
            return
        old = out.get(v)
        if old is None or len(expr) < len(old):
            out[v] = expr

    t0 = time.time()
    for mask in range(1, full + 1):
        if mask & (mask - 1) == 0:
            continue
        out = V[mask]
        sub = (mask - 1) & mask
        while sub:
            other = mask ^ sub
            if sub < other:                       # each unordered split once
                A, B = V[sub], V[other]
                if len(A) > len(B):
                    A, B = B, A
                for va, ea in A.items():
                    for vb, eb in B.items():
                        put(out, va + vb, "(%s+%s)" % (ea, eb))
                        put(out, va - vb, "(%s-%s)" % (ea, eb))
                        put(out, vb - va, "(%s-%s)" % (eb, ea))
                        put(out, va * vb, "(%s*%s)" % (ea, eb))
                        if vb != 0:
                            put(out, va / vb, "(%s/%s)" % (ea, eb))
                        if va != 0:
                            put(out, vb / va, "(%s/%s)" % (eb, ea))
            sub = (sub - 1) & mask
        print("  mask %2d  |V|=%-8d  total %.1fs" % (mask, len(V[mask]), time.time() - t0))
    return V


def fmt_expr(e, limit=120):
    if len(e) <= limit:
        return e
    return e[:limit] + "..."


def main():
    # ---------- 1) universal construction: n = -log_2(log_2(2^(1/2^n)))
    print("=" * 78)
    print("1) universal integer construction with three digit-2 pieces")
    print("   n = -log2( log2( sqrt(sqrt(...sqrt(2)...)) ) )   with n radicals")
    ok = True
    for n in [0, 1, 2, 3, 5, 10, 20, 50]:
        x = 2.0
        for _ in range(n):
            x = math.sqrt(x)
        val = -math.log(math.log(x, 2), 2)
        ok &= abs(val - n) < 1e-9
        print("   n=%-3d -> %.12f" % (n, val))
    print("   all exact:", ok)

    # ---------- 2) plain tier: 5 whole numbers + decimal point + - * /
    print("=" * 78)
    print("2) exhaustive reachability: five numbers used at most once,")
    print("   one decimal point anywhere, operations + - * /, parentheses")
    variants = [number_variants(s) for s in NUMBERS]
    for s, v in zip(NUMBERS, variants):
        print("   %-5s -> %s" % (s, sorted((str(k), x) for k, x in v.items())))

    V = build_reachable(variants)
    full = (1 << len(NUMBERS)) - 1

    def find(v):
        for mask in range(1, full + 1):
            if v in V[mask]:
                return V[mask][v], mask
        return None, None

    targets = [str(i) for i in range(0, 121)] + [
        "219", "606", "5408", "2025", "2026", "1024", "888", "999", "1000",
        "1234", "42", "7", "314", "520", "1314", "114", "365", "10086",
    ]
    misses = []
    print("\n   target -> expression")
    for t in targets:
        v = F(t)
        e, mask = find(v)
        if e is None and "." in t:
            num, den = t.split(".")
            v = F(int(num + den), 10 ** len(den))
            e, mask = find(v)
        if e is None:
            misses.append(t)
            print("   %-8s MISS" % t)
        else:
            used = [NUMBERS[i] for i in range(len(NUMBERS)) if mask >> i & 1]
            print("   %-8s = %s   [uses %s]" % (t, fmt_expr(e), ",".join(used)))

    print("\n   hit %d / %d ; misses: %s" % (len(targets) - len(misses), len(targets), misses))

    # coverage of pure integers 1..1000, either subset or all five
    cov_sub, cov_all = 0, 0
    miss_list = []
    for i in range(1, 1001):
        v = F(i)
        h1 = any(v in V[m] for m in range(1, full + 1))
        h2 = v in V[full]
        cov_sub += h1
        cov_all += h2
        if not h1:
            miss_list.append(i)
    print("   integers 1..1000 reachable (any subset): %d ; (all five used): %d" % (cov_sub, cov_all))
    print("   first misses (any subset):", miss_list[:40])
    return V, variants


if __name__ == "__main__":
    main()
