import { generateOpenAPIContent } from './test-utils.js';

describe('generateOpenAPIContent', () => {
    it('should generate OpenAPI content with correct decisionServiceId, decisionId, and deploymentSpaceId', () => {
        const decisionServiceId = 'test/Loan Approval';
        const decisionId = 'test/loan_approval/loanApprovalDecisionService/3-2025-06-18T13:00:39.447Z';
        const deploymentSpaceId = 'staging';
        
        const result = generateOpenAPIContent(decisionServiceId, decisionId, deploymentSpaceId);
        
        // Verify info section
        expect(result.info.title).toBe(decisionServiceId);
        expect(result.info.description).toBe(decisionServiceId);
        expect(result.info['x-ibm-ads-decision-service-id']).toBe(decisionServiceId);
        expect(result.info['x-ibm-ads-decision-service-name']).toBe(decisionServiceId);
        expect(result.info['x-ibm-ads-decision-id']).toBe(decisionId);
        
        // Verify server URL contains encoded decisionId and deploymentSpaceId
        const encodedDecisionId = encodeURIComponent(decisionId);
        expect(result.servers[0].url).toBe(
            `https://example.com/ads/runtime/api/v1/deploymentSpaces/${deploymentSpaceId}/decisions/${encodedDecisionId}/operations`
        );
        
        // Verify tags contain decisionServiceId
        expect(result.paths['/approval/execute'].post.tags[0]).toBe(decisionServiceId);
        
        // Verify structure
        expect(result.openapi).toBe('3.0.1');
        expect(result.security).toEqual([{ 'DI-APIKEY': [] }]);
        expect(result.components.schemas).toBeDefined();
        expect(result.components.securitySchemes).toBeDefined();
    });
    
    it('should handle different decisionServiceId and deploymentSpaceId formats', () => {
        const decisionServiceId = 'production/Credit Check';
        const decisionId = 'production/credit_check/creditCheckService/1-2025-01-01T00:00:00.000Z';
        const deploymentSpaceId = 'production';
        
        const result = generateOpenAPIContent(decisionServiceId, decisionId, deploymentSpaceId);
        
        expect(result.info.title).toBe(decisionServiceId);
        expect(result.info['x-ibm-ads-decision-service-id']).toBe(decisionServiceId);
        expect(result.info['x-ibm-ads-decision-id']).toBe(decisionId);
        expect(result.paths['/approval/execute'].post.tags[0]).toBe(decisionServiceId);
        expect(result.servers[0].url).toContain(`/deploymentSpaces/${deploymentSpaceId}/`);
    });
    
    it('should properly encode special characters in URL', () => {
        const decisionServiceId = 'test/Service With Spaces';
        const decisionId = 'test/service/path/1-2025-06-18T13:00:39.447Z';
        const deploymentSpaceId = 'development';
        
        const result = generateOpenAPIContent(decisionServiceId, decisionId, deploymentSpaceId);
        
        const encodedDecisionId = encodeURIComponent(decisionId);
        expect(result.servers[0].url).toContain(encodedDecisionId);
        expect(result.servers[0].url).not.toContain('test/service/path/1-2025-06-18T13:00:39.447Z');
        expect(result.servers[0].url).toContain(`/deploymentSpaces/${deploymentSpaceId}/`);
    });
});

// Made with Bob
