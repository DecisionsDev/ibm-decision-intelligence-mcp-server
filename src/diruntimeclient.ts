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

import axios from 'axios';
import { OpenAPIV3_1 } from "openapi-types";
import {Configuration} from "./command-line.js";

export function executeDecision(configuration: Configuration, deploymentSpace: string, decisionId: string, operation: string, input: object|undefined) {
    const url = configuration.url + "/deploymentSpaces/" + deploymentSpace + "/decisions/"
        + encodeURIComponent(decisionId)
        + "/operations/"
        + encodeURIComponent(operation)
        + "/execute";

    return axios.post(url, input, { headers: getJsonContentTypeHeaders(configuration) })
        .then(function (response) {
            return JSON.stringify(response.data);
      });
}

function getJsonContentTypeHeaders(configuration: Configuration) {
    return {
        ["Content-Type"]: "application/json",
        ...getHeaders(configuration)
    };
}

export function executeLastDeployedDecisionService(configuration: Configuration, deploymentSpace: string, serviceId: string, operation: string, input: object) {
    const url = configuration.url + "/selectors/lastDeployedDecisionService/deploymentSpaces/" + deploymentSpace
      + "/operations/" + encodeURIComponent(operation)
      + "/execute?decisionServiceId=" + encodeURIComponent(serviceId);

    return axios.post(url, input, { headers: getJsonContentTypeHeaders(configuration) })
        .then(function (response) {          
            return JSON.stringify(response.data);
      });
}

export async function getDecisionMetadata(configuration: Configuration, deploymentSpace: string, decisionId: string) {
    const url = configuration.url + `/deploymentSpaces/${deploymentSpace}/decisions/${encodeURIComponent(decisionId)}/metadata`;

    const response = await axios.get(url, {headers: getHeaders(configuration)});
    return response.data;
}

export function getMetadata(configuration: Configuration, deploymentSpace:string) {
    const url = configuration.url + "/deploymentSpaces"
        + "/" + deploymentSpace
        + "/metadata?names=decisionServiceId";

    return axios.get(url, { headers: getHeaders(configuration) })
        .then(function (response) {          
            return response.data;
        }
    );
}

type MetadataType = {decisionServiceId: {value: string}};
export function getDecisionServiceIds(metadata: MetadataType[]): string[] {
    const ids: string[] = [];

    metadata.forEach((m: MetadataType) => {
        const id = m.decisionServiceId.value;
        if (!ids.includes(id))
            ids.push(id);
    });

    return ids;
}

export function getDecisionOpenapi(configuration: Configuration, deploymentSpace: string, decisionId: string) {
    const url = configuration.url + "/deploymentSpaces/" + deploymentSpace
        + "/decisions/" + encodeURIComponent(decisionId)
        + "/openapi";

    return axios.get(url, { headers: getHeaders(configuration) })
        .then(function (response) {          
            return response.data;
    });
}

function getHeaders(configuration: Configuration) {
    const authorizationHeaderValue = configuration.credentials.getAuthorizationHeaderValue();
    const authorizationHeaderKey = configuration.credentials.getAuthorizationHeaderKey()
    return {
        ["User-Agent"]: `IBM-DI-MCP-Server/${configuration.version}`,
        "accept": "application/json",
        [authorizationHeaderKey] : authorizationHeaderValue
    };
}

export function getDecisionServiceOpenAPI(configuration: Configuration, deploymentSpace: string, decisionServiceId: string) {
    const url = configuration.url + "/selectors/lastDeployedDecisionService/deploymentSpaces/"  + deploymentSpace
        + "/openapi?decisionServiceId="
        + encodeURIComponent(decisionServiceId) + "&outputFormat=JSON"
        + "/openapi";

    return axios.get(url, { headers: getHeaders(configuration) })
        .then(function (response) {
            // Check if the response contains an incident (error) instead of OpenAPI spec
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((response.data as any).incident) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const incident = (response.data as any).incident;
                const errorMessage = `Failed to get OpenAPI for decision service '${decisionServiceId}' in deployment space '${deploymentSpace}': ${incident.incidentCategory || 'Unknown error'}${incident.stackTrace ? ' - ' + incident.stackTrace : ''}`;
                throw new Error(errorMessage);
            }
            return (response.data as OpenAPIV3_1.Document);
    });
}
