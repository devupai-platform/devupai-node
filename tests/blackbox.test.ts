import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DevupAI, { DevupAPIError } from '../src/index';

import * as rootExports from '../src/index';
import * as providerExports from '../src/provider';

let lastRequestInfo: { url: string; init: RequestInit } | null = null;
let allRequests: { url: string; init: RequestInit }[] = [];
let fetchStub: any;

describe('DEVUP AI SDK V3 - Black-box Tests', () => {
  beforeEach(() => {
    lastRequestInfo = null;
    allRequests = [];
    fetchStub = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      lastRequestInfo = { url, init };
      allRequests.push({ url, init });

      if (init.body && typeof init.body === 'string' && init.body.includes('"stream":true')) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: {"_devup":{"cost_dzd": 1, "balance_dzd": 99}}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }

      if (url.includes('/images/proxy')) {
        return new Response(new ArrayBuffer(8), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      }

      if (url.includes('/audio/transcriptions') && init.body instanceof FormData) {
        const format = init.body.get("response_format") as string;
        if (format === 'text' || format === 'srt' || format === 'vtt') {
          return new Response("Text response", { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
      }

      if (url.includes('error-plain')) {
        return new Response("Plain text error message", { status: 400, headers: { 'Content-Type': 'text/plain' } });
      }

      return new Response(JSON.stringify({
        ok: true,
        url: "test-url",
        _devup: { cost_dzd: 1, balance_dzd: 99 },
        data: [{ url: 'https://example.com/vid.mp4' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const TEST_KEY = 'test_key';

  describe('Constructors and Configuration', () => {
    it('handles default base URL', () => {
      const client = new DevupAI({ apiKey: TEST_KEY });
      expect(client.baseURL).toBe('https://api.devupai.com/api/v1');
    });

    it('handles custom base URL', () => {
      const client = new DevupAI({ apiKey: TEST_KEY, baseURL: 'http://localhost/api/v1' });
      expect(client.baseURL).toBe('http://localhost/api/v1');
    });

    it('removes trailing slashes from baseURL', () => {
      const client = new DevupAI({ apiKey: TEST_KEY, baseURL: 'http://localhost/api/v1/' });
      expect(client.baseURL).toBe('http://localhost/api/v1');
    });
  });

  describe('Health URL Resolution', () => {
    it('resolves from default base URL', async () => {
      const client = new DevupAI({ apiKey: TEST_KEY });
      await client.health.check();
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/health');
    });
  });

  describe('Unauthenticated Operations', () => {
    let client: DevupAI;
    beforeEach(() => {
      client = new DevupAI({ apiKey: TEST_KEY });
    });

    it('health.check does not send Authorization header', async () => {
      await client.health.check();
      const headers = lastRequestInfo?.init.headers as Record<string, string> || {};
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Resource Methods', () => {

    it('images.proxy calls the DEVUP API host and never fetches upstream directly', async () => {
      await client.images.proxy({ url: 'http://upstream.local/image.png' });
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/images/proxy?url=http%3A%2F%2Fupstream.local%2Fimage.png');
    });

    it('models.list, health.check, and images.proxy never send Authorization', async () => {
      const clientAuth = new DevupAI({ apiKey: 'test', headers: { 'Authorization': 'Bearer test', 'authorization': 'Bearer test' } });
      await clientAuth.models.list();
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('Authorization');
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('authorization');

      await clientAuth.health.check();
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('Authorization');
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('authorization');

      await clientAuth.images.proxy({ url: 'http://upstream' });
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('Authorization');
      expect(lastRequestInfo?.init.headers).not.toHaveProperty('authorization');
    });

    it('Authorization is stripped case-insensitively on public endpoints', async () => {
      const clientAuth = new DevupAI({ apiKey: 'test', headers: { 'AUTHORIZATION': 'secret' } });
      await clientAuth.models.list({ headers: { 'AuThOrIzAtIoN': 'hacked' } });

      const keys = Object.keys(lastRequestInfo?.init.headers || {}).map(k => k.toLowerCase());
      expect(keys).not.toContain('authorization');
    });

    it('custom headers cannot override authenticated Authorization', async () => {
      await client.balance.retrieve({ headers: { 'Authorization': 'Bearer hacked', 'authorization': 'Bearer hacked' } });
      const headers: any = lastRequestInfo?.init.headers;
      expect(headers['Authorization']).toBe('Bearer test_key');
      expect(headers['authorization']).toBeUndefined();
    });

    it('custom headers cannot override JSON Content-Type', async () => {
      await client.chat.completions.create({ model: 'test', messages: [], headers: { 'Content-Type': 'text/plain', 'content-type': 'text/plain' } });
      const headers: any = lastRequestInfo?.init.headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['content-type']).toBeUndefined();
    });

    it('multipart Content-Type is never manually forwarded', async () => {
      const blob = new Blob(['img']);
      await client.images.edit({ image: blob, prompt: 'test', headers: { 'Content-Type': 'multipart/form-data', 'content-type': 'multipart/form-data' } });
      const headers: any = lastRequestInfo?.init.headers;
      expect(headers['Content-Type']).toBeUndefined();
      expect(headers['content-type']).toBeUndefined();
    });

    it('key_points string is appended unchanged', async () => {
      const videoBlob = new Blob(['vid']);
      await client.video.edits.create({ video: videoBlob, key_points: '{"a":1,"b":"2"}' });
      const formData = lastRequestInfo?.init.body as FormData;
      expect(formData.get('key_points')).toBe('{"a":1,"b":"2"}');
    });

    it('key_points typed array/object is encoded exactly once', async () => {
      const videoBlob = new Blob(['vid']);
      await client.video.edits.create({ video: videoBlob, key_points: { a: 1 } });
      const formData = lastRequestInfo?.init.body as FormData;
      expect(formData.get('key_points')).toBe('{"a":1}');
    });

    let client: DevupAI;
    beforeEach(() => {
      client = new DevupAI({ apiKey: TEST_KEY, headers: { 'X-Global': 'true' } });
    });

    it('balance.retrieve exact URL', async () => {
      await client.balance.retrieve();
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/user/balance');
      const headers = lastRequestInfo?.init.headers as Record<string, string>;
      expect(headers['X-Global']).toBe('true');
    });

    it('images.edit sends multipart to /images/generations', async () => {
      const blob = new Blob(['img']);
      await client.images.edit({ image: blob, prompt: 'test', headers: { 'X-Test': '1' } });
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/images/generations');
      expect(lastRequestInfo?.init.body).toBeInstanceOf(FormData);
      const headers = lastRequestInfo?.init.headers as Record<string, string>;
      expect(headers['X-Test']).toBe('1');
    });

    it('rerank.create hits /rerank and sends correct JSON payload', async () => {
      const payload: any = {
        model: 'Qwen/Qwen3-Reranker-8B',
        query: 'What is Devup AI?',
        documents: ['Devup AI is an API gateway'],
        top_n: 1,
        return_documents: true,
        headers: { 'X-Rerank': 'test' }
      };
      const response = await client.rerank.create(payload);
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/rerank');
      expect(lastRequestInfo?.init.method).toBe('POST');
      const body = JSON.parse(lastRequestInfo?.init.body as string);
      expect(body.model).toBe('Qwen/Qwen3-Reranker-8B');
      expect(body.query).toBe('What is Devup AI?');
      expect(body.documents).toEqual(['Devup AI is an API gateway']);
      expect(body.top_n).toBe(1);
      expect(body.return_documents).toBe(true);
      const headers = lastRequestInfo?.init.headers as Record<string, string>;
      expect(headers['X-Rerank']).toBe('test');
      expect(headers['X-Global']).toBe('true');
      expect(response).toHaveProperty('_devup');
    });

    it('video.edits sends multipart to /video/generations with all fields', async () => {
      const videoBlob = new Blob(['vid']);
      const maskBlob = new Blob(['mask']);
      const payload: any = {
        video: videoBlob,
        prompt: 'test',
        mask: maskBlob,
        mask_url: 'http://mask',
        key_points: { a: 1 },
        frame_index: 0,
        auto_trim: false,
        preserve_audio: false,
        background_color: '#000',
        desired_increase: 0,
        output_container_and_codec: 'mp4',
        headers: { 'X-Local': 'yes' }
      };
      const response = await client.video.edits.create(payload);
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/video/generations');
      expect(lastRequestInfo?.init.body).toBeInstanceOf(FormData);

      const formData = lastRequestInfo?.init.body as FormData;
      expect(formData.get('prompt')).toBe('test');
      expect(formData.get('mask_url')).toBe('http://mask');
      expect(formData.get('key_points')).toBe(JSON.stringify({ a: 1 }));
      expect(formData.get('frame_index')).toBe('0'); // zero preserved
      expect(formData.get('auto_trim')).toBe('false'); // false preserved
      expect(formData.get('preserve_audio')).toBe('false'); // false preserved
      expect(formData.get('background_color')).toBe('#000');
      expect(formData.get('desired_increase')).toBe('0'); // zero preserved
      expect(formData.get('output_container_and_codec')).toBe('mp4');

      const headers = lastRequestInfo?.init.headers as Record<string, string>;
      expect(headers['X-Global']).toBe('true');
      expect(headers['X-Local']).toBe('yes');

      // Check absence of video_url and presence of url
      expect(response.data[0].url).toBe('https://example.com/vid.mp4');
      expect((response.data[0] as any).video_url).toBeUndefined();
    });

    it('audio.speech.create with referenceAudioUrl and exact return type', async () => {
      const payload: any = { model: 'devup-tts-v1', input: 'test', voice: 'alloy', referenceAudioUrl: 'http://ref' };
      const response = await client.audio.speech.create(payload);
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/audio/speech');
      const body = JSON.parse(lastRequestInfo?.init.body as string);
      expect(body.referenceAudioUrl).toBe('http://ref');
      expect(response).toHaveProperty('url');
      expect(response).toHaveProperty('_devup');
    });

    it('audio.transcriptions.create text format', async () => {
      const blob = new Blob(['test']);
      const response = await client.audio.transcriptions.create({ model: 'devup-whisper-v1', file: blob, response_format: 'text' });
      expect(typeof response).toBe('string');
      expect(response).toBe('Text response');
    });

    it('audio.transcriptions.create srt format', async () => {
      const blob = new Blob(['test']);
      const response = await client.audio.transcriptions.create({ model: 'devup-whisper-v1', file: blob, response_format: 'srt' });
      expect(typeof response).toBe('string');
      expect(response).toBe('Text response');
    });

    it('audio.transcriptions.create json format', async () => {
      const blob = new Blob(['test']);
      const response = await client.audio.transcriptions.create({ model: 'devup-whisper-v1', file: blob, response_format: 'json' });
      expect(typeof response).toBe('object');
      expect(response).toHaveProperty('ok');
    });

    it('inference.run handles slash in model path', async () => {
      await client.inference.run('example-org/model-id', { test: true });
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/inference/example-org%2Fmodel-id');
    });

    it('inference.run handles already percent-encoded model path', async () => {
      await client.inference.run('example-org%2Fmodel-id', { test: true });
      // Should not double encode
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/inference/example-org%2Fmodel-id');
    });

    it('embeddings.create uses correct route and payload', async () => {
      const response = await client.embeddings.create({
        model: 'devup-embed-v1',
        input: 'Test input'
      });
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/embeddings');
      expect(lastRequestInfo?.init.method).toBe('POST');
      const body = JSON.parse(lastRequestInfo?.init.body as string);
      expect(body.model).toBe('devup-embed-v1');
      expect(body.input).toBe('Test input');
      expect(response).toHaveProperty('_devup');
    });

    it('images.generate uses correct route and payload', async () => {
      const response = await client.images.generate({
        model: 'devup-image-v1',
        prompt: 'A test image'
      });
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/images/generations');
      expect(lastRequestInfo?.init.method).toBe('POST');
      const body = JSON.parse(lastRequestInfo?.init.body as string);
      expect(body.model).toBe('devup-image-v1');
      expect(body.prompt).toBe('A test image');
      expect(response).toHaveProperty('_devup');
    });

    it('models.list uses correct route', async () => {
      const response = await client.models.list();
      expect(lastRequestInfo?.url).toBe('https://api.devupai.com/api/v1/models');
      expect(lastRequestInfo?.init.method).toBe('GET');
    });

    it('plain-text error parsing', async () => {
      try {
        await client.chat.completions.create({ model: 'test', messages: [] });
      } catch (_e: any) {
        // Just checking error doesn't expose auth
      }

      const fetchStubError = vi.fn().mockResolvedValue(new Response("Plain text error message", { status: 400, headers: { 'Content-Type': 'text/plain', 'X-Request-Id': 'req-123' } }));
      vi.stubGlobal('fetch', fetchStubError);

      let caughtErr: any;
      try {
        await client.balance.retrieve();
      } catch (err) {
        caughtErr = err;
      }
      expect(caughtErr).toBeInstanceOf(DevupAPIError);
      expect(caughtErr.message).toBe("Plain text error message");
      expect(caughtErr.requestId).toBe("req-123");
      expect(caughtErr.headers).not.toHaveProperty('authorization'); // response headers don't have it anyway, but ensuring strict safety
    });

    it('JSON error parsing', async () => {
      const fetchStubError = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "JSON error message", type: "test", code: "test_code" } }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchStubError);

      let caughtErr: any;
      try {
        await client.balance.retrieve();
      } catch (err) {
        caughtErr = err;
      }
      expect(caughtErr).toBeInstanceOf(DevupAPIError);
      expect(caughtErr.message).toBe("JSON error message");
      expect(caughtErr.type).toBe("test");
      expect(caughtErr.code).toBe("test_code");
    });
  });

  describe('DevupAPIError structure', () => {
    it('initializes DevupAPIError with correct structure', () => {
      const e = new DevupAPIError(404, 'Msg', { type: 'not_found', code: 'machine_code' }, new Headers({ 'X-Request-Id': '123' }));

      expect(e.name).toBe('DevupAPIError');
      expect(e.message).toBe('Msg');
      expect(e.status).toBe(404);
      expect(e.type).toBe('not_found');
      expect(e.code).toBe('machine_code');
      expect(e.requestId).toBe('123');
      expect(e instanceof Error).toBe(true);
      expect(e instanceof DevupAPIError).toBe(true);
      // Ensure Object.keys exposes them
      expect(Object.keys(e)).toContain('type');
      expect(Object.keys(e)).toContain('code');
    });
  });

  describe('Exports and Vercel AI Provider', () => {
    it('exports root items correctly', () => {
      expect(rootExports.DevupAPIError).toBeDefined();
      expect(rootExports.default).toBeDefined();
    });

    it('exports provider correctly', () => {
      expect(providerExports.createDevupAI).toBeDefined();
      expect(providerExports.devupai).toBeDefined();
    });
  });
});
