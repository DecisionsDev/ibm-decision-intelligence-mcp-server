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

import {AuthenticationMode} from '../src/authentication-mode.js';
import {Credentials} from '../src/credentials.js';
import {debug} from '../src/debug.js';

// Mock the debug function
jest.mock('../src/debug', () => ({
    debug: jest.fn(),
}));
const mockDebug = debug as jest.MockedFunction<typeof debug>;

describe('Credentials', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };

        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const authorization = 'authorization';

    describe('constructor and toString', () => {
        test('should call debug with credential info when creating DI API key credentials', () => {
            const apikey = 'test-api-key';
            Credentials.createDiApiKeyCredentials(apikey);
            
            expect(mockDebug).toHaveBeenCalledWith('DI API Key(API key: ***)');
        });

        test('should call debug with credential info when creating Zen API key credentials', () => {
            const username = 'test-user';
            const apikey = 'test-api-key';
            Credentials.createZenApiKeyCredentials(username, apikey);
            
            expect(mockDebug).toHaveBeenCalledWith(`Zen API Key(username: ${username}, API key: ***)`);
        });

        test('should call debug with credential info when creating basic auth credentials', () => {
            const username = 'test-user';
            const password = 'test-password';
            Credentials.createBasicAuthCredentials(username, password);
            
            expect(mockDebug).toHaveBeenCalledWith(`Basic Authentication(username: ${username}, password: ***)`);
        });
    });

    describe('for basic authentication', () => {
        test(`should return '${authorization}' as header key`, () => {
            const credentials = Credentials.createBasicAuthCredentials('toto', 'tutu')
            expect(credentials.getAuthorizationHeaderKey()).toBe(authorization);
        });

        test('should return the encoded username and password as header value', () => {
            const username = 'username';
            const password = 'password';
            const credentials = Credentials.createBasicAuthCredentials(username, password);
            const encodedUsernamePassword= Buffer.from(`${username}:${password}`).toString('base64');
            expect(credentials.getAuthorizationHeaderValue()).toBe(`Basic ${encodedUsernamePassword}`);
        });

        test('should not display sensitive information', () => {
            const username = 'blah blah blah';
            const password = 'meh';
            const credentials = Credentials.createBasicAuthCredentials(username, password);
            const credentialsAsString = credentials.toString();
            expect(credentialsAsString).toContain(username);
            expect(credentialsAsString).not.toContain(password);
        });
    });

    describe('for DI API key', () => {
        const apikey = 'apikey';
        test(`should return '${apikey}' as header key`, () => {
            const credentials = Credentials.createDiApiKeyCredentials('toto');
            expect(credentials.getAuthorizationHeaderKey()).toBe(apikey);
        });

        test('should return the API key as header value', () => {
            const apiKey = 'titi';
            const credentials = Credentials.createDiApiKeyCredentials(apiKey);
            expect(credentials.getAuthorizationHeaderValue()).toBe(apiKey);
        });

        test('should not display sensitive information', () => {
            const apiKey = 'woof woof';
            const credentials = Credentials.createDiApiKeyCredentials(apiKey);
            expect(credentials.toString()).not.toContain(apiKey);
        });
    });

    describe('for Zen API key', () => {
        test(`should return '${authorization}' as header key`, () => {
            const credentials = Credentials.createZenApiKeyCredentials('toto', 'tutu')
            expect(credentials.getAuthorizationHeaderKey()).toBe(authorization);
        });

        test('should return the encoded username and API key as header value', () => {
            const username = 'username';
            const apiKey = 'apiKey';
            const credentials = Credentials.createZenApiKeyCredentials(username, apiKey)
            const encodedUsernamePassword= Buffer.from(`${username}:${apiKey}`).toString('base64');
            expect(credentials.getAuthorizationHeaderValue()).toBe(`ZenApiKey ${encodedUsernamePassword}`);
        });

        test('should not display sensitive information', () => {
            const username = 'blah blah blah';
            const apiKey = 'meh';
            const credentials = Credentials.createZenApiKeyCredentials(username, apiKey)
            const credentialsAsString = credentials.toString();
            expect(credentialsAsString).toContain(username);
            expect(credentialsAsString).not.toContain(apiKey);
        });
    });


    describe('validateCredentials', () => {

        describe('should return', () => {

            test(`DI APi key credentials by default`, () => {
                const diApikey = 'blah.blah.blah';
                const credentials = Credentials.validateCredentials({diApikey});
                expect(credentials!.authenticationMode).toBe(AuthenticationMode.DI_API_KEY);
                expect(credentials!.getAuthorizationHeaderValue()).toBe(diApikey);
            });

            test(`DI APi key credentials for 'DiApiKey' authenticationMode`, () => {
                const diApikey = 'blah.blah.blah';
                const authenticationMode = AuthenticationMode.DI_API_KEY;
                const credentials = Credentials.validateCredentials({diApikey, authenticationMode});
                expect(credentials!.authenticationMode).toBe(authenticationMode);
                expect(credentials!.getAuthorizationHeaderValue()).toBe(diApikey);
            });

            test(`Zen APi key credentials for 'ZenApiKey' authenticationMode`, () => {
                const zenApikey = 'blah.blah.blah';
                const zenUsername = 'pim.pam.plouf';
                const authenticationMode = AuthenticationMode.ZEN_API_KEY;
                const credentials = Credentials.validateCredentials({zenApikey, zenUsername, authenticationMode});
                expect(credentials!.authenticationMode).toBe(authenticationMode);
                const encoded= Buffer.from(`${zenUsername}:${zenApikey}`).toString('base64');
                expect(credentials!.getAuthorizationHeaderValue()).toBe(`ZenApiKey ${encoded}`);
            });

            test(`basic authentication credentials for 'Basic' authenticationMode`, () => {
                const basicUsername = 'pim.pam.plouf';
                const basicPassword = 'mehh';
                const authenticationMode = AuthenticationMode.BASIC;
                const credentials = Credentials.validateCredentials({basicUsername, basicPassword, authenticationMode});
                expect(credentials!.authenticationMode).toBe(authenticationMode);
                const encoded= Buffer.from(`${basicUsername}:${basicPassword}`).toString('base64');
                expect(credentials!.getAuthorizationHeaderValue()).toBe(`Basic ${encoded}`);
            });
        });

        describe('should throw an error', () => {

            test(`when the authentication mode cannot be parsed`, () => {
                const authenticationMode = 'toto'
                expect(() => {
                    Credentials.validateCredentials({authenticationMode: authenticationMode});
                }).toThrow(`Invalid authentication mode: '${authenticationMode}'. Must be one of: 'diapikey', 'zenapikey', 'basic'`)
            });

            test(`when apikey is not defined for 'DiApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({authenticationMode: AuthenticationMode.DI_API_KEY});
                }).toThrow(`The DI API key must be defined`)
            });

            test(`when apikey is empty for 'DiApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({diApikey: '      ', authenticationMode: AuthenticationMode.DI_API_KEY});
                }).toThrow(`The DI API key cannot be empty`)
            });

            test(`when apikey is not defined for 'ZenApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({authenticationMode: AuthenticationMode.ZEN_API_KEY});
                }).toThrow(`The Zen API key must be defined`)
            });

            test(`when apikey is empty for 'ZenApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({zenApikey: '      ', authenticationMode: AuthenticationMode.ZEN_API_KEY});
                }).toThrow(`The Zen API key cannot be empty`)
            });

            test(`when username is not defined for 'ZenApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({zenApikey: 'apikey', authenticationMode: AuthenticationMode.ZEN_API_KEY});
                }).toThrow(`The Zen username must be defined`)
            });

            test(`when username is empty for 'ZenApiKey' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({zenApikey: 'apikey', zenUsername: ' ', authenticationMode: AuthenticationMode.ZEN_API_KEY});
                }).toThrow(`The Zen username cannot be empty`)
            });

            test(`when username is not defined ty for 'Basic' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({basicPassword: 'tutu', authenticationMode: AuthenticationMode.BASIC});
                }).toThrow(`The username for basic authentication must be defined`)
            });

            test(`when username is empty for 'Basic' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({basicUsername: '      ', basicPassword: 'tutu', authenticationMode: AuthenticationMode.BASIC});
                }).toThrow(`The username for basic authentication cannot be empty`)
            });

            test(`when password is not defined for 'Basic' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({basicUsername: 'foo', authenticationMode: AuthenticationMode.BASIC});
                }).toThrow(`The password for basic authentication must be defined`)
            });

            test(`when password is empty for 'Basic' authenticationMode`, () => {
                expect(() => {
                    Credentials.validateCredentials({basicUsername: 'foo', basicPassword: '      ', authenticationMode: AuthenticationMode.BASIC});
                }).toThrow(`The password for basic authentication cannot be empty`)
             });

            test(`when the APIKEY environment variable is not defined`, () => {
                expect(() => Credentials.validateCredentials({})).
                toThrow('The DI API key must be defined');
            });

            test(`when the APIKEY environment variable is empty`, () => {
                process.env.DI_APIKEY = '          ';
                expect(() => Credentials.validateCredentials({})).
                toThrow('The DI API key cannot be empty');
            });

            test(`when the APIKEY environment variable is not defined for the 'Zen Api Key' authentication mode`, () => {
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.ZEN_API_KEY})).
                toThrow('The Zen API key must be defined');
            });

            test(`when the APIKEY environment variable is empty for the 'Zen Api Key' authentication mode`, () => {
                process.env.ZEN_APIKEY = '          ';
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.ZEN_API_KEY})).
                toThrow('The Zen API key cannot be empty');
            });

            test(`when the BASIC_USERNAME environment variable`, () => {
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.BASIC })).
                toThrow('The username for basic authentication must be defined');
            });

            test(`when the BASIC_USERNAME environment variable is empty`, () => {
                process.env.BASIC_USERNAME = '          ';
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.BASIC })).
                toThrow('The username for basic authentication cannot be empty');
            });

            test(`when the PASSWORD environment variable not defined`, () => {
                process.env.BASIC_USERNAME = 'the.password';
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.BASIC })).
                toThrow('The password for basic authentication must be defined');
            });

            test(`when the PASSWORD environment variable is empty`, () => {
                process.env.BASIC_PASSWORD = '          ';
                process.env.BASIC_USERNAME = 'the.password';
                expect(() => Credentials.validateCredentials({authenticationMode: AuthenticationMode.BASIC })).
                toThrow('The password for basic authentication cannot be empty');
            });
        });

        describe('when command line arguments are not provided, should use', () => {

            test('DI_APIKEY environment variable', () => {
                const apiKey = 'the api key';
                process.env.DI_APIKEY = apiKey;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    apikey: apiKey,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });
            });

            test('AUTHENTICATION_MODE, ZEN_APIKEY and ZEN_USERNAME environment variables', () => {
                const apiKey = 'the api key';
                process.env.ZEN_APIKEY = apiKey;
                const username = 'the username';
                process.env.ZEN_USERNAME = username;
                const authenticationMode = AuthenticationMode.ZEN_API_KEY;
                process.env.AUTHENTICATION_MODE = authenticationMode;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    apikey: apiKey,
                    username: username,
                    authenticationMode: authenticationMode
                });
            });

            test('AUTHENTICATION_MODE, BASIC_USERNAME and BASIC_PASSWORD environment variables', () => {
                const username = 'the username';
                process.env.BASIC_USERNAME = username;
                const password = 'the password';
                process.env.BASIC_PASSWORD = password;
                const authenticationMode = AuthenticationMode.BASIC;
                process.env.AUTHENTICATION_MODE = authenticationMode;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    username: username,
                    password: password,
                    authenticationMode: authenticationMode
                });
            });
        });


        const otherUsername = 'the other username';
        const otherApiKey = 'the other API key';

        describe('should prioritize command line arguments over environment variables', () => {

            test('for DI API key', () => {
                const diApikey = 'the api key'
                process.env.DI_APIKEY = otherApiKey;
                expect(Credentials.validateCredentials({diApikey})).toMatchObject({
                    apikey: diApikey,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });
            });

            test('for Zen API key', () => {
                const zenApikey = 'the api key'
                process.env.ZEN_APIKEY = otherApiKey;
                const authenticationMode = AuthenticationMode.ZEN_API_KEY;
                const zenUsername = 'Antonio Dela Vega'
                expect(Credentials.validateCredentials({zenApikey, zenUsername, authenticationMode})).toMatchObject({
                    apikey: zenApikey,
                    username: zenUsername,
                    authenticationMode: authenticationMode
                });
            });

            test('for Zen username', () => {
                const zenApikey = 'the api key'
                const zenUsername = 'Antonio Dela Vega';
                process.env.ZEN_USERNAME = otherUsername;
                const authenticationMode = AuthenticationMode.ZEN_API_KEY.toLowerCase();
                expect(Credentials.validateCredentials({zenApikey, zenUsername, authenticationMode})).toMatchObject({
                    apikey: zenApikey,
                    username: zenUsername,
                    authenticationMode: AuthenticationMode.ZEN_API_KEY
                });
            });

            test('for authentication mode', () => {
                const zenApikey = 'the api key';
                const zenUsername = 'John Smith';
                const authenticationMode = AuthenticationMode.ZEN_API_KEY.toLowerCase();
                process.env.AUTHENTICATION_MODE = AuthenticationMode.DI_API_KEY;
                expect(Credentials.validateCredentials({zenApikey, zenUsername, authenticationMode: authenticationMode})).toMatchObject({
                    apikey: zenApikey,
                    username: zenUsername,
                    authenticationMode: AuthenticationMode.ZEN_API_KEY
                });
            });

            test('for basic authentication username', () => {
                const basicUsername = 'Antonio Dela Vega';
                const basicPassword = 'password';
                process.env.BASIC_USERNAME = 'the other username';
                const authenticationMode = AuthenticationMode.BASIC.toLowerCase();
                expect(Credentials.validateCredentials({basicPassword, basicUsername, authenticationMode})).toMatchObject({
                    password: basicPassword,
                    username: basicUsername,
                    authenticationMode: AuthenticationMode.BASIC
                });
            });

            test('for basic authentication password', () => {
                const basicUsername = 'Foo Babar';
                const basicPassword = 'yet another password';
                process.env.BASIC_PASSWORD = 'the other password';
                const authenticationMode = AuthenticationMode.BASIC;
                expect(Credentials.validateCredentials({basicPassword, basicUsername, authenticationMode})).toMatchObject({
                    password: basicPassword,
                    username: basicUsername,
                    authenticationMode: authenticationMode
                });
            });
        });

        test('can combine both command line arguments and environment variables', () => {
            const envApiKey = 'the other API key';
            process.env.ZEN_APIKEY = envApiKey;
            const username = 'Antonio Dela Vega';
            process.env.AUTHENTICATION_MODE = AuthenticationMode.ZEN_API_KEY;
            expect(Credentials.validateCredentials({zenUsername: username})).toMatchObject({
                apikey: envApiKey,
                username: username,
                authenticationMode: AuthenticationMode.ZEN_API_KEY
            });

            const basicPassword = 'password'
            process.env.BASIC_USERNAME = otherUsername;
            const otherPassword = 'the other password';
            process.env.BASIC_PASSWORD = otherPassword;
            process.env.AUTHENTICATION_MODE = AuthenticationMode.BASIC.toLowerCase();
            expect(Credentials.validateCredentials({basicPassword})).toMatchObject({
                password: basicPassword,
                username: otherUsername,
                authenticationMode: AuthenticationMode.BASIC
            });

            expect(Credentials.validateCredentials({basicUsername: username})).toMatchObject({
                password: otherPassword,
                username: username,
                authenticationMode: AuthenticationMode.BASIC
            });

            process.env.AUTHENTICATION_MODE = undefined;
            expect(Credentials.validateCredentials({basicPassword, authenticationMode: AuthenticationMode.BASIC})).toMatchObject({
                password: basicPassword,
                username: otherUsername,
                authenticationMode: AuthenticationMode.BASIC
            });

            expect(Credentials.validateCredentials({basicUsername: username, authenticationMode: AuthenticationMode.BASIC})).toMatchObject({
                password: otherPassword,
                username: username,
                authenticationMode: AuthenticationMode.BASIC
            });
        });

        describe('should not take into account environment variables used by other authentication modes', () => {

            test(`for DI API key authentication`, () => {
                process.env.USERNAME = 'OS dependant username';
                process.env.BASIC_USERNAME = 'username for basic authentication';
                process.env.PASSWORD = 'password for basic authentication';
                process.env.ZEN_USERNAME = 'username for Zen API key authentication';
                const diApikey = 'the DI API key';
                const authenticationMode = AuthenticationMode.DI_API_KEY.toLowerCase();
                expect(Credentials.validateCredentials({diApikey})).toMatchObject({
                    apikey: diApikey,
                    username: undefined,
                    password: undefined,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });

                expect(Credentials.validateCredentials({diApikey, authenticationMode})).toMatchObject({
                    apikey: diApikey,
                    username: undefined,
                    password: undefined,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });

                process.env.AUTHENTICATION_MODE = authenticationMode;
                expect(Credentials.validateCredentials({diApikey})).toMatchObject({
                    apikey: diApikey,
                    username: undefined,
                    password: undefined,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });

                process.env.DI_APIKEY = diApikey;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    apikey: diApikey,
                    username: undefined,
                    password: undefined,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                });
            });

            test(`for Zen API key authentication`, () => {
                process.env.USERNAME = 'OS dependant username';
                process.env.DI_APIKEY = 'API key for DI API key authentication';
                process.env.BASIC_USERNAME = 'username for basic authentication';
                process.env.BASIC_PASSWORD = 'password for basic authentication';
                const zenApikey = 'the Zen API key';
                const zenUsername = 'the Zen user name';
                const authenticationMode = AuthenticationMode.ZEN_API_KEY;
                expect(Credentials.validateCredentials({zenApikey, zenUsername, authenticationMode})).toMatchObject({
                    apikey: zenApikey,
                    username: zenUsername,
                    password: undefined,
                    authenticationMode: authenticationMode
                });

                process.env.ZEN_USERNAME = zenUsername;
                process.env.ZEN_APIKEY = zenApikey;
                process.env.AUTHENTICATION_MODE = authenticationMode;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    apikey: zenApikey,
                    username: zenUsername,
                    password: undefined,
                    authenticationMode: authenticationMode
                });
            });

            test(`for basic authentication`, () => {
                process.env.USERNAME = 'OS dependant username';
                process.env.DI_APIKEY = 'API key for dI API key authentication';
                process.env.ZEN_APIKEY = 'API key for Zen API key authentication';
                process.env.ZEN_USERNAME = 'username for Zen API key authentication';
                const basicUsername = 'username for basic authentication';
                const basicPassword = 'password for basic authentication';
                const authenticationMode = AuthenticationMode.BASIC;
                expect(Credentials.validateCredentials({basicUsername, basicPassword, authenticationMode})).toMatchObject({
                    apikey: undefined,
                    username: basicUsername,
                    password: basicPassword,
                    authenticationMode: authenticationMode
                });

                process.env.BASIC_USERNAME = basicUsername;
                process.env.BASIC_PASSWORD = basicPassword;
                process.env.AUTHENTICATION_MODE = authenticationMode;
                expect(Credentials.validateCredentials({})).toMatchObject({
                    apikey: undefined,
                    username: basicUsername,
                    password: basicPassword,
                    authenticationMode: authenticationMode
                });
            });
        });
    });
});
