import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Opts a route out of the global { success, data } envelope.
 * Used for endpoints consumed by infra (e.g. health checks) that expect a raw body.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
