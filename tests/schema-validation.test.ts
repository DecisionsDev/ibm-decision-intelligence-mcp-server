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

import { OpenAPIV3_1 } from "openapi-types";
import { validateSchema } from "../src/mcp-server.js";

describe('Schema Validation', () => {
    describe('validateSchema', () => {
        describe('should return true for valid schemas', () => {
            it('should validate a simple object schema', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        age: { type: 'number' }
                    },
                    required: ['name']
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate a schema with nested objects', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                email: { type: 'string' }
                            }
                        }
                    }
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate a schema with arrays', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    }
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate a schema without properties', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object'
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate a schema with additionalProperties', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    },
                    additionalProperties: true
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate a schema with complex types', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        active: { type: 'boolean' },
                        metadata: { type: 'object' }
                    },
                    required: ['id', 'name']
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should validate an empty schema object', () => {
                const schema: OpenAPIV3_1.SchemaObject = {};

                expect(validateSchema(schema)).toBe(true);
            });
        });

        describe('should return false for invalid schemas', () => {
            it('should reject schema with null property', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: null as any
                    }
                };

                expect(validateSchema(schema)).toBe(false);
            });

            it('should reject schema with undefined property', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: undefined as any
                    }
                };

                expect(validateSchema(schema)).toBe(false);
            });

            it('should reject schema with invalid type for properties', () => {
                const schema = {
                    type: 'object',
                    properties: 'invalid' // Should be an object, not a string
                } as any;

                expect(validateSchema(schema)).toBe(false);
            });

            it('should reject schema with invalid type for required', () => {
                const schema = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    },
                    required: 'name' // Should be an array, not a string
                } as any;

                expect(validateSchema(schema)).toBe(false);
            });

            it('should reject schema with multiple null properties', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: null as any,
                        age: { type: 'number' },
                        email: null as any
                    }
                };

                expect(validateSchema(schema)).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle schema with empty properties object', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {}
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should handle schema with empty required array', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    },
                    required: []
                };

                expect(validateSchema(schema)).toBe(true);
            });

            it('should handle schema with additional unknown fields', () => {
                const schema: OpenAPIV3_1.SchemaObject = {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    },
                    // Additional fields that might be present in OpenAPI schemas
                    description: 'A test schema',
                    example: { name: 'John' }
                } as any;

                expect(validateSchema(schema)).toBe(true);
            });
        });
    });

    describe('Customer and Shopping Cart Schema', () => {
        it('should reject schema with unresolved $ref', () => {
            const schema: OpenAPIV3_1.SchemaObject = {
                type: 'object',
                properties: {
                    customer: {
                        title: 'Customer',
                        type: 'object',
                        properties: {
                            name: {
                                title: 'name',
                                type: 'string'
                            },
                            status: {
                                title: 'Status',
                                type: 'string',
                                enum: ['Bronze', 'Gold', 'Platinum', 'Silver']
                            }
                        }
                    },
                    shoppingCart: {
                        title: 'Shopping cart',
                        type: 'object',
                        properties: {
                            items: {
                                title: 'item',
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/Item'
                                }
                            },
                            price: {
                                title: 'price',
                                type: 'number',
                                format: 'double'
                            }
                        }
                    }
                },
                'x-ibm-parameter-wrapper': true
            } as any;

            // This should fail because the $ref to Item schema is not defined
            expect(validateSchema(schema)).toBe(false);
        });
    });
});
