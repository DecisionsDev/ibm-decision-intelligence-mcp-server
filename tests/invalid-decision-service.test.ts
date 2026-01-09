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

import {JSONRPCMessage, MessageExtraInfo} from "@modelcontextprotocol/sdk/types.js";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {Configuration} from "../src/command-line.js";
import {createMcpServer} from "../src/mcp-server.js";
import {PassThrough, Readable, Writable} from 'stream';
import {Credentials} from "../src/credentials.js";
import {createAndConnectClient} from "./test-utils.js";
import nock from "nock";

/**
 * Test suite to reproduce the error that occurs when an invalid decision service ID
 * is provided, causing the API to return an error response with incident information.
 * 
 * The issue:
 * - When getDecisionServiceOpenAPI() is called with an invalid decision service ID
 * - The API returns a 200 response with an incident object instead of OpenAPI spec
 * - The code doesn't handle this error case, causing the server to abort
 * - No tools are registered, and the server fails to start properly
 */
describe('MCP server with invalid decision service ID', () => {

    afterEach(() => {
        nock.cleanAll();
        jest.clearAllMocks();
    });

    class StreamClientTransport implements Transport {
        public onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
        public onerror?: (error: Error) => void;
        public onclose?: () => void;
        public sessionId?: string;
        public setProtocolVersion?: (version: string) => void;

        constructor(
            private readonly readable: Readable,
            private readonly writable: Writable
        ) {}

        async start(): Promise<void> {
            this.readable.on("data", (chunk: Buffer) => {
                try {
                    const messages = chunk.toString().split('\n').filter(Boolean);
                    for (const line of messages) {
                        const msg: JSONRPCMessage = JSON.parse(line);
                        this.onmessage?.(msg);
                    }
                } catch (e) {
                    this.onerror?.(e instanceof Error ? e : new Error(String(e)));
                }
            });

            this.readable.on("error", (err) => {
                this.onerror?.(err);
            });

            this.readable.on("close", () => {
                this.onclose?.();
            });
        }

        async close(): Promise<void> {
            this.readable.removeAllListeners();
            this.writable.removeAllListeners();
            this.onclose?.();
        }

        async send(message: JSONRPCMessage): Promise<void> {
            const json = JSON.stringify(message) + "\n";
            return new Promise<void>((resolve) => {
                if (this.writable.write(json)) {
                    resolve();
                } else {
                    this.writable.once("drain", resolve);
                }
            });
        }
    }

    /**
     * Creates a test environment with an invalid decision service ID.
     * This simulates the scenario where the API returns an error response.
     */
    function createInvalidDecisionServiceEnvironment() {
        const deploymentSpace = 'development';
        const invalidDecisionServiceId = '645005MK5R/BRA-DI-Test-Decision-Automation/Loan Approval-toto';
        const fakeStdin = new PassThrough();
        const fakeStdout = new PassThrough();
        const transport = new StdioServerTransport(fakeStdin, fakeStdout);
        const clientTransport = new StreamClientTransport(fakeStdout, fakeStdin);
        
        const configuration = new Configuration(
            Credentials.createDiApiKeyCredentials('dummy.api.key'),
            transport,
            'https://example.com',
            '1.2.3',
            true,
            [deploymentSpace],
            [invalidDecisionServiceId]
        );

        const credentials = configuration.credentials;
        const headerValue = credentials.getAuthorizationHeaderValue();
        const headerKey = credentials.getAuthorizationHeaderKey();
        const userAgentHeader = 'User-Agent';
        const userAgentValue = `IBM-DI-MCP-Server/${configuration.version}`;

        // Mock the OpenAPI endpoint to return an error response (as seen in the issue)
        const encodedServiceId = encodeURIComponent(invalidDecisionServiceId);
        nock(configuration.url)
            .get(`/selectors/lastDeployedDecisionService/deploymentSpaces/${deploymentSpace}/openapi?decisionServiceId=${encodedServiceId}&outputFormat=JSON/openapi`)
            .matchHeader(userAgentHeader, userAgentValue)
            .matchHeader(headerKey, headerValue)
            .reply(200, {
                decisionId: null,
                decisionOperation: null,
                executionId: null,
                output: null,
                executionTrace: null,
                incident: {
                    incidentId: 'bdefc395-6fdf-4acf-b615-f35a2206f96c',
                    incidentCategory: 'Decision not found',
                    stackTrace: `The global selector 'lastDeployedDecisionService' did not find any decision service matching the parameters (decisionServiceId = '${invalidDecisionServiceId}', outputFormat = 'JSON/openapi') in deployment space '${deploymentSpace}'`
                }
            });

        return {
            transport,
            clientTransport,
            configuration
        };
    }

    test('should handle invalid decision service ID gracefully without aborting', async () => {
        const { transport, clientTransport, configuration } = createInvalidDecisionServiceEnvironment();
        let server: McpServer | undefined;
        
        try {
            // Create the MCP server with invalid decision service ID
            // This should NOT throw an error, but should log a warning and continue
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            // Create and connect a client
            const client = await createAndConnectClient(clientTransport);

            // The server should still be functional and return an empty tool list
            // (since the invalid decision service was skipped)
            const toolList = await client.listTools();

            expect(toolList).toBeDefined();
            expect(toolList.tools).toBeDefined();
            expect(Array.isArray(toolList.tools)).toBe(true);
            expect(toolList.tools).toHaveLength(0);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should log appropriate error message for invalid decision service', async () => {
        const { transport, clientTransport, configuration } = createInvalidDecisionServiceEnvironment();
        let server: McpServer | undefined;
        
        // Spy on console.error to verify error logging
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;

            // Verify that an error was logged
            expect(consoleErrorSpy).toHaveBeenCalled();
            const errorCalls = consoleErrorSpy.mock.calls;
            const hasRelevantError = errorCalls.some(call => 
                call.some(arg => 
                    typeof arg === 'string' && 
                    (arg.includes('Decision not found') || arg.includes('645005MK5R'))
                )
            );
            expect(hasRelevantError).toBe(true);

        } finally {
            consoleErrorSpy.mockRestore();
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });
});