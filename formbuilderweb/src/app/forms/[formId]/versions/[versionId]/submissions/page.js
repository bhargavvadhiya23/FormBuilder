'use client';
import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
export default function Redirect({ params }) {
  const { formId } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/forms/${formId}/responses`); }, [formId, router]);
  return null;
}
