import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { usePartnerAuth } from "@/lib/partner-auth";

export function usePartnerSSE(enabled: boolean = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const { vendor } = usePartnerAuth();

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

    const eventSource = new EventSource("/api/partner/events", { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      console.log("Partner SSE connected");
      reconnectAttempts.current = 0;
    });

    eventSource.addEventListener("heartbeat", () => {});

    eventSource.addEventListener("allocation-updated", (event) => {
      const data = JSON.parse(event.data);
      console.log("Partner SSE: allocation-updated", data);
      queryClient.invalidateQueries({ queryKey: ["/api/partner/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
    });

    eventSource.addEventListener("partner-orders-updated", (event) => {
      const data = JSON.parse(event.data);
      console.log("Partner SSE: partner-orders-updated", data);
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery/summary"] });
    });

    eventSource.addEventListener("pending-orders-updated", (event) => {
      const data = JSON.parse(event.data);
      console.log("Partner SSE: pending-orders-updated", data);
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery/summary"] });
    });

    eventSource.onerror = (error) => {
      console.error("Partner SSE error:", error);

      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSourceRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts && enabledRef.current) {
          reconnectAttempts.current++;
          const delay = getReconnectDelay();
          console.log(`Partner SSE reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);

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
    if (enabled && vendor) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled, vendor]);

  return { connect, disconnect };
}
