import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RoomsSlugPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/room/${slug}`);
}
