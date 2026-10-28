import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absoluteStoreUrl,
  parseSiteUrl,
  seoIndexingAllowed,
  seoDescription,
  safeJsonLd,
} from '../src/lib/seo.ts';

const publicSite = 'https://www.ozkirtasiye.com.tr';

test('canonical site accepts only public HTTPS origins without a path or port', () => {
  assert.equal(parseSiteUrl(publicSite)?.toString(), publicSite + '/');
  assert.equal(parseSiteUrl('  https://shop.example.com/  ')?.toString(), 'https://shop.example.com/');
  for (const bad of [
    null, undefined, '', 'not-a-url', 'http://shop.example.com',
    'https://localhost', 'https://sub.localhost', 'https://127.0.0.1',
    'https://10.0.0.5', 'https://[::1]', 'https://preview.vercel.app',
    'https://vercel.app', 'https://store.local', 'https://store.internal',
    'https://shop.example.com/products', 'https://shop.example.com:8443',
    'https://shop.example.com/?utm_campaign=launch',
    'https://shop.example.com/#section', 'https://user:pass@shop.example.com',
  ]) {
    assert.equal(parseSiteUrl(bad), null, String(bad));
  }
});

test('indexing is an explicit production-only opt-in with an actual canonical domain', () => {
  const ready = {
    siteUrl: publicSite, indexable: 'true',
    nodeEnv: 'production', vercelEnv: 'production',
  };
  assert.equal(seoIndexingAllowed(ready), true);
  assert.equal(seoIndexingAllowed({ ...ready, vercelEnv: undefined }), true);
  assert.equal(seoIndexingAllowed({ ...ready, indexable: 'false' }), false);
  assert.equal(seoIndexingAllowed({ ...ready, indexable: undefined }), false);
  assert.equal(seoIndexingAllowed({ ...ready, siteUrl: undefined }), false);
  assert.equal(seoIndexingAllowed({ ...ready, siteUrl: 'https://site.vercel.app' }), false);
  assert.equal(seoIndexingAllowed({ ...ready, nodeEnv: 'development' }), false);
  assert.equal(seoIndexingAllowed({ ...ready, vercelEnv: 'preview' }), false);
  assert.equal(seoIndexingAllowed({ ...ready, vercelEnv: 'development' }), false);
});

test('absolute canonical paths never use untrusted request host values', () => {
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = publicSite;
    assert.equal(absoluteStoreUrl('/'), publicSite + '/');
    assert.equal(absoluteStoreUrl('/urunler'), publicSite + '/urunler');
    assert.equal(absoluteStoreUrl('/urunler?category=kalem'), publicSite + '/urunler?category=kalem');
    process.env.SITE_URL = 'https://preview.vercel.app';
    assert.equal(absoluteStoreUrl('/urunler'), null);
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});

test('SEO descriptions and JSON-LD are bounded and safe to embed', () => {
  assert.equal(seoDescription('  İki  kelime  '), 'İki kelime');
  assert.ok(seoDescription('x'.repeat(190)).length <= 155);
  const json = safeJsonLd({ name: '</script><script>alert(1)</script>' });
  assert.equal(json.includes('<'), false);
  assert.equal(JSON.parse(json).name, '</script><script>alert(1)</script>');
});
