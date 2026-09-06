"use server";

import { revalidatePath } from "next/cache";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  createClientActionSchema,
  searchClientsActionSchema,
  type CreateClientActionInput,
  type SearchClientsActionInput,
} from "@/features/clients/schemas";
import { createClient, searchClients } from "@/server/services/clients";

export async function createClientAction(input: CreateClientActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = createClientActionSchema.parse(input);
    const client = await createClient(currentUser, data);

    revalidatePath("/appointments/new");
    revalidatePath("/clients");

    return {
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
      },
      alreadyExisted: client.alreadyExisted,
    };
  });
}

export async function searchClientsAction(input: SearchClientsActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = searchClientsActionSchema.parse(input);
    const clients = await searchClients(currentUser, data);

    return {
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name?.trim() || "Cliente sans nom",
        phone: client.phone,
      })),
    };
  });
}
