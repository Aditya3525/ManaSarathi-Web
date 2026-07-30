const DEFAULT_PRODUCTION_ORIGINS = [
  'https://manasarathi-frontend.vercel.app',
  'https://manasarthi-frontend.onrender.com',
  'https://manasarthi.app',
  'https://api.manasarthi.app',
];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export const normalizeOrigin = (value: string): string => value.replace(/\/+$/, '');

const splitOrigins = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

export const getAllowedProductionOrigins = (): string[] => {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.MOBILE_URL,
    ...DEFAULT_PRODUCTION_ORIGINS,
    ...splitOrigins(process.env.ADDITIONAL_CORS_ORIGINS),
  ].filter((origin): origin is string => Boolean(origin && origin.trim()));

  return Array.from(new Set(configuredOrigins.map(normalizeOrigin)));
};

export const isAllowedFrontendOrigin = (origin: string): boolean => {
  const normalizedOrigin = normalizeOrigin(origin);

  try {
    const parsed = new URL(normalizedOrigin);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    if (process.env.NODE_ENV !== 'production' && LOCAL_HOSTNAMES.has(hostname)) {
      return protocol === 'http:' || protocol === 'https:';
    }

    if (protocol !== 'https:') {
      return false;
    }

    if (getAllowedProductionOrigins().includes(normalizedOrigin)) {
      return true;
    }

    return process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};
