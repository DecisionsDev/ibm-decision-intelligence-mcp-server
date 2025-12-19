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

import {McpServer, RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    executeLastDeployedDecisionService,
    getDecisionServiceIds,
    getDecisionServiceOpenAPI,
    getMetadata
} from './diruntimeclient.js';
import {runHTTPServer} from "./httpserver.js";
import {debug} from "./debug.js";
import {expandJSONSchemaDefinition} from './jsonschema.js';
import {getToolName} from "./ditool.js";
import {jsonSchemaToZod} from "json-schema-to-zod";
import {evalTS} from "./ts.js";
import { OpenAPIV3_1 } from "openapi-types";
import { ZodRawShape, ZodType } from "zod";
import { Configuration } from "./command-line.js";
import http from "node:http";

// Interface to track tool definitions for change detection
interface ToolDefinition {
    name: string;
    title?: string;
    description?: string;
    inputSchema: ZodRawShape,
    inputSchemaHash: string; // Hash of the input schema for comparison
    deploymentSpace: string;
    decisionServiceId: string;
    operationId: string;
    openapi: OpenAPIV3_1.Document; // Store the OpenAPI document to avoid re-fetching
    registeredTool: RegisteredTool; // Store the RegisteredTool object returned by registerDecisionServiceTools
}

// Helper function to create a hash of the input schema for comparison
function hashInputSchema(inputSchema: OpenAPIV3_1.SchemaObject): string {
    return JSON.stringify(inputSchema);
}

function getParameters(jsonSchema: OpenAPIV3_1.SchemaObject): ZodRawShape {
    const params: Record<string, ZodType> = {}

    for (const propName in jsonSchema.properties) {
        const jsonSchemaProp = jsonSchema.properties[propName];
        const code = jsonSchemaToZod(jsonSchemaProp);
        params[propName] = evalTS(code);
    }

    return params;
}

function getToolDefinition(path: OpenAPIV3_1.PathItemObject, components: OpenAPIV3_1.ComponentsObject|null|undefined) {
    if (path.post == undefined || path.post.requestBody == undefined) {
        debug("invalid path", JSON.stringify(path));
        return null;
    }

    const body = path.post.requestBody;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const operation = (body as any).content["application/json"];
    const inputSchema = operation.schema;
    debug("operation", operation);
    debug("inputSchema", inputSchema);

    const schemas = components == undefined ? null: components.schemas;
    const operationJsonInputSchema = expandJSONSchemaDefinition(inputSchema, schemas);
    debug("operationJsonSchema after expand", JSON.stringify(operationJsonInputSchema, null, " "));

    return {
        title: path.post.summary,
        description: path.post.description,
        inputSchema: getParameters(operationJsonInputSchema)
    };
}

// Helper function to process OpenAPI paths and extract tool metadata (without registering)
async function processOpenAPIPaths(
    configuration: Configuration,
    deploymentSpace: string,
    openapi: OpenAPIV3_1.Document,
    serviceId: string,
    toolNames: string[]
): Promise<Omit<ToolDefinition, 'registeredTool'>[]> {
    const toolMetadata: Omit<ToolDefinition, 'registeredTool'>[] = [];

    for (const key in openapi.paths) {
        const value = openapi.paths[key];

        if (value == undefined || value.post == undefined) {
            debug("Invalid openapi for path", key);
            continue;
        }

        const operationId = value.post.operationId;

        if (operationId == undefined) {
            debug("No operationId for ", JSON.stringify(value));
            continue;
        }

        const toolDefinition = getToolDefinition(value, openapi.components);

        if (toolDefinition == null) {
            debug("No tool definition for ", key);
            continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolName = await getToolName(configuration, deploymentSpace, (openapi as any).info, operationId, serviceId, toolNames);
        toolNames.push(toolName);

        toolMetadata.push({
            name: toolName,
            ...toolDefinition,
            inputSchemaHash: hashInputSchema(toolDefinition.inputSchema),
            deploymentSpace,
            decisionServiceId: serviceId,
            operationId,
            openapi // Store the OpenAPI document to avoid re-fetching
        });
    }

    return toolMetadata;
}

// Helper function to create the decision execution callback
function createDecisionExecutionCallback(
    configuration: Configuration,
    deploymentSpace: string,
    decisionServiceId: string,
    operationId: string
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (input: any) => {
        const decInput = input;
        debug("Execute decision with", JSON.stringify(decInput, null, " "));
        const str = await executeLastDeployedDecisionService(
            configuration,
            deploymentSpace,
            decisionServiceId,
            operationId,
            decInput
        );
        return {
            content: [{type: "text" as const, text: str}]
        };
    };
}

function registerDecisionOperationTool(server: McpServer, configuration: Configuration, newTool: Omit<ToolDefinition, "registeredTool">, existingTools: ToolDefinition[]) {
    // Register the tool and store the returned RegisteredTool object
    const registeredTool = server.registerTool(
        newTool.name,
        {
            title: newTool.title,
            description: newTool.description,
            inputSchema: newTool.inputSchema
        },
        createDecisionExecutionCallback(
            configuration,
            newTool.deploymentSpace,
            newTool.decisionServiceId,
            newTool.operationId
        )
    );

    // Store the complete tool definition with the RegisteredTool object
    existingTools.push({
        ...newTool,
        registeredTool
    });
}

async function registerDecisionServiceTools(
    server: McpServer,
    configuration: Configuration,
    deploymentSpace: string,
    decisionOpenAPI: OpenAPIV3_1.Document,
    decisionServiceId: string,
    toolNames: string[],
    toolDefinitions: ToolDefinition[]
) {
    const toolMetadata = await processOpenAPIPaths(
        configuration,
        deploymentSpace,
        decisionOpenAPI,
        decisionServiceId,
        toolNames
    );

    // Register each tool with the server and store the RegisteredTool object
    for (const toolDefinition of toolMetadata) {
        if (!decisionOpenAPI.paths) {
            continue;
        }
        registerDecisionOperationTool(server, configuration, toolDefinition, toolDefinitions);
    }
}

// Helper function to fetch all tool metadata from deployment spaces
async function fetchAllToolMetadata(
    configuration: Configuration
): Promise<Omit<ToolDefinition, 'registeredTool'>[]> {
    const newToolMetadata: Omit<ToolDefinition, 'registeredTool'>[] = [];

    for (const deploymentSpace of configuration.deploymentSpaces) {
        let serviceIds = configuration.decisionServiceIds;

        if (serviceIds === undefined || serviceIds.length === 0) {
            const spaceMetadata = await getMetadata(configuration, deploymentSpace);
            serviceIds = getDecisionServiceIds(spaceMetadata);
        }

        for (const serviceId of serviceIds) {
            const openapi = await getDecisionServiceOpenAPI(configuration, deploymentSpace, serviceId);
            
            // Extract tool metadata without registering
            const toolMeta = await processOpenAPIPaths(
                configuration,
                deploymentSpace,
                openapi,
                serviceId,
                []
            );
            
            newToolMetadata.push(...toolMeta);
        }
    }

    return newToolMetadata;
}

// Helper function to remove tools that no longer exist
function removeDeletedTools(
    currentToolDefinitions: ToolDefinition[],
    newToolsMap: Map<string, Omit<ToolDefinition, 'registeredTool'>>
): void {
    // Remove tools from the server and array in reverse order to avoid index issues
    for (let i = currentToolDefinitions.length - 1; i >= 0; i--) {
        const existingTool = currentToolDefinitions[i];
        if (!newToolsMap.has(existingTool.name)) {
            debug(`The existing tool '${existingTool.name}' was removed from the server.`);
            existingTool.registeredTool.remove();
            currentToolDefinitions.splice(i, 1);
        }
    }
}

// Helper function to update an existing tool with its new schema
function updateExistingTool(
    configuration: Configuration,
    existingTool: ToolDefinition,
    newToolMeta: Omit<ToolDefinition, 'registeredTool'>
): boolean {
    // Use the OpenAPI document already stored in metadata
    const openapi = newToolMeta.openapi;
    const pathKey = Object.keys(openapi.paths || {}).find(key => {
        const value = openapi.paths![key];
        return value?.post?.operationId === newToolMeta.operationId;
    });

    if (!pathKey || !openapi.paths) {
        return false;
    }

    const pathItem = openapi.paths[pathKey];
    const mcpToolDef = getToolDefinition(pathItem!, openapi.components);

    if (!mcpToolDef) {
        return false;
    }

    // Update the existing tool with the new schema
    existingTool.registeredTool.update({
        title: newToolMeta.title,
        description: newToolMeta.description,
        paramsSchema: mcpToolDef.inputSchema,
        callback: createDecisionExecutionCallback(
            configuration,
            newToolMeta.deploymentSpace,
            newToolMeta.decisionServiceId,
            newToolMeta.operationId
        )
    });

    // Update the stored metadata including the OpenAPI document
    existingTool.title = newToolMeta.title;
    existingTool.description = newToolMeta.description;
    existingTool.inputSchemaHash = newToolMeta.inputSchemaHash;
    existingTool.openapi = newToolMeta.openapi;

    return true;
}

// Debug message constants for tool change operations
const TOOL_CHANGE_MESSAGES = {
    TOOL_ADDED: (name: string) => `A new tool '${name}' was added to the server.`,
    SCHEMA_CHANGED: (name: string) => `The schema for the existing tool '${name}' was changed`,
    UPDATE_SUCCESS: (name: string) => `Successfully updated tool '${name}'`,
    UPDATE_FAILED: (name: string) => `Failed to update tool '${name}'`
} as const;

/**
 * Encapsulates tool change monitoring with proper state management.
 * Handles polling lock to prevent concurrent checks when monitoring 1000s of tools.
 */
class ToolChangeMonitor {
    private isPolling = false;

    /**
     * Checks for tool changes and updates the server accordingly.
     * Uses a polling lock to prevent concurrent executions.
     * Continues processing even if individual tool updates fail (best-effort).
     *
     * @param server - The MCP server instance
     * @param configuration - Server configuration
     * @param currentToolDefinitions - Array of current tool definitions (modified in-place)
     */
    async checkForChanges(
        server: McpServer,
        configuration: Configuration,
        currentToolDefinitions: ToolDefinition[]
    ): Promise<void> {
        if (this.isPolling) {
            return;
        }

        this.isPolling = true;
        try {
            await this.performToolCheck(server, configuration, currentToolDefinitions);
        } catch (error) {
            handleError("Error checking for tool changes: ", error);
        } finally {
            this.isPolling = false;
        }
    }

    /**
     * Performs the actual tool change detection and processing.
     * Uses Map-based lookups for O(1) performance with large tool sets.
     */
    private async performToolCheck(
        server: McpServer,
        configuration: Configuration,
        currentToolDefinitions: ToolDefinition[]
    ): Promise<void> {
        const newToolMetadata = await fetchAllToolMetadata(configuration);
        
        // Create maps for O(1) lookups (critical for 1000s of tools)
        const existingToolsMap = new Map(
            currentToolDefinitions.map(t => [t.name, t])
        );
        const newToolsMap = new Map(
            newToolMetadata.map(t => [t.name, t])
        );

        // Remove tools that no longer exist
        removeDeletedTools(currentToolDefinitions, newToolsMap);

        // Process new and updated tools
        this.processToolChanges(
            server,
            configuration,
            currentToolDefinitions,
            newToolMetadata,
            existingToolsMap
        );
    }

    /**
     * Processes all tool changes (additions and updates).
     * Continues processing even if individual updates fail.
     */
    private processToolChanges(
        server: McpServer,
        configuration: Configuration,
        currentToolDefinitions: ToolDefinition[],
        newToolMetadata: Omit<ToolDefinition, 'registeredTool'>[],
        existingToolsMap: Map<string, ToolDefinition>
    ): void {
        for (const newToolMeta of newToolMetadata) {
            const existingTool = existingToolsMap.get(newToolMeta.name);
            
            if (!existingTool) {
                this.handleNewTool(server, configuration, newToolMeta, currentToolDefinitions);
            } else if (this.hasSchemaChanged(existingTool, newToolMeta)) {
                this.handleSchemaUpdate(configuration, existingTool, newToolMeta);
            }
        }
    }

    /**
     * Handles registration of a newly detected tool.
     */
    private handleNewTool(
        server: McpServer,
        configuration: Configuration,
        newToolMeta: Omit<ToolDefinition, 'registeredTool'>,
        currentToolDefinitions: ToolDefinition[]
    ): void {
        debug(TOOL_CHANGE_MESSAGES.TOOL_ADDED(newToolMeta.name));
        registerDecisionOperationTool(server, configuration, newToolMeta, currentToolDefinitions);
    }

    /**
     * Handles updating an existing tool when its schema changes.
     * Logs success/failure but continues processing (best-effort).
     */
    private handleSchemaUpdate(
        configuration: Configuration,
        existingTool: ToolDefinition,
        newToolMeta: Omit<ToolDefinition, 'registeredTool'>
    ): void {
        debug(TOOL_CHANGE_MESSAGES.SCHEMA_CHANGED(newToolMeta.name));
        
        const success = updateExistingTool(configuration, existingTool, newToolMeta);
        debug(success
            ? TOOL_CHANGE_MESSAGES.UPDATE_SUCCESS(newToolMeta.name)
            : TOOL_CHANGE_MESSAGES.UPDATE_FAILED(newToolMeta.name)
        );
    }

    /**
     * Checks if a tool's schema has changed by comparing hashes.
     */
    private hasSchemaChanged(
        existingTool: ToolDefinition,
        newToolMeta: Omit<ToolDefinition, 'registeredTool'>
    ): boolean {
        return existingTool.inputSchemaHash !== newToolMeta.inputSchemaHash;
    }
}

// Create singleton instance for tool change monitoring
const toolChangeMonitor = new ToolChangeMonitor();

/**
 * Function to check for tool changes and update tools accordingly.
 * This is a wrapper around the ToolChangeMonitor class for backward compatibility.
 *
 * @param server - The MCP server instance
 * @param configuration - Server configuration
 * @param currentToolDefinitions - Array of current tool definitions (modified in-place)
 */
async function checkForToolChanges(
    server: McpServer,
    configuration: Configuration,
    currentToolDefinitions: ToolDefinition[]
): Promise<void> {
    await toolChangeMonitor.checkForChanges(server, configuration, currentToolDefinitions);
}

function registerToolHandlers(server: McpServer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setToolRequestHandlers();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(label: string, error: any) {
    debug(`${label}:`, error instanceof Error ? error.message : String(error));
}

export async function createMcpServer(name: string, configuration: Configuration): Promise<{ server: McpServer, transport?: StdioServerTransport, httpServer?: http.Server }> {
    const version = configuration.version;
    const server = new McpServer({
        name: name,
        version: version
    }, {
        capabilities: {
            tools: {
                listChanged: true
            }
        }
    });

    // IMPORTANT: Initialize tool handlers BEFORE registering any tools or connecting to transport.
    // This ensures the tools/list endpoint is available even if no tools are registered yet,
    // preventing "Method not found" errors when clients call list_tools() on empty deployment spaces.
    registerToolHandlers(server);

    const toolDefinitions: ToolDefinition[] = [];
    const toolNames: string[] = [];

    for (const deploymentSpace of configuration.deploymentSpaces) {
        debug("deploymentSpace", deploymentSpace);
        
        let serviceIds = configuration.decisionServiceIds;
        debug("decisionServiceIds", JSON.stringify(configuration.decisionServiceIds));

        if (serviceIds === undefined || serviceIds.length === 0) {
            const spaceMetadata = await getMetadata(configuration, deploymentSpace);
            debug("spaceMetadata", JSON.stringify(spaceMetadata, null, " "));
             
            serviceIds = getDecisionServiceIds(spaceMetadata);
        }
        debug("serviceIds", JSON.stringify(serviceIds, null, " "));

        for (const serviceId of serviceIds) {
            debug("serviceId", serviceId);
            try {
                const openapi = await getDecisionServiceOpenAPI(configuration, deploymentSpace, serviceId);
                await registerDecisionServiceTools(server, configuration, deploymentSpace, openapi, serviceId, toolNames, toolDefinitions);
            } catch (error) {
                // Log the error but continue processing other decision services
                console.error(`Error registering tools for decision service '${serviceId}' in deployment space '${deploymentSpace}':`, error instanceof Error ? error.message : String(error));
            }
        }
    }

    // Start polling for tool changes
    debug(`Now polling for tools change every ${configuration.formattedPollInterval()}`);
    const pollTimer = setInterval(async () => {
        debug("Polling for tool changes...");
        await checkForToolChanges(server, configuration, toolDefinitions);
    }, configuration.pollIntervalMs);

    // Clean up interval on server close
    const originalClose = server.close.bind(server);
    server.close = async () => {
        clearInterval(pollTimer);
        return originalClose();
    };

    if (configuration.isHttpTransport()) {
        debug("IBM Decision Intelligence MCP Server version", version, "running on http");
        const httpServer = runHTTPServer(server);
        return { server, httpServer }
    }

    const transport = configuration.transport!;
    await server.connect(transport);
    debug("IBM Decision Intelligence MCP Server version", version, "running on stdio");
    return { server, transport }
}