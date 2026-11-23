use anchor_lang::prelude::*;

declare_id!("EVCkpvMZhRSFcKTFBdUnBvf4exj88dPopsGawfY7sPXD");

#[program]
pub mod camping_pesca {
    use super::*;

    pub fn inicializar_camping(ctx: Context<InicializarCamping>, nombre: String) -> Result<()> {
        require!(nombre.as_bytes().len() <= 32, ErrorCamping::NombreMuyLargo);
        let camping = &mut ctx.accounts.camping;
        camping.admin = ctx.accounts.admin.key();
        camping.nombre = nombre;
        camping.total_parcelas = 0;
        camping.bump = ctx.bumps.camping;
        Ok(())
    }

    pub fn crear_parcela(
        ctx: Context<CrearParcela>,
        sector: String,
        capacidad_personas: u8,
    ) -> Result<()> {
        require!(sector.as_bytes().len() <= 24, ErrorCamping::SectorMuyLargo);
        require!(
            capacidad_personas >= 1 && capacidad_personas <= 10,
            ErrorCamping::CapacidadInvalida
        );

        let camping = &mut ctx.accounts.camping;
        camping.total_parcelas += 1;
        let id = camping.total_parcelas;

        let parcela = &mut ctx.accounts.parcela;
        parcela.camping = camping.key();
        parcela.id = id;
        parcela.sector = sector;
        parcela.capacidad_personas = capacidad_personas;
        parcela.reservas_activas = 0;
        parcela.total_reservas = 0;
        parcela.bump = ctx.bumps.parcela;
        Ok(())
    }

    pub fn crear_reserva(
        ctx: Context<CrearReserva>,
        cantidad_personas: u8,
        noches: u8,
    ) -> Result<()> {
        require!(noches >= 1, ErrorCamping::NochesInvalidas);
        require!(cantidad_personas >= 1, ErrorCamping::CantidadPersonasInvalida);
        let parcela = &mut ctx.accounts.parcela;
        require!(
            cantidad_personas <= parcela.capacidad_personas,
            ErrorCamping::CapacidadExcedida
        );

        parcela.total_reservas += 1;
        parcela.reservas_activas += 1;
        let id = parcela.total_reservas;

        let reserva = &mut ctx.accounts.reserva;
        reserva.parcela = parcela.key();
        reserva.pescador = ctx.accounts.pescador.key();
        reserva.id = id;
        reserva.cantidad_personas = cantidad_personas;
        reserva.noches = noches;
        reserva.bump = ctx.bumps.reserva;
        Ok(())
    }

    pub fn modificar_reserva(
        ctx: Context<ModificarReserva>,
        nuevas_personas: u8,
        nuevas_noches: u8,
    ) -> Result<()> {
        require!(nuevas_noches >= 1, ErrorCamping::NochesInvalidas);
        require!(nuevas_personas >= 1, ErrorCamping::CantidadPersonasInvalida);
        require!(
            nuevas_personas <= ctx.accounts.parcela.capacidad_personas,
            ErrorCamping::CapacidadExcedida
        );

        let reserva = &mut ctx.accounts.reserva;
        reserva.cantidad_personas = nuevas_personas;
        reserva.noches = nuevas_noches;
        Ok(())
    }

    pub fn cancelar_reserva(ctx: Context<CancelarReserva>) -> Result<()> {
        let parcela = &mut ctx.accounts.parcela;
        parcela.reservas_activas = parcela
            .reservas_activas
            .checked_sub(1)
            .ok_or(ErrorCamping::EstadoReservasInvalido)?;
        Ok(())
    }

    pub fn cerrar_parcela(ctx: Context<CerrarParcela>) -> Result<()> {
        require!(
            ctx.accounts.parcela.reservas_activas == 0,
            ErrorCamping::ParcelaConReservasActivas
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nombre: String)]
pub struct InicializarCamping<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Camping::INIT_SPACE,
        seeds = [b"camping", admin.key().as_ref()],
        bump
    )]
    pub camping: Account<'info, Camping>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sector: String, capacidad_personas: u8)]
pub struct CrearParcela<'info> {
    #[account(
        mut,
        seeds = [b"camping", admin.key().as_ref()],
        bump = camping.bump,
        has_one = admin @ ErrorCamping::NoAutorizado
    )]
    pub camping: Account<'info, Camping>,
    #[account(
        init,
        payer = admin,
        space = 8 + Parcela::INIT_SPACE,
        seeds = [b"parcela", camping.key().as_ref(), &(camping.total_parcelas + 1).to_le_bytes()],
        bump
    )]
    pub parcela: Account<'info, Parcela>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrearReserva<'info> {
    #[account(
        seeds = [b"camping", camping.admin.as_ref()],
        bump = camping.bump
    )]
    pub camping: Account<'info, Camping>,
    #[account(
        mut,
        seeds = [b"parcela", camping.key().as_ref(), &parcela.id.to_le_bytes()],
        bump = parcela.bump,
        has_one = camping @ ErrorCamping::ParcelaNoPerteneceACamping
    )]
    pub parcela: Account<'info, Parcela>,
    #[account(
        init,
        payer = pescador,
        space = 8 + Reserva::INIT_SPACE,
        seeds = [b"reserva", parcela.key().as_ref(), &(parcela.total_reservas + 1).to_le_bytes()],
        bump
    )]
    pub reserva: Account<'info, Reserva>,
    #[account(mut)]
    pub pescador: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModificarReserva<'info> {
    #[account(
        seeds = [b"parcela", parcela.camping.as_ref(), &parcela.id.to_le_bytes()],
        bump = parcela.bump
    )]
    pub parcela: Account<'info, Parcela>,
    #[account(
        mut,
        seeds = [b"reserva", parcela.key().as_ref(), &reserva.id.to_le_bytes()],
        bump = reserva.bump,
        has_one = pescador @ ErrorCamping::NoAutorizado,
        has_one = parcela @ ErrorCamping::ReservaNoPerteneceAParcela
    )]
    pub reserva: Account<'info, Reserva>,
    pub pescador: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelarReserva<'info> {
    #[account(
        mut,
        seeds = [b"parcela", parcela.camping.as_ref(), &parcela.id.to_le_bytes()],
        bump = parcela.bump
    )]
    pub parcela: Account<'info, Parcela>,
    #[account(
        mut,
        close = pescador,
        seeds = [b"reserva", parcela.key().as_ref(), &reserva.id.to_le_bytes()],
        bump = reserva.bump,
        has_one = pescador @ ErrorCamping::NoAutorizado,
        has_one = parcela @ ErrorCamping::ReservaNoPerteneceAParcela
    )]
    pub reserva: Account<'info, Reserva>,
    #[account(mut)]
    pub pescador: Signer<'info>,
}

#[derive(Accounts)]
pub struct CerrarParcela<'info> {
    #[account(
        mut,
        seeds = [b"camping", admin.key().as_ref()],
        bump = camping.bump,
        has_one = admin @ ErrorCamping::NoAutorizado
    )]
    pub camping: Account<'info, Camping>,
    #[account(
        mut,
        close = admin,
        seeds = [b"parcela", camping.key().as_ref(), &parcela.id.to_le_bytes()],
        bump = parcela.bump,
        has_one = camping @ ErrorCamping::ParcelaNoPerteneceACamping
    )]
    pub parcela: Account<'info, Parcela>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Camping {
    pub admin: Pubkey,
    #[max_len(32)]
    pub nombre: String,
    pub total_parcelas: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Parcela {
    pub camping: Pubkey,
    pub id: u64,
    #[max_len(24)]
    pub sector: String,
    pub capacidad_personas: u8,
    pub reservas_activas: u64,
    pub total_reservas: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Reserva {
    pub parcela: Pubkey,
    pub pescador: Pubkey,
    pub id: u64,
    pub cantidad_personas: u8,
    pub noches: u8,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCamping {
    #[msg("El nombre del camping excede 32 bytes")]
    NombreMuyLargo,
    #[msg("El sector excede 24 bytes")]
    SectorMuyLargo,
    #[msg("La capacidad debe estar entre 1 y 10 personas")]
    CapacidadInvalida,
    #[msg("La cantidad de noches debe ser al menos 1")]
    NochesInvalidas,
    #[msg("La cantidad de personas debe ser al menos 1")]
    CantidadPersonasInvalida,
    #[msg("La cantidad de personas excede la capacidad de la parcela")]
    CapacidadExcedida,
    #[msg("No estas autorizado para esta operacion")]
    NoAutorizado,
    #[msg("La parcela no pertenece a este camping")]
    ParcelaNoPerteneceACamping,
    #[msg("La reserva no pertenece a esta parcela")]
    ReservaNoPerteneceAParcela,
    #[msg("No se puede cerrar la parcela porque tiene reservas activas")]
    ParcelaConReservasActivas,
    #[msg("El estado de reservas activas es invalido")]
    EstadoReservasInvalido,
}

