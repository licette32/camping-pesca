import { useEffect, useRef, useState } from 'react';
import { address } from '@solana/kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { NOMBRE_INICIAL } from '../config/interfaz';
import { leerCamping, type CampingUI } from '../solana/lecturas';
import { ErrorTransaccion, ErrorConfirmacionPendiente, enlaceTransaccion, traducir, type OpcionesEnvio } from '../solana/tx';
import { inicializarCamping, crearParcela, crearReserva, modificarReserva, cancelarReserva, cerrarParcela } from '../solana/acciones';

type Op = 'init' | 'parcela' | 'reservar' | 'modificar' | 'cancelar' | 'cerrar';
const ops: { id: Op; texto: string }[] = [
  { id: 'init', texto: 'Inicializar camping' }, { id: 'parcela', texto: 'Crear parcela' },
  { id: 'reservar', texto: 'Crear reserva' }, { id: 'modificar', texto: 'Modificar reserva' },
  { id: 'cancelar', texto: 'Cancelar reserva' }, { id: 'cerrar', texto: 'Cerrar parcela' },
];

export function Registro({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (v: boolean) => void }) {
  const wallet = useWallet(); const { connection } = useConnection();
  const walletDir = wallet.publicKey?.toBase58() ?? '';
  const [adminConsulta, setAdminConsulta] = useState(walletDir);
  const [camping, setCamping] = useState<CampingUI | null>(null);
  const [consultado, setConsultado] = useState(false); const [leyendo, setLeyendo] = useState(false); const [errorLectura, setErrorLectura] = useState('');
  const [op, setOp] = useState<Op>('init');
  const [nombre, setNombre] = useState(NOMBRE_INICIAL); const [sector, setSector] = useState('Muelle Norte'); const [capacidad, setCapacidad] = useState('4');
  const [adminCamping, setAdminCamping] = useState(''); const [parcelaId, setParcelaId] = useState('1'); const [reservaId, setReservaId] = useState('1');
  const [personas, setPersonas] = useState('2'); const [noches, setNoches] = useState('1');
  const [ocupado, setOcupado] = useState(false); const [fase, setFase] = useState(''); const [firma, setFirma] = useState(''); const [firmaFallida, setFirmaFallida] = useState(''); const [errorOp, setErrorOp] = useState(''); const [aviso, setAviso] = useState('');
  const ctx = useRef(''); const seq = useRef(0); ctx.current = adminConsulta;
  useEffect(() => { setAdminConsulta(walletDir); setAdminCamping(walletDir); }, [walletDir]);
  useEffect(() => { seq.current++; setCamping(null); setConsultado(false); setErrorLectura(''); setLeyendo(false); setFirma(''); setFirmaFallida(''); setErrorOp(''); setAviso(''); }, [adminConsulta]);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);

  async function cargar(owner = adminConsulta) {
    const clave = owner; const turno = ++seq.current; setLeyendo(true); setErrorLectura('');
    try { const datos = await leerCamping(address(owner.trim())); if (turno === seq.current && ctx.current === clave) { setCamping(datos); setConsultado(true); } }
    catch (e) { if (turno === seq.current) setErrorLectura(traducir(e)); throw e; }
    finally { if (turno === seq.current) setLeyendo(false); }
  }

  async function ejecutar(e: React.FormEvent) {
    e.preventDefault(); setOcupado(true); setFase('Preparando operacion...'); setFirma(''); setFirmaFallida(''); setErrorOp(''); setAviso('');
    const opciones: OpcionesEnvio = { onEstado: (s) => setFase(s === 'firma' ? 'Revisa la solicitud en tu wallet...' : 'Esperando confirmacion de la red...') };
    try {
      let r: string;
      if (op === 'init') r = await inicializarCamping(wallet, connection, nombre, opciones);
      else if (op === 'parcela') r = await crearParcela(wallet, connection, sector, Number(capacidad), opciones);
      else if (op === 'reservar') r = await crearReserva(wallet, connection, adminCamping || adminConsulta, parcelaId, Number(personas), Number(noches), opciones);
      else if (op === 'modificar') r = await modificarReserva(wallet, connection, adminCamping || adminConsulta, parcelaId, reservaId, Number(personas), Number(noches), opciones);
      else if (op === 'cancelar') r = await cancelarReserva(wallet, connection, adminCamping || adminConsulta, parcelaId, reservaId, opciones);
      else r = await cerrarParcela(wallet, connection, parcelaId, opciones);
      setFirma(r); setFase('Operacion confirmada correctamente.'); onCambio();
      try { await cargar(adminConsulta); } catch { setAviso('Operacion confirmada, pero no se pudo refrescar. Pulsa Consultar camping.'); }
    } catch (err) { setFase(''); setErrorOp(traducir(err)); if (err instanceof ErrorTransaccion || err instanceof ErrorConfirmacionPendiente) setFirmaFallida(err.firma); }
    finally { setOcupado(false); }
  }

  const esOtra = !!adminConsulta.trim() && adminConsulta.trim() !== walletDir;
  const puedeEscribir = !programa.esReferencia && !!wallet.publicKey && (op === 'reservar' || op === 'modificar' || op === 'cancelar' ? true : !esOtra);
  return <>
    <div className="section-heading"><div><p className="eyebrow">CAMPING - PARCELAS - RESERVAS</p><h2>Reservas de camping de pesca</h2></div><span className="tag">PDAs relacionadas</span></div>
    {programa.esReferencia && <aside className="notice information"><strong>Configura tu programa para comenzar.</strong><p>Importa el IDL de tu despliegue en Devnet para habilitar escrituras.</p></aside>}
    <section className="panel lookup-panel"><div className="panel-heading"><h3>Localizar camping</h3><span className="small-note">Lectura sin firma</span></div>
      <div className="lookup-fields"><label>Admin del camping<input value={adminConsulta} disabled={ocupado} onChange={(e)=>setAdminConsulta(e.target.value)} placeholder="Wallet admin" spellCheck={false} /></label><button className="button secondary" disabled={leyendo||ocupado||programa.esReferencia||!adminConsulta.trim()} onClick={()=>void cargar().catch(()=>{})}>{leyendo?'Consultando...':'Consultar camping'}</button></div>
      <p className="help">PDAs: camping <code>["camping", admin]</code>, parcela <code>["parcela", camping, id_u64]</code>, reserva <code>["reserva", parcela, id_u64]</code>.</p>
      {errorLectura && <p className="notice error" role="alert">{errorLectura}</p>}
    </section>
    <div className="workspace-grid">
      <section className="panel customers-panel"><div className="panel-heading"><h3>Parcelas y reservas</h3>{camping && <span className="count">{camping.parcelas.length} parcelas</span>}</div>
        {!camping ? <div className="empty-state"><span className="empty-symbol">[]</span><h4>{consultado?'Camping no encontrado':'Consulta un camping'}</h4><p>{consultado?'Inicializa un camping con la wallet admin.':'Ingresa el admin y consulta.'}</p></div> : <>
          <div className="registry-summary"><div><span className="label">Camping</span><strong>{camping.nombre}</strong></div><div><span className="label">Total parcelas</span><strong>{camping.totalParcelas.toString()}</strong></div></div>
          <details className="technical-details"><summary>Direccion camping</summary><code className="address">{camping.direccion}</code></details>
          {camping.parcelas.length===0 ? <p className="empty-line">Sin parcelas. Crea la primera.</p> : camping.parcelas.map(p => <article className="customer" key={p.direccion}>
            <header><div><strong>Parcela #{p.id.toString()} - {p.sector}</strong><span className="small-note">Cap {p.capacidadPersonas} pers. | Activas {p.reservasActivas.toString()} | Total {p.totalReservas.toString()}</span></div>
            <button className="text-button" disabled={ocupado} onClick={()=>{setParcelaId(p.id.toString()); setAdminCamping(camping.admin); setOp('reservar');}}>Reservar</button></header>
            {p.reservas.length===0 ? <p className="empty-line">Sin reservas registradas.</p> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Pescador</th><th>Pers.</th><th>Noches</th></tr></thead><tbody>{p.reservas.map(r => <tr key={r.direccion} onClick={()=>{ if(!ocupado){ setParcelaId(p.id.toString()); setReservaId(r.id.toString()); setPersonas(String(r.cantidadPersonas)); setNoches(String(r.noches)); setAdminCamping(camping.admin); setOp('modificar'); } }}><td>#{r.id.toString()}</td><td><code className="address">{r.pescador.slice(0,4)}...{r.pescador.slice(-4)}</code></td><td>{r.cantidadPersonas}</td><td>{r.noches}</td></tr>)}</tbody></table></div>}
          </article>)}
        </>}
      </section>
      <section className="panel operations-panel"><div className="panel-heading"><h3>Operaciones</h3><span className="small-note">Con firma</span></div>
        <div className="operation-tabs">{ops.map(o => <button key={o.id} className={op===o.id?'active':''} disabled={ocupado} onClick={()=>{setOp(o.id); setFirma(''); setErrorOp(''); setFirmaFallida(''); setFase('');}}>{o.texto}</button>)}</div>
        <form onSubmit={ejecutar}><fieldset disabled={ocupado || !puedeEscribir}>
          {op==='init' && <label>Nombre del camping<input value={nombre} onChange={e=>setNombre(e.target.value)} maxLength={32} required /></label>}
          {op==='parcela' && <><label>Sector<input value={sector} onChange={e=>setSector(e.target.value)} maxLength={24} required /></label><label>Capacidad personas (1-10)<input type="number" min={1} max={10} value={capacidad} onChange={e=>setCapacidad(e.target.value)} required /></label></>}
          {(op==='reservar'||op==='modificar'||op==='cancelar') && <><label>Admin del camping<input value={adminCamping} onChange={e=>setAdminCamping(e.target.value)} required /><span className="help">Para derivar la PDA del camping/parcela.</span></label><label>ID parcela<input value={parcelaId} onChange={e=>setParcelaId(e.target.value)} required /></label></>}
          {(op==='modificar'||op==='cancelar') && <label>ID reserva<input value={reservaId} onChange={e=>setReservaId(e.target.value)} required /></label>}
          {(op==='reservar'||op==='modificar') && <><label>Cantidad personas<input type="number" min={1} max={255} value={personas} onChange={e=>setPersonas(e.target.value)} required /><span className="help">Aporte propio: no debe exceder capacidad de la parcela.</span></label><label>Noches<input type="number" min={1} max={255} value={noches} onChange={e=>setNoches(e.target.value)} required /></label></>}
          {op==='cerrar' && <label>ID parcela<input value={parcelaId} onChange={e=>setParcelaId(e.target.value)} required /><span className="help">Solo admin. Falla si reservas_activas != 0.</span></label>}
          <button className="button primary" type="submit">{ocupado?'Operacion en curso...':ops.find(o=>o.id===op)!.texto}</button>
        </fieldset></form>
        {!wallet.publicKey && <p className="help">Conecta tu wallet para operar.</p>}
        {ocupado && <p className="notice information" role="status">{fase}</p>}
        {firma && <p className="notice success" role="status"><strong>Operacion confirmada.</strong><br/><a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">Ver transaccion en Explorer</a></p>}
        {errorOp && <p className="notice error" role="alert">{errorOp}{firmaFallida && <><br/><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transaccion en Explorer</a></>}</p>}
        {aviso && <p className="notice subtle">{aviso}</p>}
      </section>
    </div>
  </>;
}
