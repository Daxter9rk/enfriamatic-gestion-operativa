import { expect, test } from '@playwright/test';
import { goto, login } from './support';

test('operador: solicitud, cotización, PDF, revisión y ayuda privada', async ({
  page,
}, testInfo) => {
  await login(page, 'operatorA');
  await goto(page, '/solicitudes', 'Mis solicitudes');
  const variant = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  const requestFolio = variant === 'mobile' ? 'SOL-EMU-2026-00004' : 'SOL-EMU-2026-00003';
  await expect(page.getByText(requestFolio)).toBeVisible();
  await expect(page.getByText('SOL-EMU-2026-00002')).not.toBeVisible();
  await goto(page, `/solicitudes/request-${variant}`, requestFolio);
  await page.getByRole('button', { name: 'Iniciar diagnóstico' }).click();
  await expect(page.getByText('Solicitud actualizada.')).toBeVisible();
  const evidenceName = `evidencia-${variant}.png`;
  await page.locator('input[type="file"]').setInputFiles({
    name: evidenceName,
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByText(evidenceName)).toBeVisible();

  await goto(page, `/cotizaciones/quote-${variant}`, 'Cotización en borrador');
  const quoteRows = page.locator('table tbody tr');
  const initialRowCount = await quoteRows.count();
  await page.getByRole('button', { name: /Diagnóstico EMU/ }).click();
  await expect(quoteRows).toHaveCount(initialRowCount + 1);
  await page.getByLabel('Concepto').fill(`Partida personalizada ${variant}`);
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel('Precio unitario').fill('100');
  await page.getByLabel('Descuento %').fill('10');
  await page.getByRole('button', { name: 'Agregar partida' }).click();
  await expect(page.getByText(`Partida personalizada ${variant}`)).toBeVisible();
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page.getByText('Vista previa económica')).toBeVisible();
  await page.getByRole('button', { name: 'Emitir y generar PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Cotización emitida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir PDF privado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar partida' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Crear nueva revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Cotización en borrador' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(`Partida personalizada ${variant}`)).toBeVisible();

  await goto(page, '/ayuda', 'Centro de ayuda');
  await expect(page.getByText('Manual General EMU')).toBeVisible();
  await expect(page.getByText('Manual Operador EMU')).toBeVisible();
  await expect(page.getByText('Manual Administrador EMU')).not.toBeVisible();
  await goto(page, '/configuracion', 'Permiso insuficiente');
});
