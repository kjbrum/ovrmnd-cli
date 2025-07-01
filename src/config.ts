import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

export interface ServiceConfig {
    serviceName: string;
    baseUrl: string;
    authentication?: {
        type: 'bearer' | 'apiKey';
        tokenEnv?: string;
        apiKeyEnv?: string;
        in?: 'header' | 'query';
        name?: string;
    };
    endpoints: EndpointDefinition[];
}

export interface EndpointDefinition {
    name: string;
    method: string;
    path: string;
    parameters?: ParameterDefinition[];
}

export interface ParameterDefinition {
    name: string;
    type: 'path' | 'query' | 'header' | 'body';
    required: boolean;
    description?: string;
}

export function loadConfigurations(): Record<string, ServiceConfig> {
    const globalConfigPath = path.join(os.homedir(), '.ovrmnd');
    const localConfigPath = path.join(process.cwd(), '.ovrmnd');

    let globalConfigs: Record<string, ServiceConfig> = {};
    let localConfigs: Record<string, ServiceConfig> = {};

    if (fs.existsSync(globalConfigPath)) {
        globalConfigs = loadFromDirectory(globalConfigPath);
    }

    if (fs.existsSync(localConfigPath)) {
        localConfigs = loadFromDirectory(localConfigPath);
    }

    return { ...globalConfigs, ...localConfigs };
}

function loadFromDirectory(directoryPath: string): Record<string, ServiceConfig> {
    const configs: Record<string, ServiceConfig> = {};
    if (!fs.existsSync(directoryPath)) {
        return configs;
    }
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            try {
                const filePath = path.join(directoryPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const parsedYaml = yaml.load(fileContent) as ServiceConfig;
                if (parsedYaml && parsedYaml.serviceName) {
                    configs[parsedYaml.serviceName] = parsedYaml;
                }
            } catch (error) {
                console.error(`Error loading or parsing ${file}:`, error);
            }
        }
    }

    return configs;
}

