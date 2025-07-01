import 'dotenv/config';
import { ServiceConfig } from './config';
interface RequestInitWithParams extends RequestInit {
    params?: Record<string, string>;
}

export function applyAuthentication(requestConfig: RequestInitWithParams, serviceConfig: ServiceConfig): void {
    if (!serviceConfig.authentication) {
        return; // No authentication configured for this service
    }

    const authType = serviceConfig.authentication.type;
    const authValueEnvVar = serviceConfig.authentication.tokenEnv || serviceConfig.authentication.apiKeyEnv;
    
    if (!authValueEnvVar) {
        throw new Error('Authentication failed: Missing tokenEnv or apiKeyEnv in service configuration.');
    }

    const authValue = process.env[authValueEnvVar];

    if (!authValue) {
        throw new Error(`Authentication failed: Environment variable ${authValueEnvVar} not found.`);
    }

    let headers = new Headers(requestConfig.headers);

    if (authType === 'bearer') {
        headers.set('Authorization', `Bearer ${authValue}`);
    } else if (authType === 'apiKey') {
        const inLocation = serviceConfig.authentication.in;
        const paramName = serviceConfig.authentication.name;

        if (!paramName) {
            throw new Error('Authentication failed: Missing name for apiKey authentication.');
        }

        if (inLocation === 'header') {
            headers.set(paramName, authValue);
        } else if (inLocation === 'query') {
            if (!requestConfig.params) {
                requestConfig.params = {};
            }
            requestConfig.params[paramName] = authValue;
        } else {
            throw new Error(`Unsupported API Key location: ${inLocation}`);
        }
    } else {
        throw new Error(`Unsupported authentication type: ${authType}`);
    }
    requestConfig.headers = headers;
}
