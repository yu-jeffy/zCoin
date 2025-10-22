import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const upgradeAuthority = readKeypair(process.env.UPGRADE_AUTHORITY!);
  const provider = new anchor.AnchorProvider(
    new Connection(RPC, "confirmed"),
    new anchor.Wallet(upgradeAuthority),
    {}
  );
  anchor.setProvider(provider);

  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );

  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);
  const NEW_LIQUIDITY_ATA = new PublicKey(process.env.NEW_LIQUIDITY_ATA!);
  const AMOUNT = BigInt(process.env.LIQUIDITY_AMOUNT!);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    console.log("=== Migrating Liquidity for Upgrade ===");
    console.log("Upgrade Authority:", upgradeAuthority.publicKey.toBase58());
    console.log("Amount:", AMOUNT.toString());
    console.log("Config PDA:", configPda.toBase58());

    // Check if upgrade is pending
    const configAccount = await program.account.config.fetch(configPda);
    
    if (!configAccount.upgradePending) {
      console.error("❌ No upgrade pending. Cannot migrate liquidity.");
      process.exit(1);
    }

    console.log("✅ Upgrade pending, proceeding with liquidity migration...");
    console.log("Target Program:", configAccount.upgradeTarget.toBase58());

    // Get current liquidity ATA (from fixed allocations)
    const LIQUIDITY_OWNER = new PublicKey(process.env.LIQUIDITY_OWNER!);
    const currentLiquidityAta = await getAssociatedTokenAddress(NEW_MINT, LIQUIDITY_OWNER, true);

    const tx = await program.methods.migrateLiquidity(
      new anchor.BN(AMOUNT.toString())
    )
    .accounts({
      config: configPda,
      upgradeAuthority: upgradeAuthority.publicKey,
      newMint: NEW_MINT,
      liquidityAta: currentLiquidityAta,
      newLiquidityAta: NEW_LIQUIDITY_ATA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([
      createAssociatedTokenAccountInstruction(
        upgradeAuthority.publicKey, NEW_LIQUIDITY_ATA, upgradeAuthority.publicKey, NEW_MINT
      )
    ])
    .rpc();

    console.log("✅ Liquidity migrated successfully!");
    console.log("Transaction:", tx);
    console.log("");
    console.log("Liquidity has been migrated to the new program version.");
    console.log("From ATA:", currentLiquidityAta.toBase58());
    console.log("To ATA:", NEW_LIQUIDITY_ATA.toBase58());

  } catch (error) {
    console.error("❌ Failed to migrate liquidity:", error);
    throw error;
  }
})();
