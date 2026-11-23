import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Conexion } from './components/Conexion';
import { Registro } from './components/Registro';
import { Icono } from './components/Icono';
import programa from './config/programa.json';
import { TITULO_APP } from './config/interfaz';
import { ENDPOINT } from './solana/conexion';
import { comprobarDevnet } from './solana/seguridad';

export default function App() {
  const [vista, setVista] = useState<'conexion' | 'registro'>('registro');
  const [revision, setRevision] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const { publicKey } = useWallet();
  const [red, setRed] = useState('Verificando RPC...');
  const [errorRed, setErrorRed] = useState(false);
  const { connection } = useConnection();
  useEffect(() => { let activo = true; comprobarDevnet(connection).then(() => { if (activo) { setRed('Devnet verificada'); setErrorRed(false); } }).catch(() => { if (activo) { setRed('Revisa la conexion RPC'); setErrorRed(true); } }); return () => { activo = false; }; }, [connection]);
  return <div className="app-layout">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(e) => e.preventDefault()}><span className="brand-logo"><img src="/logo-camping-pesca.png" alt="Camping de Pesca" /></span><span>Camping de Pesca<span className="brand-caption">SOLANA DEVNET</span></span></a>
      <p className="sidebar-label">CAMPING DE PESCA</p>
      <nav aria-label="Secciones"><button className={vista === 'conexion' ? 'nav-item selected' : 'nav-item'} disabled={ocupado} onClick={() => setVista('conexion')}><Icono tipo="conexion" /> Conexion</button><button className={vista === 'registro' ? 'nav-item selected' : 'nav-item'} disabled={ocupado} onClick={() => setVista('registro')}><Icono tipo="registro" /> Camping</button></nav>
      <div className="sidebar-bottom"><p>Entorno de práctica</p><span>Datos de demostración en Solana Devnet</span></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div><span className="topbar-title">{TITULO_APP}</span><span className={errorRed ? 'network-badge warning' : 'network-badge'}>{red}</span></div><WalletMultiButton>{publicKey ? publicKey.toBase58().slice(0,4)+'...'+publicKey.toBase58().slice(-4) : 'Conectar wallet'}</WalletMultiButton></header>
      <main>{vista === 'conexion' ? <Conexion revision={revision} /> : <Registro onCambio={() => setRevision(v=>v+1)} onOcupado={setOcupado} />}
        <footer className="app-footer"><span>RPC: {new URL(ENDPOINT).hostname}</span><details><summary>{programa.esReferencia ? 'Programa de referencia' : 'Programa configurado'}</summary><code className="address">{programa.programId}</code></details></footer>
      </main>
    </div>
  </div>;
}
