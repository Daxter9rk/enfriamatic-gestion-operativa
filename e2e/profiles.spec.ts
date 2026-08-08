import { expect, test, type Page } from '@playwright/test';
import { goto, login } from './support';

async function createOperator(
  page: Page,
  currentPassword: string,
  input: { displayName: string; email: string; teamId: string; supervisor?: string },
) {
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await page.getByLabel('Nombre').fill(input.displayName);
  await page.getByLabel('Correo DEV').fill(input.email);
  await page.getByLabel('Equipo', { exact: true }).fill(input.teamId);
  if (input.supervisor) {
    await page.getByLabel('Supervisor directo').selectOption({ label: input.supervisor });
  }
  await page.getByLabel('Contraseña temporal').fill(`Temporal-${input.teamId}-Aa1!`);
  await page.getByLabel('Tu contraseña actual').fill(currentPassword);
  await page.getByLabel('Tu contraseña actual').press('Enter');
  await expect(page.getByText('Usuario creado correctamente.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('row', { name: new RegExp(input.displayName) })).toBeVisible();
}

test.describe('perfiles y controles de acceso', () => {
  test('administrador principal: dashboard, usuarios, configuración y directorios', async ({
    page,
  }, testInfo) => {
    test.slow();
    const account = await login(page, 'primary');
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
    await goto(page, '/usuarios', 'Usuarios y estructura');
    await expect(page.getByRole('row', { name: /Admin Principal EMU/ })).toBeVisible();

    const suffix = `${testInfo.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, '-');
    const displayName = `Supervisor E2E ${suffix}`;
    const subordinateName = `Subordinado E2E ${suffix}`;
    const promotedName = `Promovido E2E ${suffix}`;
    await createOperator(page, account.password, {
      displayName,
      email: `supervisor-${suffix}@emulator.enfriamatic.test`,
      teamId: `team-${suffix}`,
    });
    await createOperator(page, account.password, {
      displayName: subordinateName,
      email: `subordinado-${suffix}@emulator.enfriamatic.test`,
      teamId: `team-${suffix}`,
      supervisor: displayName,
    });
    await createOperator(page, account.password, {
      displayName: promotedName,
      email: `promovido-${suffix}@emulator.enfriamatic.test`,
      teamId: `independiente-${suffix}`,
    });
    await page.getByLabel('Contraseña actual para reautenticación').fill(account.password);
    await page.getByLabel(`Acción para ${promotedName}`).selectOption('promote');
    await expect(page.getByText('Estado actualizado.')).toBeVisible();
    await expect(
      page
        .getByRole('row', { name: new RegExp(promotedName) })
        .locator('td')
        .nth(1),
    ).toHaveText('admin');

    await goto(page, '/clientes', 'Clientes');
    const clientName = `Cliente E2E ${suffix}`;
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page.getByLabel('Nombre').fill(clientName);
    await page.getByLabel('Contacto principal').fill('Contacto E2E');
    await page.getByLabel('Correo').fill(`contacto-${suffix}@clientes.invalid`);
    await page.getByLabel('Teléfono').fill('000-555-0100');
    await page.getByLabel('Teléfono').press('Enter');
    await expect(page.getByText(clientName)).toBeVisible();

    await goto(page, '/instalaciones', 'Instalaciones');
    const siteName = `Instalación E2E ${suffix}`;
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page
      .getByRole('combobox', { name: 'Cliente', exact: true })
      .selectOption({ label: clientName });
    await page.getByLabel('Nombre').fill(siteName);
    await page.getByLabel('Tipo').fill('Sitio de pruebas');
    await page.getByLabel('Dirección').fill('Domicilio ficticio E2E');
    await page.getByLabel('Contacto').fill('Contacto de sitio E2E');
    await page.getByLabel('Contacto').press('Enter');
    await page.getByRole('link', { name: siteName }).click();
    await expect(page.getByRole('heading', { name: siteName })).toBeVisible();

    await goto(page, '/equipos', 'Equipos');
    const equipmentName = `Equipo E2E ${suffix}`;
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page
      .getByRole('combobox', { name: 'Cliente', exact: true })
      .selectOption({ label: clientName });
    await page
      .getByRole('combobox', { name: 'Instalación', exact: true })
      .selectOption({ label: siteName });
    await page.getByLabel('Nombre del equipo').fill(equipmentName);
    await page.getByLabel('Categoría').fill('Compresor');
    await page.getByLabel('Marca').fill('Marca E2E');
    await page.getByLabel('Modelo').fill('Modelo E2E');
    await page.getByLabel('Número de serie').fill(`SERIE-${suffix}`);
    await page.getByLabel('Condición').selectOption('operating');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click({ force: true });
    await page.getByRole('link', { name: equipmentName }).click();
    await expect(page.getByRole('heading', { name: equipmentName })).toBeVisible();

    await goto(page, '/solicitudes/nueva', 'Nueva solicitud operativa');
    await page.getByRole('button', { name: new RegExp(clientName) }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: new RegExp(siteName) }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /Compresor Marca E2E/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Fecha solicitada').fill('2026-08-26');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: new RegExp(subordinateName) }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page
      .getByLabel('Descripción del trabajo')
      .fill('Solicitud integral E2E de administrador.');
    await page.getByRole('button', { name: 'Crear solicitud' }).click();
    await expect(page.getByRole('heading', { name: /SOL-EMU-2026-/ })).toBeVisible();

    await goto(page, '/catalogo', 'Catálogo comercial');
    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page.getByLabel('Código').fill(`E2E-${suffix}`);
    await page.getByLabel('Nombre').fill(`Servicio E2E ${suffix}`);
    await page.getByLabel('Tipo').selectOption('service');
    await page.getByLabel('Categoría').fill('Pruebas');
    await page.getByLabel('Unidad').fill('servicio');
    await page.getByLabel('Precio base').fill('250');
    await page.getByLabel('IVA decimal').fill('0.16');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click({ force: true });
    await expect(page.getByText(`Servicio E2E ${suffix}`)).toBeVisible();

    await goto(page, '/configuracion', 'Configuración');
    await page.getByLabel('Contraseña actual').fill(account.password);
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await expect(page.getByText('Configuración DEV guardada y auditada.')).toBeVisible();

    await goto(page, '/ayuda', 'Centro de ayuda');
    await expect(page.getByText('Manual General EMU')).toBeVisible();
    await expect(page.getByText('Manual Operador EMU')).toBeVisible();
    await expect(page.getByText('Manual Administrador EMU')).toBeVisible();
  });

  test('supervisor: equipo directo, solicitud para subordinado y aislamiento visual', async ({
    page,
  }, testInfo) => {
    await login(page, 'supervisorA');
    await expect(page.getByRole('heading', { name: 'Mi operación' })).toBeVisible();
    await goto(page, '/equipo', 'Mi equipo');
    await expect(page.getByText('Operador A EMU')).toBeVisible();
    await expect(page.getByText('Operador B EMU')).not.toBeVisible();

    await goto(page, '/solicitudes', 'Solicitudes');
    const assignmentFolio = testInfo.project.name.startsWith('mobile')
      ? 'SOL-EMU-2026-00004'
      : 'SOL-EMU-2026-00003';
    const assignment = page.getByLabel(`Asignar ${assignmentFolio}`);
    await expect(assignment.getByRole('option', { name: 'Operador B EMU' })).toHaveCount(0);
    await assignment.selectOption({ label: 'Supervisor A EMU' });
    await expect(page.getByText('Solicitud asignada y auditada.')).toBeVisible();

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
