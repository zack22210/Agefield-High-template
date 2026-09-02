import {LegalPage} from '@/components/LegalPage';
import {getLegalCopy, getLegalMetadata} from '@/lib/legal';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return getLegalMetadata('terms', '/terms-of-service', locale);
}

export default async function TermsOfServicePage() {
  return <LegalPage {...await getLegalCopy('terms')} />;
}
