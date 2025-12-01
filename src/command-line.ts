/*
 * Copyright contributors to the IBM ADS/Decision Intelligence MCP Server project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Command} from 'commander';
import {AuthenticationMode} from "./authentication-mode.js";
import {debug, setDebug} from "./debug.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {Credentials} from "./credentials.js";

export class Configuration {
    static readonly STDIO = "stdio";
    static readonly HTTP = "http";

    static readonly TRANSPORTS: string[] = [Configuration.STDIO, Configuration.HTTP];

    constructor(
        public credentials: Credentials,
        public transport: StdioServerTransport | undefined,
        public url: string,
        public version: string,
        public debugEnabled: boolean,
        public deploymentSpaces: string[] = Configuration.defaultDeploymentSpaces(),
        public decisionServiceIds: string[] | undefined = undefined,
        public pollInterval: number = Configuration.defaultPollInterval()
    ) {
    }

    static defaultTransport(): string {
        return Configuration.STDIO;
    }

    static defaultDeploymentSpaces(): string[] {
        return ['development'];
    }

    static defaultPollInterval(): number {
        return 30000; // 30 seconds in milliseconds
    }

    isStdioTransport(): boolean {
        return this.transport !== undefined;
    }

    isHttpTransport(): boolean {
        return this.transport === undefined;
    }

    isDiApiKeyAuthentication(): boolean {
        return this.credentials.authenticationMode === AuthenticationMode.DI_API_KEY;
    }

    isZenAPiKeyAuthentication(): boolean {
        return this.credentials.authenticationMode === AuthenticationMode.ZEN_API_KEY;
    }

    isBasicAuthentication(): boolean {
        return this.credentials.authenticationMode === AuthenticationMode.BASIC;
    }
}

// Configuration validation functions
function validateUrl(url: string) : string {
    debug("URL=" + url);
    if (url === undefined) {
        throw new Error('The decision runtime REST API URL is not defined');
    }
    try {
        new URL(url);
        return url;
    } catch {
        throw new Error(`Invalid URL format: '${url}'`);
    }
}

function validateTransport(transport: string) :StdioServerTransport | undefined {
    debug("TRANSPORT=" + transport);
    if (transport === undefined) {
        const defaultTransport = Configuration.defaultTransport();
        debug(`The transport protocol is not defined. Using '${defaultTransport}'`);
        transport = defaultTransport;
    }
    const normalizedTransport = transport.toLowerCase();
    const transports = Configuration.TRANSPORTS.map(s => s.toLowerCase());
    if (!transports.includes(normalizedTransport)) {
        throw new Error(`Invalid transport protocol: '${transport}'. Must be one of: '${transports.join('\', \'')}'`);
    }
    return Configuration.STDIO === normalizedTransport ?  new StdioServerTransport() : undefined;
}

function validateDeploymentSpaces(parseDeploymentSpaceOption: string | undefined): string[] {
    debug("DEPLOYMENT SPACES=" + parseDeploymentSpaceOption);
    const deploymentSpaces = parseDeploymentSpaces(parseDeploymentSpaceOption);
    const invalidDeploymentSpaces: string[] = [];
    const encodedDeploymentSpaces: string[] = [];

    for (const deploymentSpace of deploymentSpaces) {
        try {
            encodedDeploymentSpaces.push(encodeURIComponent(deploymentSpace));
        } catch {
            invalidDeploymentSpaces.push(deploymentSpace);
        }
    }

    const nbOfInvalidDeploymentSpaces = invalidDeploymentSpaces.length;
    if (nbOfInvalidDeploymentSpaces > 0) {
        if (nbOfInvalidDeploymentSpaces === 1) {
            throw new Error(`Invalid deployment space '${invalidDeploymentSpaces[0]}' cannot be URI encoded.`);
        }
        throw new Error(`Invalid deployment spaces '${invalidDeploymentSpaces.join("', '")}' cannot be URI encoded.`);
    }
    return encodedDeploymentSpaces;
}

function parseDeploymentSpaces(deploymentSpaces: string | undefined): string[] {
    if (deploymentSpaces !== undefined) {
        const parsedDeploymentSpaces = deploymentSpaces
            .split(',')
            .map(ds => ds.trim())
            .filter(ds => ds.length > 0);
        if (parsedDeploymentSpaces.length > 0) {
            return parsedDeploymentSpaces;
        }
    }
    return Configuration.defaultDeploymentSpaces();
}

function splitCommaIgnoringEscaped(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let i = 0;
    
    while (i < input.length) {
        if (input[i] === '\\' && i + 1 < input.length && input[i + 1] === ',') {
            current += ',';
            i += 2;
        } else if (input[i] === ',') {
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += input[i];
            i++;
        }
    }
    
    if (current.length > 0) {
        result.push(current.trim());
    }
    
    return result.filter(item => item.length > 0);
}

function parseDecisionServiceIds(decisionServiceIds: string | undefined): string[] | undefined {
    if (decisionServiceIds !== undefined) {
        const ret = splitCommaIgnoringEscaped(decisionServiceIds);
        if (ret.length > 0) {
            return ret;
        }
    }
    return undefined;
}

function validatePollInterval(pollInterval: string | undefined): number {
    debug("POLL_INTERVAL=" + pollInterval);
    if (pollInterval === undefined) {
        const defaultPollInterval = Configuration.defaultPollInterval();
        debug(`The poll interval is not defined. Using '${defaultPollInterval}' milliseconds`);
        return defaultPollInterval;
    }
    const parsedInterval = parseInt(pollInterval, 10);
    if (isNaN(parsedInterval)) {
        throw new Error(`Invalid poll interval: '${pollInterval}'. Must be a valid number in milliseconds.`);
    }
    if (parsedInterval < 1000) {
        throw new Error(`Invalid poll interval: '${pollInterval}'. Must be at least 1000 milliseconds (1 second).`);
    }
    return parsedInterval;
}

export function createConfiguration(version: string, cliArguments?: readonly string[]): Configuration {
    const program = new Command();
    program
        .name("di-mcp-server")
        .description("MCP Server for IBM Decision Intelligence")
        .version(version)
        .option('--debug', 'Enable debug output')
        .option('--url <string>', "Base URL for the decision runtime API, required. Or set the 'URL' environment variable")
        .option("--authentication-mode <authentication-mode>", "Authentication mode to access the target decision runtime: 'diapikey', 'zenapikey' or 'basic'. Default value is 'diapikey'")
        .option('--di-apikey <string>', "API key for the Decision Intelligence API key authentication")
        .option('--zen-apikey <string>', "API key for the Zen API key authentication")
        .option('--zen-username <string>', "Username for the Zen API key authentication")
        .option('--basic-username <string>', "Username for the basic authentication")
        .option('--basic-password <string>', "Password for the basic authentication")
        .option('--transport <transport>', "Transport mode: 'stdio' or 'http'")
        .option('--deployment-spaces <list>', "Comma-separated list of deployment spaces to scan (default: 'development')")
        .option('--decision-service-ids <list>', 'If defined, comma-separated list of decision service ids to be exposed as tools')
        .option('--poll-interval <milliseconds>', 'Interval in milliseconds for polling tool changes (default: 30000, minimum: 1000)');

    program.parse(cliArguments);

    const options = program.opts();
    const debugFlag = Boolean(options.debug || process.env.DEBUG === "true");
    setDebug(debugFlag);

    // Validate all options;
    const credentials = Credentials.validateCredentials(options);
    const transport = validateTransport(options.transport || process.env.TRANSPORT);
    const url = validateUrl(options.url || process.env.URL);
    const deploymentSpaces = validateDeploymentSpaces(options.deploymentSpaces || process.env.DEPLOYMENT_SPACES);
    const decisionServiceIds = parseDecisionServiceIds(options.decisionServiceIds || process.env.DECISION_SERVICE_IDS);
    const pollInterval = validatePollInterval(options.pollInterval || process.env.POLL_INTERVAL);
 
    // Create and return configuration object
    return new Configuration(credentials, transport, url, version, debugFlag, deploymentSpaces, decisionServiceIds, pollInterval);
}