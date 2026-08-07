import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin.js';

export type DueNotificationType = 'due_soon' | 'overdue' | null;

export function classifyDueDate(requestedDate: string, today: string): DueNotificationType {
  const due = Date.parse(`${requestedDate}T12:00:00Z`);
  const current = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(current)) return null;
  const days = Math.round((due - current) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due_soon';
  return null;
}

function dateInMexicoCity(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const createDueNotifications = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'America/Mexico_City',
    region: 'us-central1',
    retryCount: 2,
    maxInstances: 1,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const today = dateInMexicoCity();
    const requests = await db
      .collection('requests')
      .where('status', 'in', ['pending', 'assigned', 'in_progress'])
      .get();
    let created = 0;
    for (const snapshot of requests.docs) {
      const data = snapshot.data();
      const requestedDate = typeof data.requestedDate === 'string' ? data.requestedDate : '';
      const type = classifyDueDate(requestedDate, today);
      if (!type) continue;
      const recipients = new Set<string>();
      if (typeof data.assigneeId === 'string') recipients.add(data.assigneeId);
      if (typeof data.supervisorId === 'string') recipients.add(data.supervisorId);
      if (recipients.size === 0 && typeof data.createdBy === 'string')
        recipients.add(data.createdBy);
      for (const userId of recipients) {
        const notificationRef = db
          .collection('notifications')
          .doc(`${snapshot.id}-${userId}-${type}-${today}`);
        const inserted = await db.runTransaction(async (transaction) => {
          const existing = await transaction.get(notificationRef);
          if (existing.exists) return false;
          transaction.create(notificationRef, {
            id: notificationRef.id,
            userId,
            type,
            title: type === 'overdue' ? 'Solicitud vencida' : 'Solicitud próxima a vencer',
            body: `${String(data.folio ?? snapshot.id)} requiere atención.`,
            resourceType: 'request',
            resourceId: snapshot.id,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          });
          return true;
        });
        if (inserted) created += 1;
      }
    }
    await db.collection('auditLogs').add({
      actorId: 'system',
      actorRole: 'system',
      actorSupervisorId: null,
      actorTeamId: null,
      action: 'notifications.due_generated',
      resource: 'notifications',
      resourceId: today,
      before: null,
      after: { created, scanned: requests.size },
      metadata: { scheduled: true },
      createdAt: Timestamp.now(),
      schemaVersion: 1,
    });
  },
);
