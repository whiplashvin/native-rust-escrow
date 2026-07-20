import {
  generateKeyPairSigner,
  lamports,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  pipe,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  getMintSize,
  getInitializeMint2Instruction,
} from "@solana-program/token";
import { describe, test, expect, beforeAll } from "bun:test";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";

// 0. `[signer]` The account of the person initializing the escrow
// 1. `[writable]` Temporary token account that should be created prior to this instruction and owned by the initializer
// 2. `[]` The initializer's token account for the token they will receive should the trade go through
// 3. `[writable]` The escrow account, it will hold all necessary info about the trade.
// 4. `[]` The rent sysvar
// 5. `[]` The token program

let svm: LiteSVM;
let programId: Address;
let initializer: KeyPairSigner;
let mintX: KeyPairSigner;
let initializerTokenXAcc: Address;
let initializerTempTokenXAcc: Address;
let escrowAcc: Address;

beforeAll(async () => {
  svm = new LiteSVM();
  programId = (await generateKeyPairSigner()).address;
  initializer = await generateKeyPairSigner();
  svm.airdrop(initializer.address, lamports(10_000_000_000n));

  mintX = await generateKeyPairSigner();
  const space = BigInt(getMintSize()); // 82 bytes
  const rent = svm.minimumBalanceForRentExemption(space);

  const createMintAccountIx = getCreateAccountInstruction({
    payer: initializer,
    newAccount: mintX, // the mint is a signer: it signs its own creation
    lamports: lamports(rent),
    space,
    programAddress: TOKEN_PROGRAM_ADDRESS, // mint account is owned by the token program
  });

  const initMintIx = getInitializeMint2Instruction({
    mint: mintX.address,
    decimals: 9,
    mintAuthority: initializer.address,
    freezeAuthority: null,
  });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(initializer, m),
    (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
    (m) =>
      appendTransactionMessageInstructions(
        [createMintAccountIx, initMintIx],
        m,
      ),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const result = svm.sendTransaction(signedTx);

  if (result instanceof FailedTransactionMetadata) {
    throw new Error("mint creation failed: " + result.err().toString());
  }
});

test("mint X is created and owned by the token program", () => {
  const mintAccount = svm.getAccount(mintX.address);
  expect(mintAccount.exists).toBe(true);
  if (mintAccount.exists) {
    expect(mintAccount.programAddress).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(mintAccount.data.length).toBe(getMintSize());
  }
});
