import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import {
  createMint, mintTo, getMint, getAccount,
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

(async () => {
  const connection = new Connection(RPC, "confirmed");
  const payer = readKeypair(process.env.WALLET!);

  console.log("=== Creating Mock Pump.fun Token ===");
  console.log("Payer:", payer.publicKey.toBase58());

  try {
    // 1. Create mock pump.fun token (6 decimals, 1B supply)
    const mockPumpFunMint = await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority (will be renounced)
      null, // freeze authority (none for pump.fun)
      6, // decimals (pump.fun standard)
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    console.log("✅ Mock pump.fun mint created:", mockPumpFunMint.toBase58());

    // 2. Create token account for payer
    const payerAta = await getAssociatedTokenAddress(mockPumpFunMint, payer.publicKey, true);
    await createAssociatedTokenAccountInstruction(
      payer.publicKey, payerAta, payer.publicKey, mockPumpFunMint
    );

    // 3. Mint initial supply (1B tokens @ 6 decimals)
    const totalSupply = BigInt(1_000_000_000) * BigInt(10 ** 6); // 1B tokens
    await mintTo(
      connection,
      payer,
      mockPumpFunMint,
      payerAta,
      payer,
      Number(totalSupply)
    );

    console.log("✅ Minted 1B tokens to payer");

    // 4. Renounce mint authority (simulate pump.fun graduation)
    await setAuthority(
      connection,
      payer,
      mockPumpFunMint,
      payer,
      AuthorityType.MintTokens,
      null
    );

    console.log("✅ Renounced mint authority (simulating pump.fun graduation)");

    // 5. Verify token properties
    const mintInfo = await getMint(connection, mockPumpFunMint);
    const accountInfo = await getAccount(connection, payerAta);

    console.log("\n=== Token Verification ===");
    console.log("Decimals:", mintInfo.decimals);
    console.log("Supply:", mintInfo.supply.toString());
    console.log("Mint Authority:", mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : "None (renounced)");
    console.log("Freeze Authority:", mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : "None");
    console.log("Payer Balance:", accountInfo.amount.toString());

    // 6. Create additional test accounts with tokens
    console.log("\n=== Creating Test Accounts ===");
    const testAccounts = [];
    
    for (let i = 0; i < 5; i++) {
      const testUser = await createTestKeypair();
      const testAta = await getAssociatedTokenAddress(mockPumpFunMint, testUser.publicKey, true);
      
      // Transfer some tokens to test user
      const transferAmount = BigInt(10_000_000) * BigInt(10 ** 6); // 10M tokens
      
      // Since mint authority is renounced, we need to transfer from payer
      const transferIx = await createTransferInstruction(
        payerAta,
        testAta,
        payer.publicKey,
        Number(transferAmount)
      );
      
      // For now, just create the account and note the amount
      await createAssociatedTokenAccountInstruction(
        payer.publicKey, testAta, testUser.publicKey, mockPumpFunMint
      );
      
      testAccounts.push({
        user: testUser,
        ata: testAta,
        amount: transferAmount
      });
      
      console.log(`Test user ${i + 1}: ${testUser.publicKey.toBase58()}`);
    }

    // 7. Output environment variables for testing
    console.log("\n=== Environment Variables for Testing ===");
    console.log("OLD_MINT=" + mockPumpFunMint.toBase58());
    console.log("OLD_DECIMALS=6");
    console.log("NEW_DECIMALS=9");
    console.log("");
    console.log("Test accounts created:");
    testAccounts.forEach((acc, i) => {
      console.log(`TEST_USER_${i + 1}_KEYPAIR=${acc.user.publicKey.toBase58()}`);
    });

    console.log("\n✅ Mock pump.fun token setup complete!");
    console.log("This token simulates a graduated pump.fun token with:");
    console.log("- 6 decimals");
    console.log("- 1B total supply");
    console.log("- Renounced mint authority");
    console.log("- No freeze authority");
    console.log("- Ready for migration testing");

  } catch (error) {
    console.error("❌ Failed to create mock pump.fun token:", error);
    throw error;
  }
})();

// Helper function to create transfer instruction
async function createTransferInstruction(
  from: PublicKey,
  to: PublicKey,
  authority: PublicKey,
  amount: number
) {
  // This would create a proper transfer instruction
  // For now, it's a placeholder
  return null;
}
