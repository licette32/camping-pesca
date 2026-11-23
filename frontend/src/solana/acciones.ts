import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import { getInicializarCampingInstruction, getCrearParcelaInstruction, getCrearReservaInstruction, getModificarReservaInstruction, getCancelarReservaInstruction, getCerrarParcelaInstruction, fetchMaybeCamping, fetchMaybeParcela } from '../../clients/js/src/generated';
import { pdaCamping, pdaParcela, pdaReserva } from './pdas';
import { rpc } from './conexion';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';
import { nombreCampingValido, sectorValido, capacidadValida, personasValidas, nochesValidas, idValido } from './validaciones';

export function direccionDe(wallet: Pick<WalletFirma, 'publicKey'>): Address { if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.'); return address(wallet.publicKey.toBase58()); }
function firmante(wallet: WalletFirma) { comprobarConfiguracion(); return createNoopSigner(direccionDe(wallet)); }

export async function inicializarCamping(wallet: WalletFirma, connection: Connection, nombre: string, opciones?: OpcionesEnvio): Promise<string> {
  nombre = nombreCampingValido(nombre);
  const admin = firmante(wallet);
  const camping = pdaCamping(admin.address);
  const ix = getInicializarCampingInstruction({ camping, admin, nombre });
  return enviar(ix, wallet, connection, opciones);
}

export async function crearParcela(wallet: WalletFirma, connection: Connection, sector: string, capacidadPersonas: number, opciones?: OpcionesEnvio): Promise<string> {
  sector = sectorValido(sector); capacidadPersonas = capacidadValida(capacidadPersonas);
  const admin = firmante(wallet);
  const camping = pdaCamping(admin.address);
  const cuenta = await fetchMaybeCamping(rpc, camping);
  if (!cuenta.exists) throw new Error('Primero inicializa el camping.');
  const id = cuenta.data.totalParcelas + 1n;
  const parcela = pdaParcela(camping, id);
  const ix = getCrearParcelaInstruction({ camping, parcela, admin, sector, capacidadPersonas });
  return enviar(ix, wallet, connection, opciones);
}

export async function crearReserva(wallet: WalletFirma, connection: Connection, adminCamping: string, parcelaId: bigint | number | string, cantidadPersonas: number, noches: number, opciones?: OpcionesEnvio): Promise<string> {
  const pid = idValido(parcelaId); cantidadPersonas = personasValidas(cantidadPersonas); noches = nochesValidas(noches);
  const pescador = firmante(wallet);
  const camping = pdaCamping(address(adminCamping.trim()));
  const parcela = pdaParcela(camping, pid);
  const pCuenta = await fetchMaybeParcela(rpc, parcela);
  if (!pCuenta.exists) throw new Error('La parcela no existe.');
  const rid = pCuenta.data.totalReservas + 1n;
  const reserva = pdaReserva(parcela, rid);
  const ix = getCrearReservaInstruction({ camping, parcela, reserva, pescador, cantidadPersonas, noches });
  return enviar(ix, wallet, connection, opciones);
}

export async function modificarReserva(wallet: WalletFirma, connection: Connection, adminCamping: string, parcelaId: bigint | number | string, reservaId: bigint | number | string, nuevasPersonas: number, nuevasNoches: number, opciones?: OpcionesEnvio): Promise<string> {
  const pid = idValido(parcelaId); const rid = idValido(reservaId); nuevasPersonas = personasValidas(nuevasPersonas); nuevasNoches = nochesValidas(nuevasNoches);
  const pescador = firmante(wallet);
  const camping = pdaCamping(address(adminCamping.trim()));
  const parcela = pdaParcela(camping, pid);
  const reserva = pdaReserva(parcela, rid);
  const ix = getModificarReservaInstruction({ parcela, reserva, pescador, nuevasPersonas, nuevasNoches });
  return enviar(ix, wallet, connection, opciones);
}

export async function cancelarReserva(wallet: WalletFirma, connection: Connection, adminCamping: string, parcelaId: bigint | number | string, reservaId: bigint | number | string, opciones?: OpcionesEnvio): Promise<string> {
  const pid = idValido(parcelaId); const rid = idValido(reservaId);
  const pescador = firmante(wallet);
  const camping = pdaCamping(address(adminCamping.trim()));
  const parcela = pdaParcela(camping, pid);
  const reserva = pdaReserva(parcela, rid);
  const ix = getCancelarReservaInstruction({ parcela, reserva, pescador });
  return enviar(ix, wallet, connection, opciones);
}

export async function cerrarParcela(wallet: WalletFirma, connection: Connection, parcelaId: bigint | number | string, opciones?: OpcionesEnvio): Promise<string> {
  const pid = idValido(parcelaId);
  const admin = firmante(wallet);
  const camping = pdaCamping(admin.address);
  const parcela = pdaParcela(camping, pid);
  const ix = getCerrarParcelaInstruction({ camping, parcela, admin });
  return enviar(ix, wallet, connection, opciones);
}
