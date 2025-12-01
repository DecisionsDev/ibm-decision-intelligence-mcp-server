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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Configuration } from "../src/command-line.js";
import { createMcpServer } from "../src/mcp-server.js";
import { Server } from "http";
import { AddressInfo } from 'net';
import {Credentials} from "../src/credentials.js";
import {setupNockMocks, validateClient} from "./test-utils.js";

describe('HTTP Transport', () => {
    const decisionIds = ['dummy.decision.id'];
    const configuration = new Configuration(Credentials.createDiApiKeyCredentials('validApiKey123'),  undefined, 'https://foo.bar.bra,fr', '1.2.3', true);

    beforeAll(() => {
        setupNockMocks(configuration, decisionIds);
    });

    test('should properly list and execute tool when configured with HTTP transport', async () => {
        // Create a custom configuration for HTTP transport
        let server: McpServer | undefined;
        let httpServer: Server | undefined;
        let clientTransport: StreamableHTTPClientTransport | undefined;
        
        try {
            // Create MCP server with HTTP transport - this will return the HTTP server
            const result = await createMcpServer('test-server', configuration);
            server = result.server;
            httpServer = result.httpServer;

            if (!httpServer) {
                throw new Error('HTTP server not returned from createMcpServer');
            }
            
            // Create client transport to connect server via HTTP
            const address = httpServer.address() as AddressInfo;
            clientTransport = new StreamableHTTPClientTransport(new URL(`http://localhost:${address.port}/mcp`));
            await validateClient(clientTransport, configuration.deploymentSpaces);
        } finally {
            if (clientTransport) {
                try {
                    await clientTransport.close();
                } catch (e) {
                    console.error("Error closing client transport:", e);
                }
            }
            
            if (server) {
                try {
                    await server.close();
                } catch (e) {
                    console.error("Error closing server:", e);
                }
            }
            
            if (httpServer) {
                httpServer.closeAllConnections();
                httpServer.close();
            }
        }
    });
});
