import * as core from "@actions/core"
import * as github from "@actions/github"
import { execute } from "./execute"
import lodash from "lodash"

async function run(): Promise<void> {
  try {
    const base = core.getInput("base", { required: true })
    const head = core.getInput("head", { required: true })
    //const template = core.getInput("comment-template")
    const token = core.getInput("token", { required: true })
    const kit = github.getOctokit(token)

    const issues = await kit.rest.issues.list({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      labels: "release",
      state: "open"
    })

    for (const issue of issues.data) {
      const comments = (
        await kit.rest.issues.listComments({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: issue.number
        })
      ).data

      const commentCtx = {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
      }

      const baseCommitCommented = comments.find(
        c => c.user?.type === "Bot" && c.body?.includes("BASE_COMMIT: ")
      )

      const baseCommitId = (
        baseCommitCommented?.body
          ? baseCommitCommented.body.replace("BASE_COMMIT: ", "")
          : await execute(`git rev-parse ${base}`)
      ).replace("\n", "")

      if (!baseCommitCommented)
        await kit.rest.issues.createComment({
          issue_number: issue.number,
          ...commentCtx,
          body: `BASE_COMMIT: ${baseCommitId}`
        })

      const numbers = (
        await execute(
          `/bin/bash -c "git log --merges ${baseCommitId}..${head} --first-parent --grep='Merge pull request #' --format='%s' | sed -n 's/^.*Merge pull request #\\s*\\([0-9]*\\).*$/\\1/p'"`
        )
      ).split("\n")

      const prs = (
        await Promise.allSettled(
          numbers
            .map(num => Number(num))
            .map(async num =>
              kit.rest.pulls.get({
                ...commentCtx,
                pull_number: num
              })
            )
        )
      )
        .filter(pr => pr.status === "fulfilled")
        .map(pr => {
          if (pr.status === "rejected") throw new Error() // HACK
          return pr.value
        })

      const features = prs.filter(pr =>
        pr.data.labels.some(l => l.name === "enhancement")
      )

      const bugs = prs.filter(pr => pr.data.labels.some(l => l.name === "bug"))
      const chores = prs.filter(pr =>
        pr.data.labels.some(l => l.name === "chore" || l.name === "style")
      )
      const refactors = prs.filter(pr =>
        pr.data.labels.some(l => l.name === "refactor")
      )
      const tests = prs.filter(pr =>
        pr.data.labels.some(l => l.name === "test")
      )

      const migrations = prs.filter(pr =>
        pr.data.labels.some(l => l.name === "migration needed")
      )

      let body = "今回のリリースで投入されるPRは以下の通りです。\n\n"

      const addBodySegment = (name: string, requests: typeof prs): void => {
        if (!requests.some(_ => true)) return
        body += [
          `## ${name}\n\n`,
          requests.map(r => `* #${r.data.number}`).join("\n"),
          "\n\n"
        ].join("")
      }

      addBodySegment("機能実装", features)
      addBodySegment("不具合修正", bugs)
      addBodySegment("開発環境整備", chores)
      addBodySegment("リファクタリング", refactors)
      addBodySegment("テスト", tests)
      addBodySegment("マイグレーション必須", migrations)

      let others: number[] = prs.map(pr => pr.data.number)
      others = lodash.difference(
        others,
        features.map(pr => pr.data.number)
      )
      others = lodash.difference(
        others,
        bugs.map(pr => pr.data.number)
      )
      others = lodash.difference(
        others,
        chores.map(pr => pr.data.number)
      )
      others = lodash.difference(
        others,
        refactors.map(pr => pr.data.number)
      )
      others = lodash.difference(
        others,
        tests.map(pr => pr.data.number)
      )
      others = lodash.difference(
        others,
        migrations.map(pr => pr.data.number)
      )
      addBodySegment(
        "その他",
        prs.filter(pr => others.includes(pr.data.number))
      )

      body += `<div align="right"><sup><sub>by generate-release-notes</sub></sup></div>`

      const commented = comments.find(
        c =>
          c.user?.type === "Bot" &&
          c.body?.includes("by generate-release-notes")
      )

      const releaseNotesCtx = { ...commentCtx, body }

      if (commented)
        await kit.rest.issues.updateComment({
          comment_id: commented.id,
          ...releaseNotesCtx
        })
      else
        await kit.rest.issues.createComment({
          issue_number: issue.number,
          ...releaseNotesCtx
        })
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
