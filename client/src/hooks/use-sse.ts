import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

type SSEEventHandler = (data: any) => void;

interface UseSSEOptions {
  onOrderCreated?: SSEEventHandler;
  onOrdersCreated?: SSEEventHandler;
  onOrderUpdated?: SSEEventHandler;
  onOrdersDeleted?: SSEEventHandler;
  onConnected?: () => void;
  onError?: (error: Event) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);

  optionsRef.current = options;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource("/api/events", { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      console.log("SSE connected");
      optionsRef.current.onConnected?.();
    });

    eventSource.addEventListener("heartbeat", () => {
      // Keep-alive heartbeat, no action needed
    });

    eventSource.addEventListener("order-created", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-created", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      
      optionsRef.current.onOrderCreated?.(data);
    });

    eventSource.addEventListener("orders-created", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: orders-created", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      
      optionsRef.current.onOrdersCreated?.(data);
    });

    eventSource.addEventListener("order-updated", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-updated", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      
      optionsRef.current.onOrderUpdated?.(data);
    });

    eventSource.addEventListener("orders-deleted", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: orders-deleted", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      
      optionsRef.current.onOrdersDeleted?.(data);
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
      optionsRef.current.onError?.(error);
      
      // Reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("SSE reconnecting...");
        connect();
      }, 5000);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connect, disconnect };
}
