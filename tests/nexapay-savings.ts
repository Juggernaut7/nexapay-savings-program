import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NexapaySavings } from "../target/types/nexapay_savings";
import { assert } from "chai";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";

describe("nexapay-savings", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NexapaySavings as Program<NexapaySavings>;

  const vaultAuthority = provider.wallet;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;
  let user1TokenAccount: anchor.web3.PublicKey;
  let user2TokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // 1. Create Mint
    mint = await createMint(
      provider.connection,
      payer,
      vaultAuthority.publicKey,
      null,
      6
    );

    // 2. Find Vault PDA
    [vaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vault"), vaultAuthority.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    // 3. Find Vault Token Account PDA
    [vaultTokenAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("token_account"), vaultPda.toBuffer()],
      program.programId
    );

    // 4. Setup Users
    // Airdrop SOL for transaction fees
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL), "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL), "confirmed"
    );

    // Create User Token Accounts
    user1TokenAccount = await createAccount(
      provider.connection,
      payer,
      mint,
      user1.publicKey
    );
    user2TokenAccount = await createAccount(
      provider.connection,
      payer,
      mint,
      user2.publicKey
    );

    // Mint tokens to users
    await mintTo(provider.connection, payer, mint, user1TokenAccount, vaultAuthority.publicKey, 1000_000000); // 1000 tokens
    await mintTo(provider.connection, payer, mint, user2TokenAccount, vaultAuthority.publicKey, 2000_000000); // 2000 tokens
  });

  it("Is initialized!", async () => {
    await program.methods
      .initialize()
      .accounts({
        vault: vaultPda,
        mint: mint,
        vaultTokenAccount: vaultTokenAccount,
        authority: vaultAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.ok(vaultAccount.authority.equals(vaultAuthority.publicKey));
    assert.ok(vaultAccount.mint.equals(mint));
    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), 0);
  });

  it("Accepts deposits from User 1", async () => {
    const [memberPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("member"), vaultPda.toBuffer(), user1.publicKey.toBuffer()],
      program.programId
    );

    const amount = new anchor.BN(100_000000); // 100 tokens

    await program.methods
      .deposit(amount)
      .accounts({
        vault: vaultPda,
        vaultTokenAccount: vaultTokenAccount,
        member: memberPda,
        userTokenAccount: user1TokenAccount,
        user: user1.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    const memberAccount = await program.account.member.fetch(memberPda);
    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const vaultTokenBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);

    assert.strictEqual(memberAccount.depositedAmount.toNumber(), amount.toNumber());
    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), amount.toNumber());
    assert.strictEqual(vaultTokenBalance.value.amount, amount.toString());
  });

  it("Allows authority to withdraw", async () => {
    const amount = new anchor.BN(50_000000); // 50 tokens
    // Authority needs a token account to receive funds
    const authorityTokenAccount = await createAccount(
      provider.connection,
      payer,
      mint,
      vaultAuthority.publicKey
    );

    const initialVaultTotal = (await program.account.vault.fetch(vaultPda)).totalDeposited;

    await program.methods
      .withdraw(amount)
      .accounts({
        vault: vaultPda,
        vaultTokenAccount: vaultTokenAccount,
        authority: vaultAuthority.publicKey,
        recipientTokenAccount: authorityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const recipientBalance = await provider.connection.getTokenAccountBalance(authorityTokenAccount);

    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), initialVaultTotal.toNumber() - amount.toNumber());
    assert.strictEqual(recipientBalance.value.amount, amount.toString());
  });
});
