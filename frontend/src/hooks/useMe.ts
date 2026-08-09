import { useQuery } from '@tanstack/react-query'

import { getMe } from '../lib/client'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
