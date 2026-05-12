# Private maps workflow

## The need

The user plans real product roadmaps in this tool, but those maps contain confidential information (unreleased products, strategic bets, hiring plans, customer names) that **must never reach the public `origin`**. They want version control on the private maps, the existing tooling (loader, watcher, validator, CLIs) to see them without ceremony, and a single bad `git push` to be physically incapable of leaking. They also want to flip "private mode" on and off cheaply so private maps don't pollute the UI scenario list when they're hacking on the open-source codebase.

## Recommendation

**Use a separate private git repo, cloned into a gitignored `data/private/` directory, plus a small patch to `tools/config.ts` so the loader recurses into `data/private/`.**

Call this the **"nested private repo"** pattern. The outer public repo never sees `data/private/` (it's in `.gitignore`). The inner private repo has its own remote — and *only* that remote. There is no shared branch, no shared ref, no shared remote, so **no command run inside the public repo can push private content anywhere**.

Toggle private mode off (e.g., when working on `planning-workflow-improvements`):
`mv data/private data/.private-disabled && npm run generate:config`. Reverse to re-enable. Both names are gitignored.

## Why this and not the alternatives

**Option 1 (plain gitignored subdirectory).** Loses requirement 1: no version control. The user explicitly wants git history on private maps.

**Option 1 variant (gitignored subdirectory that is itself a separate repo).** This is the recommendation. The "variant" is the strong form.

**Option 2 (git submodule at `data/private/`).** A submodule leaves a `.gitmodules` entry and a gitlink in the public tree — both *advertise that a private map exists* and *name the private repo URL*. That metadata leak alone is disqualifying. Submodules also push their own pain tax: every outer `git status` nags about submodule drift, and `git submodule foreach git push` is exactly the foot-gun we're trying to eliminate. Submodules earn their complexity when the outer repo *needs* to pin the inner SHA for reproducibility; no public consumer of `adjacency-map` benefits from that pin.

**Option 3 (worktree of a `private` branch).** The worktree shares the public repo's `.git` directory, which means it shares remotes — `git push --all` from inside the worktree happily pushes `private` to public `origin` unless a `pre-push` hook intercepts it. That's the exact failure mode we're forbidden to enable. The worktree also lives outside `data/`, so the loader can't see it without a symlink — re-creating Option 4's complexity *plus* the worktree's.

**Option 4 (two clones with a symlink).** Close runner-up; same safety properties. I prefer the nested-repo version because keeping the private repo *inside* `data/private/` preserves the user's muscle memory ("everything I care about lives under `data/`") and the existing `data/**` watcher glob already covers it. A sibling clone adds an indirection layer and a symlink that's easy to forget when grepping or backing up.

**Option 5 (private branch in the same repo with `pre-push` hygiene).** Disqualified by requirement 2. The branch lives in a repo with the public remote configured. Any `git push --all`, `git push origin private`, or accidental `git push origin private:main` leaks the data. `pre-push` hooks are bypassable with `--no-verify` and don't survive a fresh clone. The requirement is *physically impossible*, not *merely discouraged*.

## Setup steps for the recommended approach

```bash
# 1. Reserve the path in .gitignore (public repo)
cd /Users/jkomoros/Code/adjacency-map
printf '\n# Private maps live in a separate repo cloned here. Never tracked.\ndata/private/\ndata/.private-disabled/\n' >> .gitignore
git add .gitignore
git commit -m "Reserve data/private/ for nested private maps repo"

# 2. Create the private repo (one time, web UI or gh)
gh repo create jkomoros/adjacency-map-private --private --clone=false

# 3. Clone it into data/private
git clone git@github.com:jkomoros/adjacency-map-private.git data/private

# 4. Patch tools/config.ts to scan data/private/ as well (see snippet below)

# 5. Seed your first private map
cp data/common.SAMPLE.ts data/private/roadmap.ts
cd data/private
git add roadmap.ts
git commit -m "Initial private roadmap"
git push -u origin main
cd ../..

# 6. Validate the full pipeline sees the new file
npm run generate:config
npm run validate
```

**Loader patch (`tools/config.ts`).** Replace the single `readdirSync(DATA_DIRECTORY)` loop with a scan that also looks inside `data/private/` (if present). Use logical names like `private/roadmap` for the inner files so they don't collide with top-level names, and update the import path in the generated file accordingly. Keep the `SAMPLE` exclusion. The `private/` directory existing or not is the on/off switch.

**`AGENTS.md` snippet to add.** Add a new top-level section:

> ## Private maps
>
> Files under `data/private/` are a separate, gitignored repo cloned into this workspace. They contain confidential roadmap data and **must never be committed to this repo**. The outer `.gitignore` blocks `data/private/` and `data/.private-disabled/`. If you see a file path like `data/private/<name>.ts`, treat edits exactly like a normal data file — `npm run validate` and `npm run inspect` work identically — but commit those edits inside `data/private/` (the inner repo), not the outer repo.
>
> To temporarily hide private maps from the UI scenario list (e.g., when working on open-source features), run `mv data/private data/.private-disabled && npm run generate:config`. Reverse with `mv data/.private-disabled data/private && npm run generate:config`.

## Failure modes I anticipate

1. **Working-directory confusion.** Running `git` commands from the wrong repo root. The outer `.gitignore` refuses to add `data/private/*` files, but `git add -f data/private/foo.ts` defeats it. *Mitigation:* never use `-f` near `data/private/`. A shell prompt that shows the current repo root (`__git_ps1`, starship's git module) catches this visually.

2. **Loader collision.** Without namespacing, `data/private/foo.ts` would shadow `data/foo.ts` in the generated `DATA` map. *Mitigation:* the loader patch uses the logical name `private/<basename>` for nested files.

3. **Race during initial setup.** Cloning into `data/private/` before the `.gitignore` rule lands. *Mitigation:* the setup script commits `.gitignore` *first*.

4. **CI / generated artifacts leak.** `src/data.GENERATED.ts` ends up containing private import paths if `npm run generate:config` runs while private maps are present. It's already gitignored (`*.GENERATED.*`), but screenshots showing the file dropdown could leak names. *Mitigation:* keep the existing gitignore line; consider an env var `ADJACENCY_MAP_PRIVATE=0` the loader respects so CI / screenshot scripts can opt out explicitly.

5. **Stale staged file in the outer repo.** A previous `git add -f` lingers in the index and gets committed later. *Mitigation:* the `.gitignore` rule makes it structurally impossible to *stage* files under `data/private/` without `-f`, which is a deliberate two-key shortcut to the foot.

**The single biggest failure mode** is #1: confused working directory. Everything else is well-fenced by `.gitignore`.

## Migration / change-of-mind path

- **Want a single repo after all?** Use `git format-patch` in `data/private/` and `git am` in the public repo to replay private history if it's been declassified. Otherwise leave it; nothing in the public repo depends on `data/private/` existing.
- **Want submodules after all?** Delete `data/private/` and `git submodule add git@github.com:jkomoros/adjacency-map-private.git data/private`. On-disk layout is unchanged, loader patch keeps working. You accept the metadata leak.
- **Want to nuke private mode entirely?** `rm -rf data/private data/.private-disabled && npm run generate:config`. The public repo is unchanged. Revert the loader patch and `.gitignore` lines if desired.
- **Want a third tier (team-confidential vs personal)?** Clone a second private repo into `data/team/`, add `data/team/` to `.gitignore`, extend the loader patch. Scales by repetition.
