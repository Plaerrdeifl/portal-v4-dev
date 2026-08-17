
declare namespace Deno {
  interface Conn {
    write(data: Uint8Array): Promise<number>;
    read(data: Uint8Array): Promise<number | null>;
    close(): void;
  }
  interface Env {
    get(name: string): string | undefined;
  }
}
declare const Deno: {
  env: Deno.Env;
  connectTls(options: { hostname: string; port: number }): Promise<Deno.Conn>;
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module "npm:web-push@3.6.7" {
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      options?: { TTL?: number; timeout?: number }
    ): Promise<{ headers?: { location?: string } }>;
  };
  export default webpush;
}
