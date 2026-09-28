import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      authVersion?: number;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    authVersion?: number;
  }
}
