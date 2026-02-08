use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DepositMade {
    pub vault: Pubkey,
    pub member: Pubkey,
    pub amount: u64,
    pub new_member_total: u64,
    pub new_vault_total: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalPerformed {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub new_vault_total: u64,
    pub timestamp: i64,
}
