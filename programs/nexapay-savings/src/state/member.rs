use anchor_lang::prelude::*;

#[account]
pub struct Member {
    /// The vault this member belongs to.
    pub vault: Pubkey,
    
    /// The member's wallet address.
    pub authority: Pubkey,
    
    /// Amount of lamports deposited by this member.
    pub deposited_amount: u64,
    
    /// Timestamp when the member first joined (or first deposit).
    pub joined_at: i64,
    
    /// Bump seed for PDA.
    pub bump: u8,
}

impl Member {
    // Discriminator (8) + Pubkey (32) + Pubkey (32) + u64 (8) + i64 (8) + u8 (1)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}
