export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message = "La ressource demandée est introuvable.") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}
