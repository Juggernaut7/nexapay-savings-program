use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use crate::state::Vault;
use crate::constants::SEED_VAULT;
use crate::errors::SavingsError;
use crate::events::WithdrawalPerformed;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [SEED_VAULT, authority.key().as_ref(), vault.mint.as_ref()],
        bump = vault.bump,
        has_one = authority @ SavingsError::Unauthorized,
        has_one = vault_token_account,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"token_account", vault.key().as_ref()],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let authority = &ctx.accounts.authority;
    let recipient = &ctx.accounts.recipient_token_account;

    require!(vault.total_deposited >= amount, SavingsError::InsufficientFunds);
    
    // Decrease vault total
    vault.total_deposited = vault.total_deposited.checked_sub(amount).unwrap();

    // Transfer SPL tokens from Vault to recipient
    let seeds = &[
        SEED_VAULT,
        vault.authority.as_ref(),
        vault.mint.as_ref(),
        &[vault.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = token::Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: recipient.to_account_info(),
        authority: vault.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    emit!(WithdrawalPerformed {
        vault: vault.key(),
        authority: authority.key(),
        recipient: recipient.key(),
        amount,
        new_vault_total: vault.total_deposited,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
