import { describe, it, expect, beforeAll } from 'vitest';
import Ajv, { ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let ajv: Ajv;
const validators: Record<string, ValidateFunction> = {};

describe('OpenAPI Contract Tests', () => {
  beforeAll(() => {
    const provPath = path.join(__dirname, '..', 'audit', 'openapi', 'PROVENANCE.json');
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    const yamlPath = path.join(__dirname, '..', 'audit', 'openapi', 'devupai-v1.yaml');
    const yamlContent = fs.readFileSync(yamlPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(yamlContent);
    const actualHash = hashSum.digest('hex').toUpperCase();
    if (actualHash !== prov.SourceSHA256) {
        throw new Error("OPENAPI_IDENTITY_MISMATCH");
    }

    const sPath = path.join(__dirname, 'fixtures', 'openapi.json');
    const fixtureContent = fs.readFileSync(sPath);
    const fixtureHashSum = crypto.createHash('sha256');
    fixtureHashSum.update(fixtureContent);
    const actualFixtureHash = fixtureHashSum.digest('hex').toUpperCase();
    if (actualFixtureHash !== prov.FixtureSHA256) {
        throw new Error("OPENAPI_FIXTURE_IDENTITY_MISMATCH");
    }

    const schemaPath = path.join(__dirname, 'fixtures', 'openapi.json');
    const openapi = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    ajv = new Ajv({ strict: false });
    addFormats(ajv);

    for (const [name, schema] of Object.entries(openapi.components.schemas)) {
      ajv.addSchema(schema as any, `#/components/schemas/${name}`);
    }

    const schemasToCompile = [
      'DevUpBilling',
      'ChatCompletionResponse',
      'EmbeddingResponse',
      'ImageGenerationResponse',
      'SpeechResponse',
      'TranscriptionResponse',
      'TranscriptionVerboseResponse',
      'VideoGenerationResponse',
      'ModelListResponse',
      'BalanceResponse',
      'HealthResponse',
      'ErrorResponse'
    ];

    for (const name of schemasToCompile) {
      validators[name] = ajv.compile(openapi.components.schemas[name]);
    }
  });

  describe('Positive Fixtures', () => {
    it('validates DevUpBilling', () => {
      const valid = validators.DevUpBilling({
        cost_dzd: 1.5,
        billed_duration_ms: 100,
        provider: 'openai',
        balance_dzd: 500.0
      });
      expect(validators.DevUpBilling.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates ChatCompletionResponse', () => {
      const valid = validators.ChatCompletionResponse({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'devup-fast-v1',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello there!' },
          finish_reason: 'stop'
        }],
        _devup: { cost_dzd: 1, balance_dzd: 100 }
      });
      expect(validators.ChatCompletionResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates EmbeddingResponse', () => {
      const valid = validators.EmbeddingResponse({
        object: 'list',
        data: [{ object: 'embedding', embedding: [0.1, 0.2], index: 0 }],
        model: 'devup-embed-v1',
        usage: { prompt_tokens: 5, total_tokens: 5 },
        _devup: { cost_dzd: 1, balance_dzd: 100 }
      });
      expect(validators.EmbeddingResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates ImageGenerationResponse', () => {
      const valid = validators.ImageGenerationResponse({
        created: 1677652288,
        data: [{ url: 'https://example.com/img.png' }],
        _devup: { cost_dzd: 1, balance_dzd: 100 }
      });
      expect(validators.ImageGenerationResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates SpeechResponse', () => {
      const valid = validators.SpeechResponse({
        url: 'https://example.com/audio.mp3',
        _devup: { cost_dzd: 1, balance_dzd: 500 }
      });
      expect(validators.SpeechResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates TranscriptionResponse', () => {
      const valid = validators.TranscriptionResponse({
        text: 'Hello world'
      });
      expect(validators.TranscriptionResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates TranscriptionVerboseResponse', () => {
      const valid = validators.TranscriptionVerboseResponse({
        task: 'transcribe',
        language: 'english',
        duration: 1.5,
        text: 'Hello world',
        segments: [{
          id: 0,
          seek: 0,
          start: 0,
          end: 1,
          text: 'Hello world',
          tokens: [1, 2, 3],
          temperature: 0,
          avg_logprob: -0.5,
          compression_ratio: 1,
          no_speech_prob: 0.1
        }]
      });
      expect(validators.TranscriptionVerboseResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates VideoGenerationResponse', () => {
      const valid = validators.VideoGenerationResponse({
        created: 1677652288,
        data: [{ url: 'https://example.com/vid.mp4' }],
        _devup: { cost_dzd: 1, balance_dzd: 100 }
      });
      expect(validators.VideoGenerationResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates ModelListResponse', () => {
      const valid = validators.ModelListResponse({
        object: 'list',
        data: [{ id: 'model-1', object: 'model', created: 1677652288, owned_by: 'devupai' }]
      });
      expect(validators.ModelListResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates BalanceResponse', () => {
      const valid = validators.BalanceResponse({
        balance_dzd: 1000.5
      });
      expect(validators.BalanceResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates HealthResponse', () => {
      const valid = validators.HealthResponse({
        status: 'ok',
        version: '1.0.0'
      });
      expect(validators.HealthResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates ErrorResponse', () => {
      const valid = validators.ErrorResponse({
        error: {
          message: 'An error occurred',
          type: 'devup_error',
          code: 'missing_param'
        }
      });
      expect(validators.ErrorResponse.errors).toBeNull();
      expect(valid).toBe(true);
    });
  });

  describe('Negative Fixtures', () => {
    it('rejects Billing missing cost_dzd', () => {
      const valid = validators.DevUpBilling({
        billed_duration_ms: 100,
        provider: 'openai',
        balance_dzd: 500.0
      });
      expect(valid).toBe(false);
    });

    it('rejects Billing missing balance_dzd', () => {
      const valid = validators.DevUpBilling({
        cost_dzd: 1.5,
        billed_duration_ms: 100,
        provider: 'openai'
      });
      expect(valid).toBe(false);
    });

    it('rejects Chat missing required fields', () => {
      const valid = validators.ChatCompletionResponse({
        id: 'chatcmpl-123'
      });
      expect(valid).toBe(false);
    });

    it('rejects Verbose transcription missing segments', () => {
      const valid = validators.TranscriptionVerboseResponse({
        task: 'transcribe',
        language: 'english',
        duration: 1.5,
        text: 'Hello world'
      });
      expect(valid).toBe(false);
    });

    it('rejects Video using video_url instead of url', () => {
      const valid = validators.VideoGenerationResponse({
        created: 1677652288,
        data: [{ video_url: 'https://example.com/vid.mp4' }]
      });
      expect(valid).toBe(false);
    });

    it('rejects Video missing data', () => {
      const valid = validators.VideoGenerationResponse({
        created: 1677652288
      });
      expect(valid).toBe(false);
    });

    it('rejects Video item missing url', () => {
      const valid = validators.VideoGenerationResponse({
        created: 1677652288,
        data: [{}]
      });
      expect(valid).toBe(false);
    });

    it('rejects Error missing code', () => {
      const valid = validators.ErrorResponse({
        error: {
          message: 'An error occurred',
          type: 'invalid_request_error'
        }
      });
      expect(valid).toBe(false);
    });

    it('rejects Invalid enum values', () => {
      const valid = validators.ChatCompletionResponse({
        id: 'chatcmpl-123',
        object: 'invalid.enum.value',
        created: 1677652288,
        model: 'devup-fast-v1',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello there!' },
          finish_reason: 'stop'
        }]
      });
      expect(valid).toBe(false);
    });
  });
});
