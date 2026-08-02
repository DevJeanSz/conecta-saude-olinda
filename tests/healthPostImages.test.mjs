import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHealthPostStoragePath,
  createHealthPostImageStorage,
  getPublicationsSupabaseConfig,
  parseHealthPostDataUrl,
  requireHealthPostImageUrl,
} from '../server/domain/healthPostImages.mjs';

const tinyPngDataUrl = `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`;
const tinyJpegDataUrl = `data:image/jpeg;base64,${Buffer.from('fake-jpeg').toString('base64')}`;

test('valida imagens locais, remotas https e data URLs para publicacoes', () => {
  assert.equal(requireHealthPostImageUrl('/news/noticia-saude-geral.png'), '/news/noticia-saude-geral.png');
  assert.equal(requireHealthPostImageUrl('https://cdn.example.com/post.png'), 'https://cdn.example.com/post.png');
  assert.equal(requireHealthPostImageUrl(tinyPngDataUrl), tinyPngDataUrl);

  assert.throws(() => requireHealthPostImageUrl('http://cdn.example.com/post.png'), /imagem invalida/);
  assert.throws(() => requireHealthPostImageUrl('javascript:alert(1)'), /imagem invalida/);
});

test('prepara data URL com tipo e extensao corretos', () => {
  const parsed = parseHealthPostDataUrl(tinyJpegDataUrl);

  assert.equal(parsed.extension, 'jpg');
  assert.equal(parsed.mimeType, 'image/jpeg');
  assert.equal(parsed.buffer.toString(), 'fake-jpeg');
});

test('mantem fallback antigo quando Supabase de publicacoes nao esta configurado', async () => {
  const { storeHealthPostImage } = createHealthPostImageStorage({
    env: {},
    createSupabaseClient: () => {
      throw new Error('nao deveria criar cliente Supabase');
    },
  });

  await assert.doesNotReject(async () => {
    const result = await storeHealthPostImage(tinyPngDataUrl);
    assert.equal(result, tinyPngDataUrl);
  });
});

test('nao reenvia imagem quando a publicacao editada manteve a mesma URL', async () => {
  const currentImageUrl = 'https://cdn.example.com/publicacoes/post.png';
  const { storeHealthPostImage } = createHealthPostImageStorage({
    env: {
      PUBLICATIONS_SUPABASE_URL: 'https://project.supabase.co',
      PUBLICATIONS_SUPABASE_SERVICE_ROLE_KEY: 'secret',
    },
    createSupabaseClient: () => {
      throw new Error('nao deveria criar cliente Supabase');
    },
  });

  const result = await storeHealthPostImage(currentImageUrl, currentImageUrl);
  assert.equal(result, currentImageUrl);
});

test('envia data URL para o bucket Supabase separado e retorna URL publica', async () => {
  const calls = [];
  const fakeClient = {
    storage: {
      from(bucket) {
        return {
          async upload(path, buffer, options) {
            calls.push({ bucket, path, buffer, options });
            return { data: { path }, error: null };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `https://cdn.example.com/${bucket}/${path}` } };
          },
        };
      },
    },
  };

  let createClientArgs = null;
  const { storeHealthPostImage } = createHealthPostImageStorage({
    env: {
      PUBLICATIONS_SUPABASE_URL: 'https://project.supabase.co',
      PUBLICATIONS_SUPABASE_SERVICE_ROLE_KEY: 'secret',
      PUBLICATIONS_SUPABASE_BUCKET: 'posts-publicos',
    },
    randomUUID: () => 'fixed-id',
    now: () => new Date('2026-08-02T12:00:00.000Z'),
    createSupabaseClient: (...args) => {
      createClientArgs = args;
      return fakeClient;
    },
  });

  const result = await storeHealthPostImage(tinyPngDataUrl);

  assert.equal(createClientArgs[0], 'https://project.supabase.co');
  assert.equal(createClientArgs[1], 'secret');
  assert.equal(result, 'https://cdn.example.com/posts-publicos/publicacoes/2026-08/fixed-id.png');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bucket, 'posts-publicos');
  assert.equal(calls[0].path, 'publicacoes/2026-08/fixed-id.png');
  assert.equal(calls[0].buffer.toString(), 'fake-image');
  assert.deepEqual(calls[0].options, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: false,
  });
});

test('gera erro claro quando upload no Supabase falha', async () => {
  const { storeHealthPostImage } = createHealthPostImageStorage({
    env: {
      PUBLICATIONS_SUPABASE_URL: 'https://project.supabase.co',
      PUBLICATIONS_SUPABASE_SERVICE_ROLE_KEY: 'secret',
      PUBLICATIONS_SUPABASE_BUCKET: 'posts-publicos',
    },
    createSupabaseClient: () => ({
      storage: {
        from() {
          return {
            async upload() {
              return { data: null, error: new Error('bucket missing') };
            },
          };
        },
      },
    }),
  });

  await assert.rejects(
    () => storeHealthPostImage(tinyPngDataUrl),
    (error) => error.status === 502 && /bucket de publicacoes/.test(error.message),
  );
});

test('usa bucket padrao quando URL e chave estao configuradas sem nome explicito', () => {
  const config = getPublicationsSupabaseConfig({
    PUBLICATIONS_SUPABASE_URL: 'https://project.supabase.co',
    PUBLICATIONS_SUPABASE_SERVICE_ROLE_KEY: 'secret',
  });

  assert.equal(config.bucket, 'pubconectaolinda');
  assert.equal(config.hasAnyConfig, true);
});

test('monta caminho mensal para organizar arquivos do bucket', () => {
  const path = buildHealthPostStoragePath('webp', {
    now: new Date('2026-12-20T03:00:00.000Z'),
    id: 'image-id',
  });

  assert.equal(path, 'publicacoes/2026-12/image-id.webp');
});
