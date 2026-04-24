import { SUPABASE_URL } from '../lib/supabase';

/**
 * Canonical, publishable URLs for store submission + in-app linking.
 *
 * These are expected to be served from a PUBLIC Supabase Storage bucket named `legal`.
 */
const LEGAL_BUCKET = 'legal';

function publicStorageUrl(objectPath: string) {
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<objectPath>
  return `${SUPABASE_URL}/storage/v1/object/public/${LEGAL_BUCKET}/${objectPath}`;
}

export const PRIVACY_POLICY_URL = publicStorageUrl('privacy.html');
export const TERMS_OF_SERVICE_URL = publicStorageUrl('terms.html');

