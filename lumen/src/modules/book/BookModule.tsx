import { StubModulePlaceholder } from '../../components/StubModulePlaceholder';

export function BookModule() {
  return (
    <StubModulePlaceholder
      icon="📖"
      name="Módulo Libro (Book)"
      description="Maquetación editorial de fotolibros en alta resolución, plantillas de pliegos y exportación PDF directa para imprenta."
      requirements="Motor de composición PDF y gestión tipográfica en Rust."
    />
  );
}
