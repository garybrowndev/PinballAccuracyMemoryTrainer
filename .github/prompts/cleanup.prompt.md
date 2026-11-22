---

You are helping the user clean up their git repository by resetting to master, pulling latest changes, pruning local branches, and ensuring the remote only has master and gh-pages branches. Follow this workflow exactly:

## Step 1: Check Current State

- Check current branch: `git branch --show-current`
- Check if there are uncommitted changes: `git status --porcelain`
- If there are uncommitted changes, ask the user if they want to:
  - Stash them: `git stash`
  - Discard them: `git reset --hard`
  - Stop and let them commit manually
- Report current state to the user

## Step 2: Switch to Master Branch

- Switch to master: `git checkout master`
- If the switch fails, report the error and stop
- Confirm successful switch

## Step 3: Pull Latest Changes

- Fetch all remote changes: `git fetch --all --prune`
- Pull latest master: `git pull origin master`
- If there are conflicts, report them and stop
- Report what was updated

## Step 4: List All Branches

- List local branches: `git branch`
- List remote branches: `git branch -r`
- Present the lists to the user for review

## Step 5: Delete Local Feature Branches

- Get list of local branches excluding master: `git branch | Select-String -Pattern '^\*?\s*master$' -NotMatch | ForEach-Object { $_.Line.Trim('* ').Trim() }`
- For each local branch (excluding master):
  - Ask user for confirmation before deleting
  - Delete the branch: `git branch -D <branch-name>`
  - Report deletion
- If no local branches to delete, report that

## Step 6: Clean Up Remote Branches

- Get list of remote branches: `git branch -r | Select-String -Pattern 'origin/HEAD' -NotMatch | ForEach-Object { $_.Line.Trim() }`
- Identify branches that are NOT master or gh-pages
- For each remote branch that should be deleted:
  - Show the branch to user and ask for confirmation
  - Delete from remote: `git push origin --delete <branch-name>`
  - Report deletion
- If no remote branches to delete, report that

## Step 7: Final Cleanup

- Prune remote tracking branches: `git remote prune origin`
- Run garbage collection: `git gc --prune=now`
- Report completion

## Step 8: Verify Final State

- List remaining local branches: `git branch`
- List remaining remote branches: `git branch -r`
- Current branch: `git branch --show-current`
- Report final state:
  - Local branches should only have: master
  - Remote branches should only have: origin/master, origin/gh-pages
- Confirm cleanup is complete

## Error Handling

- If any step fails, stop immediately and report the error
- Don't delete branches if the user has uncommitted changes (unless stashed/discarded)
- Always ask for confirmation before deleting remote branches (they affect other users)
- If master doesn't exist, report error and stop
- Use PowerShell syntax for all commands (semicolon `;` to chain commands, not `&&`)

## Safety Checks

- Never delete master or gh-pages branches
- Always confirm before deleting remote branches
- Always fetch and pull before deleting to ensure branches are merged
- Warn if deleting a branch that hasn't been merged to master

## Notes

- This is a destructive operation for feature branches
- Stashed changes can be recovered with `git stash pop`
- Remote branch deletion affects all users of the repository
- Use `-D` flag for local branch deletion to force delete even if not merged
- Use `--delete` flag for remote branch deletion
