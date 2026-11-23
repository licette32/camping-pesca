import { PublicKey } from '@solana/web3.js';

export const s = {
  texto: (valor: string) => Buffer.from(valor, 'utf8'),
  cuenta: (valor: { toString(): string }) => new PublicKey(valor.toString()).toBuffer(),
  u64: (valor: bigint | number) => {
    const n = typeof valor === 'bigint' ? valor : BigInt(valor);
    if (n < 0n || n > 18446744073709551615n) throw new Error('El identificador no cabe en u64.');
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64LE(n, 0);
    return bytes;
  },
};
