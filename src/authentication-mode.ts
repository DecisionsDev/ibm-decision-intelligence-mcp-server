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

export enum AuthenticationMode {
    ZEN_API_KEY = "ZenApiKey",
    BASIC = "Basic",
}

export function parseAuthenticationMode(runtime: string): AuthenticationMode | undefined {
    const normalizedInput = runtime.toLowerCase();
    return Object.values(AuthenticationMode).find(
        mode => mode.toLowerCase() === normalizedInput
    );
}

export function defaultAuthenticationMode(): AuthenticationMode {
    return AuthenticationMode.ZEN_API_KEY;
}
