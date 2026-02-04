import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

type SSEEventHandler = (data: any) => void;

interface UseSSEOptions {
  onOrderCreated?: SSEEventHandler;
  onOrdersCreated?: SSEEventHandler;
  onOrderUpdated?: SSEEventHandler;
  onOrdersDeleted?: SSEEventHandler;
  onConnected?: () => void;
  onError?: (error: Event) => void;
}

export function useSSE(options: UseSSEOptions = {}, enabled: boolean = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  const enabledRef = useRef(enabled);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const { user } = useAuth();

  optionsRef.current = options;
  enabledRef.current = enabled;

  const getReconnectDelay = useCallback(() => {
    const baseDelay = 2000;
    const maxDelay = 30000;
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), maxDelay) + jitter;
  }, []);

  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource("/api/events", { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", (event) => {
      console.log("SSE connected");
      reconnectAttempts.current = 0;
      optionsRef.current.onConnected?.();
    });

    eventSource.addEventListener("heartbeat", () => {
    });

    eventSource.addEventListener("order-created", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-created", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      
      optionsRef.current.onOrderCreated?.(data);
    });

    eventSource.addEventListener("orders-created", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: orders-created", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      
      optionsRef.current.onOrdersCreated?.(data);
    });

    eventSource.addEventListener("order-updated", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-updated", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      
      optionsRef.current.onOrderUpdated?.(data);
    });

    eventSource.addEventListener("orders-deleted", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: orders-deleted", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      
      optionsRef.current.onOrdersDeleted?.(data);
    });

    eventSource.addEventListener("order-adjusted", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-adjusted", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    });

    eventSource.addEventListener("alternate-shipment", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: alternate-shipment", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    });

    eventSource.addEventListener("order-restored", (event) => {
      const data = JSON.parse(event.data);
      console.log("SSE: order-restored", data);
      
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSourceRef.current = null;
        optionsRef.current.onError?.(error);
        
        if (reconnectAttempts.current < maxReconnectAttempts && enabledRef.current) {
          reconnectAttempts.current++;
          const delay = getReconnectDelay();
          console.log(`SSE reconnecting in ${Math.round(delay/1000)}s (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabledRef.current) {
              connect();
            }
          }, delay);
        }
      }
    };
  }, [getReconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttempts.current = 0;
  }, []);

  useEffect(() => {
    // Only connect if enabled AND user is authenticated
    if (enabled && user) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled, user]);

  return { connect, disconnect };
}
