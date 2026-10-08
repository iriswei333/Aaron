import { createDiscoverClient } from '@sproutcue/shared/discover-client';
import { apiRequest } from '../shared.js';

export { createDiscoverClient };
export const { loadDiscover, loadPlaydatesForPlaygrounds } = createDiscoverClient(apiRequest);
