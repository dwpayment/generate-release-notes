import * as exec from "@actions/exec"
import { ExecOptions } from "@actions/exec"

export const execute = async (command: string): Promise<string> => {
  let output = ""
  const options: ExecOptions = {}
  options.listeners = {
    stdout: (data: Buffer) => {
      output += data.toString()
    },
    stderr: (data: Buffer) => {
      console.error(data) // eslint-disable-line no-console
    }
  }
  await exec.exec(command, undefined, options)
  return output
}
