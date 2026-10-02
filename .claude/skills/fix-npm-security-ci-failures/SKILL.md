---
name: fix-npm-security-ci-failures
description: Diagnose and fix a failing "Security: npm Audit" GitHub Actions check (or any other red/failing CI workflow) on this repo's master branch, including the case where it has blocked a queue of open Dependabot PRs. This has happened repeatedly (2026-07-25, 2026-09-02, 2026-09-19, 2026-09-30) — always the same shape: a GHSA advisory widens its vulnerable-version range to cover a version this repo's package.json `overrides` already pinned, with zero code change, and the check then fails every scheduled run until someone bumps the override. Use this skill whenever the user reports a failing GitHub Actions run, a red "Security: npm Audit" / CI check, a GitHub Actions failure notification/email, a stuck or blocked Dependabot PR, "npm audit is failing again", "the security check is red", "master is failing", or asks to get CI/Actions back to green. Covers the full loop: lay of the land, reproduce, find the true root cause, fix, consolidate blocked PRs if any, merge, verify every workflow goes green, release.
---

# Fix npm security / CI failures on this repo

This repo's `Security: npm Audit` workflow gates on `npm audit --audit-level=high` as a **required status check**. Because `package.json` fixes known-vulnerable transitive dependencies with exact-version or narrow-range `overrides`, the gate can fail on a commit nobody touched — a new GHSA advisory publishes and widens its vulnerable range to cover whatever version an override pinned. This has now happened at least five times (2026-07-19 gate tightened, 2026-07-25, 2026-09-02, 2026-09-19, 2026-09-30/10-01). It will happen again. This skill is the standard loop for diagnosing it, fixing it correctly the first time, and not leaving the PR queue jammed behind it.

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

Wait for every check (`gh pr checks <N>`), not just the audit one. **This repo only allows merge commits** (`gh api repos/<owner>/<repo> --jq '.allow_squash_merge,.allow_rebase_merge'` to confirm) — `gh pr merge <N> --squash` will fail here; use `--merge --delete-branch`.

`Closes #N` / `Supersedes: #N` in a PR body does **not** auto-close other open PRs — only issues. Close each superseded PR explicitly:

```
gh pr close <N> --comment "Superseded by #<merged-PR>, merged as <sha>." --delete-branch
```

## Step 8 — Verify the whole repo is actually clean, not just the one check

After merging, enumerate **every** workflow run on the exact merge-commit SHA — don't sample a few and assume the rest followed:

```
gh run list --branch master --limit 30 --json workflowName,status,conclusion,headSha,createdAt --jq --arg sha <merge-sha-short> '.[] | select(.headSha | startswith($sha)) | "\(.conclusion // .status)  \(.workflowName)"'
```

Specifically check `CD: Release` — it doesn't run on PRs at all, so a green PR never proves it. Confirm Dependabot alerts are at zero:

```
gh api repos/garybrowndev/PinballAccuracyMemoryTrainer/dependabot/alerts?state=open --jq 'length'
```

Prune branches once confirmed merged (`git fetch --all --prune`, `git branch -d` locally for anything fully merged).

## Step 9 — Report what's still open

If anything genuinely can't be fixed right now (no safe override exists, or fixing it requires a breaking major bump you're not confident is safe), say so explicitly rather than silently dropping it or silently forcing it — moderate-severity leftovers that never fixed-available cleanly are normal and don't need to block anything.
