import { randomUUID } from 'node:crypto';

import { Params } from 'nestjs-pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  'res.headers["set-cookie"]',
  '*.passwordHash',
  '*.refreshTokenHash',
  '*.tokenHash',
];

export function buildLoggerOptions(nodeEnv: string, logLevel: string): Params {
  const isDev = nodeEnv === 'development';

  return {
    pinoHttp: {
      level: logLevel,
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
      genReqId: (req) => {
        const existing = req.headers['x-request-id'];
        return typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
      },
      customProps: () => ({ context: 'HTTP' }),
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  };
}
