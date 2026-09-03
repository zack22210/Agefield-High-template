import {LegalPage} from '@/components/LegalPage';
import {getLegalCopy, getLegalMetadata} from '@/lib/legal';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return getLegalMetadata('privacy', '/privacy-policy', locale);
}

export default async function PrivacyPolicyPage({params}: Props) {
  const {locale} = await params;
  return <LegalPage {...await getLegalCopy('privacy', locale)} />;
}
