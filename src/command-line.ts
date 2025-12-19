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
    // Public contract (CLI/env/docs) is in seconds
    private static readonly MIN_POLL_INTERVAL_S = 1;
    private static readonly DEFAULT_POLL_INTERVAL_S = 30;
    private static readonly MS_IN_ONE_SECOND = 1000;
    private static readonly MS_IN_ONE_MINUTE = 60_000;


    constructor(
        public credentials: Credentials,
        public transport: StdioServerTransport | undefined,
        public url: string,
        public version: string,
        public debugEnabled: boolean,
        public deploymentSpaces: string[] = Configuration.defaultDeploymentSpaces(),
        public decisionServiceIds: string[] | undefined = undefined,
        // Stored internally in milliseconds so tests and timers can use small values
        public pollIntervalMs: number = Configuration.defaultPollIntervalMs()
    ) {
    }

    static defaultTransport(): string {
        return Configuration.STDIO;
    }

    static defaultDeploymentSpaces(): string[] {
        return ['development'];
    }

    /**
     * Default poll interval expressed in seconds (as exposed to users).
     */
    private static defaultPollInterval(): number {
        return Configuration.DEFAULT_POLL_INTERVAL_S;
    }

    /**
     * Default poll interval expressed in milliseconds (internal representation).
     */
    static defaultPollIntervalMs(): number {
        return Configuration.defaultPollInterval() * Configuration.MS_IN_ONE_SECOND;
    }

    /**
     * Validates the poll interval provided via CLI or environment.
     *
     * The user-facing contract is in **seconds**, but the returned value is in **milliseconds**
     * so that the rest of the codebase (and tests) can work with millisecond precision.
     */
    static validatePollInterval(pollInterval: string | undefined): number {
        debug("DECISIONS_POLL_INTERVAL=" + pollInterval);
        if (pollInterval === undefined) {
            const defaultPollInterval = Configuration.defaultPollInterval();
            debug(`The poll interval is not defined. Using '${defaultPollInterval}' seconds.`);
            return Configuration.defaultPollIntervalMs();
        }
        const parsedIntervalSeconds = parseInt(pollInterval, 10);
        if (isNaN(parsedIntervalSeconds)) {
            throw new Error(`Invalid poll interval: '${pollInterval}'. Must be a valid number in seconds.`);
        }
        if (parsedIntervalSeconds < Configuration.MIN_POLL_INTERVAL_S) {
            throw new Error(`Invalid poll interval: '${pollInterval}'. Must be at least ${Configuration.MIN_POLL_INTERVAL_S} second.`);
        }
        // Return milliseconds for internal consumption
        return parsedIntervalSeconds * Configuration.MS_IN_ONE_SECOND;
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

    formattedPollInterval() {
        // < 1 second → milliseconds
        const ms = this.pollIntervalMs;
        const oneSecondMs = Configuration.MS_IN_ONE_SECOND;
        if (ms < oneSecondMs) {
            return `${ms}ms`;
        }

        const oneMinuteMs = Configuration.MS_IN_ONE_MINUTE;
        const minutes = Math.floor(ms / oneMinuteMs);
        const remainingMs = ms % oneMinuteMs;
        // minutes + seconds
        if (minutes > 0) {
            if (remainingMs === 0) {
                return `${minutes}min`;
            }

            // exact seconds
            if (remainingMs % 1_000 === 0) {
                return `${minutes}min ${remainingMs / 1_000}s`;
            }

            return `${minutes}min ${(remainingMs / oneSecondMs).toFixed(3)}s`;
        }
        // seconds only
        if (ms % 1_000 === 0) {
            return `${ms / 1_000}s`;
        }
        return `${(ms / oneSecondMs).toFixed(3)}s`;
    }
}

// Environment variable names
export const EnvironmentVariables = {
    DEBUG: 'DEBUG',
    URL: 'URL',
    TRANSPORT: 'TRANSPORT',
    AUTHENTICATION_MODE: 'AUTHENTICATION_MODE',
    DI_APIKEY: 'DI_APIKEY',
    ZEN_APIKEY: 'ZEN_APIKEY',
    ZEN_USERNAME: 'ZEN_USERNAME',
    BASIC_USERNAME: 'BASIC_USERNAME',
    BASIC_PASSWORD: 'BASIC_PASSWORD',
    DEPLOYMENT_SPACES: 'DEPLOYMENT_SPACES',
    DECISION_SERVICE_IDS: 'DECISION_SERVICE_IDS',
    DECISIONS_POLL_INTERVAL: 'DECISIONS_POLL_INTERVAL'
} as const;

/**
 * Resolves an option value by checking the CLI option first, then falling back to environment variable
 * @param optionValue - The value from CLI options
 * @param envVarName - The environment variable name to check
 * @returns The resolved value or undefined
 */
export function resolveOption(
    optionValue: string | undefined,
    envVarName: string
): string | undefined {
    return optionValue || process.env[envVarName];
}

// Configuration validation functions
function validateUrl(url: string | undefined) : string {
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

function validateTransport(transport: string | undefined) :StdioServerTransport | undefined {
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

/**
 * Creates and configures the Commander program with all CLI options
 * @param version - The version string for the application
 * @returns Configured Commander program
 */
function createCommanderProgram(version: string): Command {
    const program = new Command();
    return program
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
        .option('--decisions-poll-interval <milliseconds>', 'Interval in s for polling tool changes (default: 30000, minimum: 1000)');
}

export function createConfiguration(version: string, cliArguments?: readonly string[]): Configuration {
    const program = createCommanderProgram(version);
    program.parse(cliArguments);

    const options = program.opts();
    const debugFlag = Boolean(options.debug || resolveOption(undefined, EnvironmentVariables.DEBUG) === "true");
    setDebug(debugFlag);

    // Validate all options
    const credentials = Credentials.validateCredentials(options);
    const transport = validateTransport(resolveOption(options.transport, EnvironmentVariables.TRANSPORT));
    const url = validateUrl(resolveOption(options.url, EnvironmentVariables.URL));
    const deploymentSpaces = validateDeploymentSpaces(resolveOption(options.deploymentSpaces, EnvironmentVariables.DEPLOYMENT_SPACES));
    const decisionServiceIds = parseDecisionServiceIds(resolveOption(options.decisionServiceIds, EnvironmentVariables.DECISION_SERVICE_IDS));
    const pollIntervalMs = Configuration.validatePollInterval(resolveOption(options.decisionsPollInterval, EnvironmentVariables.DECISIONS_POLL_INTERVAL));
 
    // Create and return the configuration object
    return new Configuration(credentials, transport, url, version, debugFlag, deploymentSpaces, decisionServiceIds, pollIntervalMs);
}