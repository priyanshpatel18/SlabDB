import { HomeGate } from "@/components/home-gate";
import { renderSchemaTags } from "@/lib/seo";

export default function Home() {
  return (
    <>
      {renderSchemaTags({
        name: "Slab",
        description:
          "SQL-native storage for onchain data. Indexes on MagicBlock. Pages on Irys.",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
      })}
      <HomeGate />
    </>
  );
}
