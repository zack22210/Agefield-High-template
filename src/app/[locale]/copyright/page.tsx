import {LegalPage} from '@/components/LegalPage';
import {getLegalCopy, getLegalMetadata} from '@/lib/legal';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return getLegalMetadata('copyright', '/copyright', locale);
}

export default async function CopyrightPage() {
  return <LegalPage {...await getLegalCopy('copyright')} />;
}
