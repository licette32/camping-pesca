// No imports needed: web3, anchor, pg and more are globally available

describe("camping_pesca", () => {
  const admin = pg.wallet.publicKey;
  const pescador = web3.Keypair.generate();
  const intruso = web3.Keypair.generate();

  function pdaCamping(a = admin) {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("camping"), a.toBuffer()],
      pg.program.programId
    );
  }
  function pdaParcela(camping, id) {
    const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(id));
    return web3.PublicKey.findProgramAddressSync([Buffer.from("parcela"), camping.toBuffer(), b], pg.program.programId);
  }
  function pdaReserva(parcela, id) {
    const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(id));
    return web3.PublicKey.findProgramAddressSync([Buffer.from("reserva"), parcela.toBuffer(), b], pg.program.programId);
  }

  before(async () => {
    for (const kp of [pescador, intruso]) {
      const sig = await pg.connection.requestAirdrop(kp.publicKey, 2 * web3.LAMPORTS_PER_SOL);
      await pg.connection.confirmTransaction(sig);
    }
  });

  it("flujo valido: inicializar, crear parcela, reservar, modificar, cancelar, cerrar parcela vacia", async () => {
    const [campingPda] = pdaCamping();
    await pg.program.methods.inicializarCamping("Lago Azul")
      .accounts({ camping: campingPda, admin, systemProgram: web3.SystemProgram.programId }).rpc();
    let camping = await pg.program.account.camping.fetch(campingPda);
    assert.equal(camping.nombre, "Lago Azul");
    assert.equal(camping.totalParcelas.toNumber(), 0);

    const [parcelaPda] = pdaParcela(campingPda, 1);
    await pg.program.methods.crearParcela("Muelle Norte", 4)
      .accounts({ camping: campingPda, parcela: parcelaPda, admin, systemProgram: web3.SystemProgram.programId }).rpc();
    let parcela = await pg.program.account.parcela.fetch(parcelaPda);
    assert.equal(parcela.sector, "Muelle Norte");
    assert.equal(parcela.capacidadPersonas, 4);
    assert.equal(parcela.reservasActivas.toNumber(), 0);

    const [reservaPda] = pdaReserva(parcelaPda, 1);
    await pg.program.methods.crearReserva(3, 2)
      .accounts({ camping: campingPda, parcela: parcelaPda, reserva: reservaPda, pescador: pescador.publicKey, systemProgram: web3.SystemProgram.programId })
      .signers([pescador]).rpc();
    parcela = await pg.program.account.parcela.fetch(parcelaPda);
    assert.equal(parcela.reservasActivas.toNumber(), 1);
    let reserva = await pg.program.account.reserva.fetch(reservaPda);
    assert.equal(reserva.cantidadPersonas, 3);
    assert.equal(reserva.noches, 2);

    await pg.program.methods.modificarReserva(2, 3)
      .accounts({ parcela: parcelaPda, reserva: reservaPda, pescador: pescador.publicKey })
      .signers([pescador]).rpc();
    reserva = await pg.program.account.reserva.fetch(reservaPda);
    assert.equal(reserva.cantidadPersonas, 2);
    assert.equal(reserva.noches, 3);

    await pg.program.methods.cancelarReserva()
      .accounts({ parcela: parcelaPda, reserva: reservaPda, pescador: pescador.publicKey })
      .signers([pescador]).rpc();
    parcela = await pg.program.account.parcela.fetch(parcelaPda);
    assert.equal(parcela.reservasActivas.toNumber(), 0);

    await pg.program.methods.cerrarParcela()
      .accounts({ camping: campingPda, parcela: parcelaPda, admin }).rpc();
    const info = await pg.connection.getAccountInfo(parcelaPda);
    assert.equal(info, null);
  });

  it("rechaza casos invalidos", async () => {
    const [campingPda] = pdaCamping();
    const [parcelaPda] = pdaParcela(campingPda, 2);

    await pg.program.methods.crearParcela("Costa Rio", 5)
      .accounts({ camping: campingPda, parcela: parcelaPda, admin, systemProgram: web3.SystemProgram.programId }).rpc();

    // wallet no autorizada crea parcela
    const [campingIntruso] = pdaCamping(intruso.publicKey);
    let fallo = false;
    try {
      await pg.program.methods.inicializarCamping("Otro")
        .accounts({ camping: campingIntruso, admin: intruso.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([intruso]).rpc();
      const [parcelaIntruso] = pdaParcela(campingIntruso, 1);
      await pg.program.methods.crearParcela("X", 2)
        .accounts({ camping: campingPda, parcela: parcelaIntruso, admin: intruso.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([intruso]).rpc();
    } catch (_) { fallo = true; }
    assert.ok(fallo, "debe rechazar admin no autorizado");

    // exceder capacidad
    const [reservaPda] = pdaReserva(parcelaPda, 1);
    fallo = false;
    try {
      await pg.program.methods.crearReserva(6, 1)
        .accounts({ camping: campingPda, parcela: parcelaPda, reserva: reservaPda, pescador: pescador.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([pescador]).rpc();
    } catch (e) { fallo = String(e).includes("CapacidadExcedida") || String(e).includes("capacidad"); }
    assert.ok(fallo, "debe rechazar capacidad excedida");

    // reserva valida para probar cierre con reservas activas y reserva de otra parcela/modificacion ajena
    await pg.program.methods.crearReserva(2, 1)
      .accounts({ camping: campingPda, parcela: parcelaPda, reserva: reservaPda, pescador: pescador.publicKey, systemProgram: web3.SystemProgram.programId })
      .signers([pescador]).rpc();

    // cerrar parcela con reservas activas
    fallo = false;
    try {
      await pg.program.methods.cerrarParcela()
        .accounts({ camping: campingPda, parcela: parcelaPda, admin }).rpc();
    } catch (e) { fallo = String(e).includes("ParcelaConReservasActivas") || String(e).includes("reservas activas"); }
    assert.ok(fallo, "debe rechazar cierre con reservas activas");

    // modificar reserva de otro pescador
    fallo = false;
    try {
      await pg.program.methods.modificarReserva(1, 1)
        .accounts({ parcela: parcelaPda, reserva: reservaPda, pescador: intruso.publicKey })
        .signers([intruso]).rpc();
    } catch (_) { fallo = true; }
    assert.ok(fallo, "debe rechazar pescador no autorizado");

    // reserva sobre otra parcela (seeds no coinciden / cuenta incorrecta) - usar reservaPda de parcela 2 con parcela distinta
    const [parcela3] = pdaParcela(campingPda, 3);
    await pg.program.methods.crearParcela("Isla", 2)
      .accounts({ camping: campingPda, parcela: parcela3, admin, systemProgram: web3.SystemProgram.programId }).rpc();
    const [reservaMala] = pdaReserva(parcela3, 1);
    fallo = false;
    try {
      // intenta usar reserva derivada de parcela3 pero pasando parcela2 en cuentas
      await pg.program.methods.modificarReserva(1, 1)
        .accounts({ parcela: parcelaPda, reserva: reservaMala, pescador: pescador.publicKey })
        .signers([pescador]).rpc();
    } catch (_) { fallo = true; }
    assert.ok(fallo, "debe rechazar reserva de otra parcela");
  });
});
