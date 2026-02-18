export type AppRole = "superadmin" | "admin" | "user";

const allowedDomains = ["vestasolutions.com", "vestatelemed.com"] as const;

export const isAllowedEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;

  const [, domain = ""] = email.toLowerCase().split("@");
  return allowedDomains.includes(domain as (typeof allowedDomains)[number]);
};

export const getAppRole = (params: {
  agentRole: string | null | undefined;
}): AppRole => {
  const normalizedRole = params.agentRole?.trim().toLowerCase();

  if (normalizedRole === "superadmin") return "superadmin";
  if (normalizedRole === "admin") return "admin";

  return "user";
};
