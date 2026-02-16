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
npm run dev -- --apikey <APIKEY> --url <URL>
```
#### Using environment variables
```bash
APIKEY=<APIKEY> URL=<URL> npm run dev
```
#### Releasing a new version

- Checkout the main branch
- Build and test the project:
  - npm ci
  - npm run build
  - npm run test
- Create a new branch for the release
- Bump the version in `package.json`
- Commit the changes, push to the release branch and create a pull request
- Merge the release branch into main
- Create a new release in GitHub
- Run npm pack
- Test the produced `di-mcp-server-X.Y.Z.tgz` npm package locally in target IDEs:
  - IBM Bob
- Publish the new version to NPM
   - npm login
   - npm publish 
- Test the new version in target IDEs and IBM watsonx Orchestrate
  - IBM Bob
  - IBM watsonx Orchestrate

