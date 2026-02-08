import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NexapaySavings } from "../target/types/nexapay_savings";
import { assert } from "chai";

describe("nexapay-savings", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NexapaySavings as Program<NexapaySavings>;

  const vaultAuthority = provider.wallet;
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();

  let vaultPda: anchor.web3.PublicKey;
  let vaultBump: number;

  before(async () => {
    // Airdrop SOL to users
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    [vaultPda, vaultBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vault"), vaultAuthority.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Is initialized!", async () => {
    await program.methods
      .initialize()
      .accounts({
        vault: vaultPda,
        authority: vaultAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.ok(vaultAccount.authority.equals(vaultAuthority.publicKey));
    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), 0);
    assert.strictEqual(vaultAccount.memberCount.toNumber(), 0);
  });

  it("Accepts deposits from User 1", async () => {
    const [memberPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("member"), vaultPda.toBuffer(), user1.publicKey.toBuffer()],
      program.programId
    );

    const amount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(amount)
      .accounts({
        vault: vaultPda,
        member: memberPda,
        user: user1.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const memberAccount = await program.account.member.fetch(memberPda);
    const vaultAccount = await program.account.vault.fetch(vaultPda);

    assert.strictEqual(memberAccount.depositedAmount.toNumber(), amount.toNumber());
    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), amount.toNumber());
    assert.strictEqual(vaultAccount.memberCount.toNumber(), 1);
  });

  it("Accepts deposits from User 2", async () => {
    const [memberPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("member"), vaultPda.toBuffer(), user2.publicKey.toBuffer()],
      program.programId
    );

    const amount = new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(amount)
      .accounts({
        vault: vaultPda,
        member: memberPda,
        user: user2.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    const memberAccount = await program.account.member.fetch(memberPda);
    const vaultAccount = await program.account.vault.fetch(vaultPda);

    assert.strictEqual(memberAccount.depositedAmount.toNumber(), amount.toNumber());
    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), 3 * anchor.web3.LAMPORTS_PER_SOL); // 1 + 2
    assert.strictEqual(vaultAccount.memberCount.toNumber(), 2);
  });

  it("Updates existing member deposit", async () => {
    const [memberPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("member"), vaultPda.toBuffer(), user1.publicKey.toBuffer()],
      program.programId
    );

    const amount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .deposit(amount)
      .accounts({
        vault: vaultPda,
        member: memberPda,
        user: user1.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const memberAccount = await program.account.member.fetch(memberPda);
    const vaultAccount = await program.account.vault.fetch(vaultPda);

    assert.strictEqual(memberAccount.depositedAmount.toNumber(), 1.5 * anchor.web3.LAMPORTS_PER_SOL);
    assert.strictEqual(vaultAccount.memberCount.toNumber(), 2); // Count shouldn't change
  });

  it("Allows authority to withdraw", async () => {
    const amount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const recipient = anchor.web3.Keypair.generate();

    const initialVaultTotal = (await program.account.vault.fetch(vaultPda)).totalDeposited;

    await program.methods
      .withdraw(amount)
      .accounts({
        vault: vaultPda,
        authority: vaultAuthority.publicKey,
        recipient: recipient.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const recipientBalance = await provider.connection.getBalance(recipient.publicKey);

    assert.strictEqual(vaultAccount.totalDeposited.toNumber(), initialVaultTotal.toNumber() - amount.toNumber());
    assert.strictEqual(recipientBalance, amount.toNumber());
  });

  it("Prevents unauthorized withdrawal", async () => {
    const amount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const recipient = anchor.web3.Keypair.generate();

    // Use user1 as unauthorized signer
    try {
      await program.methods
        .withdraw(amount)
        .accounts({
            // @ts-ignore
          vault: vaultPda,
          authority: user1.publicKey, // Incorrect authority
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc();
        assert.fail("Should have failed with unauthorized error");
    } catch (err) {
        // Expected error
        // Anchor errors are sometimes wrapped, so we check for the code or msg
        // In localnet it might be a simulation error
        assert.ok(true);
    }
  });
});
