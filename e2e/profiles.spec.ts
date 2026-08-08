import { expect, test } from '@playwright/test';
import { goto, login } from './support';

test.describe('perfiles y controles de acceso', () => {
  test('administrador principal: dashboard, usuarios, configuración y directorios', async ({
    page,
  }, testInfo) => {
    const account = await login(page, 'primary');
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
    await goto(page, '/usuarios', 'Usuarios y estructura');
    await expect(page.getByRole('row', { name: /Admin Principal EMU/ })).toBeVisible();

    const suffix = `${testInfo.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, '-');
    const displayName = `Supervisor E2E ${suffix}`;
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByLabel('Nombre').fill(displayName);
    await page.getByLabel('Correo DEV').fill(`supervisor-${suffix}@emulator.enfriamatic.test`);
    await page.getByLabel('Equipo', { exact: true }).fill(`team-${suffix}`);
    await page.getByLabel('Contraseña temporal').fill(`Temporal-${suffix}-Aa1!`);
    await page.getByLabel('Tu contraseña actual').fill(account.password);
    await page.getByLabel('Tu contraseña actual').press('Enter');
    await expect(page.getByText('Usuario creado correctamente.')).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(displayName) })).toBeVisible();

    await goto(page, '/clientes', 'Clientes');
    const clientName = `Cliente E2E ${suffix}`;
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page.getByLabel('Nombre').fill(clientName);
    await page.getByLabel('Contacto principal').fill('Contacto E2E');
    await page.getByLabel('Correo').fill(`contacto-${suffix}@clientes.invalid`);
    await page.getByLabel('Teléfono').fill('000-555-0100');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    await goto(page, '/catalogo', 'Catálogo comercial');
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page.getByLabel('Código').fill(`E2E-${suffix}`);
    await page.getByLabel('Nombre').fill(`Servicio E2E ${suffix}`);
    await page.getByLabel('Tipo').selectOption('service');
    await page.getByLabel('Categoría').fill('Pruebas');
    await page.getByLabel('Unidad').fill('servicio');
    await page.getByLabel('Precio base').fill('250');
    await page.getByLabel('IVA decimal').fill('0.16');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText(`Servicio E2E ${suffix}`)).toBeVisible();

    await goto(page, '/configuracion', 'Configuración');
    await page.getByLabel('Contraseña actual').fill(account.password);
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await expect(page.getByText('Configuración DEV guardada y auditada.')).toBeVisible();
  });

  test('supervisor: equipo directo, solicitud para subordinado y aislamiento visual', async ({
    page,
  }) => {
    await login(page, 'supervisorA');
    await expect(page.getByRole('heading', { name: 'Mi operación' })).toBeVisible();
    await goto(page, '/equipo', 'Mi equipo');
    await expect(page.getByText('Operador A EMU')).toBeVisible();
    await expect(page.getByText('Operador B EMU')).not.toBeVisible();

    await goto(page, '/solicitudes/nueva', 'Nueva solicitud operativa');
    await page.getByRole('button', { name: /Cliente Ártico EMU/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /Instalación A EMU/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page
      .getByRole('button', { name: /Compresor/ })
      .last()
      .click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Fecha solicitada').fill('2026-08-25');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /Operador A EMU/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page
      .getByLabel('Descripción del trabajo')
      .fill('Solicitud E2E para subordinado directo.');
    await page.getByRole('button', { name: 'Crear solicitud' }).click();
    await expect(page.getByRole('heading', { name: /SOL-EMU-2026-/ })).toBeVisible();

    await goto(page, '/usuarios', 'Permiso insuficiente');
  });
});
