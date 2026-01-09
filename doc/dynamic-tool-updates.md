# Dynamic Tool Updates

The MCP server implements the `listChanged` capability, which allows it to automatically notify connected clients when the list of available tools changes. This feature enables real-time updates without requiring a server restart.

## How it works

1. **Initial Tool Discovery**: When the server starts, it discovers and registers all available decision service operations as MCP tools.

2. **Continuous Monitoring**: The server polls the Decision Intelligence or Automation Decision Services runtime every 30 seconds to check for changes.

3. **Change Detection**: The server detects the following types of changes:
   - **New tools**: When a new decision service operation is deployed
   - **Removed tools**: When a decision service operation is undeployed
   - **Modified tools**: When the input schema of an operation changes

4. **Client Notification**: When changes are detected, the server sends a `notifications/tools/list_changed` notification to all connected clients, prompting them to refresh their tool list.

## Benefits

- **No restart required**: New or updated decision services become available immediately
- **Automatic synchronization**: Clients stay in sync with the latest decision services
- **Seamless updates**: Changes are detected and propagated automatically

## Configuration

The dynamic tool update feature is enabled by default and requires no additional configuration. The decisions polling interval defaults to 30 seconds, which provides a good balance between responsiveness and system load.

You can customize the polling interval using the `--decision-service-poll-interval` option or the `DECISION_SERVICE_POLL_INTERVAL` environment variable:

```bash
# Set polling interval to 60 seconds
npx -y di-mcp-server --di-apikey <YOUR_API_KEY> --url <RUNTIME_URL> --decision-service-poll-interval 60
```

Or using an environment variable:
```bash
export DECISION_SERVICE_POLL_INTERVAL=60
npx -y di-mcp-server --di-apikey <YOUR_API_KEY> --url <RUNTIME_URL>
```
**Note**: The minimum allowed polling interval is 1 second.