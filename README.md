# Watchtower Update for GitHub Actions

Trigger Docker container updates via [Watchtower's HTTP API](https://github.com/nicholas-fedor/watchtower) from GitHub Actions.

## Setup

Add the following secrets in your repository settings (`Settings > Secrets > Actions`):

| Secret | Description | Example |
|--------|-------------|---------|
| `WATCHTOWER_URL` | Base URL or full `/v1/update` endpoint | `https://watchtower.example.com` |
| `WATCHTOWER_API_TOKEN` | Bearer token for authentication | `398ea9ce7d9e572684720305d267da61` |

The action automatically appends `/v1/update` if the URL doesn't already include it.

## Usage

### Update all containers

```yaml
- name: Deploy
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}
```

### Update specific images

```yaml
- name: Deploy
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}
    images: "myrepo/app,myrepo/worker"
```

### With Cloudflare Access headers

```yaml
- name: Deploy
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}
    headers: |
      {
        "CF-Access-Client-Id": "${{ secrets.CF_ACCESS_CLIENT_ID }}",
        "CF-Access-Client-Secret": "${{ secrets.CF_ACCESS_CLIENT_SECRET }}"
      }
```

### With retries and custom timeout

```yaml
- name: Deploy
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}
    timeout: "60"
    retry_count: "3"
    retry_delay: "15"
```

### Non-blocking (warn instead of fail)

```yaml
- name: Deploy
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}
    fail_on_error: "false"
```

### Using outputs

```yaml
- name: Deploy
  id: watchtower
  uses: bludesign/watchtower-update@v4
  with:
    url: ${{ secrets.WATCHTOWER_URL }}
    api_token: ${{ secrets.WATCHTOWER_API_TOKEN }}

- name: Check results
  run: |
    echo "Status: ${{ steps.watchtower.outputs.status_code }}"
    echo "Updated: ${{ steps.watchtower.outputs.updated }}"
    echo "Failed: ${{ steps.watchtower.outputs.failed }}"
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | Yes | | Watchtower URL (base or full `/v1/update` endpoint) |
| `api_token` | Yes | | Bearer token for HTTP API authentication |
| `images` | No | | Comma-separated Docker images to update |
| `containers` | No | | Alias for `images` |
| `headers` | No | | Additional HTTP headers as JSON object |
| `timeout` | No | `30` | Request timeout in seconds |
| `retry_count` | No | `0` | Number of retries on failure |
| `retry_delay` | No | `10` | Seconds between retries (429 uses Retry-After header) |
| `fail_on_error` | No | `true` | Set `false` to warn instead of failing on errors |

## Outputs

| Output | Description |
|--------|-------------|
| `status_code` | HTTP status code from the response |
| `response` | Full JSON response body |
| `scanned` | Number of containers scanned |
| `updated` | Number of containers updated |
| `failed` | Number of containers that failed to update |

## License

MIT
