import { describe, it, expect, vi, beforeAll } from 'vitest';
import { GoogleTranslateProvider } from '../../src/providers/google-translate/GoogleTranslateProvider.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

// Mock logger
const createMockLogger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
});

describe('Google Translate Integration', () => {
    let mockLogger;

    beforeAll(() => {
        mockLogger = createMockLogger();
    });

    describe('ProviderFactory integration', () => {
        it('should register google-translate as a supported provider', () => {
            const supported = ProviderFactory.getSupportedProviders();
            expect(supported).toContain('google-translate');
        });

        it('should create google-translate provider via factory', () => {
            const provider = ProviderFactory.createProvider(
                { provider: 'google-translate', sourceLanguage: 'en' },
                mockLogger
            );
            expect(provider).toBeInstanceOf(GoogleTranslateProvider);
        });

        it('should return provider info for google-translate', () => {
            const providers = ProviderFactory.getProviderInfo();
            const googleTranslateInfo = providers.find(p => p.name === 'google-translate');

            expect(googleTranslateInfo).toBeDefined();
            expect(googleTranslateInfo.status).toBe('implemented');
            expect(googleTranslateInfo.models).toContain('default');
            expect(googleTranslateInfo.description).toContain('free');
        });

        it('should validate google-translate as a supported provider', () => {
            expect(ProviderFactory.isProviderSupported('google-translate')).toBe(true);
        });
    });

    describe('End-to-end translation simulation', () => {
        it('should translate batch in dry run mode', async () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            const batch = [
                { msgid: 'Hello', msgid_plural: null },
                { msgid: 'Goodbye', msgid_plural: null },
                { msgid: 'Thank you', msgid_plural: null },
            ];

            const result = await provider.translateBatch(
                batch,
                'fr',
                'default',
                'Translate to French',
                3,
                1000,
                30000,
                true // dry run
            );

            expect(result.success).toBe(true);
            expect(result.translations).toHaveLength(3);
            expect(result.cost.totalCost).toBe(0);

            // Check that dry run markers are present
            result.translations.forEach(trans => {
                expect(trans.msgstr[0]).toContain('[DRY RUN]');
            });
        });

        it('should handle multiple plural forms in dry run', async () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            const batch = [
                { msgid: '%d file', msgid_plural: '%d files' },
            ];

            const result = await provider.translateBatch(
                batch,
                'fr',
                'default',
                'Translate to French',
                3,
                1000,
                30000,
                true,
                null,
                null,
                2 // plural count
            );

            expect(result.success).toBe(true);
            expect(result.translations[0].msgstr).toHaveLength(2);
        });
    });

    describe('Configuration validation', () => {
        it('should fail validation for missing sourceLanguage', () => {
            const provider = new GoogleTranslateProvider({}, mockLogger);
            const result = provider.validateConfig({});

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should pass validation with sourceLanguage', () => {
            const provider = new GoogleTranslateProvider({}, mockLogger);
            const result = provider.validateConfig({ sourceLanguage: 'en' });

            expect(result.isValid).toBe(true);
        });
    });

    describe('API URL construction', () => {
        it('should construct valid Google Translate API URL', () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            const url = provider._buildUrl('Hello World', 'en', 'fr');

            expect(url).toBe('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=Hello%20World');
        });

        it('should handle special characters in text', () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            const url = provider._buildUrl('Hello & goodbye <test>', 'en', 'fr');

            // URL encoding should handle special characters
            expect(url).toContain('client=gtx');
            expect(url).toContain('sl=en');
            expect(url).toContain('tl=fr');
            expect(url).toContain('q=');
        });
    });

    describe('Pricing configuration', () => {
        it('should have zero cost for all translations', async () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            await provider.initialize();

            const pricing = provider.getModelPricing('default');
            expect(pricing.prompt).toBe(0);
            expect(pricing.completion).toBe(0);
        });

        it('should calculate zero cost', () => {
            const provider = new GoogleTranslateProvider(
                { sourceLanguage: 'en' },
                mockLogger
            );

            const cost = provider.calculateCost({ tokens: 1000 }, 'default');
            expect(cost.totalCost).toBe(0);
        });
    });
});