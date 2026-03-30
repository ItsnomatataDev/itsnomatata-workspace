import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getClients,
  getMyClients,
  type Client,
} from "../supabase/queries/clients";
import {
  createClient as createClientMutation,
  updateClient as updateClientMutation,
  deleteClient as deleteClientMutation,
  type CreateClientInput,
  type UpdateClientInput,
} from "../supabase/mutations/clients";

export const useClients = ({
  userId,
  organizationId,
}: {
  userId?: string;
  organizationId?: string | null;
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [myClients, setMyClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const fetchClients = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setError("Missing organization id.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [allClients, assignedClients] = await Promise.all([
        getClients(organizationId),
        userId ? getMyClients(userId, organizationId) : Promise.resolve([]),
      ]);

      setClients(allClients);
      setMyClients(assignedClients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  }, [userId, organizationId]);

  const createClient = async (payload: CreateClientInput) => {
    const created = await createClientMutation(payload);
    setClients((prev) => [created, ...prev]);
    return created;
  };

  const updateClient = async (clientId: string, payload: UpdateClientInput) => {
    const updated = await updateClientMutation(clientId, payload);
    setClients((prev) =>
      prev.map((item) => (item.id === clientId ? updated : item)),
    );
    setMyClients((prev) =>
      prev.map((item) => (item.id === clientId ? updated : item)),
    );
    return updated;
  };

  const deleteClient = async (clientId: string) => {
    await deleteClientMutation(clientId);
    setClients((prev) => prev.filter((item) => item.id !== clientId));
    setMyClients((prev) => prev.filter((item) => item.id !== clientId));
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const stats = useMemo(() => {
    return {
      totalClients: clients.length,
      myClients: myClients.length,
      activeClients: clients.filter((client) => client.status === "active")
        .length,
      pausedClients: clients.filter((client) => client.status === "paused")
        .length,
    };
  }, [clients, myClients]);

  return {
    clients,
    myClients,
    stats,
    loading,
    error,
    refetch: fetchClients,
    createClient,
    updateClient,
    deleteClient,
  };
};
