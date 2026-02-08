use anchor_lang::prelude::*;

#[error_code]
pub enum SavingsError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,

    #[msg("The requested amount exceeds available funds.")]
    InsufficientFunds,

    #[msg("Arithmetic overflow occurred.")]
    Overflow,

    #[msg("Invalid vault configuration.")]
    InvalidVaultConfig,
}
