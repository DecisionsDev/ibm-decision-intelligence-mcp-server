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

import nock from "nock";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {Configuration} from "../src/command-line.js";

// Shared test data
const decisionServiceId = 'test/Loan Approval';
const decisionId = 'test/loan_approval/loanApprovalDecisionService/3-2025-06-18T13:00:39.447Z';
const operationId = 'approval';
const executionOutput = {
    "insurance": {
        "rate": 2.5,
            "required": true
    },
    "approval": {
        "approved": true,
            "message": "Loan approved based on income and credit score"
    }
};

// Setup nock mocks for testing
export function setupNockMocks(configuration: Configuration): void {
    const metadataName = `mcpToolName.${operationId}`;
    const credentials = configuration.credentials;
    const headerValue = credentials.getAuthorizationHeaderValue();
    const headerKey = credentials.getAuthorizationHeaderKey();
    for(const deploymentSpace of configuration.deploymentSpaces) {
        const deploymentSpaceId = encodeURIComponent(deploymentSpace);
        const decisionService = encodeURIComponent(decisionServiceId);
        const userAgentHeader = 'User-Agent';
        const userAgentValue = `IBM-DI-MCP-Server/${configuration.version}`;
        nock(configuration.url)
        .get(`/deploymentSpaces/${deploymentSpaceId}/metadata?names=decisionServiceId`)
        .matchHeader(userAgentHeader, userAgentValue)
        .matchHeader(headerKey, headerValue)
        .reply(200, [{
            'decisionServiceId': {
                'name': 'decisionServiceId',
                'kind': 'PLAIN',
                'readOnly': true,
                'value': decisionServiceId
            }
        }])
        .get(`/deploymentSpaces/${deploymentSpaceId}/decisions/${encodeURIComponent(decisionId)}/metadata`)
        .matchHeader(userAgentHeader, userAgentValue)
        .matchHeader(headerKey, headerValue)
        .reply(200, {
            map : {
                [metadataName] : {
                    'name': metadataName,
                    'kind': 'PLAIN',
                    'readOnly': false,
                    'value': deploymentSpaceId
                }
            }
        })
        .get(`/selectors/lastDeployedDecisionService/deploymentSpaces/${deploymentSpaceId}/openapi?decisionServiceId=${decisionService}&outputFormat=JSON/openapi`)
        .matchHeader(userAgentHeader, userAgentValue)
        .matchHeader(headerKey, headerValue)
        .replyWithFile(200, 'tests/loanvalidation-openapi.json')
        .post(`/selectors/lastDeployedDecisionService/deploymentSpaces/${deploymentSpaceId}/operations/${encodeURIComponent(operationId)}/execute?decisionServiceId=${decisionService}`)
        .matchHeader(userAgentHeader, userAgentValue)
        .matchHeader(headerKey, headerValue)
        .reply(200, executionOutput);
    }
}

export async function validateClient(clientTransport: Transport, deploymentSpaces: string[]): Promise<void> {
    const client = new Client({
            name: "client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(clientTransport);
        const toolList = await client.listTools();
        const tools = toolList.tools;

        expect(Array.isArray(tools)).toBe(true);
        expect(tools).toHaveLength(deploymentSpaces.length);

        deploymentSpaces.forEach((deploymentSpace, index) => {
            const loanApprovalTool = tools[index];
            expect(loanApprovalTool).toEqual(
                expect.objectContaining({
                    name: `${deploymentSpace}`,
                    title: operationId,
                    description: 'Execute approval'
                },)
            );
            expect(loanApprovalTool).toHaveProperty('inputSchema');
            expect(typeof loanApprovalTool.inputSchema).toBe('object');
        });

        const toolNames: string[] = tools.map((tool) => {
            return tool.name;
        });

        await validateToolExecutions(toolNames);

        async function validateToolExecutions(toolNames: string[]): Promise<void> {
            const executionInput = {
                loan: {
                    amount: 1000,
                    loanToValue: 1.5,
                    numberOfMonthlyPayments: 1000,
                    startDate: "2025-06-17T14:40:26Z"
                },
                borrower: {
                    SSN: {
                        areaNumber: "123",
                        groupCode: "45",
                        serialNumber: "6789"
                    },
                    birthDate: "1990-01-01T00:00:00Z",
                    creditScore: 750,
                    firstName: "Alice",
                    lastName: "Doe",
                    latestBankruptcy: {
                        chapter: 11,
                        date: "2010-01-01T00:00:00Z",
                        reason: "Medical debt"
                    },
                    yearlyIncome: 85000,
                    zipCode: "12345"
                },
                currentTime: new Date().toISOString()
            };

            for (const toolName of toolNames) {
                try {
                    const response = await client.callTool({
                        name: toolName,
                        arguments: executionInput
                    });

                    expect(response).toBeDefined();
                    const content = response.content as Array<{type: string, text: string}>;
                    expect(content).toBeDefined();
                    expect(Array.isArray(content)).toBe(true);
                    expect(content).toHaveLength(1);
                    const actualContent = content[0];
                    expect(actualContent.text).toEqual(JSON.stringify(executionOutput));
                } catch (error) {
                    console.error(`An unexpected error occurred while calling tool '${toolName}':`, error);
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('Tool call failed:', error);
        throw error;
    } finally {
        await client.close();
    }
}

export async function createAndConnectClient(clientTransport: Transport, name: string = "client", version: string = "1.0.0") {
    const client = new Client({
        name: name,
        version: version,
    });
    await client.connect(clientTransport);
    return client;
}
