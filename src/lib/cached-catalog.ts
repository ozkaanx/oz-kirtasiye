import { cache } from 'react';
import {
  getLiveCategories,
  getLiveProductBySlug,
  getLiveProducts,
} from '@/lib/real-catalog';

/** React request-local cache: shared by layouts, pages and generateMetadata. */
export const getCachedLiveCategories = cache(getLiveCategories);
export const getCachedLiveProducts = cache(getLiveProducts);
export const getCachedLiveProductBySlug = cache(getLiveProductBySlug);
