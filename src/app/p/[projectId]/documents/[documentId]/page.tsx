"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect old document detail pages to the new unified view
export default function DocumentPageRedirect() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;

  useEffect(() => {
    // Redirect to new unified document view at /p/[projectId]/d/[documentId]
    router.replace(`/p/${projectId}/d/${documentId}`);
  }, [router, projectId, documentId]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
