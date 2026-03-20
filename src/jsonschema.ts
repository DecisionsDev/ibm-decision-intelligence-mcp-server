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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { OpenAPIV3_1 } from "openapi-types";
import { debug } from "./debug.js";

function walk(schema: OpenAPIV3_1.SchemaObject, defs: any, history: any): boolean {
    // Handle null or undefined schemas
    if (!schema || typeof schema !== 'object') {
        return false;
    }
    
    if (schema.type === 'object') {
        if (schema.properties) {
            for (const key in schema.properties) {
                const property = schema.properties[key];
                if (walk(property, defs, history)) {
                    delete((schema.properties as any)[key]);
                }
            }
        }
        return false;
    }

    // Handle arrays with items that may contain $ref
    if (schema.type === 'array' && (schema as any).items) {
        walk((schema as any).items, defs, history);
        return false;
    }

    if ((schema as any)["$ref"]) {
        const canonicalRef = (schema as any)['$ref'];

        const paths = canonicalRef.split('/');
        const ref = paths[3];

        if (history.includes(ref)) {
            debug("Circular reference detected for " + ref + " in history: " + history);
            delete((schema as any)["$ref"]);
            return true;
        }
        const def = defs[ref];
        for (const k in def) {
            (schema as any)[k] = def[k];
        }
        delete((schema as any)["$ref"]);
        walk(schema, defs, [...history, ref]);
        return false
    }
    return false
}

export function expandJSONSchemaDefinition(schema: any, defs: any): any {
    const outSchema = {...schema};

    const expandedDefs = {... defs};

    Object.keys(expandedDefs).forEach((key) => {
        const def = defs[key];
        walk(def, expandedDefs, [key]);
    });

    walk(outSchema, expandedDefs, []);

    return outSchema;
}

