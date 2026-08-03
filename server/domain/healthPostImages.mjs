import { randomUUID as defaultRandomUUID } from 'node:crypto';
import ws from 'ws';

export const DEFAULT_PUBLICATIONS_SUPABASE_BUCKET = 'pubconectaolinda';
export const HEALTH_POST_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i;
export const MAX_HEALTH_POST_IMAGE_URL_LENGTH = 2048;
export const MAX_HEALTH_POST_IMAGE_DATA_URL_LENGTH = 2500000;
export const MAX_HEALTH_POST_IMAGE_BYTES = 2 * 1024 * 1024;

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const getPublicationsSupabaseConfig = (env = process.env) => {
  const url = env.PUBLICATIONS_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const key = env.PUBLICATIONS_SUPABASE_SERVICE_ROLE_KEY
    || env.PUBLICATIONS_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY
    || '';
  const configuredBucket = env.PUBLICATIONS_SUPABASE_BUCKET || env.VITE_SUPABASE_BUCKET || '';

  return {
    url,
    key,
    configuredBucket,
    bucket: configuredBucket || DEFAULT_PUBLICATIONS_SUPABASE_BUCKET,
    hasAnyConfig: Boolean(url || key || configuredBucket),
  };
};

export const requireHealthPostImageUrl = (value) => {
  const imageUrl = String(value ?? '').trim();
  const isBundledAsset = imageUrl.startsWith('/news/');
  const isDataImage = HEALTH_POST_DATA_URL_PATTERN.test(imageUrl);
  const isRemoteImage = /^https:\/\/[^\s"'<>]+$/i.test(imageUrl);

  const isImageUrl = isBundledAsset || isRemoteImage;
  const isAllowedUrlSize = isImageUrl && imageUrl.length <= MAX_HEALTH_POST_IMAGE_URL_LENGTH;
  const isAllowedDataSize = isDataImage && imageUrl.length <= MAX_HEALTH_POST_IMAGE_DATA_URL_LENGTH;

  if (!imageUrl || (!isAllowedUrlSize && !isAllowedDataSize)) {
    throw createHttpError('imagem invalida.', 400);
  }

  return imageUrl;
};

export const parseHealthPostDataUrl = (imageUrl) => {
  const match = String(imageUrl || '').match(HEALTH_POST_DATA_URL_PATTERN);
  if (!match) return null;

  const subtype = match[1].toLowerCase();
  const extension = subtype === 'jpeg' || subtype === 'jpg' ? 'jpg' : subtype;
  const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
  const buffer = Buffer.from(match[2], 'base64');

  if (!buffer.length || buffer.length > MAX_HEALTH_POST_IMAGE_BYTES) {
    throw createHttpError('imagem excede o limite de 2MB.', 400);
  }

  return { buffer, extension, mimeType };
};

export const buildHealthPostStoragePath = (extension, options = {}) => {
  const now = options.now || new Date();
  const id = options.id || defaultRandomUUID();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `publicacoes/${year}-${month}/${id}.${extension}`;
};

export const createHealthPostImageStorage = ({
  createSupabaseClient,
  env = process.env,
  randomUUID = defaultRandomUUID,
  now = () => new Date(),
} = {}) => {
  let publicationsSupabase = null;

  const getPublicationsSupabase = () => {
    const config = getPublicationsSupabaseConfig(env);
    if (!config.hasAnyConfig) return null;

    if (!config.url || !config.key || !config.bucket) {
      throw createHttpError('Supabase de publicacoes incompleto. Configure URL, chave e bucket.', 500);
    }

    if (!createSupabaseClient) {
      throw createHttpError('Cliente Supabase de publicacoes nao configurado.', 500);
    }

    if (!publicationsSupabase) {
      publicationsSupabase = createSupabaseClient(config.url, config.key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          WebSocket: ws,
        },
      });
    }

    return { supabase: publicationsSupabase, bucket: config.bucket };
  };

  const storeHealthPostImage = async (imageUrl, currentImageUrl = '') => {
    if (imageUrl === currentImageUrl) return imageUrl;

    const parsed = parseHealthPostDataUrl(imageUrl);
    if (!parsed) return imageUrl;

    const storage = getPublicationsSupabase();
    if (!storage) return imageUrl;

    const filePath = buildHealthPostStoragePath(parsed.extension, {
      now: now(),
      id: randomUUID(),
    });
    const { data, error } = await storage.supabase.storage
      .from(storage.bucket)
      .upload(filePath, parsed.buffer, {
        contentType: parsed.mimeType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (error) {
      throw createHttpError('Nao foi possivel enviar a imagem para o bucket de publicacoes.', 502);
    }

    const uploadedPath = data?.path || filePath;
    const { data: publicUrlData } = storage.supabase.storage
      .from(storage.bucket)
      .getPublicUrl(uploadedPath);

    if (!publicUrlData?.publicUrl) {
      throw createHttpError('Nao foi possivel gerar a URL publica da imagem.', 502);
    }

    return publicUrlData.publicUrl;
  };

  return { storeHealthPostImage };
};
