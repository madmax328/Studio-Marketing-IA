import { vi } from "vitest";
import type { TextGenerationProvider } from "@/server/ai/types";

/** Fournisseur de texte simulé pour les tests : réponses déterministes, aucun appel réseau. */
export function fakeTextProvider(overrides: Partial<TextGenerationProvider> = {}) {
  const usage = { inputTokens: 10, outputTokens: 10 };
  const generatePosts = vi.fn<TextGenerationProvider["generatePosts"]>(async (input) => ({
    model: "fake-model",
    usage,
    output: {
      posts: [
        ...input.networks.map((network) => ({ network, text: `Texte ${network}`, hashtags: ["test"], rationale: "Rôle." })),
        // Réseau non demandé : doit être ignoré.
        { network: "pinterest" as const, text: "Hors sujet", hashtags: [], rationale: "" },
      ],
      missingInformation: ["Prix"],
    },
  }));
  const generateCampaignStrategy = vi.fn<TextGenerationProvider["generateCampaignStrategy"]>(async (input) => ({
    model: "fake-model",
    usage,
    output: {
      summary: "Stratégie de test.",
      keyMessages: ["Fait maison"],
      slots: input.slots.map((slot) => ({ index: slot.index, theme: `Sujet ${slot.index}`, kind: "conseil" as const, role: "Rôle." })),
      missingInformation: [],
    },
  }));
  const generateCampaignPosts = vi.fn<TextGenerationProvider["generateCampaignPosts"]>(async (input) => ({
    model: "fake-model",
    usage,
    output: {
      posts: input.slots.flatMap((slot) =>
        input.networks.map((network) => ({ slotIndex: slot.index, network, text: `${slot.theme} sur ${network}`, hashtags: [], rationale: slot.role })),
      ),
      missingInformation: [],
    },
  }));
  const provider: TextGenerationProvider = {
    id: "fake",
    label: "Fake",
    dataProcessor: "Test",
    isConfigured: () => true,
    generatePosts,
    generateCampaignStrategy,
    generateCampaignPosts,
    ...overrides,
  };
  return { provider, generatePosts, generateCampaignStrategy, generateCampaignPosts };
}
