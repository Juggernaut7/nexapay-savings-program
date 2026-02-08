use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::Vault;
use crate::constants::SEED_VAULT;
use crate::errors::SavingsError;
use crate::events::WithdrawalPerformed;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [SEED_VAULT, authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ SavingsError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Recipient is verified by the authority signing the transaction.
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let destination = &ctx.accounts.recipient;
    let authority = &ctx.accounts.authority;

    require!(vault.total_deposited >= amount, SavingsError::InsufficientFunds);
    
    // Decrease vault total
    vault.total_deposited = vault.total_deposited.checked_sub(amount).unwrap();

    // Transfer from Vault PDA to recipient
    **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **destination.try_borrow_mut_lamports()? += amount;

    emit!(WithdrawalPerformed {
        vault: vault.key(),
        authority: authority.key(),
        recipient: destination.key(),
        amount,
        new_vault_total: vault.total_deposited,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
