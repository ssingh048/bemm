import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse as JSON first
      const errorData = await res.json();
      const error = new Error(errorData.message || `${res.status}: ${res.statusText}`);
      (error as any).status = res.status;
      (error as any).response = { status: res.status, data: errorData };
      throw error;
    } catch (parseError) {
      // If JSON parsing fails, use text or statusText
      const text = await res.text().catch(() => res.statusText);
      const error = new Error(`${res.status}: ${text}`);
      (error as any).status = res.status;
      throw error;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const headers: Record<string, string> = {};
    let body: any = undefined;
    
    // Handle FormData differently than JSON
    if (data) {
      if (data instanceof FormData) {
        // Don't set Content-Type for FormData, browser will set it with boundary
        body = data;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(data);
      }
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body,
      credentials: "include", // Important for cookies
    });

    if (!res.ok) {
      await throwIfResNotOk(res);
    }
    
    return res;
  } catch (error) {
    console.error(`API request error (${method} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        const error = new Error(errorData.message || 'API request failed');
        (error as any).status = res.status;
        (error as any).response = { status: res.status, data: errorData };
        throw error;
      }
      
      return await res.json();
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
