import { notFound, redirect } from "next/navigation";
import { CATEGORY_TAXONOMY, getCategoryBySlug } from "@/lib/categories";

export function generateStaticParams() {
  return CATEGORY_TAXONOMY.map((cat) => ({ slug: cat.slug }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();
  redirect(`/en/campaigns?category=${slug}`);
}
