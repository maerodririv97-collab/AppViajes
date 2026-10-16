import { create } from "zustand";

// Contador de versión de datos: cualquier escritura llama a `bump()` y todos los hooks
// de lectura (useQuery) recargan. Evita tener que pasar callbacks de refresco por props.
interface DataState {
  version: number;
  bump: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
