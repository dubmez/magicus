import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_WORKFLOWS, workflowBySlug } from "@/lib/demo-map";
import { WorkflowMap } from "../workflow-map";

export const metadata: Metadata = {
  title: "Map",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return DEMO_WORKFLOWS.map((w) => ({ slug: w.slug }));
}

export default async function WorkflowMapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!workflowBySlug(slug)) notFound();
  return <WorkflowMap slug={slug} />;
}
