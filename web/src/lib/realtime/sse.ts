// ==========================================
// SSE (SERVER-SENT EVENTS) REAL-TIME MANAGER
// ==========================================

export class SSEClient {
  private static eventSource: EventSource | null = null;
  private static listeners: Map<string, Set<(data: any) => void>> = new Map();

  public static connect(url: string = '/api/realtime/stream') {
    if (this.eventSource) return;

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;
        if (this.listeners.has(type)) {
          this.listeners.get(type)!.forEach((cb) => cb(data));
        }
      } catch (e) {
        // ignore malformed JSON
      }
    };

    this.eventSource.onerror = () => {
      console.warn('[SSE] Connection error. Reconnecting...');
    };
  }

  public static subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  public static disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
