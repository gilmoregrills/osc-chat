declare module 'osc' {
  // Add more specific types if known, otherwise 'any' allows for usage
  // For example, if UDPPort and WebSocketPort are classes:
  export class UDPPort {
    constructor(options: any);
    on(event: string, callback: (...args: any[]) => void): void;
    open(): void;
    close(): void;
    send(packet: any, address?: string, port?: number): void;
    options: any; // Add known properties
    removeListener(event: string, callback: (...args: any[]) => void): void; // Added removeListener
  }

  export class WebSocketPort {
    constructor(options: any);
    on(event: string, callback: (...args: any[]) => void): void;
    send(packet: any): void;
    close(): void;
  }

  // Add other exports from 'osc' if used, like 'TCPSocketPort', etc.
  // If the internal structure is unknown or too complex for now,
  // a simpler declaration would be:
  // const osc: any;
  // export default osc;
}
