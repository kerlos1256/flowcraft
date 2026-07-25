export interface AppConfig {
  port: number;
  webOrigin: string;
  database: { url: string };
  inngest: {
    dev: boolean;
    baseUrl: string;
    eventKey: string;
    signingKey: string;
  };
}

export default (): AppConfig => ({
  // Render (and most PaaS) inject PORT; fall back to API_PORT locally.
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '3002', 10),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3003',
  database: { url: process.env.DATABASE_URL ?? '' },
  inngest: {
    // In dev we talk to the local Inngest dev server; no keys needed.
    dev: process.env.INNGEST_DEV === '1' || process.env.NODE_ENV !== 'production',
    baseUrl: process.env.INNGEST_BASE_URL ?? 'http://localhost:8288',
    eventKey: process.env.INNGEST_EVENT_KEY ?? '',
    signingKey: process.env.INNGEST_SIGNING_KEY ?? '',
  },
});
