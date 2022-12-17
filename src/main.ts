import * as core from '@actions/core'
import * as exec from '@actions/exec'
// import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    // const token = core.getInput('token')
    // const octokit = github.getOctokit(token)
    // execute linting
    const path = core.getInput('lint-path')
    const filesToCheck = core.getInput('files').split('\n')

    let jsonOutput = ''
    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          jsonOutput += data.toString()
        }
      }
    }
    await exec.exec(
      'python',
      [`${path}/main.py`, 'json', ...filesToCheck],
      options
    )
    core.info(`Output:`)
    core.info(jsonOutput)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
