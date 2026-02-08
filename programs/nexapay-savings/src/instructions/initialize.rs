use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::constants::SEED_VAULT;
use crate::events::VaultInitialized;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [SEED_VAULT, authority.key().as_ref()],
        bump,
        payer = authority,
        space = Vault::LEN
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.authority = ctx.accounts.authority.key();
    vault.bump = ctx.bumps.vault;
    vault.total_deposited = 0;
    vault.member_count = 0;

    emit!(VaultInitialized {
        vault: vault.key(),
        authority: vault.authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
