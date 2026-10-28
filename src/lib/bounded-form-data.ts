export class BodyLimitError extends Error {}

/** Count the entire multipart stream, including extra fields, before parsing it. */
export async function boundedFormData(request: Request, limit: number): Promise<FormData> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await request.body?.cancel();
    throw new BodyLimitError('Dosya isteği boyut sınırını aşıyor.');
  }
  if (!request.body) throw new Error('Dosya isteği boş.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyLimitError('Dosya isteği boyut sınırını aşıyor.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new Response(bytes, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData();
}
