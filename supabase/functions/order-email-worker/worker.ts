type Job = { id: string; lease_token: string; message: Record<string, unknown> };
type Config = { serviceUrl?: string; serviceKey?: string; resendKey?: string };
type Dependencies = { fetch: typeof fetch; pause?: () => Promise<void> };

export function createEmailWorker(config: Config, deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    // The gateway checks JWT validity; the worker additionally requires the service credential.
    if (
      !config.serviceKey ||
      request.headers.get('authorization') !== `Bearer ${config.serviceKey}`
    ) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (!config.serviceUrl || !config.resendKey) return json({ error: 'not_configured' }, 503);
    const rpc = async (name: string, body: unknown) => {
      const response = await deps.fetch(`${config.serviceUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: config.serviceKey!,
          Authorization: `Bearer ${config.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('database_error');
      return response.json();
    };
    let accepted = 0;
    let failed = 0;
    try {
      const jobs: Job[] = await rpc('claim_order_emails', {});
      for (const job of jobs) {
        let providerId: string | null = null;
        let error: string | null = null;
        let retry = false;
        try {
          const response = await deps.fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.resendKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `order-email/${job.id}`,
            },
            body: JSON.stringify(job.message),
            signal: AbortSignal.timeout(10_000),
          });
          if (response.ok) {
            const body = await response.json();
            providerId = typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
            if (!providerId) {
              error = 'invalid_response';
              retry = true;
            }
          } else {
            error = `provider_${response.status}`;
            retry = response.status === 429 || response.status >= 500 || response.status === 408;
            // Never log provider response bodies (they may contain recipients or credentials).
            await response.body?.cancel();
          }
        } catch {
          error = 'network';
          retry = true;
        }
        const saved = await rpc('finish_order_email', {
          p_id: job.id,
          p_lease_token: job.lease_token,
          p_provider_id: providerId,
          p_error: error,
          p_retry: retry,
        });
        if (saved !== true) throw new Error('lease_lost');
        if (providerId) accepted++;
        else failed++;
        // Stay below the provider's default per-second request quota.
        if (deps.pause) await deps.pause();
      }
      return json({ accepted, failed });
    } catch {
      // A failed acknowledgement is recovered using the same provider idempotency key.
      return json({ error: 'worker_failed', accepted, failed }, 503);
    }
  };
}
