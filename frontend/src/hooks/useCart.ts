import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { commerceService } from '@/services/commerce'
import { useAuth } from '@/hooks/useAuth'

export function useCart() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: commerceService.cart,
    enabled: isAuthenticated,
  })

  const add = useMutation({
    mutationFn: ({ productId, quantity }: { productId: number; quantity?: number }) =>
      commerceService.addItem(productId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['cart-quote'] })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => commerceService.updateItem(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['cart-quote'] })
    },
  })

  const remove = useMutation({
    mutationFn: commerceService.removeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['cart-quote'] })
    },
  })

  const count = cartQuery.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return { ...cartQuery, add, update, remove, count }
}
