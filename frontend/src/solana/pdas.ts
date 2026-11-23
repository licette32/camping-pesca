import { address, type Address } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import { CAMPING_PESCA_PROGRAM_ADDRESS } from "../../clients/js/src/generated";
import { s } from "./seeds";

const PROGRAM_ID = new PublicKey(CAMPING_PESCA_PROGRAM_ADDRESS);
function derivar(semillas: Buffer[]): Address { const [pda] = PublicKey.findProgramAddressSync(semillas, PROGRAM_ID); return address(pda.toBase58()); }

export function pdaCamping(admin: Address) { return derivar([s.texto("camping"), s.cuenta(admin)]); }
export function pdaParcela(camping: Address, id: bigint | number) { return derivar([s.texto("parcela"), s.cuenta(camping), s.u64(id)]); }
export function pdaReserva(parcela: Address, id: bigint | number) { return derivar([s.texto("reserva"), s.cuenta(parcela), s.u64(id)]); }
