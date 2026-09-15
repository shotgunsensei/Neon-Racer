import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { HighScore, InsertHighScore } from "@shared/schema";

// Log Zod errors for easier debugging
function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useScores() {
  return useQuery({
    queryKey: [api.scores.list.path],
    queryFn: async () => {
      const res = await fetch(api.scores.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scores");
      const data = await res.json();
      return parseWithLogging<HighScore[]>(api.scores.list.responses[200], data, "scores.list");
    },
  });
}

export function useCreateScore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertHighScore) => {
      // Validate request payload using schema
      const validated = api.scores.create.input.parse(data);
      
      const res = await fetch(api.scores.create.path, {
        method: api.scores.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Invalid score data");
        }
        throw new Error("Failed to create score");
      }
      
      const responseData = await res.json();
      return parseWithLogging(api.scores.create.responses[201], responseData, "scores.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scores.list.path] });
    },
  });
}
