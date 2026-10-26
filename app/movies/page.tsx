import { catalogue } from "@/lib/provider";
import { UniversalSearch } from "@/components/universal-search";
import { QuerySchema, providerQuery } from "@/lib/catalogue-query";

export const dynamic = "force-dynamic";
export const metadata = { title: "Movies · Universal Search" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = QuerySchema.parse({ sort: "recent", ...(await searchParams) });
  const data = await catalogue(providerQuery(filters, "movie"));
  return <UniversalSearch initial={data} initialFilters={filters} initialKind="movie" />;
}
