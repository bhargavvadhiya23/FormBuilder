'use client';
import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

// This page is no longer used — versions are hidden from UI (Google Forms style)
// Redirect to the form's edit page
export default function VersionsRedirectPage({ params }) {
  const { formId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/forms/${formId}/edit`);
  }, [formId, router]);
  return null;
}
