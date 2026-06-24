import { PublicFormEmbed } from '../../../components/cms/public-form-embed';

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <PublicFormEmbed slug={slug} />
    </main>
  );
}
