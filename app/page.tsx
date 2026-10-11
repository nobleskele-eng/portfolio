import Landing from "@/components/Landing";
import { loadAeProjects } from "@/lib/after-effects";

export default function Home() {
  return (
    <main>
      <Landing aeProjects={loadAeProjects()} />
    </main>
  );
}
