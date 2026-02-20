import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { providers } from "~/server/db/schema";

const formatProviderName = (provider: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  degree: string | null;
}) => {
  const fullName = [provider.firstName, provider.middleName, provider.lastName]
    .filter(Boolean)
    .join(" ");

  if (!fullName) return "Provider Profile";
  return provider.degree ? `${fullName}, ${provider.degree}` : fullName;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await params;

  const row = await db
    .select({
      firstName: providers.firstName,
      middleName: providers.middleName,
      lastName: providers.lastName,
      degree: providers.degree,
    })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  const provider = row[0];
  if (!provider) {
    return NextResponse.json({ label: "Provider Profile" });
  }

  return NextResponse.json({ label: formatProviderName(provider) });
}
