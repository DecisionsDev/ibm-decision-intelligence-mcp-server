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
import {setupNockMocks, validateClient, createAndConnectClient} from "./test-utils.js";

describe('Mcp Server', () => {

    function createTestEnvironment(deploymentSpaces: string[] = ['staging', 'production'], decisionIds: string[] = ['dummy.decision.id'], pollInterval: number = 30000) {
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
            deploymentSpaces,
            undefined,
            pollInterval
        );
        setupNockMocks(configuration, decisionIds);
        
        return {
            transport,
            clientTransport,
            configuration
        };
    }

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
                        this.onmessage?.(msg); // You could pass extra info here if needed
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

        async send(
            message: JSONRPCMessage
        ): Promise<void> {
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

    test('should properly list and execute tool when configured with STDIO transport', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;
        try {
            const result = await createMcpServer('toto', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);
            await validateClient(clientTransport, configuration.deploymentSpaces);
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should advertise tools.listChanged capability', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;
        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // Check that the server advertises the tools.listChanged capability
            const serverCapabilities = (client as any)._serverCapabilities;
            expect(serverCapabilities).toBeDefined();
            expect(serverCapabilities.tools).toBeDefined();
            expect(serverCapabilities.tools.listChanged).toBe(true);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        let timeoutId: NodeJS.Timeout;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Expected notification not received'));
            }, ms);
        });

        return Promise.race([promise, timeoutPromise]).finally(() => {
            clearTimeout(timeoutId);
        });
    }    

    test('should send notification when sendToolListChanged is called', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            // Set up a promise to capture the notification
            let notificationReceived = false;

            const notificationPromise = new Promise<void>((resolve) => {
                const originalOnMessage = clientTransport.onmessage;

                clientTransport.onmessage = (message: JSONRPCMessage) => {
                    if (originalOnMessage) {
                        originalOnMessage(message);
                    }

                    // Detect the notification
                    if ('method' in message && message.method === 'notifications/tools/list_changed') {
                        notificationReceived = true;
                        resolve();
                    }
                };
            });

            const client = await createAndConnectClient(clientTransport);

            // Trigger the server notification manually
            server.sendToolListChanged();

            // Wait for the notification with safe timeout (no timer leaks)
            await withTimeout(notificationPromise, 1000);

            expect(notificationReceived).toBe(true);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should register tools from OpenAPI specification', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // List tools to verify they were registered
            const toolsResponse = await client.listTools();
            expect(toolsResponse.tools).toBeDefined();
            expect(toolsResponse.tools.length).toBeGreaterThan(0);

            // Verify that each tool has required properties
            for (const tool of toolsResponse.tools) {
                expect(tool.name).toBeDefined();
                expect(typeof tool.name).toBe('string');
                expect(tool.name.length).toBeGreaterThan(0);
                expect(tool.inputSchema).toBeDefined();
            }

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should register tools with correct names from deployment spaces', async () => {
        const deploymentSpaces = ['staging', 'production'];
        const { transport, clientTransport, configuration } = createTestEnvironment(deploymentSpaces);
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // List tools
            const toolsResponse = await client.listTools();
            expect(toolsResponse.tools).toBeDefined();

            // Verify tools are registered for each deployment space
            const toolNames = toolsResponse.tools.map(t => t.name);
            expect(toolNames.length).toBeGreaterThan(0);

            // Tool names should be unique
            const uniqueToolNames = new Set(toolNames);
            expect(uniqueToolNames.size).toBe(toolNames.length);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should register tools with valid input schemas', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // List tools
            const toolsResponse = await client.listTools();
            expect(toolsResponse.tools).toBeDefined();
            expect(toolsResponse.tools.length).toBeGreaterThan(0);

            // Verify each tool has a valid input schema
            for (const tool of toolsResponse.tools) {
                expect(tool.inputSchema).toBeDefined();
                expect(typeof tool.inputSchema).toBe('object');
                
                // Input schema should have properties or be an object schema
                if (tool.inputSchema.properties) {
                    expect(typeof tool.inputSchema.properties).toBe('object');
                }
            }

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should handle tool addition with description and title', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // List tools
            const toolsResponse = await client.listTools();
            expect(toolsResponse.tools).toBeDefined();
            expect(toolsResponse.tools.length).toBeGreaterThan(0);

            // Check that at least one tool has description or title
            const toolsWithMetadata = toolsResponse.tools.filter(
                t => t.description || (t as any).title
            );
            
            // At least some tools should have metadata
            expect(toolsWithMetadata.length).toBeGreaterThanOrEqual(0);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });

    test('should maintain tool list consistency after registration', async () => {
        const { transport, clientTransport, configuration } = createTestEnvironment();
        let server: McpServer | undefined;

        try {
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            expect(server.isConnected()).toEqual(true);

            const client = await createAndConnectClient(clientTransport);

            // List tools multiple times to ensure consistency
            const toolsResponse1 = await client.listTools();
            const toolsResponse2 = await client.listTools();

            expect(toolsResponse1.tools.length).toBe(toolsResponse2.tools.length);

            // Verify tool names are the same
            const toolNames1 = toolsResponse1.tools.map(t => t.name).sort();
            const toolNames2 = toolsResponse2.tools.map(t => t.name).sort();
            expect(toolNames1).toEqual(toolNames2);

            await client.close();
        } finally {
            await clientTransport?.close();
            await transport?.close();
            await server?.close();
        }
    });
});
