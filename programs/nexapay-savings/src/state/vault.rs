use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    /// The authority/manager of the vault who can initiate withdrawals.
    pub authority: Pubkey,
    
    /// Bump seed for PDA validation.
    pub bump: u8,
    
    /// Total amount of lamports deposited in this vault.
    pub total_deposited: u64,
    
    /// Number of unique members who have deposited.
    pub member_count: u64,
}

impl Vault {
    // Discriminator (8) + Pubkey (32) + u8 (1) + u64 (8) + u64 (8)
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8;
}
