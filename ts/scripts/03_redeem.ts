import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";
function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const user = readKeypair(process.env.USER_WALLET!);
  const provider = new anchor.AnchorProvider(
    new Connection(RPC, "confirmed"),
    new anchor.Wallet(user),
    {}
  );
  anchor.setProvider(provider);

  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );

  const OLD_MINT = new PublicKey(process.env.OLD_MINT!);
  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  const userOldAta = await getAssociatedTokenAddress(OLD_MINT, user.publicKey, true);
  const userNewAta = await getAssociatedTokenAddress(NEW_MINT, user.publicKey, true);
  const createNewAtaIx = createAssociatedTokenAccountInstruction(
    user.publicKey, userNewAta, user.publicKey, NEW_MINT
  );

  const AMOUNT_OLD = BigInt(process.env.AMOUNT_OLD!); // base units
  const MIN_NEW_OUT = BigInt(process.env.MIN_NEW_OUT ?? "0");

  await program.methods.redeem(
    new anchor.BN(AMOUNT_OLD.toString()),
    new anchor.BN(MIN_NEW_OUT.toString())
  )
  .accounts({
    user: user.publicKey,
    config: configPda,
    tokenProgram: TOKEN_PROGRAM_ID,
    oldMint: OLD_MINT,
    userOldAta,
    newMint: NEW_MINT,
    userNewAta,
    mintAuthority: mintAuthPda,
  })
  .preInstructions([createNewAtaIx])
  .rpc();

  console.log("Redeemed successfully.");
})();
