import {fetchCatalogSuggestions} from '@queries/api/catalog/fetchCatalogSuggestions'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useCatalogSuggestionsQuery = (limit?: number) =>
  useQuery({
    queryKey: queryKeys.catalogSuggestions,
    queryFn: () => fetchCatalogSuggestions('dislike', limit)
  })
