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

import { debug } from "./debug.js";
import { getDecisionMetadata } from './diruntimeclient.js';
import { Configuration } from "./command-line.js";

function getDecisionServiceName(info: Record<string, string>) {
    return info["x-ibm-ads-decision-service-name"];
}

export async function getToolName(configuration: Configuration, deploymentSpace: string, info: Record<string, string>, operationId: string, decisionServiceId: string, toolNames: string[]): Promise<string> {
    const decisionServiceName = getDecisionServiceName(info);
    debug("decisionServiceName", decisionServiceName);
    const decisionId = info["x-ibm-ads-decision-id"];
    debug("decisionId", decisionId);

    type MetadataEntry = {
        name: string;
        kind: string;
        readOnly: boolean;
        value: string;
    };

    type MetadataMap = {
        [key: string]: MetadataEntry;
    };

    const metadata: { map: MetadataMap } = await getDecisionMetadata(configuration, deploymentSpace, decisionId)
    debug("metadata", JSON.stringify(metadata, null, " "));

    const metadataName = `mcpToolName.${operationId}`;
    return metadata.map[metadataName]?.value || generateToolName(operationId, decisionServiceName, decisionServiceId, toolNames);
}

/**
 * Generates a unique tool name for an operation of a decision service.
 *
 * @param operationId - The operation identifier.
 * @param decisionServiceName - The name of the decision service.
 * @param decisionServiceId - The unique ID of the decision service.
 * @param toolNames - Array of existing tool names.
 * @returns A unique tool name string.
 */
export function generateToolName(operationId: string, decisionServiceName: string, decisionServiceId: string, toolNames: string[]): string {
    // WO does not support white spaces for tool names
    // Claude does not support /
    let toolName = (decisionServiceName + " " + operationId).replaceAll(" ", "_").replaceAll("/", "_");
            
    if (toolNames.includes(toolName)) {
        toolName = (decisionServiceId + " " + operationId).replaceAll(" ", "_").replaceAll("/", "_");
        if (toolNames.includes(toolName))
            throw new Error("Tool name " + toolName  + " already exist");
    }

    return toolName;
}