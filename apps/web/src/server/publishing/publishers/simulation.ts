import { randomUUID } from "node:crypto";
import { PublishError, type SocialPublisher } from "../types";

/**
 * Connecteur de test : vérifie que la publication est complète et que ses images sont lisibles,
 * puis la marque comme envoyée SANS rien publier. Toujours signalé « simulation » dans l'interface.
 */
export const simulationPublisher: SocialPublisher = {
  provider: "simulation",
  async publish({ media }) {
    for (const item of media) {
      const bytes = await item.read();
      if (bytes.length === 0) throw new PublishError("Une image jointe est vide ou introuvable.", "permanent");
    }
    return { externalId: `simulation-${randomUUID()}`, externalUrl: null, simulated: true };
  },
};
