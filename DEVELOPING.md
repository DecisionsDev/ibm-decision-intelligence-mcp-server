# Developing the MCP server

You can develop your own MCP server by using the source files that are available here.

### Getting source files

Run the following command to get the source files of the MCP server:

```bash
git clone https://github.com/DecisionsDev/di-mcp-server.git
cd di-mcp-server
```

### Building the MCP server

Run the following commands to build the MCP server from the source files:

```bash
npm install
npm run build
```

### Testing the MCP server

Run the following command to test the MCP server:

```bash
npm test
```

### Code coverage

The project is configured with Jest's built-in code coverage capabilities. To generate a code coverage report, run the following command:

```bash
npm run test:coverage
```

This will:
1. Run all tests in the project
2. Generate a coverage report showing which parts of the code are covered by tests
3. Create detailed reports in the `coverage` directory

The coverage report includes:
- Statement coverage: percentage of code statements executed (**96%**)
- Branch coverage: percentage of control structures (if/else, switch) executed (**90%**)
- Function coverage: percentage of functions called (**100%**)
- Line coverage: percentage of executable lines executed (**96%**)

Coverage thresholds are  set to 96%, 90%, 100% and 96% respectively for statements, branches, functions, and lines. If the coverage falls below these thresholds, the `npm run test:coverage` command fails.

To view the detailed HTML coverage report, open `coverage/lcov-report/index.html` in your browser after running the coverage command.
### Running the MCP server in development mode with `nodemon`

Run the MCP server with `nodemon` and the `DEBUG` environment variable:
- The server is restarted whenever changes are detected on the source code.
- Debug output is enabled.

#### Using command line options
```bash
npm run dev -- --zen-username <ZEN_USERNAME> --zen-apikey <APIKEY> --url <URL>
```
#### Using environment variables
```bash
ZEN_USERNAME=<ZEN_USERNAME> ZEN_APIKEY=<APIKEY> URL=<URL> npm run dev
```

#### Releasing a new version

> **Always release and publish from an up-to-date `main` branch, never from a
> PR or release branch.** This keeps what is published to npmjs in sync with
> what is tagged in git. Published versions are immutable, so a mismatch cannot
> be fixed afterwards.

1. Create the release PR
   - Checkout `main` and pull the latest changes
   - Create a release branch
   - Bump the version in BOTH `package.json` and `package-lock.json`:
     `npm version <X.Y.Z> --no-git-tag-version`
   - Commit, push the branch and open a pull request
   - Merge the PR into `main`

2. Build and test from `main`
   - `git checkout main && git pull`
   - `npm ci`
   - `npm run build`
   - `npm run test`

3. Package and verify locally
   - `npm pack`
   - Test the produced `di-mcp-server-X.Y.Z.tgz` locally in the target IDEs:
     - IBM Bob

4. Tag and publish (still on `main`, in sync with `origin/main`)
   - Run the release check: `node scripts/check-release.js`
   - Create a new release in GitHub from `main` (this creates the `X.Y.Z` tag)
   - `npm login`
   - `npm publish di-mcp-server-X.Y.Z.tgz` (publishes the exact tarball you tested)

5. Verify the published version
   - `npm view <package-name> version`
   - Test the new version in the target IDEs and IBM watsonx Orchestrate:
     - IBM Bob
     - IBM watsonx Orchestrate

If a published version turns out to be broken, do not try to republish it.
Release a new patch version and, if needed, run `npm deprecate` on the bad one.
