import HomeClient from "@/components/HomeClient";
import HomeTitle from "@/components/HomeTitle";

export default function HomePage() {
  return (
    <main
      className="container"
      style={{
        padding: "48px 0",
        display: "grid",
        gap: 20,
        width: "min(96vw, 1560px)",
        maxWidth: "1560px",
        justifyItems: "stretch",
        textAlign: "left",
      }}
    >
      <header style={{ textAlign: "center" }}>
        <HomeTitle />
      </header>
      <HomeClient />
    </main>
  );
}
