import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleMainItemAction } from "../server/main.actions";
import { mainQueries } from "./main.queries";

export function useToggleMainItem() {
  const queryClient = useQueryClient();
  const { queryKey } = mainQueries.items();

  return useMutation({
    // mutationFn의 두 번째 인자(QueryClient 포함)는 직렬화할 수 없으므로 Server Action에 그대로 넘기지 않는다.
    mutationFn: (id: string) => toggleMainItemAction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (items) =>
        items?.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
