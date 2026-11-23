import type { Address } from "@solana/kit";
import { fetchAllMaybeParcela, fetchAllMaybeReserva, fetchMaybeCamping } from "../../clients/js/src/generated";
import { rpc } from "./conexion";
import { pdaCamping, pdaParcela, pdaReserva } from "./pdas";

export type ReservaUI = { direccion: Address; id: bigint; pescador: Address; cantidadPersonas: number; noches: number };
export type ParcelaUI = { direccion: Address; id: bigint; sector: string; capacidadPersonas: number; reservasActivas: bigint; totalReservas: bigint; reservas: ReservaUI[] };
export type CampingUI = { direccion: Address; admin: Address; nombre: string; totalParcelas: bigint; parcelas: ParcelaUI[] };

export async function leerCamping(admin: Address): Promise<CampingUI | null> {
  const direccion = pdaCamping(admin);
  const cuenta = await fetchMaybeCamping(rpc, direccion);
  if (!cuenta.exists) return null;
  const total = Number(cuenta.data.totalParcelas);
  const dirsParcelas = Array.from({ length: total }, (_, i) => pdaParcela(direccion, i + 1));
  const cuentasParcelas = dirsParcelas.length ? await fetchAllMaybeParcela(rpc, dirsParcelas) : [];
  const parcelas: ParcelaUI[] = [];
  for (const p of cuentasParcelas) {
    if (!p.exists) continue;
    const totalRes = Number(p.data.totalReservas);
    const dirsRes = Array.from({ length: totalRes }, (_, i) => pdaReserva(p.address, i + 1));
    const cuentasRes = dirsRes.length ? await fetchAllMaybeReserva(rpc, dirsRes) : [];
    const reservas = cuentasRes.flatMap(r => r.exists ? [{ direccion: r.address, id: r.data.id, pescador: r.data.pescador, cantidadPersonas: r.data.cantidadPersonas, noches: r.data.noches }] : []);
    parcelas.push({ direccion: p.address, id: p.data.id, sector: p.data.sector, capacidadPersonas: p.data.capacidadPersonas, reservasActivas: p.data.reservasActivas, totalReservas: p.data.totalReservas, reservas });
  }
  return { direccion, admin: cuenta.data.admin, nombre: cuenta.data.nombre, totalParcelas: cuenta.data.totalParcelas, parcelas };
}
