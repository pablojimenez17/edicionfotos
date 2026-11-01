import { StubModulePlaceholder } from '../../components/StubModulePlaceholder';

export function MapModule() {
  return (
    <StubModulePlaceholder
      icon="🗺️"
      name="Módulo Mapa (Geolocalización)"
      description="Visualización y geolocalización de fotografías con coordenadas GPS EXIF, agrupación dinámica de chinchetas y descarga de teselas locales."
      requirements="Servidor de teselas cartográficas offline o clave de API cartográfica."
    />
  );
}
