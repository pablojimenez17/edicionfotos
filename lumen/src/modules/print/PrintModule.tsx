import { StubModulePlaceholder } from '../../components/StubModulePlaceholder';

export function PrintModule() {
  return (
    <StubModulePlaceholder
      icon="🖨️"
      name="Módulo Impresión (Print)"
      description="Preparación de pliegos de impresión, perfiles de papel ICC de laboratorio, marcas de corte y resolución exacta por pulgada (DPI)."
      requirements="Controladores de impresión OS nativos y soft-proofing."
    />
  );
}
