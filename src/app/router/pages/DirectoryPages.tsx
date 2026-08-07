import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { decodeDirectoryRecord } from '../../../domain/firestore-validation';
import { DirectoryCrudPage, type DirectoryItem } from './directory/DirectoryCrudPage';

export function ClientsPage() {
  return (
    <DirectoryCrudPage
      title="Clientes"
      description="Contactos, datos disponibles e historial operativo."
      collectionName="clients"
      columns={[
        { key: 'name', label: 'Cliente' },
        { key: 'contactName', label: 'Contacto' },
        { key: 'email', label: 'Correo' },
        { key: 'phone', label: 'Teléfono' },
      ]}
      fields={[
        { key: 'name', label: 'Nombre', required: true },
        { key: 'contactName', label: 'Contacto principal', required: true },
        { key: 'email', label: 'Correo', type: 'email', required: true },
        { key: 'phone', label: 'Teléfono', required: true },
        { key: 'taxId', label: 'Identificador fiscal disponible' },
      ]}
    />
  );
}

export function SitesPage() {
  const clients = useCollectionData<DirectoryItem>('clients', decodeDirectoryRecord);
  return (
    <DirectoryCrudPage
      title="Instalaciones"
      description="Ubicaciones, contactos, acceso y equipos relacionados."
      collectionName="sites"
      columns={[
        { key: 'name', label: 'Instalación' },
        { key: 'type', label: 'Tipo' },
        { key: 'address', label: 'Dirección' },
        { key: 'contactName', label: 'Contacto' },
      ]}
      fields={[
        {
          key: 'clientId',
          label: 'Cliente',
          type: 'select',
          required: true,
          options: clients.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        { key: 'name', label: 'Nombre', required: true },
        { key: 'type', label: 'Tipo', required: true },
        { key: 'address', label: 'Dirección', required: true },
        { key: 'contactName', label: 'Contacto', required: true },
        { key: 'accessNotes', label: 'Referencias de acceso', type: 'textarea' },
        { key: 'mapUrl', label: 'Enlace seguro a mapa' },
      ]}
    />
  );
}

export function EquipmentPage() {
  const clients = useCollectionData<DirectoryItem>('clients', decodeDirectoryRecord);
  const sites = useCollectionData<DirectoryItem>('sites', decodeDirectoryRecord);
  return (
    <DirectoryCrudPage
      title="Equipos"
      description="Expedientes técnicos vinculados a clientes e instalaciones."
      collectionName="equipment"
      detailsPath="/equipos"
      columns={[
        { key: 'name', label: 'Equipo' },
        { key: 'category', label: 'Categoría' },
        { key: 'brand', label: 'Marca' },
        { key: 'model', label: 'Modelo' },
        { key: 'status', label: 'Condición' },
      ]}
      fields={[
        {
          key: 'clientId',
          label: 'Cliente',
          type: 'select',
          required: true,
          options: clients.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        {
          key: 'siteId',
          label: 'Instalación',
          type: 'select',
          required: true,
          options: sites.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        { key: 'name', label: 'Nombre del equipo', required: true },
        { key: 'category', label: 'Categoría', required: true },
        { key: 'brand', label: 'Marca', required: true },
        { key: 'model', label: 'Modelo', required: true },
        { key: 'serialNumber', label: 'Número de serie', required: true },
        { key: 'capacity', label: 'Capacidad' },
        { key: 'refrigerant', label: 'Refrigerante' },
        {
          key: 'status',
          label: 'Condición',
          type: 'select',
          required: true,
          options: [
            { value: 'operating', label: 'Operando' },
            { value: 'maintenance', label: 'En mantenimiento' },
            { value: 'inactive', label: 'Inactivo' },
          ],
        },
      ]}
    />
  );
}

export function CatalogPage() {
  return (
    <DirectoryCrudPage
      title="Catálogo comercial"
      description="Productos y servicios disponibles para cotizar. Sin inventario ni compras."
      collectionName="catalogItems"
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Concepto' },
        { key: 'category', label: 'Categoría' },
        { key: 'unit', label: 'Unidad' },
        { key: 'basePrice', label: 'Precio base' },
      ]}
      fields={[
        { key: 'code', label: 'Código', required: true },
        { key: 'name', label: 'Nombre', required: true },
        {
          key: 'type',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { value: 'product', label: 'Producto' },
            { value: 'service', label: 'Servicio' },
          ],
        },
        { key: 'category', label: 'Categoría', required: true },
        { key: 'unit', label: 'Unidad', required: true },
        { key: 'brand', label: 'Marca' },
        { key: 'model', label: 'Modelo' },
        { key: 'basePrice', label: 'Precio base', type: 'number', required: true },
        { key: 'taxRate', label: 'IVA decimal', type: 'number', required: true },
      ]}
    />
  );
}
