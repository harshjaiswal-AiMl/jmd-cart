import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/lib/prisma';

describe('Party Import Migration Verification', () => {
  it('imported all 1660 parties with accurate classification', async () => {
    const totalParties = await prisma.party.count();
    expect(totalParties).toBeGreaterThanOrEqual(1660);

    const aaTraders = await prisma.party.findFirst({
      where: { name: 'A A Traders' },
    });
    expect(aaTraders).not.toBeNull();
    expect(aaTraders?.type).toBe('WHOLESALER');
    expect(aaTraders?.phone).toBe('7004676252');
    expect(aaTraders?.address).toBe('Simri Bakhtiyarpur');

    const anCosmetic = await prisma.party.findFirst({
      where: { name: 'A N Cosmetic Shringar' },
    });
    expect(anCosmetic).not.toBeNull();
    expect(anCosmetic?.type).toBe('RETAILER');
    expect(anCosmetic?.phone).toBe('8405958574');
    expect(anCosmetic?.address).toBe('Panchwati Chawk');

    const akSharaf = await prisma.party.findFirst({
      where: { name: 'A K Sharaf' },
    });
    expect(akSharaf).not.toBeNull();
    expect(akSharaf?.type).toBe('CUSTOMER');
    expect(akSharaf?.phone).toBe('9798445390');
    expect(akSharaf?.address).toBe('Salkhua');

    const zamil = await prisma.party.findFirst({
      where: { name: 'Zamil' },
    });
    expect(zamil).not.toBeNull();
    expect(zamil?.address).toBe('Nado');
  });
});
