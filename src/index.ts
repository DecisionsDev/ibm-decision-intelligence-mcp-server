#!/usr/bin/env node
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

import {createConfiguration} from "./command-line.js";
import {createMcpServer} from "./mcp-server.js";
import {debug} from "./debug.js";
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const requireModule = createRequire(import.meta.url);
const packageJson = requireModule(path.join(dirname, '../package.json'));

const configuration = createConfiguration(packageJson.version);
const serverName = "mcp-server";
createMcpServer(serverName, configuration).then(() => {
     debug(`MCP server '${serverName}' is up & running...`);
 });
