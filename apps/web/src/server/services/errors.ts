/** Erreur métier dont le message peut être affiché tel quel à l'utilisateur. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "forbidden" | "limit_reached" | "invalid_input",
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}
