#!/usr/bin/env python3
"""Patch template for index.html — exact-count anchored edits.

Usage: copy per change round, fill in rep() calls, run against a WORKING COPY,
run qa/qa.js, and only then commit over index.html.
Every rep() asserts the anchor appears exactly `count` times; any mismatch
aborts before a single byte is written, so a partial patch can never ship.
"""
import io, sys

SRC = "index.html"          # run from Prototype/, or set an absolute path
html = io.open(SRC, encoding="utf-8").read()
orig = html

def rep(old, new, count=1):
    """Replace `old` with `new`; abort unless `old` occurs exactly `count` times."""
    global html
    n = html.count(old)
    assert n == count, f"ANCHOR MISMATCH ({n} != {count}): {old[:80]!r}"
    html = html.replace(old, new)

# ---- edits ----------------------------------------------------------------
# rep("""<exact existing text>""",
#     """<replacement text>""")
#
# For a large block swap, splice by unique start/end markers instead:
# START, END = "function viewX(){", "/* ---- next section ---- */"
# assert html.count(START) == 1 and html.count(END) == 1
# html = html[:html.index(START)] + NEW_BLOCK + html[html.index(END):]
# ---------------------------------------------------------------------------

io.open(SRC, "w", encoding="utf-8").write(html)
print(f"OK — {len(orig)} -> {len(html)} bytes ({len(html)-len(orig):+d})")
