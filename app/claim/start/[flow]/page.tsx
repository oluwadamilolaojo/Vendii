"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDraft } from "@/lib/draft";
import type { FlowType } from "@/lib/domain/types";

/** Entry point from the landing page. Resumes an unfinished draft of the same kind, otherwise starts clean. */
export default function StartClaim({ params }: { params: { flow: string } }) {
  const { draft, ready, reset } = useDraft();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const flow: FlowType = params.flow === "estate" ? "estate" : "own";
    if (draft.flowType !== flow || draft.filedIds.length > 0) reset(flow);
    router.replace("/claim/name");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return <div className="center-note"><span className="spin" /></div>;
}
