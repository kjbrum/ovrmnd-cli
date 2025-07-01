

interface StandardizedError {
    success: false;
    error: {
        code: string;
        message: string;
        details: Record<string, any>;
    };
}

export function handleError(error: Error, isJsonOutput: boolean): void {
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unexpected error occurred.';
    let errorDetails: Record<string, any> = {};

    if (error.message.startsWith('API Error:')) {
        errorCode = 'API_ERROR';
        errorMessage = error.message;
        if (error.cause) {
            errorDetails = error.cause as Record<string, any>;
        }
    } else if (error.message.includes('Authentication failed')) { 
        errorCode = 'AUTH_ERROR';
        errorMessage = error.message;
    } else if (error.message.includes('Invalid service.endpoint') || error.message.includes('not found') || error.message.includes('Missing required')) { 
        errorCode = 'VALIDATION_ERROR';
        errorMessage = error.message;
    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = 'Network Error: Could not connect to the API.';
        errorDetails = { message: error.message };
    } else {
        errorMessage = error.message;
        errorDetails = { stack: error.stack };
    }

    const standardizedError: StandardizedError = {
        success: false,
        error: {
            code: errorCode,
            message: errorMessage,
            details: errorDetails,
        },
    };

    if (isJsonOutput) {
        console.error(JSON.stringify(standardizedError, null, 2));
    } else {
        console.error(`Error: ${errorMessage}`);
        if (Object.keys(errorDetails).length > 0) {
            console.error('Details:', errorDetails);
        }
    }
}
