import { createContext, useContext, type ReactNode } from "react";

/**
 * Vista en solo lectura (visitante de un viaje). Dentro de ella Button e IconButton no se
 * renderizan: en la vista de un viaje todos los botones son acciones de edición. Para otros
 * controles de edición, envolverlos en <Editable>.
 */
export const ReadOnlyContext = createContext(false);

export const useReadOnly = () => useContext(ReadOnlyContext);

export function Editable({ children }: { children: ReactNode }) {
  return useReadOnly() ? null : <>{children}</>;
}
