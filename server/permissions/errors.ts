export class PermissionDeniedError extends Error {
  constructor(
    message = "Vous n'avez pas l'autorisation d'effectuer cette action.",
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}
