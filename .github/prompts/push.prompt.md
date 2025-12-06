---
description: Lint, commit, push changes, and create PR to master
name: push
argument-hint: Optional commit message
agent: agent
---

You are helping the user commit and push their changes to git, then create a pull request. Follow this workflow exactly:

## Step 1: Review Current Changes

- If you are on master and there are committed changes not yet pushed, create a branch and proceed to step 3
- Use available tools to check what files have been modified
- If there are no changes to commit, check to see if there are unpushed commits
  - If there are unpushed commits, proceed to step 3
  - If there are no changes or unpushed commits, exit gracefully with a message
- Provide a brief summary of the changes found

## Step 2: Generate Commit Message

- Analyze the changes and create a commit message following conventional commit format:
  - Format: `<type>: <description>`
  - Types: `feat` (new feature), `fix` (bug fix), `docs` (documentation), `style` (formatting/styling), `refactor` (code restructuring), `perf` (performance), `test` (tests), `chore` (build/dependencies)
- Keep the first line under 72 characters
- Add bullet points in the body if multiple significant changes exist
- Present the proposed commit message and ask for user approval or modification

## Step 3: Run Lint and Format Check

- Execute: `npm run lint`
- If lint fails, attempt auto-fix: `npm run lint -- --fix`
- Execute: `npm run format:check` to verify Prettier formatting
- If format check fails, suggest running: `npm run format` to auto-format
- If errors remain after auto-fix:
  - Report the errors clearly
  - Ask if the user wants to proceed anyway or fix manually
  - Only proceed to tests if user explicitly approves

**Note:** When committing, Husky pre-commit hooks will automatically run lint and format checks. Pre-push hooks will run tests.

## Step 4: Run Tests

Once lint passes (or user approves proceeding with warnings):

- Execute unit tests: `npm run test:run`
- If unit tests fail:
  - Report the test failures clearly
  - Do NOT proceed to accessibility tests
  - Suggest fixes or ask the user to resolve test failures
- If unit tests pass, execute accessibility unit tests: `npm run test:a11y`
- If accessibility tests fail:
  - Report the violations clearly (WCAG 2.1 AAA violations)
  - Do NOT proceed to E2E tests
  - Suggest fixes or ask the user to resolve accessibility issues
- If accessibility unit tests pass, execute E2E tests: `npm run test:e2e`
- If E2E tests fail:
  - Report the test failures clearly
  - Ask if the user wants to proceed anyway or fix manually
  - Only proceed to E2E accessibility tests if user explicitly approves
- If E2E tests pass, execute E2E accessibility tests: `npm run test:e2e:a11y`
- If E2E accessibility tests fail:
  - Report the accessibility violations clearly
  - Ask if the user wants to proceed anyway or fix manually
  - Only proceed to build if user explicitly approves
- If all tests pass, confirm and proceed to build

## Step 5: Build App

Once tests pass (or user approves proceeding with test failures):

- Execute: `npm run build`
- If build fails:
  - Report the build errors clearly
  - Do NOT proceed to commit
  - Suggest fixes or ask the user to resolve build errors
- If build succeeds, confirm and proceed to branch creation

## Step 6: Create Feature Branch (if on master)

- Check current branch: `git branch --show-current`
- If currently on `master` or `main`:
  - Generate a short, descriptive branch name based on the commit type and summary
  - Format: `<type>/<short-description>` (e.g., `feat/add-dark-mode`, `fix/login-validation`, `chore/update-deps`)
  - Keep branch names lowercase with hyphens, no spaces
  - Create and switch to the new branch: `git checkout -b <branch-name>`
  - Report the new branch name
- If already on a feature branch, continue with that branch

## Step 7: Commit Locally

Once on the correct branch:

- Stage all changes: `git add .`
- Commit with the approved message: `git commit -m "<message>"`
- **Note:** Husky hooks will automatically run:
  - `commit-msg` hook: Validates commit message format (conventional commits)
  - `pre-commit` hook: Runs lint and format checks
  - If hooks fail, the commit will be blocked - fix issues and try again
- If there's nothing to commit (changes already committed), skip to push
- Report the commit hash

## Step 8: Push Branch to Origin

- Push the branch to origin: `git push -u origin <branch-name>`
- **Note:** Husky `pre-push` hook will automatically run all tests before pushing
- If pre-push hook fails, the push will be blocked - fix test failures and try again
- If push fails, suggest the user may need to pull first
- Confirm successful push

## Step 9: Create Pull Request

- Use GitHub tools to create a pull request:
  - Base branch: `master`
  - Head branch: the current feature branch
  - Title: Use the commit message summary (first line)
  - Body: Include the commit message body (bullet points) if present, or a brief description
- Report the PR URL/number

## Error Handling

- If any step fails, stop immediately and report the error
- Don't create PR if push fails
- Don't push if commit fails
- Don't commit if build fails
- Don't build if tests fail (unless user explicitly approves)
- Don't run tests if lint fails (unless user explicitly approves)
- If push fails, suggest the user may need to pull first

## Notes

- All changes will be staged (including untracked files)
- User will review and approve the commit message before committing
- The test step ensures all unit and E2E tests pass before building
- The build step ensures the app compiles successfully before committing
- Branch names are auto-generated from the commit type and description
- PRs are always created against the `master` branch
- Use PowerShell syntax for commands (semicolon `;` to chain commands, not `&&`)
