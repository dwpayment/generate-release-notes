import * as github from "@actions/github"
export type UnwrapPromise<T> = T extends PromiseLike<infer U> ? U : T
export type Octokit = ReturnType<typeof github.getOctokit>
export type Issue = UnwrapPromise<
  ReturnType<Octokit["rest"]["issues"]["get"]>
>["data"]
export type IssueComment = UnwrapPromise<
  ReturnType<Octokit["rest"]["issues"]["getComment"]>
>["data"]
