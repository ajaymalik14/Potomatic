import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleTranslateProvider } from '../../src/providers/google-translate/GoogleTranslateProvider.js';

// Mock logger
const createMockLogger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
});

describe('GoogleTranslateProvider', () => {
    let provider;
    let mockLogger;

    beforeEach(() => {
        mockLogger = createMockLogger();
        provider = new GoogleTranslateProvider(
            { sourceLanguage: 'en' },
            mockLogger
        );
    });

    describe('constructor', () => {
        it('should create a new provider instance', () => {
            expect(provider).toBeDefined();
            expect(provider.baseUrl).toBe('https://translate.googleapis.com/translate_a/single');
        });
    });

    describe('getProviderName', () => {
        it('should return google-translate as the provider name', () => {
            expect(provider.getProviderName()).toBe('google-translate');
        });
    });

    describe('getSupportedModels', () => {
        it('should return default model', () => {
            expect(provider.getSupportedModels()).toEqual(['default']);
        });
    });

    describe('validateConfig', () => {
        it('should return valid for config with sourceLanguage', () => {
            const result = provider.validateConfig({ sourceLanguage: 'en' });
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return errors when sourceLanguage is missing', () => {
            const result = provider.validateConfig({});
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Source language is required for Google Translate');
        });
    });

    describe('calculateCost', () => {
        it('should always return zero cost', () => {
            const cost = provider.calculateCost({}, 'default');
            expect(cost.totalCost).toBe(0);
            expect(cost.promptCost).toBe(0);
            expect(cost.completionCost).toBe(0);
            expect(cost.model).toBe('google-translate');
        });
    });

    describe('getTokenCount', () => {
        it('should return estimated token count based on character length', async () => {
            const count = await provider.getTokenCount('hello world', 'default');
            expect(count).toBe(Math.ceil('hello world'.length / 4));
        });

        it('should return 0 for empty text', async () => {
            const count = await provider.getTokenCount('', 'default');
            expect(count).toBe(0);
        });

        it('should return 0 for null text', async () => {
            const count = await provider.getTokenCount(null, 'default');
            expect(count).toBe(0);
        });
    });

    describe('estimateOutputTokens', () => {
        it('should estimate output as 1.2x input', () => {
            const output = provider.estimateOutputTokens(100, 'fr');
            expect(output).toBe(120);
        });
    });

    describe('getModelPricing', () => {
        it('should return zero pricing', () => {
            const pricing = provider.getModelPricing('default');
            expect(pricing.prompt).toBe(0);
            expect(pricing.completion).toBe(0);
        });
    });

    describe('_getFallbackPricing', () => {
        it('should return zero pricing structure', () => {
            const fallback = provider._getFallbackPricing();
            expect(fallback.models.default.prompt).toBe(0);
            expect(fallback.models.default.completion).toBe(0);
            expect(fallback.fallback.prompt).toBe(0);
            expect(fallback.fallback.completion).toBe(0);
        });
    });

    describe('_buildUrl', () => {
        it('should build correct URL with parameters', () => {
            const url = provider._buildUrl('hello', 'en', 'fr');
            expect(url).toContain('client=gtx');
            expect(url).toContain('sl=en');
            expect(url).toContain('tl=fr');
            expect(url).toContain('dt=t');
            expect(url).toContain('q=hello');
        });
    });

    describe('_parseResponse', () => {
        it('should parse Google Translate response format', () => {
            // Simulate Google Translate response: [[translated_text, original, detected_lang], ...]
            const mockData = [['Bonjour le monde', 'Hello world', 'en']];
            const result = provider._parseResponse(mockData);
            expect(result).toBe('Bonjour le monde');
        });

        it('should handle array of segments', () => {
            // Multiple segments in response
            const mockData = [[['Hello', 'world']]];
            const result = provider._parseResponse(mockData);
            expect(result).toBe('Helloworld');
        });

        it('should throw error for invalid response', () => {
            expect(() => provider._parseResponse(null)).toThrow('Invalid response format');
            expect(() => provider._parseResponse([])).toThrow('Invalid response format');
        });
    });

    describe('translateBatch (dry run)', () => {
        it('should return mock translations in dry run mode', async () => {
            const batch = [
                { msgid: 'Hello', msgid_plural: null },
                { msgid: 'World', msgid_plural: null }
            ];

            const result = await provider.translateBatch(
                batch,
                'fr',
                'default',
                'system prompt',
                3,
                1000,
                30000,
                true // dry run
            );

            expect(result.success).toBe(true);
            expect(result.translations).toHaveLength(2);
            expect(result.translations[0].msgstr[0]).toContain('[DRY RUN]');
            expect(result.cost.totalCost).toBe(0);
            expect(result.isDryRun).toBe(true);
        });

        it('should handle plural forms in dry run', async () => {
            const batch = [
                { msgid: 'One item', msgid_plural: '%d items', msgstr: [''] }
            ];

            const result = await provider.translateBatch(
                batch,
                'fr',
                'default',
                'system prompt',
                3,
                1000,
                30000,
                true
            );

            expect(result.success).toBe(true);
            expect(result.translations[0].msgstr).toHaveLength(1); // pluralCount defaults to 1
        });
    });

    describe('_shouldStopRetrying', () => {
        it('should return false for timeout errors (retriable)', () => {
            const error = new Error('Request timeout');
            expect(provider._shouldStopRetrying(error)).toBe(false);
        });

        it('should return false for other errors (retriable)', () => {
            const error = new Error('Network error');
            expect(provider._shouldStopRetrying(error)).toBe(false);
        });
    });

    describe('_notifyRetryProgress', () => {
        it('should call callback with progress info', () => {
            const callback = vi.fn();
            provider._notifyRetryProgress(callback, 1, 3, true);

            expect(callback).toHaveBeenCalledWith({
                isRetrying: true,
                attempt: 1,
                maxRetries: 3,
            });
        });

        it('should not call callback if not provided', () => {
            expect(() => provider._notifyRetryProgress(null, 1, 3, true)).not.toThrow();
        });
    });

    describe('_sleep', () => {
        it('should return a promise', () => {
            const result = provider._sleep(10);
            expect(result).toBeInstanceOf(Promise);
        });
    });
});