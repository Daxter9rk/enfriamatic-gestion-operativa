import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

export type Persona = 'primary' | 'supervisorA' | 'operatorA';

interface CredentialsFile {
  projectId: string;
  users: Record<Persona, { email: string; password: string }>;
}

export async function credential(persona: Persona) {
  const parsed = JSON.parse(
    await readFile(resolve('.credentials', 'emulator-users.local.json'), 'utf8'),
  ) as CredentialsFile;
  expect(parsed.projectId).toBe('enfriamatic-operativa-dev');
  return parsed.users[persona];
}

export async function login(page: Page, persona: Persona) {
  const account = await credential(persona);
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Entrar a Gestión Operativa' }).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  return account;
}

export async function goto(page: Page, path: string, heading: RegExp | string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
}
