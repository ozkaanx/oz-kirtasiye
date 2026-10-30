import { createEmailWorker } from './worker.ts';

// Narrow runtime declaration also allows the repository's TypeScript check to inspect this file.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(
  createEmailWorker(
    {
      serviceUrl: Deno.env.get('SUPABASE_URL'),
      serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      resendKey: Deno.env.get('ORDER_RESEND_API_KEY'),
    },
    {
      fetch,
      pause: () => new Promise((resolve) => setTimeout(resolve, 600)),
    },
  ),
);
