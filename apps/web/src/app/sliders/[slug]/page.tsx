import { PublicSliderEmbed } from '../../../components/cms/public-slider-embed';

export default async function PublicSliderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <PublicSliderEmbed slug={slug} />
    </main>
  );
}
