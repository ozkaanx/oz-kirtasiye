import { cache } from 'react';
import {
  getLiveCategories,
  getLiveProductBySlug,
} from '@/lib/real-catalog';

/** React request-local cache: shared by layouts, pages and generateMetadata. */
export const getCachedLiveCategories = cache(getLiveCategories);
export const getCachedLiveProductBySlug = cache(getLiveProductBySlug);
