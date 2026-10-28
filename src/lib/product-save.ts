export type ProductSaveProgress = { photo: File | null; path: string | null; uploaded: boolean };
type Result = { error: { message: string } | null };
type ImageDependencies = {
  upload: (path: string, file: File) => PromiseLike<Result>;
  record: (path: string) => PromiseLike<Result>;
  recorded: (path: string) => PromiseLike<Result & { found: boolean }>;
  remove: (path: string) => PromiseLike<Result>;
  makePath: () => string;
};

/** Retry a successful upload's metadata write without uploading another object. */
export async function saveProductImage(
  progress: ProductSaveProgress,
  photo: File,
  deps: ImageDependencies,
) {
  if (progress.photo !== photo) {
    if (progress.uploaded && progress.path) {
      const removed = await deps.remove(progress.path);
      if (removed.error) throw new Error('Önceki görsel temizlenemedi. Tekrar deneyin.');
    }
    progress.photo = photo;
    progress.path = deps.makePath();
    progress.uploaded = false;
  }
  const path = progress.path!;
  if (!progress.uploaded) {
    const result = await deps.upload(path, photo);
    if (result.error)
      throw new Error('Ürün kaydedildi ancak fotoğraf yüklenemedi. Tekrar deneyin.');
    progress.uploaded = true;
  }
  const result = await deps.record(path);
  if (result.error) {
    const check = await deps.recorded(path);
    if (check.found && !check.error) return;
    // A lost response may hide a successful write. Never delete its image
    // when verification is also unavailable; retry the same metadata ID.
    if (check.error) throw new Error('Ürün kaydedildi; görsel doğrulanamadı. Tekrar deneyin.');
    const removed = await deps.remove(path);
    if (!removed.error) progress.uploaded = false;
    throw new Error('Ürün kaydedildi ancak görsel kaydı tamamlanamadı. Tekrar deneyin.');
  }
}
