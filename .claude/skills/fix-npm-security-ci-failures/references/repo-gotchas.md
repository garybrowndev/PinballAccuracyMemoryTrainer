# Repo-specific gotchas

Read this before starting the fix loop in SKILL.md. Each of these has independently cost a full diagnostic cycle in a past session — they're cheap to avoid, expensive to rediscover.

## gh account identity

This machine has three `gh` accounts. This repo is structurally pinned to `garybrowndev` via a repo-scoped `GH_CONFIG_DIR` (set in `.claude/settings.local.json`), which should mean you never need to `gh auth switch`. If a `gh` call ever 403s with something that reads like a missing-scope error ("Must have admin rights", "needs admin:repo_hook"), **do not follow gh's own suggested `gh auth refresh` fix** — check the actual identity first:

```
gh api user --jq .login
gh api repos/garybrowndev/PinballAccuracyMemoryTrainer --jq .permissions
```

`permissions.admin: false` on a repo this account owns means the active account is wrong, not under-scoped. This has happened even with the `GH_CONFIG_DIR` pin in place if something else on the machine mutated the global `hosts.yml` — the pin should prevent it, but verify instead of assuming.

## The local pre-push hook is permanently broken on Windows — not your fault

`npm run test:e2e` in the pre-push hook always fails on this machine: 6 visual-regression tests fail against stale `-win32.png` baselines (last refreshed 2026-07-19). This reproduces identically on a clean, unmodified `master` — it is not caused by whatever you changed. CI only ever checks the `-linux.png` baselines; the win32 ones exist solely for local dev and have drifted.

Don't assume this, though — if you want to be sure before using `--no-verify`, prove it: `git stash`, `git checkout master`, `npm ci`, run the e2e visual suite, see the identical failures, then go back to your branch. Don't regenerate the win32 snapshots to make the hook pass; that bakes this machine's font rendering into the repo and CI never reads them.

## This repo only allows merge commits

`gh pr merge <N> --squash` fails here with `GraphQL: Squash merges are not allowed on this repository`. Always use `--merge --delete-branch`. If unsure, check first:

```
gh api repos/garybrowndev/PinballAccuracyMemoryTrainer --jq '{merge:.allow_merge_commit, squash:.allow_squash_merge, rebase:.allow_rebase_merge}'
```

## `Closes #N` only closes issues, not PRs

A consolidation commit/PR body listing `Closes #209, #210, ...` will not auto-close those pull requests on merge — GitHub's keyword-closing only applies to issues. Close each superseded PR explicitly with `gh pr close <N> --comment "..." --delete-branch`. One PR occasionally self-closes anyway if Dependabot notices its bump was separately satisfied — that's incidental, not the mechanism to rely on.

## PowerShell has no heredoc

`git commit -m @'...'@` multi-line here-strings work, but for anything with special characters, write the message to a file with the `Write` tool and use `git commit -F <path>`. Don't try `<<'EOF'` — that's bash syntax and fails outright in PowerShell.

## `git merge FETCH_HEAD` after a multi-ref fetch merges all of them at once

`git fetch origin <branch-1> <branch-2>` followed by `git merge FETCH_HEAD --no-edit` merges _both_ branches in a single commit if they don't conflict with each other — useful when consolidating several Dependabot branches, but confirm with `git log --oneline -1` afterward that it actually merged what you expected, not just the last ref listed.

## A `git commit` that triggers the pre-commit hook can take a while

The hook runs `npm run lint` + `prettier --check .`; on a cold cache or right after a large `npm ci`, this can run past the tool's default foreground timeout and get moved to the background. That's normal — check `git log --oneline -1` afterward to confirm it actually landed rather than assuming the backgrounded call's buffered output tells the full story.

## Don't trust a scratch-directory audit probe over a real `npm ci`

Copying just `package.json` + `package-lock.json` into a scratch folder and running `npm install --package-lock-only --ignore-scripts` there can report a different (sometimes larger) vulnerability set than a real `npm ci` + `npm audit` in the actual working tree, for packages whose resolution depends on more than what's in those two files alone. If a scratch probe and a real install disagree, trust the real install — it's what CI actually runs.

## Open Dependabot alert severity can disagree with npm's own audit severity

GitHub's Dependabot alert API may label an advisory "medium" while `npm audit` still counts it as a gate-failing "high", or vice versa. Worth fixing either way (alerts should go to zero), but when diagnosing _why the gate failed_, trust `npm audit --audit-level=high`'s own severity field over the Dependabot alert label.
