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
//const decisionServiceId = 'test/Loan Approval';
// const decisionId = 'test/loan_approval/loanApprovalDecisionService/3-2025-06-18T13:00:39.447Z';
const operationId = 'approval';

/**
 * Generates OpenAPI JSON content for a decision service (for testing purposes).
 *
 * @param decisionServiceId - The decision service ID (e.g., "test/Loan Approval")
 * @param decisionId - The decision ID (e.g., "test/loan_approval/loanApprovalDecisionService/3-2025-06-18T13:00:39.447Z")
 * @param deploymentSpaceId - The deployment space ID (e.g., "staging", "production", "development")
 * @returns The complete OpenAPI document as a JSON object
 */
export function generateOpenAPIContent(decisionServiceId: string, decisionId: string, deploymentSpaceId: string): any {
    // URL encode the decision ID for the server URL
    const encodedDecisionId = encodeURIComponent(decisionId);
    
    return {
        "openapi": "3.0.1",
        "info": {
            "title": decisionServiceId,
            "description": decisionServiceId,
            "version": "1",
            "x-ibm-ads-decision-service-id": decisionServiceId,
            "x-ibm-ads-decision-service-name": decisionServiceId,
            "x-ibm-ads-decision-id": decisionId
        },
        "servers": [
            {
                "url": `https://example.com/ads/runtime/api/v1/deploymentSpaces/${deploymentSpaceId}/decisions/${encodedDecisionId}/operations`
            }
        ],
        "security": [
            {
                "DI-APIKEY": []
            }
        ],
        "paths": {
            "/approval/execute": {
                "post": {
                    "tags": [
                        decisionServiceId
                    ],
                    "summary": "approval",
                    "description": "Execute approval",
                    "operationId": "approval",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/approval_input"
                                },
                                "example": {
                                    "loan": {
                                        "amount": 1000,
                                        "loanToValue": 1.5,
                                        "numberOfMonthlyPayments": 1000,
                                        "startDate": "2025-06-17T14:40:26Z"
                                    },
                                    "borrower": {
                                        "SSN": {
                                            "areaNumber": "<areaNumber>",
                                            "groupCode": "<groupCode>",
                                            "serialNumber": "<serialNumber>"
                                        },
                                        "birthDate": "2025-06-17T14:40:26Z",
                                        "creditScore": 1000,
                                        "firstName": "<firstName>",
                                        "lastName": "<lastName>",
                                        "latestBankruptcy": {
                                            "chapter": 1000,
                                            "date": "2025-06-17T14:40:26Z",
                                            "reason": "<reason>"
                                        },
                                        "yearlyIncome": 1000,
                                        "zipCode": "<zipCode>"
                                    },
                                    "currentTime": "2025-06-17T14:40:26Z"
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Decision execution success",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/approval_output"
                                    }
                                }
                            }
                        },
                        "404": {
                            "description": "A decision or decision operation was not found",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/BaseError"
                                    }
                                }
                            }
                        },
                        "500": {
                            "description": "A runtime exception occurred while executing a decision",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/BaseError"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "insurance": {
                    "title": "insurance",
                    "type": "object",
                    "properties": {
                        "rate": {
                            "title": "rate",
                            "type": "number",
                            "format": "double"
                        },
                        "required": {
                            "title": "required",
                            "type": "boolean"
                        }
                    }
                },
                "loan": {
                    "title": "loan",
                    "type": "object",
                    "properties": {
                        "amount": {
                            "title": "amount",
                            "type": "integer"
                        },
                        "loanToValue": {
                            "title": "loan to value",
                            "type": "number",
                            "format": "double"
                        },
                        "numberOfMonthlyPayments": {
                            "title": "number of monthly payments",
                            "type": "integer"
                        },
                        "startDate": {
                            "title": "start date",
                            "type": "string",
                            "description": "The format for this field is \"date-time\" as defined in rfc3339 (https://tools.ietf.org/html/rfc3339#section-5.6)",
                            "format": "date-time"
                        }
                    }
                },
                "approval_input": {
                    "type": "object",
                    "properties": {
                        "loan": {
                            "$ref": "#/components/schemas/loan"
                        },
                        "borrower": {
                            "$ref": "#/components/schemas/borrower"
                        },
                        "currentTime": {
                            "type": "string",
                            "description": "The format for this field is \"date-time\" as defined in rfc3339 (https://tools.ietf.org/html/rfc3339#section-5.6)",
                            "format": "date-time"
                        }
                    },
                    "x-ibm-parameter-wrapper": true
                },
                "approval": {
                    "title": "approval",
                    "type": "object",
                    "properties": {
                        "approved": {
                            "title": "approved",
                            "type": "boolean"
                        },
                        "message": {
                            "title": "message",
                            "type": "string"
                        }
                    }
                },
                "approval_output": {
                    "type": "object",
                    "properties": {
                        "insurance": {
                            "$ref": "#/components/schemas/insurance"
                        },
                        "approval": {
                            "$ref": "#/components/schemas/approval"
                        }
                    },
                    "nullable": true,
                    "x-ibm-parameter-wrapper": true
                },
                "borrower": {
                    "title": "borrower",
                    "type": "object",
                    "properties": {
                        "SSN": {
                            "$ref": "#/components/schemas/SSN"
                        },
                        "birthDate": {
                            "title": "birth date",
                            "type": "string",
                            "description": "The format for this field is \"date-time\" as defined in rfc3339 (https://tools.ietf.org/html/rfc3339#section-5.6)",
                            "format": "date-time"
                        },
                        "creditScore": {
                            "title": "credit score",
                            "type": "integer"
                        },
                        "firstName": {
                            "title": "first name",
                            "type": "string"
                        },
                        "lastName": {
                            "title": "last name",
                            "type": "string"
                        },
                        "latestBankruptcy": {
                            "$ref": "#/components/schemas/bankruptcy"
                        },
                        "spouse": {
                            "$ref": "#/components/schemas/borrower"
                        },
                        "yearlyIncome": {
                            "title": "yearly income",
                            "type": "integer"
                        },
                        "zipCode": {
                            "title": "zip code",
                            "type": "string"
                        }
                    }
                },
                "BaseError": {
                    "type": "object",
                    "properties": {
                        "output": {
                            "type": "object",
                            "description": "The output of the decision service archive.",
                            "nullable": true
                        },
                        "incident": {
                            "$ref": "#/components/schemas/Incident"
                        }
                    },
                    "description": "The response when an error occurs"
                },
                "Incident": {
                    "type": "object",
                    "properties": {
                        "incidentId": {
                            "type": "string",
                            "description": "A unique identifier for the incident"
                        },
                        "incidentCategory": {
                            "type": "string",
                            "description": "The category of the incident, for instance \"Decision not found\""
                        },
                        "stackTrace": {
                            "type": "string",
                            "description": "An associated stack trace, if the decision runtime is configured to provide it. By default, the stack trace is null"
                        }
                    },
                    "description": "The description of the failure"
                },
                "bankruptcy": {
                    "title": "bankruptcy",
                    "type": "object",
                    "properties": {
                        "chapter": {
                            "title": "chapter",
                            "type": "integer"
                        },
                        "date": {
                            "title": "date",
                            "type": "string",
                            "description": "The format for this field is \"date-time\" as defined in rfc3339 (https://tools.ietf.org/html/rfc3339#section-5.6)",
                            "format": "date-time"
                        },
                        "reason": {
                            "title": "reason",
                            "type": "string"
                        }
                    }
                },
                "SSN": {
                    "title": "SSN",
                    "type": "object",
                    "properties": {
                        "areaNumber": {
                            "title": "area number",
                            "type": "string"
                        },
                        "groupCode": {
                            "title": "group code",
                            "type": "string"
                        },
                        "serialNumber": {
                            "title": "serial number",
                            "type": "string"
                        }
                    }
                }
            },
            "securitySchemes": {
                "DI-APIKEY": {
                    "type": "apiKey",
                    "name": "apikey",
                    "in": "header"
                }
            }
        }
    };
}

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
export function setupNockMocks(configuration: Configuration, decisionIds: string[]): void {
    const metadataName = `mcpToolName.${operationId}`;
    const credentials = configuration.credentials;
    const headerValue = credentials.getAuthorizationHeaderValue();
    const headerKey = credentials.getAuthorizationHeaderKey();
    for (const deploymentSpace of configuration.deploymentSpaces) {
        for (const decisionId of decisionIds) {
            const deploymentSpaceId = encodeURIComponent(deploymentSpace);
            const decisionServiceId = `${deploymentSpaceId}/${decisionId}`;
            const decisionService = encodeURIComponent(decisionServiceId);
            const userAgentHeader = 'User-Agent';
            const userAgentValue = `IBM-DI-MCP-Server/${configuration.version}`;
            
            // Generate OpenAPI content dynamically using the function
            const openApiContent = generateOpenAPIContent(decisionServiceId, decisionId, deploymentSpace);
            
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
                            'value': `${deploymentSpaceId}-${decisionId}`
                        }
                    }
                })
                .get(`/selectors/lastDeployedDecisionService/deploymentSpaces/${deploymentSpaceId}/openapi?decisionServiceId=${decisionService}&outputFormat=JSON/openapi`)
                .matchHeader(userAgentHeader, userAgentValue)
                .matchHeader(headerKey, headerValue)
                .reply(200, openApiContent)
                .post(`/selectors/lastDeployedDecisionService/deploymentSpaces/${deploymentSpaceId}/operations/${encodeURIComponent(operationId)}/execute?decisionServiceId=${decisionService}`)
                .matchHeader(userAgentHeader, userAgentValue)
                .matchHeader(headerKey, headerValue)
                .reply(200, executionOutput);
            }
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


export async function validateClient(clientTransport: Transport, deploymentSpaces: string[]): Promise<void> {
    const client = await createAndConnectClient(clientTransport);
    try {
        const toolList = await client.listTools();
        const tools = toolList.tools;

        expect(Array.isArray(tools)).toBe(true);
        expect(tools).toHaveLength(deploymentSpaces.length);

        deploymentSpaces.forEach((deploymentSpace, index) => {
            const loanApprovalTool = tools[index];
            // Tool name is generated as: deploymentSpace-decisionId (e.g., "staging-dummy.decision.id")
            expect(loanApprovalTool).toEqual(
                expect.objectContaining({
                    name: `${deploymentSpace}-dummy.decision.id`,
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
