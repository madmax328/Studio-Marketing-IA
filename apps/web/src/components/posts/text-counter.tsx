import { SOCIAL_NETWORKS, type SocialNetworkId } from "@smia/shared";

/** Compteur de caractères par rapport à la limite du réseau. */
export function TextCounter({ network, length }: { network: SocialNetworkId; length: number }) {
  const max = SOCIAL_NETWORKS[network].maxTextLength;
  const over = length > max;
  return (
    <p className={over ? "text-xs font-medium text-danger" : "text-xs text-muted"} aria-live="polite">
      {length} / {max} caractères{over ? " : trop long pour ce réseau" : ""}
    </p>
  );
}
