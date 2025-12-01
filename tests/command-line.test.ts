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

import {createConfiguration, Configuration} from '../src/command-line.js';
import {debug, setDebug} from '../src/debug.js';
import {AuthenticationMode, parseAuthenticationMode, defaultAuthenticationMode} from '../src/authentication-mode.js';
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";

// Mock the debug function and setDebug function
jest.mock('../src/debug', () => ({
    debug: jest.fn(),
    setDebug: jest.fn(),
}));
const mockDebug = debug as jest.MockedFunction<typeof debug>;
const mockSetDebug = setDebug as jest.MockedFunction<typeof setDebug>;

// Mock the DecisionRuntime enum and parseDecisionRuntime function
jest.mock('../src/authentication-mode', () => ({
    AuthenticationMode: {
        DI_API_KEY: 'DiApiKey',
        ZEN_API_KEY: 'ZenApiKey',
        BASIC: 'Basic'
    },
    parseAuthenticationMode: jest.fn(),
    defaultAuthenticationMode: jest.fn()
}));
const mockParseAuthenticationMode = parseAuthenticationMode as jest.MockedFunction<typeof parseAuthenticationMode>;
const mockDefaultAuthenticationMode = defaultAuthenticationMode as jest.MockedFunction<typeof defaultAuthenticationMode>;

describe('CLI Configuration', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Save original environment
        originalEnv = process.env;
        process.env = { ...originalEnv };
        process.env.npm_package_version = version;

        // Clear all mocks
        jest.clearAllMocks();

        // Setup default mock implementations
        mockParseAuthenticationMode.mockImplementation((authenticationMode: string) => {
            const normalizedInput = authenticationMode.toLowerCase();
            if (normalizedInput === 'DiApiKey'.toLowerCase()) {
                return AuthenticationMode.DI_API_KEY;
            }
            if (normalizedInput === 'ZenApiKey'.toLowerCase()) {
                return AuthenticationMode.ZEN_API_KEY;
            }
            if (normalizedInput === 'Basic'.toLowerCase()) {
                return AuthenticationMode.BASIC;
            }
            return undefined;
        });

        mockDefaultAuthenticationMode.mockImplementation(() => {
            return AuthenticationMode.DI_API_KEY;
        });
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    const version = '2.0.0';
    const protocol = 'https:';
    const hostname = 'api.example.com';
    const url = `${protocol}//${hostname}`;

    describe('validateUrl', () => {
        test('should return URL string argument for valid URL', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.url).toBe(url);
            expect(config.version).toBe(version);
        });

        test('should throw error when URL is undefined', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--di-apikey', 'validkey123',
                    '--transport', 'stdio'
                ]);
            }).toThrow('The decision runtime REST API URL is not defined');
        });

        test('should throw error for invalid URL format', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', 'invalid-url',
                    '--di-apikey', 'validkey123',
                    '--transport', 'StDiO'
                ]);
            }).toThrow('Invalid URL format: \'invalid-url\'');
        });

        test('should use URL from environment variable', () => {
            const urlFromEnv = 'https://env-api.example.com';
            process.env.URL = urlFromEnv;

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.url).toBe(urlFromEnv);
        });

        test('should call debug function with URL', () => {
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(mockDebug).toHaveBeenCalledWith('URL=https://api.example.com');
        });
    });

    describe('validateTransport', () => {
        test('should accept valid transports', () => {
            const stdioConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            const httpConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'hTtP'
            ]);

            expect(stdioConfig.transport).toBeInstanceOf(StdioServerTransport);
            expect(httpConfig.transport).toBe(undefined);
        });

        test('should throw error for invalid transport', () => {
            const invalid = 'INVALID';
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', 'validkey123',
                    '--transport', invalid
                ]);
            }).toThrow(`Invalid transport protocol: '${invalid}'. Must be one of: 'stdio', 'http'`);
        });

        test('should use transport from environment variable', () => {
            process.env.TRANSPORT = 'HTTP';

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123'
            ]);

            expect(config.transport).toBe(undefined);
        });

        test('should default to STDIO when not specified', () => {
            // Clear environment variable
            delete process.env.TRANSPORT;

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123'
            ]);

            expect(config.transport).toBeInstanceOf(StdioServerTransport);
        });

        test('should call debug function with transport', () => {
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'HTTP'
            ]);

            expect(mockDebug).toHaveBeenCalledWith('TRANSPORT=HTTP');
        });
    });

    describe('validateDecisionRuntime', () => {
        test('should accept valid authentication modes', () => {
            const diApiKeyConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--authentication-mode', 'DiApiKey'
            ]);
            expect(diApiKeyConfig.credentials.authenticationMode).toBe(AuthenticationMode.DI_API_KEY);

            const zenApiKeyConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--zen-apikey', 'validkey123',
                '--zen-username', 'foobar',
                '--transport', 'STDIO',
                '--authentication-mode', 'ZenApiKey'
            ]);
            expect(zenApiKeyConfig.credentials.authenticationMode).toBe(AuthenticationMode.ZEN_API_KEY);

            const basiconfig = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--basic-username', 'foobar',
                '--basic-password', 'babar',
                '--transport', 'STDIO',
                '--authentication-mode', 'Basic'
            ]);
            expect(basiconfig.credentials.authenticationMode).toBe(AuthenticationMode.BASIC);
        });

        test('should default to DI when not specified', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.credentials.authenticationMode).toBe(AuthenticationMode.DI_API_KEY);
        });

        test('should throw error for invalid decision runtime', () => {
            const invalid = 'INVALID';
            mockParseAuthenticationMode.mockReturnValue(undefined);

            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', 'validkey123',
                    '--transport', 'STDIO',
                    '--authentication-mode', invalid
                ]);
            }).toThrow(`Invalid authentication mode: '${invalid}'. Must be one of: 'diapikey', 'zenapikey', 'basic'`);
        });

        test('should read authentication mode from environment variable', () => {
            process.env.AUTHENTICATION_MODE = 'Basic';

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--basic-username', 'toto',
                '--basic-password', 'tutu',
                '--transport', 'STDIO'
            ]);

            expect(config.credentials.authenticationMode).toBe(AuthenticationMode.BASIC);
        });

        test('should call debug function with authentication mode', () => {
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--authentication-mode', 'DiApiKey'
            ]);

            expect(mockDebug).toHaveBeenCalledWith('AUTHENTICATION_MODE=DiApiKey');
        });

        test('should call parseDecisionRuntime function', () => {
            const diApiKey = 'DiApiKey';
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--authentication-mode', diApiKey
            ]);

            expect(mockParseAuthenticationMode).toHaveBeenCalledWith('DiApiKey');
        });
    });

    describe('validateCredentials', () => {

        test('should throw error when no credentials are defined', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--transport', 'STDIO'
                ]);
            }).toThrow('The DI API key must be defined');
        });

        describe('With DI API key', () => {
            const apiKey = 'validkey123';
            test('should accept valid API keys', () => {
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', apiKey,
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: apiKey
                    },
                });
            });

            test('should throw error for undefined DI API key', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The DI API key must be define');
            });

            test('should throw error for empty API key', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--di-apikey', '   ',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The DI API key cannot be empty');
            });

            test('should use API key from environment variable', () => {
                const envApiKey = 'env-api-key-123';
                process.env.DI_APIKEY = envApiKey;

                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: envApiKey
                    },
                });
            });

            test('should read authentication mode from environment variable', () => {
                process.env.AUTHENTICATION_MODE = 'DIAPIKEY'
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', apiKey,
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: apiKey
                    },
                });
            });

            test('should call debug function with DI API key', () => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', apiKey,
                    '--transport', 'STDIO'
                ]);

                expect(mockDebug).toHaveBeenCalledWith('DI API Key(API key: ***)');
            });
        });

        describe('With Zen API key', () => {

            const apiKey = 'validkey123';
            const username = 'foo bar bra';

            test('should accept valid API keys', () => {
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--zen-apikey', apiKey,
                    '--zen-username', username,
                    '--authentication-mode', 'zenApiKEY',
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: apiKey,
                        username: username
                    },
                });
            });

            test('should throw error for undefined Zen API key', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--authentication-mode', 'zenApiKEY',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The Zen API key must be defined');
            });

            test('should throw error for empty Zen API key', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--zen-apikey', '   ',
                        '--authentication-mode', 'ZENAPIKEY',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The Zen API key cannot be empty');
            });

            test('should throw error for undefined Zen username', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--zen-apikey', apiKey,
                        '--authentication-mode', 'zenApiKEY',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The Zen username must be defined');
            });

            test('should throw error for empty Zen username', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--zen-apikey', apiKey,
                        '--zen-username', '   ',
                        '--authentication-mode', 'ZENAPIKEY',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The Zen username cannot be empty');
            });

            test('should use API key from environment variable', () => {
                const envApiKey = 'env-api-key-123';
                process.env.ZEN_APIKEY = envApiKey;

                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--transport', 'STDIO',
                    '--zen-username', username,
                    '--authentication-mode', 'ZENAPIKEY'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: envApiKey,
                        username: username
                    },
                });
            });

            test('should read authentication mode from environment variable', () => {
                process.env.AUTHENTICATION_MODE = 'ZENapiKEY';
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--zen-apikey', apiKey,
                    '--zen-username', username,
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        apikey: apiKey,
                        username: username
                    },
                });
            });

            test('should call debug function with Zen API key', () => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--zen-apikey', apiKey,
                    '--zen-username', username,
                    '--authentication-mode', 'zenAPIkey',
                    '--transport', 'STDIO'
                ]);

                expect(mockDebug).toHaveBeenCalledWith(`Zen API Key(username: ${username}, API key: ***)`);
            });
        });

        describe('with basic authentication credentials', () => {
            const password = 'the password';
            const username = 'foo bar bra';

            test('should accept valid API keys', () => {
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--basic-username', username,
                    '--basic-password', password,
                    '--authentication-mode', 'BASIC',
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        username: username,
                        password: password
                    },
                });
            });

            test('should throw error for undefined basic authentication username', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--authentication-mode', 'bAsIc',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The username for basic authentication must be defined');
            });

            test('should throw error for empty basic authentication username', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--basic-username', '   ',
                        '--basic-password', password,
                        '--authentication-mode', 'basic',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The username for basic authentication cannot be empty');
            });

            test('should throw error for undefined basic authentication password', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--basic-username', username,
                        '--authentication-mode', 'BAsic',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The password for basic authentication must be defined');
            });

            test('should throw error for empty basic authentication password', () => {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--basic-username', username,
                        '--basic-password', '   ',
                        '--authentication-mode', 'BAsic',
                        '--transport', 'STDIO'
                    ]);
                }).toThrow('The password for basic authentication cannot be empty');
            });

            test('should use username from environment variable', () => {
                const envUsername= 'env-username';
                process.env.BASIC_USERNAME = envUsername;

                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--transport', 'STDIO',
                    '--basic-password', password,
                    '--authentication-mode', 'Basic'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        username: envUsername,
                        password: password
                    },
                });
            });

            test('should use password from environment variable', () => {
                const envPassword = 'env password';
                process.env.BASIC_PASSWORD = envPassword;
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--transport', 'STDIO',
                    '--basic-username', username,
                    '--authentication-mode', 'Basic'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        password: envPassword,
                        username: username
                    },
                });
            });

            test('should read authentication mode from environment variable', () => {
                process.env.AUTHENTICATION_MODE = 'BaSiC';
                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--basic-username', username,
                    '--basic-password', password,
                    '--transport', 'STDIO'
                ]);

                expect(config).toMatchObject({
                    credentials: {
                        username: username,
                        password: password
                    },
                });
            });

            test('should call debug function with basic authentication', () => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--basic-username', username,
                    '--basic-password', password,
                    '--authentication-mode', 'BASiC',
                    '--transport', 'STDIO'
                ]);

                expect(mockDebug).toHaveBeenCalledWith(`Basic Authentication(username: ${username}, password: ***)`);
            });        });
    });

    describe('createConfiguration', () => {
        const apiKey = 'validkey123';
        test('should create complete configuration object', () => {
            const username = 'blah blah blah';
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--debug',
                '--url', url,
                '--zen-apikey', apiKey,
                '--zen-username', username,
                '--transport', 'HTTP',
                '--authentication-mode', 'ZenApiKey'
            ]);

            expect(config).toMatchObject({
                credentials: {
                    apikey: apiKey,
                    username: username,
                    authenticationMode: AuthenticationMode.ZEN_API_KEY
                },
                transport: undefined,
                url: url,
                version: version,
                debugEnabled: true
            });
        });

        test('should create configuration with defaults', () => {
            process.env.URL = url;
            process.env.DI_APIKEY = apiKey;
            process.env.TRANSPORT = 'STDIO';

            const config = createConfiguration(version, ['node', 'cli.js']);

            expect(config).toMatchObject({
                credentials: {
                    apikey: apiKey,
                    authenticationMode: AuthenticationMode.DI_API_KEY
                },
                transport: expect.any(StdioServerTransport),
                url: url,
                version: version,
                debugEnabled: originalEnv.DEBUG === 'true',
                deploymentSpaces: ['development']
            });
        });

        test('should handle debug flag from CLI argument', () => {
            process.env.URL = url;
            process.env.DI_APIKEY = apiKey;
            process.env.TRANSPORT = 'STDIO';

            const config = createConfiguration(version, ['node', 'cli.js', '--debug']);

            expect(config.debugEnabled).toBe(true);
            expect(mockSetDebug).toHaveBeenCalledWith(true);
        });

        test('should handle debug flag from environment variable', () => {
            process.env.DEBUG = 'true';
            process.env.URL = url;
            process.env.DI_APIKEY = apiKey;
            process.env.TRANSPORT = 'STDIO';

            const config = createConfiguration(version, ['node', 'cli.js']);

            expect(config.debugEnabled).toBe(true);
            expect(mockSetDebug).toHaveBeenCalledWith(true);
        });

        test('should prioritize CLI arguments over environment variables', () => {
            process.env.URL = 'https://env-api.example.com';
            process.env.ZEN_APIKEY = 'env-api-key';
            process.env.TRANSPORT = 'STDIO';
            process.env.RUNTIME = 'DI';
            process.env.ZEN_USERNAME = 'env username';
            process.env.AUTHENTICATION_MODE =  AuthenticationMode.BASIC;
            process.env.DEPLOYMENT_SPACES = 'prod,dev,staging';

            const urlFromCli = 'https://cli-api.example.com';
            const cliApiKey = 'cli-api-key-123';
            const deploymentSpaces = ['toto','titi','tutu'];
            const cliUserName = 'the CLI username';
            const cliAuthenticationMode = AuthenticationMode.ZEN_API_KEY;
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', urlFromCli,
                '--zen-apikey', cliApiKey,
                '--zen-username', cliUserName,
                '--transport', 'HTTP',
                '--authentication-mode', cliAuthenticationMode,
                '--deployment-spaces', deploymentSpaces.join(',')
            ]);

            expect(config).toMatchObject({
                credentials: {
                    apikey: cliApiKey,
                    authenticationMode: cliAuthenticationMode,
                },
                transport: undefined,
                url: urlFromCli,
                deploymentSpaces: deploymentSpaces
            });
        });

        describe(`should set helper properties correctly for`, ()=> {

            test(`'DiApiKey' authentication mod`, () => {
                process.env.URL = url;
                process.env.DI_APIKEY = apiKey;
                process.env.TRANSPORT = 'STDIO';

                const config = createConfiguration(version, [
                    'node', 'cli.js'
                ]);

                expect(config.isDiApiKeyAuthentication()).toBe(true);
                expect(config.isZenAPiKeyAuthentication()).toBe(false);
                expect(config.isBasicAuthentication()).toBe(false);
            });

            test(`'ZenApiKey' authentication mode`, () => {
                process.env.URL = url;
                process.env.ZEN_APIKEY = apiKey;
                process.env.TRANSPORT = 'STDIO';

                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--zen-username', 'the username',
                    '--authentication-mode', 'ZenApiKey'
                ]);

                expect(config.isDiApiKeyAuthentication()).toBe(false);
                expect(config.isZenAPiKeyAuthentication()).toBe(true);
                expect(config.isBasicAuthentication()).toBe(false);
            });

            test(`'Basic' authentication mode`, () => {
                process.env.URL = url;
                process.env.BASIC_USERNAME = 'foo bar bra';
                process.env.TRANSPORT = 'STDIO';

                const config = createConfiguration(version, [
                    'node', 'cli.js',
                    '--basic-password', 'the password',
                    '--authentication-mode', 'Basic'
                ]);

                expect(config.isDiApiKeyAuthentication()).toBe(false);
                expect(config.isZenAPiKeyAuthentication()).toBe(false);
                expect(config.isBasicAuthentication()).toBe(true);
            });
        });

        test('should set transport helper properties correctly', () => {
            process.env.URL = url;
            process.env.DI_APIKEY = apiKey;

            const stdioConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--transport', 'STDIO'
            ]);

            const httpConfig = createConfiguration(version, [
                'node', 'cli.js',
                '--transport', 'HTTP'
            ]);

            expect(stdioConfig.isStdioTransport()).toBe(true);
            expect(stdioConfig.isHttpTransport()).toBe(false);
            expect(httpConfig.isStdioTransport()).toBe(false);
            expect(httpConfig.isHttpTransport()).toBe(true);
        });

        test('should parse arguments when no arguments provided', () => {

            const originalArgv = process.argv;
            try {
                process.argv = [originalArgv[0], originalArgv[1]];
                process.env.URL = url;
                process.env.DI_APIKEY = apiKey;

                // Should use process.argv when no arguments provided
                const config = createConfiguration(version);

                expect(config).toBeDefined();
                expect(config).toMatchObject({
                    credentials: {
                        apikey: apiKey,
                        authenticationMode: defaultAuthenticationMode(),
                    },
                    transport: expect.any(StdioServerTransport),
                    url: url,
                    deploymentSpaces: ['development']
                });
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('validateDeploymentSpaces', () => {
        const deploymentSpaces = ['development', 'production', 'test'];
        const encodedDeploymentSpaces = deploymentSpaces.map(ds => encodeURIComponent(ds));
        const encodedDefaultDeploymentSpaces = Configuration.defaultDeploymentSpaces().map(ds => encodeURIComponent(ds));
        test('should accept valid deployment spaces', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--deployment-spaces', deploymentSpaces.join(',')
            ]);

            expect(config.deploymentSpaces).toEqual(encodedDeploymentSpaces);
        });

        test('should accept deployment space with white spaces', () => {
            const deploymentSpace = 'toto     toto';
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--deployment-spaces', `  ${deploymentSpace}        `
            ]);

            expect(config.deploymentSpaces).toEqual([encodeURIComponent(deploymentSpace)]);
        });

        test('should trim deployment spaces', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--deployment-spaces', '     development         ,  production     ,  test  '
            ]);

            expect(config.deploymentSpaces).toEqual(encodedDeploymentSpaces);
        });

        test('should use default deployment spaces when parsed array is empty', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--deployment-spaces', '     ,     ,       ,     '
            ]);

            expect(config.deploymentSpaces).toEqual(encodedDefaultDeploymentSpaces);
        });

        test('should create Configuration with default deploymentSpaces when not provided', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.deploymentSpaces).toEqual(encodedDefaultDeploymentSpaces);
        });

        test('should throw error for invalid deployment spaces that cannot be URI encoded', () => {
            // Create a deployment space name that will cause encodeURIComponent to throw
            // This is a surrogate pair that is deliberately malformed
            const invalidSpace = 'test\uD800space'; // Unpaired surrogate, will cause encodeURIComponent to throw

            // Mock the encodeURIComponent to throw for our specific test case
            const originalEncodeURIComponent = global.encodeURIComponent;
            global.encodeURIComponent = jest.fn().mockImplementation((str) => {
                if (str === invalidSpace) {
                    throw new URIError('URI malformed');
                }
                return originalEncodeURIComponent(str);
            });

            try {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--di-apikey', 'validkey123',
                        '--transport', 'STDIO',
                        '--deployment-spaces', `development,${invalidSpace}`
                    ]);
                }).toThrow(`Invalid deployment space '${invalidSpace}' cannot be URI encoded.`);
            } finally {
                // Restore the original function
                global.encodeURIComponent = originalEncodeURIComponent;
            }
        });

        test('should throw error listing all invalid deployment spaces when multiple are invalid', () => {
            // Create three deployment space names that will cause encodeURIComponent to throw
            const invalidSpace1 = 'test\uD800space1';
            const invalidSpace2 = 'test\uD800space2';
            const invalidSpace3 = 'test\uD800space3';

            // Mock the encodeURIComponent to throw for our specific test cases
            const originalEncodeURIComponent = global.encodeURIComponent;
            global.encodeURIComponent = jest.fn().mockImplementation((str) => {
                if ([invalidSpace1, invalidSpace2, invalidSpace3].includes(str)) {
                    throw new URIError('URI malformed');
                }
                return originalEncodeURIComponent(str);
            });

            try {
                expect(() => {
                    createConfiguration(version, [
                        'node', 'cli.js',
                        '--url', url,
                        '--di-apikey', 'validkey123',
                        '--transport', 'STDIO',
                        '--deployment-spaces', `development,${invalidSpace1},${invalidSpace2},${invalidSpace3},production`
                    ]);
                }).toThrow(`Invalid deployment spaces '${invalidSpace1}', '${invalidSpace2}', '${invalidSpace3}' cannot be URI encoded.`);
            } finally {
                // Restore the original function
                global.encodeURIComponent = originalEncodeURIComponent;
            }
        });

        test('should use deployment spaces from environment variable', () => {
            const deploymentSpaces = ['env-space-1', 'env-space-2'];
            process.env.DEPLOYMENT_SPACES = deploymentSpaces.join(',');

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.deploymentSpaces).toEqual(deploymentSpaces.map(ds => encodeURIComponent(ds)));
        });

        test('should call debug function with deployment spaces', () => {
            const deploymentSpaces = 'dev,prod';
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--deployment-spaces', deploymentSpaces
            ]);

            expect(mockDebug).toHaveBeenCalledWith(`DEPLOYMENT SPACES=${deploymentSpaces}`);
        });
    });

    describe('Error handling', () => {
        test('should fail fast on first validation error', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', 'invalid-url',
                    '--transport', 'INVALID'
                ]);
            }).toThrow(`The DI API key must be defined`); // Should throw on invalid API key first
        });

        test('should provide descriptive error messages', () => {
            const invalid = 'WEBSOCKET';
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', 'validkey123',
                    '--transport', invalid
                ]);
            }).toThrow(`Invalid transport protocol: '${invalid}'. Must be one of: 'stdio', 'http'`);
        });
    });

    describe('getDecisionServiceIds', () => {
        test('should get no decisionServiceIds', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.decisionServiceIds).toEqual(undefined);
        });

        test('should get decisionServiceIds', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--decision-service-ids', "A,B"
            ]);

            expect(config.decisionServiceIds).toEqual(["A", "B"]);
        });

        test('should not split escaped commas', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--decision-service-ids', "A,B\\,C,D"
            ]);
            expect(config.decisionServiceIds).toEqual(["A", "B,C", "D"]);
        });

        test('should handle escaped commas at the end of string', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--decision-service-ids', "A,B\\,"
            ]);
            expect(config.decisionServiceIds).toEqual(["A", "B,"]);
        });

        test('should handle multiple consecutive escaped commas', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--decision-service-ids', "A\\,\\,B,C"
            ]);
            expect(config.decisionServiceIds).toEqual(["A,,B", "C"]);
        });

        test('should handle empty string after trimming', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--decision-service-ids', "   ,   ,   "
            ]);
            expect(config.decisionServiceIds).toEqual(undefined);
        });
    });

    describe('validatePollInterval', () => {
        test('should accept valid poll interval', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--poll-interval', '60000'
            ]);

            expect(config.pollInterval).toBe(60000);
        });

        test('should use default poll interval when not specified', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.pollInterval).toBe(Configuration.defaultPollInterval());
            expect(config.pollInterval).toBe(30000);
        });

        test('should throw error for non-numeric poll interval', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', 'validkey123',
                    '--transport', 'STDIO',
                    '--poll-interval', 'invalid'
                ]);
            }).toThrow("Invalid poll interval: 'invalid'. Must be a valid number in milliseconds.");
        });

        test('should throw error for poll interval less than 1000ms', () => {
            expect(() => {
                createConfiguration(version, [
                    'node', 'cli.js',
                    '--url', url,
                    '--di-apikey', 'validkey123',
                    '--transport', 'STDIO',
                    '--poll-interval', '500'
                ]);
            }).toThrow("Invalid poll interval: '500'. Must be at least 1000 milliseconds (1 second).");
        });

        test('should accept minimum valid poll interval of 1000ms', () => {
            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--poll-interval', '1000'
            ]);

            expect(config.pollInterval).toBe(1000);
        });

        test('should use poll interval from environment variable', () => {
            process.env.POLL_INTERVAL = '45000';

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO'
            ]);

            expect(config.pollInterval).toBe(45000);
        });

        test('should prioritize CLI argument over environment variable', () => {
            process.env.POLL_INTERVAL = '45000';

            const config = createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--poll-interval', '60000'
            ]);

            expect(config.pollInterval).toBe(60000);
        });

        test('should call debug function with poll interval', () => {
            createConfiguration(version, [
                'node', 'cli.js',
                '--url', url,
                '--di-apikey', 'validkey123',
                '--transport', 'STDIO',
                '--poll-interval', '60000'
            ]);

            expect(mockDebug).toHaveBeenCalledWith('POLL_INTERVAL=60000');
        });
    });
});
