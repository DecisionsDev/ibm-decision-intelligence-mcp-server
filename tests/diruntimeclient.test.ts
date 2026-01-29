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

import {executeDecision, executeLastDeployedDecisionService, getDecisionMetadata, getDecisionOpenapi, getDecisionServiceIds, getDecisionServiceOpenAPI, getMetadata} from '../src/diruntimeclient.js';
import nock from 'nock';
import { default as loanValidationOpenapi } from '../tests/loanvalidation-openapi.json';
import {Credentials} from "../src/credentials.js";
import {Configuration} from "../src/command-line.js";

const metadata =  [{
        "decisionServiceId": {
            "name": "decisionServiceId",
            "kind": "PLAIN",
            "readOnly": true,
            "value": "ID1"
        },
        "deploymentTime": {
            "name": 'deploymentTime',
            "kind": 'PLAIN',
            "readOnly": true,
            "value": '2025-08-07T21:00:12.045Z'
        }
    }, {
        "decisionServiceId": {
            "name": "decisionServiceId",
            "kind": "PLAIN",
            "readOnly": true,
            "value": "ID1"
        }, "deploymentTime": {
            "name": 'deploymentTime',
            "kind": 'PLAIN',
            "readOnly": true,
            "value": '2025-08-07T21:00:12.045Z'
        }
    }, {
        "decisionServiceId": {
            "name": "decisionServiceId",
            "kind": "PLAIN",
            "readOnly": true,
            "value": "ID2"
    }, "deploymentTime": {
            "name": 'deploymentTime',
            "kind": 'PLAIN',
            "readOnly": true,
            "value": '2025-08-07T21:00:12.045Z'
        }
}];

const url = 'https://example.com';
const apikey = 'apiKey';
const version = '1.2.3';
const username = 'username';
const encodedUsernameApiKey= Buffer.from(`${username}:${apikey}`).toString('base64');
const diApiKeyConfiguration = new Configuration(Credentials.createDiApiKeyCredentials(apikey), undefined, url, version, false);
const zenApiKeyConfiguration = new Configuration(Credentials.createZenApiKeyCredentials(username, apikey), undefined, url, version, false);
const password = 'password';
const encodedUsernamePassword= Buffer.from(`${username}:${password}`).toString('base64');
const basicAuthConfiguration = new Configuration(Credentials.createBasicAuthCredentials(username, password), undefined, url, version, false);
const decisionId = 'decisionId';
const operationId = 'operationId';
const executionResponse = { answer: 42 };
const decisionMetadata = {
    map : {
        "decisionServiceId": {
            "name": "decisionServiceId",
            "kind": "PLAIN",
            "readOnly": true,
            "value": "ID1"
        }, "deploymentTime": {
            "name": 'deploymentTime',
            "kind": 'PLAIN',
            "readOnly": true,
            "value": '2025-08-07T21:00:12.045Z'
        }
    }
};

const deploymentSpaceWithWhiteSpaces = `toto    toto`;
nock(url)
    .get('/deploymentSpaces/test/metadata?names=decisionServiceId,deploymentTime,mcpGroups')
    .matchHeader('authorization', `Basic ${encodedUsernamePassword}`)
    .reply(200, metadata)
    .get('/deploymentSpaces/nonexistent/metadata?names=decisionServiceId,deploymentTime,mcpGroups')
    .reply(404)
    .get('/selectors/lastDeployedDecisionService/deploymentSpaces/production/openapi?decisionServiceId=ID1&outputFormat=JSON/openapi')
    .matchHeader('apikey', apikey)
    .reply(200, loanValidationOpenapi)
    .post('/selectors/lastDeployedDecisionService/deploymentSpaces/foo.bar/operations/execute/execute?decisionServiceId=ID1')
    .matchHeader('apikey', apikey)
    .reply(200, { result: 'default-success' })
    .get('/deploymentSpaces/staging/decisions/decision123/openapi')
    .matchHeader('authorization', `ZenApiKey ${encodedUsernameApiKey}`)
    .reply(200, { openapi: '3.0.0' })
    .post(`/deploymentSpaces/${encodeURIComponent(deploymentSpaceWithWhiteSpaces)}/decisions/${decisionId}/operations/${operationId}/execute`, {})
    .matchHeader('authorization', `ZenApiKey ${encodedUsernameApiKey}`)
    .reply(200, executionResponse)
    .get(`/deploymentSpaces/tutu/decisions/${decisionId}/openapi`)
    .reply(200, loanValidationOpenapi)
    .get(`/deploymentSpaces/toto/decisions/${decisionId}/metadata`)
    .matchHeader('authorization', `Basic ${encodedUsernamePassword}`)
    .reply(200, decisionMetadata);

test('getDecisionServiceIds', () => {
    expect(getDecisionServiceIds(metadata)).toEqual(["ID1", "ID2"]);
});

test(`getMetadata with 'test' deployment space`, async () => {
    return getMetadata(basicAuthConfiguration, 'test')
        .then(data => {
            expect(data).toEqual(metadata);
    });
});

test('getMetadata with non existent deploymentSpace', async () => {
    await expect(getMetadata(zenApiKeyConfiguration, 'nonexistent'))
        .rejects.toThrow('Request failed with status code 404');
});

test(`getDecisionServiceOpenAPI with 'production' deploymentSpace`, async() => {
    return getDecisionServiceOpenAPI(diApiKeyConfiguration, 'production', 'ID1')
        .then(data => {
            expect(data).toEqual(loanValidationOpenapi);
        })
});

test(`executeLastDeployedDecisionService with 'foo.bar' deploymentSpace`, async() => {
    const input = { data: 'test' };
    return executeLastDeployedDecisionService(diApiKeyConfiguration, 'foo.bar', 'ID1', 'execute', input)
        .then(data => {
            expect(JSON.parse(data)).toEqual({ result: 'default-success' });
        })
});

test(`getDecisionOpenapi with 'staging' deploymentSpace`, async() => {
    return getDecisionOpenapi(zenApiKeyConfiguration, 'staging', 'decision123')
        .then(data => {
            expect(data).toEqual({ openapi: '3.0.0' });
        })
});

test(`executeDecision with '${deploymentSpaceWithWhiteSpaces}' deploymentSpace`, async () => {
    return executeDecision(zenApiKeyConfiguration, deploymentSpaceWithWhiteSpaces, decisionId, operationId, {})
        .then(data => {
            expect(data).toEqual(JSON.stringify(executionResponse));
        });
});

test(`getDecisionMetadata with 'toto' deploymentSpace`, async () => {
    return getDecisionMetadata(basicAuthConfiguration, 'toto', decisionId)
        .then(data => {
            expect(data).toEqual(decisionMetadata);
        })
});

test(`getDecisionOpenApi with 'tutu' deploymentSpace`, async () => {
    return getDecisionOpenapi(zenApiKeyConfiguration, 'tutu', decisionId)
        .then(data => {
            expect(data).toEqual(loanValidationOpenapi);
        });
});
