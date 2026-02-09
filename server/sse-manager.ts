interface SSEClient {
  id: string;
  res: any;
  userId: string;
  userType: "user" | "member" | "partner";
  vendorId?: number;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);
    console.log(`SSE client connected: ${client.userId} (${client.userType}), total: ${this.clients.size}`);
  }

  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`SSE client disconnected, total: ${this.clients.size}`);
  }

  sendToMember(memberId: string, event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "member" && client.userId === memberId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  sendToAdmins(event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "user") {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  sendToPartner(vendorId: number, event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "partner" && client.vendorId === vendorId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  sendToAllPartners(event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "partner") {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  broadcast(event: string, data: any) {
    this.clients.forEach(client => {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }
}

export const sseManager = new SSEManager();
export type { SSEClient };
