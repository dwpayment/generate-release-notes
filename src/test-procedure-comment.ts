import { Octokit, Issue, IssueComment } from "./types"
import * as github from "@actions/github"

export async function generateTestProcedureComment(
  kit: Octokit,
  comments: IssueComment[],
  issue: Issue
): Promise<void> {
  const { repo } = github.context
  const signature = "<!-- test procedure DO NOT REMOVE THIS LINE -->"

  const commented = comments.find(
    c => c.user?.type === "Bot" && c.body?.includes(signature)
  )

  if (!commented)
    await kit.rest.issues.createComment({
      issue_number: issue.number,
      ...repo,
      body: `### 検証手順\nここに検証手順を含めてください\n\n${signature}`
    })
}
