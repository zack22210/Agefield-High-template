import {LegalPage} from '@/components/LegalPage';
import {getLegalCopy, getLegalMetadata} from '@/lib/legal';
import {setRequestLocale} from 'next-intl/server';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return getLegalMetadata('copyright', '/copyright', locale);
}

export default async function CopyrightPage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <LegalPage {...await getLegalCopy('copyright', locale)} />;
}
