---
name: fix-npm-security-ci-failures
description: Diagnose and fix a failing "Security: npm Audit" GitHub Actions check (or any other red/failing CI workflow) on this repo's master branch, including the case where it has blocked a queue of open Dependabot PRs. This has happened repeatedly (2026-07-25, 2026-09-02, 2026-09-19, 2026-09-30, 2026-10-06) — always the same shape: a GHSA advisory widens its vulnerable-version range to cover a version this repo's package.json `overrides` already pinned, with zero code change, and the check then fails every scheduled run until someone bumps the override. Use this skill whenever the user reports a failing GitHub Actions run, a red "Security: npm Audit" / CI check, a GitHub Actions failure notification/email, a stuck or blocked Dependabot PR, "npm audit is failing again", "the security check is red", "master is failing", or asks to get CI/Actions back to green. Covers the full loop and drives it to a clean repo without the user having to prompt: lay of the land, reproduce, find the true root cause, fix, consolidate blocked PRs, wait on CI itself, rerun known flakes, merge, close superseded PRs, verify every master workflow including the release, clear any Dependabot alerts the merge surfaces, and clean up branches and worktrees.
---

# Fix npm security / CI failures on this repo

This repo's `Security: npm Audit` workflow gates on `npm audit --audit-level=high` as a **required status check**. Because `package.json` fixes known-vulnerable transitive dependencies with exact-version or narrow-range `overrides`, the gate can fail on a commit nobody touched — a new GHSA advisory publishes and widens its vulnerable range to cover whatever version an override pinned. This has now happened at least five times (2026-07-19 gate tightened, 2026-07-25, 2026-09-02, 2026-09-19, 2026-09-30/10-01). It will happen again. This skill is the standard loop for diagnosing it, fixing it correctly the first time, and not leaving the PR queue jammed behind it.

## The job is a clean repo, not a fix — drive it to the end without being prompted

Invoking this skill is the user's authorization for the whole loop: fix, push, open the PR, wait for CI, merge, close superseded PRs, verify master, clear alerts, clean up. **The skill is not finished until Step 9's end state holds.** The user should never have to ask "are you done?", "is it running?", or "are we just waiting?" — each of those questions means the session stopped driving.

The failure this section exists to prevent (2026-10-07): the fix was pushed and the PR opened, and then the session told the user "say 'merge it' once checks are green" and went idle. The user had to prompt three times. Meanwhile a check had been cancelled (needed a rerun nobody triggered) and the merge surfaced 7 new Dependabot alerts nobody would have looked at. Concretely:

- **Never hand a wait back to the user.** Every wait — PR checks, master runs after merge — runs as a time-capped, harness-tracked background task (`run_in_background: true`) that exits when the thing finishes. Its completion notification wakes the session, which then takes the next step itself. See the wait commands in Steps 7 and 8.
- **Don't ask permission for steps this skill already prescribes.** Merging a green PR, closing superseded PRs, rerunning a known flake, deleting merged branches and the worktree are all part of the loop. Ask only for things the skill does _not_ cover (e.g. dismissing an alert, a risky major bump).
- **Tell the user what's live while waiting**, in one line: which task is watching what, and roughly how long the last run took. Then keep working on anything that doesn't depend on it.

**Read `references/repo-gotchas.md` before you start** — it has the account-switching footgun, the local pre-push hook that's permanently broken for unrelated reasons, the merge-method restriction, and a few PowerShell quoting traps that have each cost a full diagnostic cycle before.

## Step 1 — Lay of the land

Don't assume the one failure the user mentioned is the only one. Survey broadly before narrowing:

```
gh run list --branch master --limit 30 --json workflowName,status,conclusion,createdAt --jq 'group_by(.workflowName)[] | max_by(.createdAt) | "\(.conclusion // .status)  \(.workflowName)"'
gh pr list --state open --json number,title,mergeStateStatus
gh api repos/garybrowndev/PinballAccuracyMemoryTrainer/dependabot/alerts?state=open --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name) \(.security_advisory.ghsa_id)"'
```

This tells you three things at once: which workflow is actually red (don't assume it's npm audit — it usually is, but check), whether any PRs are stuck behind it, and whether Dependabot already knows about the underlying advisory.

**A Dependabot alert's severity label can disagree with npm's own classification.** GitHub may call something "medium" while `npm audit --audit-level=high` still treats it as a gate-failing high. Don't fix only what the alert API calls high — the next step settles this with the actual audit output, not a label.

## Step 2 — Reproduce locally with the literal CI command

Read the workflow file instead of assuming the flag:

```
Get-Content .github/workflows/security-npm-audit.yml | Select-String 'npm audit'
```

Then run exactly that, in the real working tree (not a scratch copy without a real install — see the warning below):

```
npm ci
npm audit --audit-level=high
```

**Don't verify with `npm install --package-lock-only` against a bare copy of `package.json`/`package-lock.json` with no real `node_modules`.** It can report a materially different (sometimes larger) vulnerability set than `npm ci` + `npm audit` does in a real install, because audit-without-install re-resolves parts of the tree differently. `npm ci` is what CI actually runs — mirror that, not an approximation of it. If you want to test a fix without touching the real tree, do the edit on a branch and run the real `npm ci`/`npm audit` there; don't trust a disposable scratch-directory probe as the final word.

**Watch for output truncation when you pipe through `Select-Object -Last N`.** `npm audit`'s text output lists one block per vulnerable package before the summary line — piping to `-Last 30` can silently cut off everything except the last package or two, making the summary count look smaller than it is. Either don't truncate, or get the full picture from `--json` (see Step 3).

## Step 3 — Find the true root cause(s), not just the first package you notice

There can be more than one unrelated advisory landing at once (brace-expansion and basic-ftp broke the gate on the same day in the 2026-09-30/10-01 incident, alongside an already-open ip-address alert that turned out to be a red herring for this specific gate). Get the full structured picture:

```
npm audit --audit-level=high --json > audit.json
```

Then, in PowerShell, filter to packages that carry a **direct** GHSA reference (not just a `"dep-of": "<parent>"` entry) — those are the actual leaf causes; everything else in the high/critical bucket is usually just inheriting severity from depending on one of them:

```powershell
$j = Get-Content audit.json -Raw | ConvertFrom-Json
$j.vulnerabilities.PSObject.Properties | Where-Object { $_.Value.severity -in 'high','critical' } | ForEach-Object {
  $ghsas = $_.Value.via | Where-Object { $_ -isnot [string] } | ForEach-Object { $_.url } | Select-Object -Unique
  if ($ghsas) { Write-Output "$($_.Name):"; $ghsas | ForEach-Object { Write-Output "    $_" } }
}
```

A long list of eslint/puppeteer/lighthouse/etc. packages all showing "high" is normal noise if they all trace back to one or two real leaf packages — fix the leaf, not each symptom.

For each real leaf GHSA, get the authoritative patched version and publish date (don't guess from the advisory title):

```
gh api /advisories/<GHSA-ID> --jq '.published_at + " | " + (.vulnerabilities[] | select(.package.name=="<pkg>") | .vulnerable_version_range + " -> " + .first_patched_version)'
```

If a package has multiple advisories with different `first_patched_version` values, take the highest — the fix has to satisfy all of them at once.

**Prove nothing in the repo changed**, if you want the "why now" story: compare the last-green run's commit SHA to the first-red run's SHA on the same branch —

```
gh run list --workflow="security-npm-audit.yml" --branch master --limit 10 --json conclusion,headSha,createdAt --jq '.[] | "\(.createdAt)  \(.conclusion)  \(.headSha[0:7])"'
```

Same SHA across the green-to-red boundary means the advisory database moved, not the code.

## Step 4 — Fix: bump the override, matching the existing pattern

**Do the work in a git worktree, not the main checkout.** The main checkout often has the user's untracked files (e.g. `scratch/*.html`), and the pre-commit hook runs `prettier --check .`, which fails on them — the commit is rejected for files you didn't touch. Don't edit or delete the user's files and don't `--no-verify` the commit; a worktree sidesteps both:

```
git fetch origin
git worktree add -b <branch> C:\code\Pinball\PAMT-fix-wt origin/master
# then run npm ci and every subsequent command inside C:\code\Pinball\PAMT-fix-wt
```

Remove it in Step 9.

**Check whether a plain lockfile refresh is enough first** (`npm update <pkg> ...`). If the patched version is inside every parent's declared range, that's the smallest fix. If a parent pins the vulnerable version exactly (`npm view <parent>@<ver> dependencies.<pkg>` — e.g. `serve@14.2.6` pins `compression` to `1.8.1`), only an override can move it. Also check whether a newer release of the top-level dependency drops the vulnerable package entirely (e.g. `lighthouse@13.5.0` moved to `@sentry/node@10`, which no longer pulls in the `@opentelemetry/instrumentation-*` packages) — that beats overriding six packages across a large version gap.

Open `package.json`'s `overrides` block and find the entry for the vulnerable package. There are two shapes in this repo, and the fix differs slightly:

- **Exact pin** (`"js-yaml@<3.15.1": "3.15.1"`) — the pin itself is now in the vulnerable range. Bump both the range key and the target version to the patched release.
- **Caret range** (`"basic-ftp": "^5.3.1"`) — the _range_ is the limiter, not one exact version. If the patched release is a major bump (e.g. `6.2.1`), the caret has to move too, not just get re-applied.

After editing, regenerate the lockfile and re-verify with the real `npm ci` + `npm audit` from Step 2, not a scratch probe.

If the override targets a devDependency-only leaf with no runtime exposure (check with `npm ls <pkg>` — if the chain is entirely inside something like `@lhci/cli` or `eslint-plugin-*`, it never ships to users), a major-version override is low-risk even though it looks aggressive in the diff. Say so in the commit message so a reviewer doesn't have to re-derive it.

## Step 5 — If this is also blocking open PRs, consolidate rather than offering options

Because `Security: npm Audit` is a _required_ check, its failure blocks **every** open PR, including ones that could otherwise merge cleanly — and the Dependabot PRs that would eventually fix part of the problem can't themselves pass the gate either, since they don't touch `overrides`. Check for this with the Step 1 PR list.

When two or more PRs sit `BLOCKED` behind this same gate: **build one consolidated branch instead of asking the user to choose between incremental options.** This has been explicitly requested before — don't re-litigate it with an `AskUserQuestion` menu each time.

```
git checkout -b <branch> origin/master
# commit the override fix first, on its own
git fetch origin <branch-1> <branch-2> ...
git merge FETCH_HEAD --no-edit     # a multi-ref fetch merges all of them in one shot if they don't conflict
```

If `package-lock.json` conflicts, take `git checkout --ours package-lock.json` for each conflicting merge, then run one `npm install` at the end to regenerate a consistent lockfile. Resolve genuine `package.json` conflicts by hand, keeping the higher version on each line.

## Step 6 — Verify the full local gate, not just the audit

Before pushing, run everything CI actually gates on:

```
npm ci
npm audit --audit-level=high
npm run lint
npm run format:check
npm run test:run
npm run build
npm run build:standalone
```

All must exit 0. `npm run test:run` should show all suites passing (253/253 as of this writing — if the count has drifted, that's fine, just confirm nothing _failed_).

## Step 7 — Push, open the PR, wait for green, merge

Push with `git push --no-verify` — the local `pre-push` hook is known-broken for unrelated reasons (see `references/repo-gotchas.md`) and Step 6 already proved the checks CI cares about. Open the PR with a body that states the real root cause(s) from Step 3 (GHSA IDs, publish dates, why each override needed to move) and lists `Supersedes: #N, #N` for every PR folded in.

Wait for every check, not just the audit one — and wait **yourself**, as a background task, right after `gh pr create`. **Every wait needs a time cap.** `gh pr checks --watch` and `gh run watch` wait forever, and on 2026-10-08 a GitHub job sat "in progress" with no runner for 66 minutes while two uncapped watchers waited on it silently. Use a capped loop instead, so a stuck job turns into a report rather than a hang:

```powershell
# run_in_background: true — exits when every check has finished, or after 60 min; the notification wakes the session
$cap=(Get-Date).AddMinutes(60)
do { Start-Sleep 60; $c = gh pr checks <N> --json state,name | ConvertFrom-Json
     $pend = @($c | Where-Object { $_.state -in 'PENDING','QUEUED','IN_PROGRESS' })
} while ($pend.Count -gt 0 -and (Get-Date) -lt $cap)
$c | Where-Object { $_.state -notin 'SUCCESS','SKIPPED' } | ForEach-Object { "$($_.state) $($_.name)" }
```

Also start the CLAUDE.md 10-minute status check-in (`CronCreate`) at the beginning of the loop, with the Step 9 end state as its goal, so stalls get caught between waits too.

When it completes, act on the result immediately:

- **All green** → merge (below). Don't ask first.
- **`Lighthouse Mobile Audit` / `Lighthouse CI - Mobile` shows `fail` after ~15 min** → check the run with `gh run view <run-id> --json conclusion,jobs`. If the run's conclusion is `cancelled` with `Install dependencies` cancelled, it's the known cold-cache timeout, not a real failure: `gh run rerun <run-id>`, start the watch again, keep going. The same goes for a `failure` in `Install dependencies` whose log (`gh run view <run-id> --log-failed`) shows `Failed to download Chrome for Testing` during `playwright install` — a transient download error, not the code (2026-10-08, on master). The `Extract metadata` / `Generate job summary` failures that follow it are knock-on noise.
- **A check still pending when the cap hits, or "in progress" with no completed steps for 20+ min** → the job is stuck on GitHub's side (`gh run view <run-id> --json jobs` shows `runnerName: null` and no step progress). `gh run cancel` may not stop it; use `gh api -X POST repos/garybrowndev/PinballAccuracyMemoryTrainer/actions/runs/<run-id>/force-cancel`, then `gh run rerun <run-id>`, and confirm steps start completing before you start the next capped wait. `runnerName` can stay null briefly even on a healthy run, so judge by step progress.
- **Anything else red** → read `gh run view <run-id> --log-failed`, fix it on the branch, push, watch again.

In the Claude desktop app, also bind the PR to the session (`mcp__ccd_pr__get_status`, then `bind_pr` if unbound) so the PR bar shows it — but the background watch is what drives the next step.

**This repo only allows merge commits** (`gh api repos/<owner>/<repo> --jq '.allow_squash_merge,.allow_rebase_merge'` to confirm) — `gh pr merge <N> --squash` will fail here; use `--merge --delete-branch`.

`gh pr merge --delete-branch` prints `cannot delete branch ... used by worktree` when you worked in a worktree — the merge still succeeded and the remote branch is gone; the local branch goes away in Step 9.

`Closes #N` / `Supersedes: #N` in a PR body does **not** auto-close other open PRs — only issues. But when the consolidated branch _merged_ a Dependabot branch (Step 5), GitHub usually marks that PR **merged** on its own, because its head commit is now in master. So check before closing, and close only what's still open:

```
gh pr view <N> --json state --jq .state     # MERGED → nothing to do
gh pr close <N> --comment "Superseded by #<merged-PR>, merged as <sha>." --delete-branch
gh pr list --state open --json number --jq 'length'   # expect 0, or only PRs unrelated to this fix
```

## Step 8 — Verify the whole repo is actually clean, not just the one check

After merging, enumerate **every** workflow run on the exact merge-commit SHA — don't sample a few and assume the rest followed. About 18 workflows start on a master push and take ~15–20 min, so start this as a background task immediately after the merge (`run_in_background: true`); it exits once all of them have completed and prints the final table:

```powershell
$sha='<merge-sha-short>'; $deadline=(Get-Date).AddMinutes(60)
do { Start-Sleep 60
  $runs = gh run list --branch master --limit 40 --json workflowName,status,conclusion,headSha | ConvertFrom-Json | Where-Object { $_.headSha.StartsWith($sha) }
  $open = @($runs | Where-Object { $_.status -ne 'completed' })
} while ($open.Count -gt 0 -and (Get-Date) -lt $deadline)
$runs | ForEach-Object { "$($_.conclusion ?? $_.status)  $($_.workflowName)" } | Sort-Object
```

Specifically check `CD: Release` — it doesn't run on PRs at all, so a green PR never proves it. Anything red here gets the same treatment as Step 7 (Lighthouse Mobile flake → rerun; real failure → fix).

**`CD: Release` fails whenever any other workflow on the SHA fails.** Its first step waits for the others and aborts with `Workflow <name> failed with conclusion: failure. Aborting deployment.` So a red release is usually a symptom: rerun the failed workflow first, and only once it's green rerun the release (`gh run rerun <release-run-id>`), then watch it to completion. Do both in one background task so the release rerun fires without another prompt.

**While that runs, check Dependabot alerts — they can go up after the merge.** Dependabot rescans the new lockfile on master, and advisories published in the meantime show up as fresh alerts minutes after the merge (2026-10-07: 0 alerts before, 7 medium alerts after). The gate only fails on high/critical, but the end state is zero open alerts, so medium ones count too:

```
gh api "repos/garybrowndev/PinballAccuracyMemoryTrainer/dependabot/alerts?state=open" --jq '.[] | "\(.number) \(.security_advisory.severity) \(.dependency.package.name) \(.security_advisory.ghsa_id) fix=\(.security_vulnerability.first_patched_version.identifier)"'
```

Any non-zero result loops back to Step 3 for those packages (`npm ls <pkg> --all` for the chain, then Step 4's options) — a follow-up branch and PR through Steps 4–8 again. Don't stop at "the gate is green".

## Step 9 — Clean up and confirm the end state

The loop is done only when all of these hold — check each, don't infer it:

| Check                                       | Command                                                | Expect                                      |
| :------------------------------------------ | :----------------------------------------------------- | :------------------------------------------ |
| Every master workflow on the last merge SHA | Step 8 wait script                                     | all `success`                               |
| Open PRs this fix touched                   | `gh pr list --state open`                              | none left                                   |
| Dependabot alerts                           | `...dependabot/alerts?state=open --jq length`          | `0`, or only ones listed as unfixable below |
| Worktree removed                            | `git worktree remove <path>`, then `git worktree list` | main checkout only                          |
| Local branches pruned                       | `git branch -D <branch>`, `git fetch --all --prune`    | no leftover fix branches                    |
| Main checkout current                       | `git pull --ff-only` on master                         | at the merge SHA                            |

If something genuinely can't be fixed right now — no patched version exists (`first_patched_version` is null), or the only fix is a breaking major bump you're not confident in — say so explicitly with the package, advisory, and dependency chain, rather than silently dropping it or silently forcing it. Ask the user before dismissing an alert; dismissal is their call. Then give the final report: what was wrong, what merged (SHAs), the end-state table, and anything left open.
