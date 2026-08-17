import { redirect } from 'next/navigation';

function toQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
}

export default async function Home({ searchParams }: PageProps<'/'>) {
  const query = toQueryString(await searchParams);
  redirect(query === '' ? '/plan' : `/plan?${query}`);
}
