/* eslint-disable no-console */
/* eslint-disable security/detect-non-literal-regexp */
module.exports = async ({ github, context, header, body, workflowYaml }) => {
  const sha = context.payload.pull_request ? context.payload.pull_request.head.sha : context.sha;
  const shortSha = sha.slice(0, 7);
  const marker = `<!-- report-for-commit-${sha} -->`;
  const { owner, repo } = context.repo;
  const issue_number = context.issue.number;

  if (!issue_number) {
    console.log('No issue number found (not a PR?), skipping comment.');
    return;
  }

  // Find existing comment
  const comments = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number,
  });

  const existingComment = comments.data.find((c) => c.body.includes(marker));

  // Construct header with links
  let headerContent = header;
  if (workflowYaml) {
    const fileUrl = `https://github.com/${owner}/${repo}/blob/${sha}/.github/workflows/${workflowYaml}`;
    headerContent += ` ([${workflowYaml}](${fileUrl}))`;
  }

  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`;
  const newSection = `## ${headerContent}\n\n${body}\n\n[View Workflow Run](${runUrl})`;

  if (existingComment) {
    let content = existingComment.body;

    // Regex to find existing section for this header
    // We assume sections start with "## Header" and end with "## " or end of string
    // We escape the header for regex safety just in case
    const escapedHeader = header.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');
    const sectionRegex = new RegExp(`## ${escapedHeader}[\\s\\S]*?(?=(## |$))`, 'g');

    if (content.match(sectionRegex)) {
      // Replace existing section
      content = content.replace(sectionRegex, `${newSection}\n\n`);
    } else {
      // Append new section
      content += `\n\n${newSection}`;
    }

    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: content,
    });
  } else {
    const initialBody = `${marker}\n# 🤖 Automated PR Report for ${shortSha}\n\n${newSection}`;
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: initialBody,
    });
  }
};
