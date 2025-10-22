import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey,
} from "@solana/web3.js";
import {
  createMint, setAuthority, AuthorityType, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const payer = readKeypair(process.env.WALLET!);
  const connection = new Connection(RPC, "confirmed");

  const GOVERNANCE = new PublicKey(process.env.GOVERNANCE!);
  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const NEW_DECIMALS = parseInt(process.env.NEW_DECIMALS ?? "9", 10);

  // 1) Create new mint with temporary mint authority = payer, freeze = governance
  const newMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    GOVERNANCE,
    NEW_DECIMALS,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("New mint:", newMint.toBase58());

  // 2) PDA for mint authority (must match program seeds)
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth"), newMint.toBuffer()],
    PROGRAM_ID
  );
  console.log("Mint authority PDA:", mintAuthPda.toBase58());

  // 3) Set mint authority to PDA
  const sig = await setAuthority(
    connection, payer, newMint, payer, AuthorityType.MintTokens, mintAuthPda
  );
  console.log("Set mint authority to PDA. Sig:", sig);

  console.log("ENV to export:");
  console.log("NEW_MINT=", newMint.toBase58());
  console.log("MINT_AUTH_PDA=", mintAuthPda.toBase58());
})();
