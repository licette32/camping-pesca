import { AccountRole, type Address, type ReadonlyUint8Array } from '@solana/kit';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import idl from '../../idl.json';
import { CAMPING_PESCA_PROGRAM_ADDRESS } from '../../clients/js/src/generated';
import { comprobarPrograma } from './seguridad';

export type WalletFirma = Pick<WalletContextState, 'publicKey' | 'sendTransaction'>;
export type OpcionesEnvio = { onEstado?: (estado: 'firma' | 'confirmacion') => void };
export type InstruccionKit = { programAddress: Address; accounts?: readonly { address: Address; role: number }[]; data?: ReadonlyUint8Array };

export function aWeb3(ix: InstruccionKit): TransactionInstruction {
  const keys = (ix.accounts ?? []).map((cuenta) => {
    if (![0,1,2,3].includes(cuenta.role)) throw new Error('Rol de cuenta desconocido.');
    return { pubkey: new PublicKey(cuenta.address), isSigner: cuenta.role === AccountRole.READONLY_SIGNER || cuenta.role === AccountRole.WRITABLE_SIGNER, isWritable: cuenta.role === AccountRole.WRITABLE || cuenta.role === AccountRole.WRITABLE_SIGNER };
  });
  return new TransactionInstruction({ programId: new PublicKey(ix.programAddress), keys, data: Buffer.from(new Uint8Array(ix.data ?? [])) });
}
export class ErrorTransaccion extends Error { constructor(public readonly firma: string, public readonly resultado: unknown) { super('La transaccion se proceso con error: ' + JSON.stringify(resultado)); this.name='ErrorTransaccion'; } }
export class ErrorConfirmacionPendiente extends Error { constructor(public readonly firma: string, public readonly causa: unknown) { super('La transaccion se envio, pero no pudimos comprobar su resultado. Revisa su estado en Explorer antes de repetirla.'); this.name='ErrorConfirmacionPendiente'; } }
export async function confirmarEnvio(connection: Pick<Connection, 'confirmTransaction'>, estrategia: { signature: string; blockhash: string; lastValidBlockHeight: number }): Promise<string> {
  const resultado = await connection.confirmTransaction(estrategia, 'confirmed').catch((causa: unknown) => { throw new ErrorConfirmacionPendiente(estrategia.signature, causa); });
  if (resultado.value.err !== null) throw new ErrorTransaccion(estrategia.signature, resultado.value.err);
  return estrategia.signature;
}
export async function enviar(ix: InstruccionKit, wallet: WalletFirma, connection: Connection, opciones: OpcionesEnvio = {}): Promise<string> {
  if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.');
  if (String(ix.programAddress) !== String(CAMPING_PESCA_PROGRAM_ADDRESS)) throw new Error('La instruccion corresponde a otro programa.');
  await comprobarPrograma(connection);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }); tx.add(aWeb3(ix));
  opciones.onEstado?.('firma');
  const firma = await wallet.sendTransaction(tx, connection, { preflightCommitment: 'confirmed' });
  opciones.onEstado?.('confirmacion');
  return confirmarEnvio(connection, { signature: firma, blockhash, lastValidBlockHeight });
}
function detalle(error: unknown): string { if (!error || typeof error !== 'object') return String(error); const mensaje = error instanceof Error ? error.message : String(error); const logs = 'logs' in error && Array.isArray(error.logs) ? error.logs.filter((i)=>typeof i==='string').join('\n') : ''; return mensaje + '\n' + logs; }
export function traducir(error: unknown): string {
  const texto = detalle(error);
  if (/user rejected|rejected the request|rechazaste|request rejected/i.test(texto)) return 'La firma fue cancelada en la wallet. Puedes volver a intentarlo.';
  if (/ConstraintSeeds|seeds constraint/i.test(texto)) return 'Las cuentas no corresponden a las semillas esperadas. Revisa camping, parcela o reserva.';
  if (/AccountNotInitialized|does not exist|Account does not exist/i.test(texto)) return 'No se encontro una de las cuentas. Verifica que el camping/parcela/reserva exista.';
  if (/already in use|already initialized/i.test(texto)) return 'Esa cuenta ya existe.';
  const coincidencia = texto.match(/custom program error:\s*(0x[0-9a-f]+|\d+)/i) ?? texto.match(/"Custom"\s*:\s*(\d+)/);
  if (coincidencia) { const codigo = Number(coincidencia[1]); const propio = (idl.errors ?? []).find((item:any) => item.code === codigo); if (propio) return propio.name + ': ' + propio.msg; return 'El programa rechazo la operacion con el codigo ' + codigo + '.'; }
  if (/insufficient funds|insufficient lamports/i.test(texto)) return 'Falta SOL de prueba para la comision o la creacion de la cuenta.';
  if (/429|too many requests/i.test(texto)) return 'El RPC limito las consultas. Espera unos segundos y vuelve a intentarlo.';
  return texto.trim();
}
export const enlaceTransaccion = (firma: string) => 'https://explorer.solana.com/tx/' + encodeURIComponent(firma) + '?cluster=devnet';
