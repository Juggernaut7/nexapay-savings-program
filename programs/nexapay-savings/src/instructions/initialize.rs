use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Vault;
use crate::constants::SEED_VAULT;
use crate::events::VaultInitialized;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [SEED_VAULT, authority.key().as_ref(), mint.key().as_ref()],
        bump,
        payer = authority,
        space = Vault::LEN
    )]
    pub vault: Account<'info, Vault>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        seeds = [b"token_account", vault.key().as_ref()],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.authority = ctx.accounts.authority.key();
    vault.mint = ctx.accounts.mint.key();
    vault.vault_token_account = ctx.accounts.vault_token_account.key();
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
