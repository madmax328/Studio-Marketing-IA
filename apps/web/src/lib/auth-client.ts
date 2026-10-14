"use client";

import { createAuthClient } from "better-auth/react";

/** Client d'authentification côté navigateur (aucun secret ici). */
export const authClient = createAuthClient();
