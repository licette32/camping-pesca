import '../src/polyfills';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import { address, createNoopSigner } from '@solana/kit';
import { getCrearReservaInstruction, getCrearReservaInstructionDataDecoder, CAMPING_PESCA_PROGRAM_ADDRESS } from '../clients/js/src/generated';
import { pdaCamping, pdaParcela, pdaReserva } from '../src/solana/pdas';
import { s } from '../src/solana/seeds';
import { aWeb3, confirmarEnvio, ErrorTransaccion, ErrorConfirmacionPendiente, traducir } from '../src/solana/tx';
import { comprobarDevnet, DEVNET_GENESIS } from '../src/solana/seguridad';
import { nombreCampingValido, sectorValido, capacidadValida, personasValidas, nochesValidas } from '../src/solana/validaciones';
import idl from '../idl.json';
import { validarIdl, prepararIdl, REFERENCIA_ID } from '../scripts/contrato-idl.mjs';

const admin = address(new PublicKey(new Uint8Array(32).fill(7)).toBase58());
const pescador = address(new PublicKey(new Uint8Array(32).fill(9)).toBase58());

test('semillas u64 little-endian y limites', () => {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(1n);
  assert.deepEqual([...s.u64(1)], [...b]);
  assert.throws(() => s.u64(-1n));
});

test('PDAs camping/parcela/reserva coinciden con Rust', () => {
  const programa = new PublicKey(CAMPING_PESCA_PROGRAM_ADDRESS);
  const [camping] = PublicKey.findProgramAddressSync([Buffer.from('camping'), new PublicKey(admin).toBuffer()], programa);
  const id = Buffer.alloc(8); id.writeBigUInt64LE(1n);
  const [parcela] = PublicKey.findProgramAddressSync([Buffer.from('parcela'), camping.toBuffer(), id], programa);
  const [reserva] = PublicKey.findProgramAddressSync([Buffer.from('reserva'), parcela.toBuffer(), id], programa);
  assert.equal(pdaCamping(admin), camping.toBase58());
  assert.equal(pdaParcela(address(camping.toBase58()), 1n), parcela.toBase58());
  assert.equal(pdaReserva(address(parcela.toBase58()), 1n), reserva.toBase58());
});

test('Codama serializa crearReserva y puente conserva roles/bytes', () => {
  const camping = pdaCamping(admin);
  const parcela = pdaParcela(camping, 1n);
  const reserva = pdaReserva(parcela, 1n);
  const ix = getCrearReservaInstruction({ camping, parcela, reserva, pescador: createNoopSigner(pescador), cantidadPersonas: 2, noches: 3 });
  const esperado = createHash('sha256').update('global:crear_reserva').digest().subarray(0, 8);
  assert.deepEqual(Buffer.from(ix.data.subarray(0,8)), esperado);
  const dec = getCrearReservaInstructionDataDecoder().decode(ix.data);
  assert.equal(dec.cantidadPersonas, 2);
  assert.equal(dec.noches, 3);
  const w3 = aWeb3(ix);
  assert.equal(w3.programId.toBase58(), CAMPING_PESCA_PROGRAM_ADDRESS);
  assert.deepEqual(w3.keys.map(k=>[k.isSigner,k.isWritable]), [[false,false],[false,true],[false,true],[true,true],[false,false]]);
});

test('confirmacion con error no es exito; pendiente no afirma fallo', async () => {
  const estrategia = { signature: 'firma', blockhash: 'b', lastValidBlockHeight: 1 };
  const errConn = { confirmTransaction: async () => ({ context:{slot:1}, value:{ err:{ InstructionError:[0,{Custom:6005}] } } }) } as unknown as Pick<Connection,'confirmTransaction'>;
  await assert.rejects(confirmarEnvio(errConn, estrategia), (e: unknown) => e instanceof ErrorTransaccion);
  const pendConn = { confirmTransaction: async () => { throw new Error('RPC timeout'); } } as unknown as Pick<Connection,'confirmTransaction'>;
  await assert.rejects(confirmarEnvio(pendConn, estrategia), (e: unknown) => e instanceof ErrorConfirmacionPendiente);
});

test('solo Devnet genesis', async () => {
  await comprobarDevnet({ getGenesisHash: async () => DEVNET_GENESIS });
  await assert.rejects(comprobarDevnet({ getGenesisHash: async () => 'bad' }), /Devnet/);
});

test('validaciones dominio camping', () => {
  assert.equal(nombreCampingValido(' Lago Azul '), 'Lago Azul');
  assert.equal(sectorValido('Muelle Norte'), 'Muelle Norte');
  assert.equal(capacidadValida(10), 10);
  assert.throws(() => capacidadValida(0));
  assert.throws(() => capacidadValida(11));
  assert.equal(personasValidas(1), 1);
  assert.equal(nochesValidas(1), 1);
  assert.throws(() => nochesValidas(0));
});

test('errores traducidos', () => {
  assert.match(traducir(new Error('User rejected the request')), /cancelada/);
  assert.match(traducir(new Error('custom program error: 0x1775')), /CapacidadExcedida/);
  assert.match(traducir(new Error('custom program error: 0x1779')), /ParcelaConReservasActivas/);
});

test('contrato IDL camping_pesca valido', () => {
  const copia = structuredClone(idl);
  assert.equal(validarIdl(copia).programId, REFERENCIA_ID);
  const normalizada = prepararIdl(copia, REFERENCIA_ID);
  assert.equal(normalizada.name, 'camping_pesca');
  const invalida = structuredClone(copia); invalida.instructions = [];
  assert.throws(() => validarIdl(invalida), /Falta la instruccion/);
});
