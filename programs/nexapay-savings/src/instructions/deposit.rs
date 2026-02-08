use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{Vault, Member};
use crate::constants::{SEED_VAULT, SEED_MEMBER};
use crate::events::DepositMade;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [SEED_VAULT, vault.authority.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [SEED_MEMBER, vault.key().as_ref(), user.key().as_ref()],
        bump,
        space = Member::LEN
    )]
    pub member: Account<'info, Member>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let member = &mut ctx.accounts.member;
    let user = &ctx.accounts.user;

    // Transfer SOL from user to vault
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: user.to_account_info(),
            to: vault.to_account_info(),
        },
    );
    transfer(cpi_context, amount)?;

    // Update Vault stats
    vault.total_deposited = vault.total_deposited.checked_add(amount).unwrap();
    
    // Update Member stats
    if member.deposited_amount == 0 {
        // New member (or re-entry)
        member.vault = vault.key();
        member.authority = user.key();
        member.joined_at = Clock::get()?.unix_timestamp;
        member.bump = ctx.bumps.member;
        vault.member_count = vault.member_count.checked_add(1).unwrap();
    }
    member.deposited_amount = member.deposited_amount.checked_add(amount).unwrap();

    emit!(DepositMade {
        vault: vault.key(),
        member: member.key(),
        amount,
        new_member_total: member.deposited_amount,
        new_vault_total: vault.total_deposited,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
