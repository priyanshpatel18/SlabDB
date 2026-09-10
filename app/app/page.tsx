import { HomeGate } from "@/components/home-gate";
import { renderSchemaTags } from "@/lib/seo";

export default function Home() {
  return (
    <>
      {renderSchemaTags({
        name: "Slab",
        description:
          "Onchain GitHub. Profiles, repos, and README on MagicBlock and Irys.",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
      })}
      <HomeGate />
    </>
  );
}
