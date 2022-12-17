import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

interface Indicator {
  start: number
  end: number
}

interface Result {
  exit_rule: number
  indicators: Indicator[]
  error: string
  suggestion?: string
}

interface FatResult {
  lnr: number
  line: string
  result: Result
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('token')
    const octokit = github.getOctokit(token)
    // execute linting
    const path = core.getInput('lint-path')
    const filesToCheck = core.getInput('files').split('\n')

    let jsonOutput = ''
    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          jsonOutput += data.toString()
        }
      },
      ignoreReturnCode: true
    }
    await exec.exec(
      'python',
      [`${path}/main.py`, 'json', ...filesToCheck],
      options
    )
    core.info(`Output Start`)
    core.info(jsonOutput)
    core.info('Output End')

    // parse output
    const issues: {[file: string]: FatResult[]} = JSON.parse(jsonOutput)
    core.info(`Parsed: ${issues}`)

    // if no keys were found, auto approve pull request
    if (Object.keys(issues).length === 0) {
      if (core.getBooleanInput('auto-approve')) {
        core.info('Approving PR ...')
        // get pull request number
        const pullRequest = github.context.payload.pull_request
        if (!pullRequest) {
          throw new Error(
            'auto-approve requires the action to be run in a pull_request event'
          )
        }
        await octokit.rest.pulls.createReview({
          pull_number: pullRequest.number,
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          body: core.getInput('auto-approve-message'),
          event: 'APPROVE'
        })
      }
      return
    }

    for (const file of Object.keys(issues)) {
      for (const issue of issues[file]) {
        let startColumn: number | undefined = undefined
        let endColumn: number | undefined = undefined

        // get smallest start colunm
        for (const indicator of issue.result.indicators) {
          if (startColumn === undefined || indicator.start < startColumn) {
            startColumn = indicator.start
          }
          if (endColumn === undefined || indicator.end > endColumn) {
            endColumn = indicator.end
          }
        }

        core.error(issue.result.error, {
          title: 'fff-ir-lint',
          file,
          startLine: issue.lnr,
          endLine: issue.lnr,
          startColumn,
          endColumn
        })
      }
    }

    if (core.getBooleanInput('auto-request-changes')) {
      core.info('Requesting Changes ...')
      // get pull request number
      const pullRequest = github.context.payload.pull_request
      if (!pullRequest) {
        throw new Error(
          'auto-reject requires the action to be run in a pull_request event'
        )
      }
      await octokit.rest.pulls.createReview({
        pull_number: pullRequest.number,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        body: core.getInput('auto-request-changes-message'),
        event: 'REQUEST_CHANGES'
      })
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
