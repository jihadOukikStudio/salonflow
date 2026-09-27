import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { ManagerCommandError, type ManagerPrompts } from "./manager-command";

export function createManagerPrompts(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): ManagerPrompts {
  if (!input.isTTY || !output.isTTY) {
    throw new ManagerCommandError(
      "Un terminal interactif est obligatoire ; les entrées redirigées sont refusées.",
    );
  }
  let muted = false;
  let closed = false;
  let pending: ((error: Error) => void) | undefined;
  const sink = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) output.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({
    input,
    output: sink,
    terminal: true,
    historySize: 0,
  });
  rl.on("SIGINT", () => rl.close());
  rl.on("close", () => {
    closed = true;
    pending?.(
      new ManagerCommandError("Saisie interrompue. Aucune création effectuée."),
    );
    pending = undefined;
  });
  return {
    async ask(label, secret = false) {
      if (closed)
        throw new ManagerCommandError(
          "Terminal fermé. Aucune création effectuée.",
        );
      muted = false;
      try {
        return await new Promise<string>((resolve, reject) => {
          pending = reject;
          rl.question(label, (answer) => {
            pending = undefined;
            resolve(answer);
          });
          // readline affiche et redessine lui-même le libellé.
          // Masquer seulement les caractères saisis, après cet affichage.
          muted = secret;
        });
      } finally {
        muted = false;
        if (secret) output.write("\n");
      }
    },
    write(message) {
      output.write(`${message}\n`);
    },
    close() {
      rl.close();
      sink.end();
    },
  };
}
