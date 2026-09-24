import type { ReactElement } from "react";

import { LegalDocScreen } from "@/components/LegalDocScreen";

/** La ruta de la política de privacidad. Lo pinta todo `LegalDocScreen`. */
export default function Pantalla(): ReactElement {
  return <LegalDocScreen doc="privacy" />;
}
