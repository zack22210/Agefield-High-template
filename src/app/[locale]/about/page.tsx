import {LegalPage} from '@/components/LegalPage';
import {getLegalCopy, getLegalMetadata} from '@/lib/legal';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return getLegalMetadata('about', '/about', locale);
}

export default async function AboutPage() {
  return <LegalPage {...await getLegalCopy('about')} />;
}
