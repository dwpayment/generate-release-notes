import * as core from "@actions/core"
import * as github from "@actions/github"
import { generateReleaseNotes } from "./release-notes"
import { generateTestProcedureComment } from "./test-procedure-comment"
import { Issue } from "./types"

async function run(): Promise<void> {
  try {
    const base = core.getInput("base", { required: true })
    const head = core.getInput("head", { required: true })
    //const template = core.getInput("comment-template")
    const token = core.getInput("token", { required: true })
    const isCommentTestProcedure =
      core
        .getInput("test-procedure-comment", { required: true })
        .toLowerCase() === "true"
    const kit = github.getOctokit(token)

    const { repo } = github.context
    let issues: Issue[] = []

    if (github.context.issue?.number) {
      core.info(`Payload issue: #${github.context.issue?.number}`)
      const remoteIssue = (
        await kit.rest.issues.get({
          ...repo,
          issue_number: github.context.issue.number
        })
      ).data

      // Ignore closed issues
      if (
        remoteIssue.state === "open" &&
        remoteIssue.labels.some(l => l === "release")
      ) {
        issues = [remoteIssue]
      }
    }

    if (!issues.some(_ => true))
      issues = (
        await kit.rest.issues.listForRepo({
          ...repo,
          labels: "release",
          state: "open"
        })
      ).data

    for (const issue of issues) {
      core.info(`Processing #${issue.number}`)
      const comments = (
        await kit.rest.issues.listComments({
          ...repo,
          issue_number: issue.number
        })
      ).data
      await generateReleaseNotes(base, head, kit, comments, issue)

      isCommentTestProcedure &&
        generateTestProcedureComment(kit, comments, issue)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
