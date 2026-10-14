import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 10 minutes : les données sont considérées comme fraîches assez longtemps
      staleTime: 1000 * 60 * 10,
      // 30 jours : garde les données en cache (AsyncStorage)
      gcTime: 1000 * 60 * 60 * 24 * 30,
      retry: 2,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'PROUT_QUERY_CACHE',
});

persistQueryClient({
  queryClient: queryClient as any,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
});
