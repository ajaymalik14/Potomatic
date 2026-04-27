import { Provider } from '../base/Provider.js';

/**
 * Google Translate Provider Implementation.
 *
 * Handles translation using Google's free public Translate API.
 * No API key required - uses translate.googleapis.com endpoint.
 *
 * @since 1.0.0
 */
export class GoogleTranslateProvider extends Provider {
    /**
     * Creates a new Google Translate Provider instance.
     *
     * @since 1.0.0
     *
     * @param {Object} config - Google Translate provider configuration.
     * @param {Object} logger - Logger instance.
     */
    constructor(config, logger) {
        super(config, logger);

        this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    }

    /**
     * Initializes the Google Translate provider.
     * Sets up pricing information (free service).
     *
     * @since 1.0.0
     *
     * @return {Promise<void>} Resolves when initialization is complete.
     */
    async initialize() {
        await this._loadProviderPricing('google-translate');
        this.logger.debug('Google Translate provider initialized (free service)');
    }

    /**
     * Validates Google Translate provider configuration.
     *
     * @since 1.0.0
     *
     * @param {Object} config - Configuration to validate.
     *
     * @return {Object} Validation result.
     */
    validateConfig(config) {
        const errors = [];

        if (!config.sourceLanguage) {
            errors.push('Source language is required for Google Translate');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Translates a batch of strings using Google Translate API.
     *
     * @since 1.0.0
     *
     * @param {Array}    batch                - Array of translation items.
     * @param {string}   targetLang           - Target language code.
     * @param {string}   model                - Model identifier (unused for Google Translate).
     * @param {string}   systemPrompt         - System prompt (ignored, Google Translate is direct).
     * @param {number}   maxRetries           - Maximum retry attempts.
     * @param {number}   retryDelayMs         - Delay between retries.
     * @param {number}   timeout              - Request timeout in ms.
     * @param {boolean}  isDryRun             - Whether this is a dry run.
     * @param {Function} retryProgressCallback - Optional callback for retry progress updates.
     * @param {Object}   debugConfig          - Optional debug configuration object.
     * @param {number}   pluralCount          - Number of plural forms for target language.
     *
     * @return {Promise<Object>} Translation result.
     */
    async translateBatch(batch, targetLang, model, systemPrompt, maxRetries, retryDelayMs, timeout, isDryRun, retryProgressCallback = null, debugConfig = null, pluralCount = 1) {
        const sourceLang = this.config.sourceLanguage || 'en';

        if (isDryRun) {
            return this._handleDryRun(batch, targetLang, sourceLang, pluralCount);
        }

        return await this._makeApiCallWithRetries(batch, targetLang, sourceLang, maxRetries, retryDelayMs, timeout, retryProgressCallback, pluralCount);
    }

    /**
     * Calculates cost based on usage data.
     * Google Translate is free, so cost is always 0.
     *
     * @since 1.0.0
     *
     * @param {Object} usage - Token usage (not used for Google Translate).
     * @param {string} model - Model used (unused).
     *
     * @return {Object} Cost breakdown (zero for free service).
     */
    calculateCost(usage, model) {
        return {
            model: 'google-translate',
            promptCost: 0,
            completionCost: 0,
            totalCost: 0,
        };
    }

    /**
     * Gets token count using character-based estimation.
     *
     * @since 1.0.0
     *
     * @param {string} text  - Text to count tokens for.
     * @param {string} model - Model identifier (unused).
     *
     * @return {number} Estimated token count.
     */
    async getTokenCount(text, model) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    /**
     * Gets supported "models" for Google Translate.
     * Returns default since Google Translate doesn't use model selection.
     *
     * @since 1.0.0
     *
     * @return {Array<string>} Supported model identifiers.
     */
    getSupportedModels() {
        return ['default'];
    }

    /**
     * Gets the provider name.
     *
     * @since 1.0.0
     *
     * @return {string} Provider name.
     */
    getProviderName() {
        return 'google-translate';
    }

    /**
     * Estimates output tokens based on input tokens.
     * Google Translate typically expands text by ~10-30%.
     *
     * @since 1.0.0
     *
     * @param {number} inputTokens - Number of input tokens.
     * @param {string} targetLang - Target language (unused).
     *
     * @return {number} Estimated output tokens.
     */
    estimateOutputTokens(inputTokens, targetLang) {
        // Google Translate output is typically 1.2x input
        return Math.round(inputTokens * 1.2);
    }

    /**
     * Gets fallback pricing when pricing file cannot be loaded.
     * Google Translate is free.
     *
     * @since 1.0.0
     *
     * @return {Object} Google Translate fallback pricing structure.
     *
     * @protected
     */
    _getFallbackPricing() {
        return {
            models: {
                default: { prompt: 0, completion: 0 },
            },
            fallback: { prompt: 0, completion: 0 },
        };
    }

    /**
     * Gets model pricing for Google Translate.
     *
     * @since 1.0.0
     *
     * @param {string} model - Model to get pricing for.
     *
     * @return {Object} Pricing information (always zeros).
     */
    getModelPricing(model) {
        if (this.providerPricing && this.providerPricing.models && this.providerPricing.models[model]) {
            return this.providerPricing.models[model];
        }

        return { prompt: 0, completion: 0 };
    }

    /**
     * Handles dry-run mode by returning mock translations.
     *
     * @since 1.0.0
     *
     * @param {Array}  batch      - Translation batch.
     * @param {string} targetLang - Target language code.
     * @param {string} sourceLang - Source language code.
     * @param {number} pluralCount - Number of plural forms.
     *
     * @return {Object} Dry-run result.
     *
     * @private
     */
    async _handleDryRun(batch, targetLang, sourceLang, pluralCount) {
        const translations = batch.map((item) => {
            const msgstr = Array(pluralCount).fill(`[DRY RUN] ${item.msgid}`);
            return { msgid: item.msgid, msgstr };
        });

        return {
            success: true,
            translations,
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            cost: {
                totalCost: 0,
                model: 'google-translate',
                isDryRun: true,
            },
            isDryRun: true,
        };
    }

    /**
     * Makes API call with retry logic.
     *
     * @since 1.0.0
     *
     * @param {Array}    batch                - Translation batch.
     * @param {string}   targetLang           - Target language code.
     * @param {string}   sourceLang           - Source language code.
     * @param {number}   maxRetries           - Maximum retries.
     * @param {number}   retryDelayMs         - Retry delay in ms.
     * @param {number}   timeout              - Request timeout in ms.
     * @param {Function} retryProgressCallback - Optional callback for retry progress updates.
     * @param {number}   pluralCount          - Number of plural forms.
     *
     * @return {Promise<Object>} Translation result.
     *
     * @private
     */
    async _makeApiCallWithRetries(batch, targetLang, sourceLang, maxRetries, retryDelayMs, timeout, retryProgressCallback, pluralCount) {
        // Convert timeout from seconds to milliseconds (timeout is in seconds from config)
        const timeoutMs = typeof timeout === 'number' && timeout < 1000 ? timeout * 1000 : timeout;

        // For Google Translate, process all strings in parallel for speed
        // Use a smaller batch to avoid rate limiting
        const maxConcurrent = 10; // Number of concurrent requests

        const translateItem = async (item, itemIndex) => {
            let attempts = 0;

            while (attempts <= maxRetries) {
                try {
                    // Translate the string
                    const translation = await this._translateText(item.msgid, sourceLang, targetLang, timeoutMs);

                    // Handle plural forms - Google Translate doesn't support plural forms directly
                    // If the item has a plural form, translate it too
                    let msgstr = [translation];

                    if (item.msgid_plural) {
                        const pluralTranslation = await this._translateText(item.msgid_plural, sourceLang, targetLang, timeoutMs);
                        msgstr = Array(pluralCount).fill(pluralTranslation);
                        if (pluralCount === 1) {
                            msgstr = [translation];
                        }
                    }

                    return {
                        msgid: item.msgid,
                        msgid_plural: item.msgid_plural || null,
                        msgstr,
                    };
                } catch (error) {
                    attempts++;

                    if (attempts > maxRetries) {
                        this.logger.error(`Failed to translate "${item.msgid}" after ${maxRetries + 1} attempts`);
                        return {
                            msgid: item.msgid,
                            msgid_plural: item.msgid_plural || null,
                            msgstr: Array(pluralCount).fill(''),
                            error: error?.message || 'Translation failed',
                        };
                    }

                    // Short delay before retry for Google Translate
                    if (error.message?.includes('timeout') || error.message?.includes('429')) {
                        await this._sleep(500); // Short delay for retries
                    }

                    this.logger.warn(`Retry ${attempts}/${maxRetries} for "${item.msgid}": ${error.message}`);
                }
            }

            // Should not reach here, but just in case
            return {
                msgid: item.msgid,
                msgid_plural: item.msgid_plural || null,
                msgstr: Array(pluralCount).fill(''),
                error: 'Translation failed',
            };
        };

        // Process in chunks for parallel execution
        const translations = [];
        for (let i = 0; i < batch.length; i += maxConcurrent) {
            const chunk = batch.slice(i, i + maxConcurrent);
            const results = await Promise.all(chunk.map((item, idx) => translateItem(item, i + idx)));
            translations.push(...results);
        }

        return {
            success: true,
            translations,
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            cost: {
                totalCost: 0,
                model: 'google-translate',
            },
        };
    }

    /**
     * Translates a single text using Google Translate API.
     *
     * @since 1.0.0
     *
     * @param {string} text      - Text to translate.
     * @param {string} sourceLang - Source language code.
     * @param {string} targetLang - Target language code.
     * @param {number} timeout   - Request timeout in ms.
     *
     * @return {Promise<string>} Translated text.
     *
     * @private
     */
    async _translateText(text, sourceLang, targetLang, timeout = 30000) {
        const url = this._buildUrl(text, sourceLang, targetLang);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return this._parseResponse(data);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }

            throw error;
        }
    }

    /**
     * Builds the Google Translate API URL.
     *
     * @since 1.0.0
     *
     * @param {string} text      - Text to translate.
     * @param {string} sourceLang - Source language code.
     * @param {string} targetLang - Target language code.
     *
     * @return {string} Complete URL with query parameters.
     *
     * @private
     */
    _buildUrl(text, sourceLang, targetLang) {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang,
            tl: targetLang,
            dt: 't',
            q: text,
        });

        return `${this.baseUrl}?${params.toString()}`;
    }

    /**
     * Parses Google Translate API response.
     *
     * @since 1.0.0
     *
     * @param {Object} data - JSON response from Google Translate.
     *
     * @return {string} Extracted translation text.
     *
     * @private
     */
    _parseResponse(data) {
        // Google Translate returns: [[translated_text, original_text, detected_lang], ...]
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid response format from Google Translate');
        }

        // The first element is the translation
        const firstElement = data[0];

        if (Array.isArray(firstElement)) {
            // For single sentences, data[0] is an array of segments
            // Join all segments to get full translation
            return firstElement.map((segment) => (Array.isArray(segment) ? segment[0] : segment)).join('');
        }

        return String(firstElement);
    }

    /**
     * Determines if retrying should stop based on error type.
     *
     * @private
     *
     * @since 1.0.0
     *
     * @param {Error} error - The error that occurred.
     *
     * @return {boolean} True if retrying should stop.
     */
    _shouldStopRetrying(error) {
        // Don't retry on client errors
        if (error.message && error.message.includes('timeout')) {
            return false; // Timeouts are retriable
        }
        return false; // Most errors are retriable for Google Translate
    }

    /**
     * Notifies retry progress callback if provided.
     *
     * @private
     *
     * @since 1.0.0
     *
     * @param {Function} callback - Progress callback function.
     * @param {number} attempt - Current attempt number.
     * @param {number} maxRetries - Maximum retry attempts.
     * @param {boolean} isRetrying - Whether currently retrying.
     */
    _notifyRetryProgress(callback, attempt, maxRetries, isRetrying = true) {
        if (!callback) {
            return;
        }

        callback({
            isRetrying: isRetrying && attempt > 0,
            attempt,
            maxRetries,
        });
    }

    /**
     * Sleep utility for delays.
     *
     * @private
     *
     * @param {number} ms - Milliseconds to sleep.
     *
     * @return {Promise<void>}
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}