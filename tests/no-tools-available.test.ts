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
 * Test suite to reproduce the "Method not found" error that occurs when
 * no tools are available (empty deployment space, no decision services).
 * 
 * This test demonstrates the issue described in PYTHON_CLIENT_ISSUE_ANALYSIS.md:
 * - When no tools exist, registerTool() is never called
 * - Therefore setToolRequestHandlers() is never triggered (lazy initialization)
 * - The tools/list request handler doesn't exist
 * - Client's list_tools() call fails with "Method not found"
 */
describe('STDIO MCP server with no tools intially available', () => {

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
     * Creates a test environment with an EMPTY deployment space (no decision services).
     * This simulates the scenario where no tools will be registered.
     */
    function createEmptyDeploymentSpaceEnvironment() {
        const deploymentSpace = 'empty-space';
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
            undefined
        );

        // Mock the metadata endpoint to return an EMPTY list of decision services
        const encodedDeploymentSpace = encodeURIComponent(deploymentSpace);
        const credentials = configuration.credentials;
        const headerValue = credentials.getAuthorizationHeaderValue();
        const headerKey = credentials.getAuthorizationHeaderKey();
        const userAgentHeader = 'User-Agent';
        const userAgentValue = `IBM-DI-MCP-Server/${configuration.version}`;

        nock(configuration.url)
            .get(`/deploymentSpaces/${encodedDeploymentSpace}/metadata?names=decisionServiceId`)
            .matchHeader(userAgentHeader, userAgentValue)
            .matchHeader(headerKey, headerValue)
            .reply(200, []); // Empty array - no decision services available

        return {
            transport,
            clientTransport,
            configuration
        };
    }

    test('should handle list_tools request even when no tools are available', async () => {
        const { transport, clientTransport, configuration } = createEmptyDeploymentSpaceEnvironment();
        let server: McpServer | undefined;
        
        try {
            // Create the MCP server with empty deployment space
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            // Create and connect a client (simulating Python client behavior)
            const client = await createAndConnectClient(clientTransport);

            // This is where the Python client fails with "Method not found"
            // when no tools are available, because setToolRequestHandlers() was never called
            const toolList = await client.listTools();

            // The server should return an empty list, not throw "Method not found"
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
});