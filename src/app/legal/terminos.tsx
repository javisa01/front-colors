import type { ReactElement } from "react";

import { LegalDocScreen } from "@/components/LegalDocScreen";

/** La ruta de las condiciones de uso. Lo pinta todo `LegalDocScreen`. */
export default function Pantalla(): ReactElement {
  return <LegalDocScreen doc="terms" />;
}
