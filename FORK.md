# FORK.md — what this fork carries that upstream should not take as-is

This is GGGODLIN's fork of [AltanS/collie](https://github.com/AltanS/collie). Most fork work is
meant to go upstream and is recorded the ordinary way, as a bullet under `## [Unreleased]` in
[`CHANGELOG.md`](/CHANGELOG.md).

This file lists the other kind: changes that only make sense on this operator's own setup. Read it
before opening an upstream PR, so none of these ride along, and before publishing the fork, so a
reader knows which parts assume tools they do not have.

## Keeping this list current

Last audited against `upstream/main` at `54d76632` (2026-09-26): every non-docs fork commit since
then is either a `CHANGELOG.md` bullet or an entry below.

1. Add the entry in the same commit as the change (CLAUDE.md → *Personal changes go in FORK.md*).
2. After each upstream merge and before each upstream PR, list what the fork still carries.

   ```
   git fetch upstream && git log --no-merges --format='%h %s' upstream/main..main
   ```

3. Sort any commit newer than the audit point into general or personal, then move the hash above.

A personal change that upstream later accepts in a general form leaves this list in the merge
that brings it back.

## Personal changes

Each entry says what it is, where it lives, and what it assumes.

### The title bar reads COLLIE-GGGODLIN (2026-09-22)

- **What.** The header shows `COLLIE-GGGODLIN` instead of `Collie`, so this build is told apart
  from an upstream install on the same phone.
- **Where.** [`web/src/components/app-header.tsx`](/web/src/components/app-header.tsx) and the
  tests pinning it, `app-header.test.tsx` and `alpha-bar.test.tsx`.
- **Assumes.** This fork's name.
- **To upstream.** Leave it out. A per-install title would be an operator setting instead.

### The pane description reads a recap cc-mod-waitwhat writes (2026-09-24)

- **What.** One of the three sources of a pane's description is a recap file the operator's
  Claude Code mod writes to `~/.cache/cc-recap/<sessionId>.json`. The other two, a waiting
  approval and the newest prompt, work anywhere.
- **Where.** [`bridge/journal/recap.ts`](/bridge/journal/recap.ts), read by
  [`bridge/description/resolve.ts`](/bridge/description/resolve.ts). The design notes stay in the
  operator's local research folder, outside the repo.
- **Assumes.** cc-mod-waitwhat's recap hook is installed; without it that source is simply absent.
- **To upstream.** The description can go as it is. The recap source needs the file format written
  down as a contract any plugin can produce, not one mod's output.

### Plain / Lost retellings run cc-sidecar-waitwhat (2026-09-26)

- **What.** The pane sheet's Plain and Lost rows run the command `retell.toml` names, appending
  `--session-id <id> --json`, and read its JSON answer.
- **Where.** [`bridge/retell.ts`](/bridge/retell.ts),
  [`web/src/components/retell-sheet.tsx`](/web/src/components/retell-sheet.tsx),
  [ADR 0074](/.adr/0074-retell-is-a-one-shot-operator-child.md).
- **Assumes.** The operator's own [cc-sidecar-waitwhat](https://github.com/GGGODLIN/cc-sidecar-waitwhat)
  (`ww`): its flags and its JSON shape are the contract. The account switch that landed in the same
  commit is general and is not part of this entry.
- **To upstream.** Only with the argv and answer shape documented as Collie's own contract, and
  ADR 0074's security exception accepted by the maintainer.

### The live e2e suite in e2e-live (2026-09-25)

- **What.** A browser suite that drives the active Collie through this machine's tailnet front door
  against a throwaway Herdr session.
- **Where.** [`e2e-live/`](/e2e-live/), and the *Fork-only live e2e* section of
  [`CLAUDE.md`](/CLAUDE.md).
- **Assumes.** This machine's front door and the `ccp-free` Claude launcher, so a run spends only
  the free pool.
- **To upstream.** Leave it out. Upstream's Tier 2 (`web/e2e/live/`) is the general form.

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
