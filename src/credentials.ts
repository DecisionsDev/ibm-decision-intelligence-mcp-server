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

import {OptionValues} from "commander";
import {debug} from "./debug.js";
import {AuthenticationMode, parseAuthenticationMode, defaultAuthenticationMode} from "./authentication-mode.js";
import {ENV_VARS} from "./command-line.js";

interface CredentialsOptions {
    apikey?: string;
    username?: string;
    password?: string;
}

export class Credentials {
    private readonly apikey?: string;

    private readonly username?: string;

    private readonly password?: string;

    readonly authenticationMode: AuthenticationMode;

    private constructor(options: CredentialsOptions = {}, authenticationMode: AuthenticationMode) {
        const { apikey, username, password } = options;
        this.apikey = apikey;
        this.username = username;
        this.password = password;
        this.authenticationMode = authenticationMode;
        debug(this.toString());
    }

    static validateAuthenticationMode(authenticationMode: string): AuthenticationMode {
        debug("AUTHENTICATION_MODE=" + authenticationMode);
        if (authenticationMode === undefined) {
            const actualAuthenticationMode = defaultAuthenticationMode();
            debug(`The authentication mode is not defined. Using '${actualAuthenticationMode}'`);
            return actualAuthenticationMode;
        }
        const actualAuthenticationMode = parseAuthenticationMode(authenticationMode);
        if (actualAuthenticationMode === undefined) {
            throw new Error(`Invalid authentication mode: '${authenticationMode}'. Must be one of: '${Object.values(AuthenticationMode).map(v => v.toLowerCase()).join('\', \'')}'`);
        }
        return actualAuthenticationMode;
    }

    static validateCredentials(options: OptionValues) {
        const authenticationMode = this.validateAuthenticationMode(
            options.authenticationMode || process.env[ENV_VARS.AUTHENTICATION_MODE]
        );

        switch (authenticationMode) {
            case AuthenticationMode.DI_API_KEY: {
                const apikey = options.diApikey || process.env[ENV_VARS.DI_APIKEY];
                return this.createDiApiKeyCredentials(apikey);
            }
            case AuthenticationMode.ZEN_API_KEY: {
                const apikey = options.zenApikey || process.env[ENV_VARS.ZEN_APIKEY];
                const username = options.zenUsername || process.env[ENV_VARS.ZEN_USERNAME];
                return this.createZenApiKeyCredentials(username, apikey);

            }
            case AuthenticationMode.BASIC: {
                const username = options.basicUsername || process.env[ENV_VARS.BASIC_USERNAME];
                const password = options.basicPassword || process.env[ENV_VARS.BASIC_PASSWORD];
                return this.createBasicAuthCredentials(username, password);
            }
        }
    }

    static createDiApiKeyCredentials(apikey: string) {
        this.checkNonEmptyString(apikey, 'DI API key');
        return new Credentials({apikey}, AuthenticationMode.DI_API_KEY);
    }

    static createZenApiKeyCredentials(username: string, apikey: string) {
        this.checkNonEmptyString(apikey, 'Zen API key');
        this.checkNonEmptyString(username, 'Zen username');
        return new Credentials({username, apikey}, AuthenticationMode.ZEN_API_KEY);
    }

    static createBasicAuthCredentials(username: string, password: string) {
        this.checkNonEmptyString(username, 'username for basic authentication');
        this.checkNonEmptyString(password, 'password for basic authentication');
        return new Credentials({ username, password }, AuthenticationMode.BASIC);
    }


    private static checkNonEmptyString(value:string, errorLabel: string) {
        if (value === undefined) {
            throw new Error(`The ${errorLabel} must be defined`);
        }

        if (value.trim().length === 0) {
            throw new Error(`The ${errorLabel} cannot be empty`);
        }
    }

    toString() {
        switch (this.authenticationMode) {
            case AuthenticationMode.DI_API_KEY: {
                return `DI API Key(API key: ***)`;
            }
            case AuthenticationMode.ZEN_API_KEY: {
                return `Zen API Key(username: ${this.username}, API key: ***)`;
            }
            case AuthenticationMode.BASIC:
            default: {
                return `Basic Authentication(username: ${this.username}, password: ***)`;
            }
        }
    }

    getAuthorizationHeaderValue(): string {
        switch (this.authenticationMode) {
            case AuthenticationMode.DI_API_KEY: {
                return this.apikey!;
            }
            case AuthenticationMode.ZEN_API_KEY: {
                const encoded = Buffer.from(`${this.username}:${this.apikey}`).toString('base64');
                return `ZenApiKey ${encoded}`;
            }
            case AuthenticationMode.BASIC:
            default: {
                const encoded = Buffer.from(`${this.username}:${this.password}`).toString('base64');
                return `Basic ${encoded}`;
            }
        }
    }

    getAuthorizationHeaderKey() : string {
        switch (this.authenticationMode) {
            case AuthenticationMode.DI_API_KEY: {
                return 'apikey';
            }
            case AuthenticationMode.BASIC:
            case AuthenticationMode.ZEN_API_KEY:
            default: {
                return 'authorization';
            }
        }
    }
}
