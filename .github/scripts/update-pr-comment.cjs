/* eslint-disable no-console */
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

    // Extract the marker and main title
    const markerMatch = content.match(/^<!--.*?-->\n# .+?\n\n/s);
    const preamble = markerMatch ? markerMatch[0] : '';

    // Extract all sections (## headers and their content)
    const sectionRegex = /## (.+?)\n([\S\s]*?)(?=\n## |$)/g;
    const sections = new Map();
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionHeader = match[1].trim();
      const sectionBody = match[2].trim();
      sections.set(sectionHeader, `## ${match[1]}\n\n${sectionBody}`);
    }

    // Update or add the new section
    sections.set(headerContent, newSection);

    // Sort sections alphabetically by header (case-insensitive)
    const sortedSections = [...sections.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([, sectionContent]) => sectionContent);

    // Reconstruct the comment with sorted sections
    content = preamble + sortedSections.join('\n\n');

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
