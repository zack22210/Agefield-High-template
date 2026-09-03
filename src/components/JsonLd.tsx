type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  context?: {locale?: string; category?: string; slug?: string; route?: string};
};

export function JsonLd({data, context}: JsonLdProps) {
  let serialized: string;
  try {
    serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const fields = [
      'stage=serialize-json-ld',
      context?.locale ? `locale=${context.locale}` : '',
      context?.category ? `category=${context.category}` : '',
      context?.slug ? `slug=${context.slug}` : '',
      context?.route ? `route=${context.route}` : ''
    ].filter(Boolean).join(' ');
    throw new Error(`[json-ld] ${fields}: ${detail.slice(0, 400)}`);
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{__html: serialized}}
    />
  );
}
