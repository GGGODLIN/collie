# FORK.md — what this fork carries that upstream should not take as-is

This is GGGODLIN's fork of [AltanS/collie](https://github.com/AltanS/collie). Most fork work is
meant to go upstream and is recorded the ordinary way, as a bullet under `## [Unreleased]` in
[`CHANGELOG.md`](/CHANGELOG.md).

This file lists the other kind: changes that only make sense on this operator's own setup. Read it
before opening an upstream PR, so none of these ride along, and before publishing the fork, so a
reader knows which parts assume tools they do not have.

## Personal changes

Each entry says what it is, where it lives, and what it assumes.

### The wait-what band is hidden from the mirror (2026-09-26)

- **What.** The phone's pane mirror drops the band that
  [cc-mod-waitwhat](https://github.com/GGGODLIN/cc-sidecar-waitwhat) draws above Claude's input box
  (the `wait what [ 白話 ] [ 跟丟了 ]` row, its recap line and any retelling under it).
- **Where.** [`web/src/lib/harness/claude/waitwhat-band.ts`](/web/src/lib/harness/claude/waitwhat-band.ts),
  applied after `stripChrome` in [`web/src/lib/harness/claude/index.ts`](/web/src/lib/harness/claude/index.ts).
- **Assumes.** The operator runs that mod, whose labels are in Traditional Chinese. On the phone its
  buttons are dead text; the retell sheet (ADR 0074) and the pane description replace them.
- **To upstream.** It would need to become a general rule, for example an operator-declared list of
  band headers to hide, instead of one mod's labels written into the code.
