import WishlistPublicClient from "@/components/WishlistPublicClient";

export default async function WishlistPublicPage({ params }) {
  const { slug } = await params;
  return <WishlistPublicClient slug={slug} />;
}
