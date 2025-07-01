import { ServiceConfig, EndpointDefinition } from './config';

export function validateSchema(config: ServiceConfig): void {
    if (!config.serviceName || typeof config.serviceName !== 'string') {
        throw new Error('Missing or invalid serviceName');
    }
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
        throw new Error('Missing or invalid baseUrl');
    }
    if (!Array.isArray(config.endpoints)) {
        throw new Error('Missing or invalid endpoints array');
    }

    for (const endpoint of config.endpoints) {
        if (!endpoint.name || typeof endpoint.name !== 'string') {
            throw new Error(`Invalid endpoint: missing name`);
        }
        if (!endpoint.method || typeof endpoint.method !== 'string') {
            throw new Error(`Invalid endpoint "${endpoint.name}": missing method`);
        }
        if (!endpoint.path || typeof endpoint.path !== 'string') {
            throw new Error(`Invalid endpoint "${endpoint.name}": missing path`);
        }
    }

    if (config.authentication) {
        if (!config.authentication.type || typeof config.authentication.type !== 'string') {
            throw new Error('Missing or invalid authentication type');
        }
        if (config.authentication.type === 'bearer' && !config.authentication.tokenEnv) {
            throw new Error('Missing tokenEnv for bearer authentication');
        }
        if (config.authentication.type === 'apiKey' && !config.authentication.apiKeyEnv) {
            throw new Error('Missing apiKeyEnv for apiKey authentication');
        }
    }
}

interface MappedParameters {
    finalPath: string;
    body: Record<string, any>;
    query: Record<string, string>;
    headers: Record<string, string>;
}

export function mapParameters(endpoint: EndpointDefinition, args: Record<string, any>): MappedParameters {
    let finalPath = endpoint.path;
    const pathParams = endpoint.path.match(/\{([^}]+)\}/g) || [];
    for (const param of pathParams) {
        const paramName = param.slice(1, -1);
        if (args[paramName]) {
            finalPath = finalPath.replace(param, args[paramName]);
        } else {
            const requiredParam = endpoint.parameters?.find(p => p.name === paramName && p.type === 'path' && p.required);
            if (requiredParam) {
                throw new Error(`Missing required path parameter: ${paramName}`);
            }
        }
    }

    const body: Record<string, any> = {};
    const query: Record<string, string> = {};
    const headers: Record<string, string> = {};

    if (endpoint.parameters) {
        for (const param of endpoint.parameters) {
            if (args[param.name]) {
                if (param.type === 'body') {
                    body[param.name] = args[param.name];
                } else if (param.type === 'query') {
                    query[param.name] = args[param.name];
                } else if (param.type === 'header') {
                    headers[param.name] = args[param.name];
                }
            } else if (param.required) {
                throw new Error(`Missing required parameter: ${param.name}`);
            }
        }
    }

    return { finalPath, body, query, headers };
}
