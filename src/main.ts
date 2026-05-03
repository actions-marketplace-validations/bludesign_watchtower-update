import * as core from '@actions/core'
import axios, {AxiosError, AxiosResponse} from 'axios'

interface WatchtowerResponse {
  summary?: {
    scanned?: number
    updated?: number
    failed?: number
    restarted?: number
    skipped?: number
  }
  timing?: {
    duration_ms?: number
    duration?: string
  }
  timestamp?: string
  api_version?: string
  error?: string
}

type Headers = Record<string, string>

function buildUrl(raw: string, images: string[]): string {
  let base = raw.replace(/\/+$/, '')
  if (!base.endsWith('/v1/update')) {
    base = `${base}/v1/update`
  }
  if (images.length > 0) {
    return `${base}?image=${images.join(',')}`
  }
  return base
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendUpdate(
  url: string,
  apiToken: string,
  extraHeaders: Headers,
  timeoutMs: number
): Promise<AxiosResponse<WatchtowerResponse>> {
  return axios<WatchtowerResponse>({
    method: 'POST',
    url,
    data: null,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...extraHeaders
    },
    timeout: timeoutMs,
    maxRedirects: 5,
    validateStatus: () => true,
    beforeRedirect: (options: Record<string, unknown>) => {
      options.method = 'POST'
    }
  })
}

async function run(): Promise<void> {
  try {
    const apiToken = core.getInput('api_token', {required: true})
    const rawUrl = core.getInput('url', {required: true})
    const failOnError =
      core.getInput('fail_on_error').toLowerCase() !== 'false'
    const timeoutSec = parseInt(core.getInput('timeout') || '30', 10)
    const retryCount = parseInt(core.getInput('retry_count') || '0', 10)
    const retryDelay = parseInt(core.getInput('retry_delay') || '10', 10)

    const rawImages = core.getInput('images') || core.getInput('containers')
    const images = rawImages
      ? rawImages
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : []

    let extraHeaders: Headers = {}
    const rawHeaders = core.getInput('headers')
    if (rawHeaders) {
      extraHeaders = JSON.parse(rawHeaders)
    }

    const url = buildUrl(rawUrl, images)
    const timeoutMs = timeoutSec * 1000

    core.info(`Watchtower endpoint: ${url}`)
    if (images.length > 0) {
      core.info(`Targeting images: ${images.join(', ')}`)
    } else {
      core.info('Triggering full update (all monitored containers)')
    }

    let lastResponse: AxiosResponse<WatchtowerResponse> | undefined
    let attempt = 0
    const maxAttempts = 1 + Math.max(0, retryCount)

    while (attempt < maxAttempts) {
      attempt++
      if (attempt > 1) {
        core.info(`Retry attempt ${attempt - 1}/${retryCount}...`)
      }

      try {
        lastResponse = await sendUpdate(url, apiToken, extraHeaders, timeoutMs)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unknown request error'
        core.warning(`Request failed: ${msg}`)
        if (attempt < maxAttempts) {
          core.info(`Waiting ${retryDelay}s before retry...`)
          await sleep(retryDelay * 1000)
          continue
        }
        break
      }

      const status = lastResponse.status
      core.info(`Response status: ${status}`)

      if (status === 200) {
        break
      }

      if (status === 429) {
        const retryAfter = parseInt(
          lastResponse.headers['retry-after'] || `${retryDelay}`,
          10
        )
        core.warning(
          `Update already in progress (429). Retrying after ${retryAfter}s...`
        )
        if (attempt < maxAttempts) {
          await sleep(retryAfter * 1000)
          continue
        }
      }

      if (status === 401) {
        core.error('Authentication failed (401). Check your api_token.')
        break
      }

      if (attempt < maxAttempts) {
        core.warning(`HTTP ${status} - retrying in ${retryDelay}s...`)
        await sleep(retryDelay * 1000)
        continue
      }

      break
    }

    if (!lastResponse) {
      const msg = 'All request attempts failed with no response'
      if (failOnError) {
        core.setFailed(msg)
      } else {
        core.warning(msg)
      }
      return
    }

    const status = lastResponse.status
    const body = lastResponse.data

    core.setOutput('status_code', status)
    core.setOutput('response', JSON.stringify(body))

    if (body?.summary) {
      core.setOutput('scanned', body.summary.scanned ?? 0)
      core.setOutput('updated', body.summary.updated ?? 0)
      core.setOutput('failed', body.summary.failed ?? 0)
    }

    if (status === 200) {
      const s = body?.summary
      if (s) {
        core.info(
          `Update complete: ${s.scanned ?? 0} scanned, ${s.updated ?? 0} updated, ${s.failed ?? 0} failed`
        )
      } else {
        core.info('Update completed successfully')
      }
      if (body?.timing?.duration) {
        core.info(`Duration: ${body.timing.duration}`)
      }
    } else {
      const errMsg = body?.error || `HTTP ${status}`
      const msg = `Watchtower update failed: ${errMsg}`
      if (failOnError) {
        core.setFailed(msg)
      } else {
        core.warning(msg)
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
