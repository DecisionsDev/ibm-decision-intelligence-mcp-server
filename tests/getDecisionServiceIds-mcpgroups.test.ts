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

import { getDecisionServiceIds } from '../src/diruntimeclient.js';
import { Configuration } from '../src/command-line.js';
import { Credentials } from '../src/credentials.js';

const url = 'https://example.com';
const dummy_apikey = 'testApiKey';
const version = '1.0.0';

function createConfiguration(mcpGroups?: string[]): Configuration {
    return new Configuration(
        Credentials.createDiApiKeyCredentials(dummy_apikey),
        undefined,
        url,
        version,
        false,
        undefined,
        undefined,
        undefined,
        mcpGroups
    );
}

describe('getDecisionServiceIds with mcpGroups', () => {
    test('returns all services when no mcpGroups filter is configured', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' }
            }
        ];
        const config = createConfiguration();
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual(['service1', 'service2']);
    });

    test('returns only services matching configured mcpGroups', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' },
                mcpGroups: { value: 'groupA, groupB' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' },
                mcpGroups: { value: 'groupC' }
            }
        ];
        const config = createConfiguration(['groupA']);
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual(['service1']);
    });

    test('returns only services matching configured mcpGroups', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' },
                mcpGroups: { value: 'groupA, groupB' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' },
                mcpGroups: { value: 'groupC' }
            },
            {
                decisionServiceId: { value: 'service3' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' },
                mcpGroups: { value: 'groupD, groupE' }
            }
        ];
        const config = createConfiguration(['groupA', 'groupE']);
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual(['service1', 'service3']);
    });

    test('returns empty array when no services match mcpGroups', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' },
                mcpGroups: { value: 'groupA' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' },
                mcpGroups: { value: 'groupB' }
            }
        ];
        const config = createConfiguration(['groupC']);
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual([]);
    });

    test('excludes services without mcpGroups when filter is configured', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' },
                mcpGroups: { value: 'groupA' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' }
            }
        ];
        const config = createConfiguration(['groupA']);
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual(['service1']);
    });

    test('handles multiple matching groups', () => {
        const metadata = [
            {
                decisionServiceId: { value: 'service1' },
                deploymentTime: { value: '2025-01-01T10:00:00.000Z' },
                mcpGroups: { value: 'groupA, groupB' }
            },
            {
                decisionServiceId: { value: 'service2' },
                deploymentTime: { value: '2025-01-01T11:00:00.000Z' },
                mcpGroups: { value: 'groupB, groupC' }
            }
        ];
        const config = createConfiguration(['groupB', 'groupD']);
        
        const result = getDecisionServiceIds(metadata, config);
        
        expect(result).toEqual(['service1', 'service2']);
    });
});
