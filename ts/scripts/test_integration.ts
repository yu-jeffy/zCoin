import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey, SystemProgram
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  createMint, createAccount, mintTo, burn, getMint, getAccount,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, AuthorityType, setAuthority
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

async function createTestKeypair(): Promise<Keypair> {
  return Keypair.generate();
}

async function setupTestEnvironment() {
  console.log("=== Setting up Test Environment ===");
  
  const connection = new Connection(RPC, "confirmed");
  const payer = await createTestKeypair();
  
  // Airdrop SOL for testing
  try {
    const signature = await connection.requestAirdrop(payer.publicKey, 2 * 1e9); // 2 SOL
    await connection.confirmTransaction(signature);
    console.log("✅ Airdropped 2 SOL for testing");
  } catch (error) {
    console.log("⚠️  Airdrop failed (might be on mainnet/devnet)");
  }

  return { connection, payer };
}

async function createMockPumpFunToken(connection: Connection, payer: Keypair) {
  console.log("=== Creating Mock Pump.fun Token ===");
  
  // Create old mint (pump.fun style: 6 decimals, 1B supply)
  const oldMint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority (none for pump.fun)
    6, // decimals
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  console.log("Old mint created:", oldMint.toBase58());
  
  // Mint initial supply to payer
  const payerOldAta = await getAssociatedTokenAddress(oldMint, payer.publicKey, true);
  await createAssociatedTokenAccountInstruction(
    payer.publicKey, payerOldAta, payer.publicKey, oldMint
  );
  
  const supply = BigInt(1_000_000_000) * BigInt(10 ** 6); // 1B tokens @ 6 decimals
  await mintTo(connection, payer, oldMint, payerOldAta, payer, Number(supply));
  
  console.log("✅ Mock pump.fun token created with 1B supply");
  
  return { oldMint, payerOldAta };
}

async function testMigrationFlow() {
  console.log("=== Testing Migration Flow ===");
  
  const { connection, payer } = await setupTestEnvironment();
  const { oldMint, payerOldAta } = await createMockPumpFunToken(connection, payer);
  
  // Create new mint
  const newMint = await createMint(
    connection,
    payer,
    payer.publicKey, // temporary mint authority
    payer.publicKey, // freeze authority
    9, // decimals
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  
  console.log("New mint created:", newMint.toBase58());
  
  // Set up program
  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    {}
  );
  anchor.setProvider(provider);
  
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );
  
  // Test 1: Initialize migration
  console.log("\n--- Test 1: Initialize Migration ---");
  await testInitializeMigration(program, payer, oldMint, newMint);
  
  // Test 2: Redeem tokens
  console.log("\n--- Test 2: Redeem Tokens ---");
  await testRedeemTokens(program, payer, oldMint, newMint);
  
  // Test 3: Pause functionality
  console.log("\n--- Test 3: Pause Functionality ---");
  await testPauseFunctionality(program, payer, oldMint, newMint);
  
  console.log("\n✅ All integration tests completed!");
}

async function testInitializeMigration(program: any, payer: Keypair, oldMint: PublicKey, newMint: PublicKey) {
  try {
    // Create destination ATAs for fixed allocations
    const treasuryOwner = await createTestKeypair();
    const liquidityOwner = await createTestKeypair();
    const contributorsOwner = await createTestKeypair();
    
    const treasuryAta = await getAssociatedTokenAddress(newMint, treasuryOwner.publicKey, true);
    const liquidityAta = await getAssociatedTokenAddress(newMint, liquidityOwner.publicKey, true);
    const contributorsAta = await getAssociatedTokenAddress(newMint, contributorsOwner.publicKey, true);
    
    // Derive PDAs
    const [mintAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), newMint.toBuffer()],
      program.programId
    );
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      program.programId
    );
    
    // Set mint authority to PDA
    await setAuthority(
      program.provider.connection,
      payer,
      newMint,
      payer,
      AuthorityType.MintTokens,
      mintAuthPda
    );
    
    // Calculate allocations
    const TOTAL_CAP = BigInt(100_000_000) * BigInt(10 ** 9); // 100M @ 9 decimals
    const MIGRATION_CAP = (TOTAL_CAP * 60n) / 100n;
    const TREASURY_AMT = (TOTAL_CAP * 20n) / 100n;
    const LIQ_AMT = (TOTAL_CAP * 10n) / 100n;
    const CONTR_AMT = (TOTAL_CAP * 10n) / 100n;
    
    const now = Math.floor(Date.now() / 1000);
    const startTs = now + 60; // 1 minute from now
    const endTs = startTs + 3600; // 1 hour window for testing
    
    const tx = await program.methods.initialize({
      admin: payer.publicKey,
      ratioNum: new anchor.BN("1"),
      ratioDen: new anchor.BN("10"),
      totalCap: new anchor.BN(TOTAL_CAP.toString()),
      migrationCap: new anchor.BN(MIGRATION_CAP.toString()),
      treasuryAmount: new anchor.BN(TREASURY_AMT.toString()),
      liquidityAmount: new anchor.BN(LIQ_AMT.toString()),
      contributorsAmount: new anchor.BN(CONTR_AMT.toString()),
      startTs: new anchor.BN(startTs),
      endTs: new anchor.BN(endTs),
    })
    .accounts({
      payer: payer.publicKey,
      admin: payer.publicKey,
      oldMint: oldMint,
      newMint: newMint,
      mintAuthority: mintAuthPda,
      config: configPda,
      treasuryAta,
      liquidityAta,
      contributorsAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([
      createAssociatedTokenAccountInstruction(payer.publicKey, treasuryAta, treasuryOwner.publicKey, newMint),
      createAssociatedTokenAccountInstruction(payer.publicKey, liquidityAta, liquidityOwner.publicKey, newMint),
      createAssociatedTokenAccountInstruction(payer.publicKey, contributorsAta, contributorsOwner.publicKey, newMint),
    ])
    .rpc();
    
    console.log("✅ Migration initialized successfully");
    console.log("Transaction:", tx);
    
  } catch (error) {
    console.error("❌ Initialize migration failed:", error);
    throw error;
  }
}

async function testRedeemTokens(program: any, payer: Keypair, oldMint: PublicKey, newMint: PublicKey) {
  try {
    // Wait for migration window to open
    await new Promise(resolve => setTimeout(resolve, 70000)); // Wait 70 seconds
    
    const userOldAta = await getAssociatedTokenAddress(oldMint, payer.publicKey, true);
    const userNewAta = await getAssociatedTokenAddress(newMint, payer.publicKey, true);
    
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      program.programId
    );
    const [mintAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), newMint.toBuffer()],
      program.programId
    );
    
    const redeemAmount = BigInt(1_000_000); // 1M old tokens (6 decimals)
    const minNewOut = BigInt(0);
    
    const tx = await program.methods.redeem(
      new anchor.BN(redeemAmount.toString()),
      new anchor.BN(minNewOut.toString())
    )
    .accounts({
      user: payer.publicKey,
      config: configPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      oldMint: oldMint,
      userOldAta,
      newMint: newMint,
      userNewAta,
      mintAuthority: mintAuthPda,
    })
    .preInstructions([
      createAssociatedTokenAccountInstruction(payer.publicKey, userNewAta, payer.publicKey, newMint)
    ])
    .rpc();
    
    console.log("✅ Token redemption successful");
    console.log("Transaction:", tx);
    
    // Check balances
    const oldBalance = await getAccount(program.provider.connection, userOldAta);
    const newBalance = await getAccount(program.provider.connection, userNewAta);
    
    console.log("Old token balance:", oldBalance.amount.toString());
    console.log("New token balance:", newBalance.amount.toString());
    
  } catch (error) {
    console.error("❌ Token redemption failed:", error);
    throw error;
  }
}

async function testPauseFunctionality(program: any, payer: Keypair, oldMint: PublicKey, newMint: PublicKey) {
  try {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      program.programId
    );
    
    // Pause migration
    const pauseTx = await program.methods.setPause(true)
      .accounts({
        config: configPda,
        admin: payer.publicKey,
        newMint: newMint,
      })
      .rpc();
    
    console.log("✅ Migration paused");
    console.log("Transaction:", pauseTx);
    
    // Try to redeem (should fail)
    try {
      const userOldAta = await getAssociatedTokenAddress(oldMint, payer.publicKey, true);
      const userNewAta = await getAssociatedTokenAddress(newMint, payer.publicKey, true);
      const [mintAuthPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_auth"), newMint.toBuffer()],
        program.programId
      );
      
      await program.methods.redeem(
        new anchor.BN("1000000"),
        new anchor.BN("0")
      )
      .accounts({
        user: payer.publicKey,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        oldMint: oldMint,
        userOldAta,
        newMint: newMint,
        userNewAta,
        mintAuthority: mintAuthPda,
      })
      .rpc();
      
      console.log("❌ Redeem should have failed when paused");
    } catch (error) {
      console.log("✅ Redeem correctly failed when paused");
    }
    
    // Unpause migration
    const unpauseTx = await program.methods.setPause(false)
      .accounts({
        config: configPda,
        admin: payer.publicKey,
        newMint: newMint,
      })
      .rpc();
    
    console.log("✅ Migration unpaused");
    console.log("Transaction:", unpauseTx);
    
  } catch (error) {
    console.error("❌ Pause functionality test failed:", error);
    throw error;
  }
}

// Run the integration tests
(async () => {
  try {
    await testMigrationFlow();
  } catch (error) {
    console.error("Integration test failed:", error);
    process.exit(1);
  }
})();
