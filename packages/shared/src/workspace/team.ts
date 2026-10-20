import { z } from "zod";
import { INVITABLE_ROLES } from "./roles";

/** Invitation d'une personne dans l'espace (validée côté serveur). */
export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Adresse e-mail invalide.")),
  role: z.enum(INVITABLE_ROLES, "Rôle invalide."),
});
export type InvitationInput = z.infer<typeof invitationSchema>;

/** Nom d'un espace client (agences). */
export const clientSpaceSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à l'espace (2 caractères au moins).").max(80, "Nom trop long (80 caractères au plus)."),
});

/** Remarque laissée en refusant une publication. */
export const approvalCommentSchema = z.string().trim().max(500, "Remarque trop longue (500 caractères au plus).");

/** Durée de validité d'une invitation. */
export const INVITATION_TTL_DAYS = 7;
