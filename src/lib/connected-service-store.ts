import { prisma } from './prisma';
import { ServiceType } from '@/types/risk';

function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_URL_NON_POOLING);
}

export async function markServiceConnected(
  userId: string,
  service: Extract<ServiceType, 'slack' | 'gmail'>,
  connectionId: string
) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    return await prisma.connectedService.upsert({
      where: {
        userId_service: {
          userId,
          service,
        },
      },
      update: {
        connectionId,
        status: 'connected',
      },
      create: {
        userId,
        service,
        connectionId,
        status: 'connected',
      },
    });
  } catch (error) {
    console.warn(`Unable to persist connected service state for ${service}.`, error);
    return null;
  }
}

export async function markServiceDisconnected(
  userId: string,
  service: Extract<ServiceType, 'slack' | 'gmail'>,
  connectionId: string = service
) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    return await prisma.connectedService.upsert({
      where: {
        userId_service: {
          userId,
          service,
        },
      },
      update: {
        connectionId,
        status: 'disconnected',
      },
      create: {
        userId,
        service,
        connectionId,
        status: 'disconnected',
      },
    });
  } catch (error) {
    console.warn(`Unable to mark ${service} as disconnected.`, error);
    return null;
  }
}

export async function markServiceTokenObserved(
  userId: string,
  service: Extract<ServiceType, 'slack' | 'gmail'>,
  connectionId: string
) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    return await prisma.connectedService.upsert({
      where: {
        userId_service: {
          userId,
          service,
        },
      },
      update: {
        connectionId,
        status: 'connected',
        lastUsed: new Date(),
      },
      create: {
        userId,
        service,
        connectionId,
        status: 'connected',
        lastUsed: new Date(),
      },
    });
  } catch (error) {
    console.warn(`Unable to persist last observed token time for ${service}.`, error);
    return null;
  }
}

export async function getConnectedServiceSnapshots(userId: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    return await prisma.connectedService.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    console.warn('Unable to query connected service snapshots.', error);
    return [];
  }
}
