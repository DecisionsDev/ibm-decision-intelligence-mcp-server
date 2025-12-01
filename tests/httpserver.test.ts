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

import { runHTTPServer } from '../src/httpserver.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import http from 'http';
import { AddressInfo } from 'net';

describe('HTTP Server Error Handling', () => {
    let mockServer: McpServer;
    let httpServer: http.Server;
    
    beforeEach(() => {
        mockServer = {
            connect: jest.fn().mockResolvedValue(undefined),
            isConnected: jest.fn().mockReturnValue(true),
            close: jest.fn().mockResolvedValue(undefined),
        } as any;
    });

    afterEach((done) => {
        if (httpServer) {
            httpServer.close(() => {
                done();
            });
        } else {
            done();
        }
        jest.clearAllMocks();
    });

    test('should return 400 error when no session ID provided for non-initialize request', async () => {
        httpServer = runHTTPServer(mockServer);
        const address = httpServer.address() as AddressInfo;
        const port = address.port;

        const response = await new Promise<{statusCode?: number, body: string}>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: '/mcp',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            
            req.on('error', reject);
            
            req.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 1
            }));
            req.end();
        });

        expect(response.statusCode).toBe(400);
        const parsedBody = JSON.parse(response.body);
        expect(parsedBody).toMatchObject({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided'
            },
            id: null
        });
    });
});

// Made with Bob
