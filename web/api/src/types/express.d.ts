declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        plan: "FREE" | "STARTER" | "PLUS" | "PRO" | "BUSINESS";
        role: "USER" | "ADMIN";
        orgRole: "OWNER" | "ADMIN" | "MEMBER";
        organizationId: string | null;
      };
    }
  }
}

export {};
