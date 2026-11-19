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

import { AuthenticationMode, parseAuthenticationMode, defaultAuthenticationMode } from '../src/authentication-mode.js';

describe(`Decision Runtime`, () => {

    describe(`defaultAuthenticationMode`, () => {

        test(`should return AuthenticationMode.ZEN_API_KEY`, () => {
            expect(defaultAuthenticationMode()).toEqual(AuthenticationMode.ZEN_API_KEY);
        });
    });

    describe(`parseDecisionRuntime`, () => {

        test(`should parse 'ZenApiKey' as AuthenticationMode.ZEN_API_KEY`, () => {
            expect(parseAuthenticationMode('ZenApiKey')).toEqual(AuthenticationMode.ZEN_API_KEY);
        });

        test(`should parse 'ZenApiKey' as AuthenticationMode.ZEN_API_KEY`, () => {
            expect(parseAuthenticationMode('zenapikey')).toEqual(AuthenticationMode.ZEN_API_KEY);
        });

        test(`should parse 'Basic' as AuthenticationMode.BASIC`, () => {
            expect(parseAuthenticationMode('Basic')).toEqual(AuthenticationMode.BASIC);
        });

        test(`should parse 'Basic' as AuthenticationMode.BASIC`, () => {
            expect(parseAuthenticationMode('basic')).toEqual(AuthenticationMode.BASIC);
        });

        test(`should parse 'DI' returns undefined`, () => {
            expect(parseAuthenticationMode('DI')).toEqual(undefined);
        });
    });

});
