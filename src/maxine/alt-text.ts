
// Get Cloud Function URL from environment variables (set via wxt.config.ts)
const CLOUD_FUNCTION_URL = import.meta.env.VITE_CLOUD_FUNCTION_URL;

// Maximum length for alt text to avoid "Message length exceeded maximum allowed length" error
const MAX_ALT_TEXT_LENGTH = 2000;

// Hard limit for any text before we try to condense it
const ABSOLUTE_MAX_LENGTH = 5000;

// Max size for direct blob processing (in bytes)
const MAX_DIRECT_BLOB_SIZE = 5 * 1024 * 1024; // 5MB

// 1. Add helper to convert Blob or URL to Data URL
const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// 2. Update getBase64Data to handle different source types (Data URL, HTTP URL)
async function getBase64Data(source: string, isLargeVideo: boolean = false): Promise<{ base64Data: string; mimeType: string }> {
    if (source.startsWith('data:')) {
        console.log('[getBase64Data] Source is Data URL, extracting...');
        const parts = source.match(/^data:(.+?);base64,(.*)$/);
        if (!parts || parts.length < 3) {
            console.error('[getBase64Data] Invalid Data URL format received:', source.substring(0, 100) + '...');
            throw new Error('Invalid Data URL format received');
        }
        const mimeType = parts[1];
        const base64Data = parts[2];
        if (!mimeType.includes('/') || !base64Data) {
            throw new Error('Extracted mimeType or base64 data appears invalid.');
        }
        return { base64Data, mimeType };
    } else if (source.startsWith('http:') || source.startsWith('https:')) {
        console.log('[getBase64Data] Source is HTTP(S) URL, fetching...', source);
        try {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log(`[getBase64Data] Fetched blob of size: ${blob.size} bytes, type: ${blob.type}`);

            // Process all videos in full
            console.log(`[getBase64Data] Processing full media file (size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);

            const dataUrl = await blobToDataURL(blob);
            console.log('[getBase64Data] Successfully fetched and converted URL to Data URL.');
            // Re-run with the dataUrl to extract parts
            return await getBase64Data(dataUrl);
        } catch (fetchError) {
            console.error('[getBase64Data] Error fetching or converting URL:', fetchError);
            throw new Error(`Failed to fetch or process media URL: ${fetchError instanceof Error ? fetchError.message : fetchError}`);
        }
    } else if (source.startsWith('blob:')) {
        console.log('[getBase64Data] Source is Blob URL, fetching...', source);
        try {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Failed to fetch blob URL: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log(`[getBase64Data] Fetched blob of size: ${blob.size} bytes, type: ${blob.type}`);

            // Process all videos in full
            console.log(`[getBase64Data] Processing full media file (size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);

            const dataUrl = await blobToDataURL(blob);
            console.log('[getBase64Data] Successfully fetched and converted blob URL to Data URL.');
            // Re-run with the dataUrl to extract parts
            return await getBase64Data(dataUrl);
        } catch (fetchError) {
            console.error('[getBase64Data] Error fetching or converting blob URL:', fetchError);
            throw new Error(`Failed to fetch or process blob URL: ${fetchError instanceof Error ? fetchError.message : fetchError}`);
        }
    } else {
        console.error('[getBase64Data] ERROR: Received unsupported source type:', source.substring(0, 100) + '...');
        throw new Error('Background script received an unsupported source type.');
    }
}

// Helper function to optimize video processing by extracting frames
async function optimizedVideoProcessing(videoBlob: Blob, mimeType: string): Promise<{ base64Data: string; mimeType: string }> {
    try {
        console.log(`[optimizedVideoProcessing] Processing full video of size: ${videoBlob.size / (1024 * 1024).toFixed(2)}MB`);

        // Convert the blob to base64 directly
        const dataUrl = await blobToDataURL(videoBlob);

        // Extract the base64 data
        const parts = dataUrl.match(/^data:(.+?);base64,(.*)$/);
        if (!parts || parts.length < 3) {
            throw new Error('Failed to extract base64 data from video blob');
        }

        return {
            base64Data: parts[2],
            mimeType: parts[1]
        };
    } catch (error) {
        console.error('[optimizedVideoProcessing] Error processing video:', error);
        throw error;
    }
}

type PortResponse = { altText: string } | { error: string };

// --- Alt Text Generation Logic (Modified to call Proxy) ---
export async function generateAltTextViaProxy(
    source: string, // Expecting Data URL from content script
    isVideo: boolean, // Keep this, might be useful later
    isLargeVideo: boolean = source.length > 1000000 // Flag for handling large videos
): Promise<PortResponse> { // Return type matches PortResponse
    if (!CLOUD_FUNCTION_URL || CLOUD_FUNCTION_URL === 'YOUR_FUNCTION_URL_HERE') {
        console.error('Cannot generate alt text: Cloud Function URL is not configured.');
        return { error: 'Extension configuration error: Proxy URL not set.' };
    }

    try {
        // 1. Get Base64 data and final mime type
        const { base64Data, mimeType } = await getBase64Data(source, isLargeVideo);
        console.log(`Sending request to proxy for ${mimeType}, data size: ${(base64Data.length / (1024 * 1024)).toFixed(2)}MB`);

        // Check if this is a large data source
        const isLargeData = base64Data.length > 1000000; // Over 1MB of base64 data
        if (isVideo && isLargeData) {
            console.log(`Processing large video data (${(base64Data.length / (1024 * 1024)).toFixed(2)}MB)`);
        }

        // 2. Prepare request body for the Cloud Function Proxy
        const proxyRequestBody = {
            base64Data: base64Data,
            mimeType: mimeType,
            isVideo: isVideo,
            fileName: "file." + (mimeType.split('/')[1] || (isVideo ? "mp4" : "jpg")),
            fileSize: base64Data.length // File size based on base64 length
        };

        // Set appropriate timeout based on file size
        const timeoutDuration = base64Data.length > 4000000 ? 300000 : 180000; // 5 min for larger files, 3 min for smaller

        // 3. Call the Cloud Function Proxy with proper timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        try {
            console.log('Sending request to Cloud Function:', CLOUD_FUNCTION_URL);
            console.log('Request body size:', JSON.stringify(proxyRequestBody).length);

            // Make sure we handle very large requests appropriately
            if (base64Data.length > 10000000) { // 10MB+
                console.log('Very large request detected, using chunked transfer encoding if available');
            }

            // Add mode: 'cors' explicitly to the fetch options
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(proxyRequestBody),
                signal: controller.signal,
                mode: 'cors', // Explicitly set CORS mode
                credentials: 'omit', // Don't send cookies for cross-origin requests
                keepalive: false // MODIFIED (or remove this line)
            };

            console.log(`Starting fetch request at ${new Date().toISOString()}`);
            const proxyResponse = await fetch(CLOUD_FUNCTION_URL, fetchOptions);
            console.log(`Received response at ${new Date().toISOString()}, status: ${proxyResponse.status}`);

            clearTimeout(timeoutId);

            // 4. Handle the Response
            if (!proxyResponse.ok) {
                console.error('Proxy function returned an error:', proxyResponse.status, proxyResponse.statusText);
                let errorMsg = '';

                // Handle specific HTTP status codes
                if (proxyResponse.status === 403) {
                    errorMsg = 'Access denied by the server. This is likely a CORS (Cross-Origin Resource Sharing) issue. The server needs to allow this extension to connect to it.';
                    console.error('CORS issue detected: 403 Forbidden response from Cloud Function');
                } else if (proxyResponse.status === 413) {
                    errorMsg = 'Server error: File exceeds size limits (max 20MB). Please use a smaller file.';
                    console.error('Request entity too large (413) response from Cloud Function');
                } else if (proxyResponse.status === 0 || proxyResponse.status === 500 || proxyResponse.status === 502) {
                    errorMsg = 'The server experienced an error processing your request. This could be due to the file size or server load.';
                    console.error('Server error response from Cloud Function:', proxyResponse.status);
                } else {
                    try {
                        const responseData = await proxyResponse.json();
                        errorMsg = responseData?.error || proxyResponse.statusText || `Proxy request failed with status ${proxyResponse.status}`;
                    } catch (jsonError) {
                        errorMsg = `Request failed (${proxyResponse.status}): ${proxyResponse.statusText}`;
                    }
                }

                return { error: errorMsg };
            }

            console.log(`Parsing JSON response at ${new Date().toISOString()}`);
            const responseData = await proxyResponse.json();
            console.log(`Finished parsing JSON at ${new Date().toISOString()}`);

            if (responseData && typeof responseData.altText === 'string') {
                console.log(`Successfully received alt text, length: ${responseData.altText.length} characters`);

                let altText = responseData.altText;

                // Check if text exceeds the maximum length
                if (altText.length > MAX_ALT_TEXT_LENGTH) {
                    console.warn(`Alt text exceeds maximum length (${altText.length} > ${MAX_ALT_TEXT_LENGTH}), condensing instead of truncating...`);

                    // Use Gemini to condense the text instead of truncating
                    altText = await condenseAltText(altText, isVideo);

                    // Add a note if the text was condensed
                    if (isVideo) {
                        const condensedNote = "[Note: This video description was automatically condensed to fit character limits.]\n\n";
                        // Only add the note if there's room for it
                        if (altText.length + condensedNote.length <= MAX_ALT_TEXT_LENGTH) {
                            altText = condensedNote + altText;
                        }
                    }
                }

                return { altText: altText };
            } else {
                console.error('Unexpected successful response format from proxy:', responseData);
                return { error: 'Received invalid response format from proxy service.' };
            }
        } catch (e) {
            clearTimeout(timeoutId);
            console.error('Fetch error details:', e);

            // If it's a network error, try an alternative approach for images AND videos
            if ((e.name === 'TypeError' && e.message.includes('Failed to fetch'))) {
                console.log(`${isVideo ? 'Video' : 'Still image'} network error, trying alternate approach...`);
                try {
                    // Try a simpler request format
                    const simpleRequestBody = {
                        base64Data: base64Data, // Essential
                        mimeType: mimeType,     // Essential
                        isVideo: isVideo,       // Essential
                        simpleMode: true,       // Flag for the server
                        fileName: proxyRequestBody.fileName, // Keep filename if available
                        // Omit fileSize or other potentially problematic fields for this simplified attempt
                    };

                    console.log('Alternate approach body:', simpleRequestBody.mimeType, simpleRequestBody.isVideo, simpleRequestBody.simpleMode);
                    const simpleResponse = await fetch(CLOUD_FUNCTION_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(simpleRequestBody),
                        mode: 'cors' // Ensure CORS mode for the alternate request too
                    });

                    if (!simpleResponse.ok) {
                        const errorText = await simpleResponse.text().catch(() => `Alternative request failed with status ${simpleResponse.status}`);
                        console.error('Alternative approach failed:', errorText);
                        // Fall through to the more generic error if this also fails, but provide specific feedback
                        return { error: `Network error after multiple attempts. Main: ${e.message}. Alt: ${errorText}` };
                    }

                    const simpleData = await simpleResponse.json();
                    if (simpleData && typeof simpleData.altText === 'string') {
                        console.log('Successfully received alt text via alternate approach');
                        return { altText: simpleData.altText };
                    } else {
                        console.error('Alternate approach response format unexpected:', simpleData);
                        return { error: 'Network error: AI service connection failed (alt response invalid).' };
                    }
                } catch (altError) {
                    console.error('Alternative approach also failed with exception:', altError);
                    return { error: `Network error: Unable to connect to the AI service after multiple attempts. Please check your connection. (Main: ${e.message}, Alt Exception: ${altError.message})` };
                }
            }

            // Original error handling if not a 'Failed to fetch' TypeError or if alternate fails and falls through
            if (e.name === 'AbortError') {
                return { error: 'Request timed out after several minutes. The media may be too complex to process.' };
            }
            if (e.message && e.message.includes('Failed to fetch')) {
                console.error('Network fetch error:', e);
                return { error: 'Network error: Unable to connect to the AI service. Please check your connection and try again later.' };
            }
            if (e.message && (e.message.includes('413') ||
                e.message.toLowerCase().includes('too large') ||
                e.message.toLowerCase().includes('request entity too large') ||
                e.message.toLowerCase().includes('payload too large') ||
                e.message.toLowerCase().includes('message length exceeded'))) {
                console.error('Size limit error:', e);
                return { error: `Server error: File exceeds size limits (max 20MB). Please use a smaller file.` };
            }
            if (e.message && e.message.includes('NetworkError')) {
                console.error('Network error:', e);
                return { error: 'Network error: Connection interrupted. Please try again.' };
            }
            return { error: `Error: ${e.message || 'Unknown error occurred'}` };
        }
    } catch (error: unknown) {
        console.error('Error calling alt text proxy:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error communicating with proxy';
        return { error: `Request Error: ${errorMessage}` };
    }
}


// Function to condense alt text by making another API call to Gemini
async function condenseAltText(originalText: string, isVideo: boolean): Promise<string> {
    if (!CLOUD_FUNCTION_URL) {
        console.error('Cannot condense alt text: Cloud Function URL is not configured.');
        return originalText.substring(0, MAX_ALT_TEXT_LENGTH - 3) + '...';
    }

    try {
        // Create a directive for Gemini to condense the text to the target length
        const targetLength = MAX_ALT_TEXT_LENGTH - 100; // Leave some buffer space
        const mediaType = isVideo ? "video" : "image";
        const directive = `You are an expert at writing concise, informative alt text. Please condense the following ${mediaType} description to be no more than ${targetLength} characters while preserving the most important details. The description needs to be accessible and useful for screen readers:`;

        // Truncate the original text if it's extremely long to prevent message size issues
        const safeOriginalText = originalText.length > ABSOLUTE_MAX_LENGTH
            ? originalText.substring(0, ABSOLUTE_MAX_LENGTH - 100) + "... [content truncated for processing]"
            : originalText;

        // Create a special request for the condensing operation
        const condensingRequest = {
            operation: "condense_text",
            directive: directive,
            text: safeOriginalText,
            targetLength: targetLength
        };

        // Call the Cloud Function with this special request
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(condensingRequest)
        });

        const responseData = await response.json();

        if (!response.ok || !responseData.altText) {
            console.error('Failed to condense alt text:', responseData);
            // Fall back to truncation if condensing fails
            return originalText.substring(0, MAX_ALT_TEXT_LENGTH - 3) + '...';
        }

        return responseData.altText;
    } catch (error) {
        console.error('Error condensing alt text:', error);
        // Fall back to truncation if condensing fails
        return originalText.substring(0, MAX_ALT_TEXT_LENGTH - 3) + '...';
    }
}