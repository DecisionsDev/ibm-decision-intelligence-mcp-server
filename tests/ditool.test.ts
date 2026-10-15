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

import {getToolName, generateToolName} from '../src/ditool.js';
import {Configuration} from "../src/command-line.js";
import nock from "nock";
import {Credentials} from "../src/credentials.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";

describe('generateToolName', () => {

    test('should use decision service name in priority', () => {
        expect(generateToolName("op", "dname", "did", [])).toEqual("dname_op");
        expect(generateToolName("op2", "dname", "did", ["dname_op"])).toEqual("dname_op2");
    });

    test('should use decision service id if a tool with the decision service name already exists', () => {
        expect(generateToolName("op", "dname", "did", ["dname_op"])).toEqual("did_op");
        expect(generateToolName("op2", "dname", "did", ["dname_op", "dname_op2"])).toEqual("did_op2");
    });

    test('should use decision service id if a tool with the decision service name already exists', () => {
        expect(generateToolName("op", "dname", "did", ["dname_op"])).toEqual("did_op");
        expect(generateToolName("op2", "dname", "did", ["dname_op"])).toEqual("dname_op2");
        expect(generateToolName("op2", "dname", "did", ["dname_op", "dname_op2"])).toEqual("did_op2");
    });

    test('should throw an error if the generated tool name already exists', () => {
        expect(() => {
            generateToolName("op", "dname", "did", ["dname_op", "did_op"])
        }).toThrow("Tool name did_op already exist");
    });
});

describe('getToolName', () => {

    const operationId = 'operation-id';
    const toolName = 'My tool name';
    const metadataName = `mcpToolName.${operationId}`;
    const decisionMetadata = {
        map : {
            [metadataName]: {
                "name": metadataName,
                "kind": "PLAIN",
                "readOnly": false,
                "value": toolName
            }
        }
    };

    const url = 'https://example.com';
    const decisionId = 'decision-id';
    const deploymentSpace = `development`;
    nock(url)
        .get(`/deploymentSpaces/${deploymentSpace}/decisions/${decisionId}/metadata`)
        .reply(200, decisionMetadata)
        .get(`/deploymentSpaces/development/decisions/${decisionId}/metadata`)
        .reply(200, { map : {}});

    const configuration = new Configuration(Credentials.createDiApiKeyCredentials('apiKey'), new StdioServerTransport(), url, '1.2.3', false);
    const decisionServiceName = 'decision-service-name';
    const info = {
        ['x-ibm-ads-decision-service-name'] : decisionServiceName,
        ['x-ibm-ads-decision-id'] : decisionId
    }

    test('should use the appropriate metadata if provided', () => {
        return expect(getToolName(configuration, deploymentSpace, info, operationId, 'decision-service-id', [])).resolves.
            toBe(toolName);
    });

    test('should invoke generateToolName if the appropriate metadata is not provided', async () => {
        return expect(getToolName(configuration, deploymentSpace, info, operationId, 'decision-service-id', [])).resolves.
            toBe(`${decisionServiceName}_${operationId}`);
    });
});
