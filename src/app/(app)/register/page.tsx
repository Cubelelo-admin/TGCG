import RegisterPageContent from "./RegisterPageContent";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <RegisterPageContent initialCategoryId={category} />;
}
