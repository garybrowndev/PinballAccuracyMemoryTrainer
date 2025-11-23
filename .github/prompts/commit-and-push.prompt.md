---
description: Lint, commit, and push changes to origin
name: commit-and-push
argument-hint: Optional commit message
agent: agent
---

You are helping the user commit and push their changes to git. Follow this workflow exactly:

## Step 1: Review Current Changes
- Use available tools to check what files have been modified
- Provide a brief summary of the changes found

## Step 2: Generate Commit Message
- Analyze the changes and create a commit message following conventional commit format:
  - Format: `<type>: <description>`
  - Types: `feat` (new feature), `fix` (bug fix), `docs` (documentation), `style` (formatting/styling), `refactor` (code restructuring), `perf` (performance), `test` (tests), `chore` (build/dependencies)
- Keep the first line under 72 characters
- Add bullet points in the body if multiple significant changes exist
- Present the proposed commit message and ask for user approval or modification

## Step 3: Run Lint
- Execute: `npm run lint`
- If lint fails, attempt auto-fix: `npm run lint -- --fix`
- If errors remain after auto-fix:
  - Report the errors clearly
  - Ask if the user wants to proceed anyway or fix manually
  - Only proceed to tests if user explicitly approves

## Step 4: Run Tests
Once lint passes (or user approves proceeding with warnings):
- Execute unit tests: `npm run test:run`
- If unit tests fail:
  - Report the test failures clearly
  - Do NOT proceed to E2E tests
  - Suggest fixes or ask the user to resolve test failures
- If unit tests pass, execute E2E tests: `npm run test:e2e`
- If E2E tests fail:
  - Report the test failures clearly
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
- If build succeeds, confirm and proceed to commit

## Step 6: Commit Locally
Once build passes:
- Stage all changes: `git add .`
- Commit with the approved message: `git commit -m "<message>"`
- Report the commit hash

## Step 7: Push to Origin
- Get the current branch name: `git branch --show-current`
- Push to origin: `git push origin <branch-name>`
- Confirm successful push

## Error Handling
- If any step fails, stop immediately and report the error
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
- Use PowerShell syntax for commands (semicolon `;` to chain commands, not `&&`)
