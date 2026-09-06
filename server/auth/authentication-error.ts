export class AuthenticationRequiredError extends Error {
  constructor(
    message = "Vous devez être connecté pour effectuer cette action.",
  ) {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}
