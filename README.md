# Native Rust Escrow

> **Disclaimer:** This project follows [paulx's escrow blog post](https://paulx.dev/blog/2021/01/14/programming-on-solana-an-introduction/) ("Programming on Solana — An Introduction"). Differences from the original: his UI was built in Vue, this one is in React, and several cargo package versions have been updated (e.g. `solana-program 4.0.0`, `spl-token 9.0.0`).

A Solana escrow program written in **native Rust** (no Anchor). It lets two parties trustlessly swap SPL tokens: Alice locks up token **X** and states how much token **Y** she wants; Bob takes the trade by sending Y and receiving the locked X — all atomically in a single transaction.

A small React UI lives in [`escrow-ui-react/`](./escrow-ui-react) for driving the program from the browser.

## Architecture

```
src/
├── lib.rs          # Crate root, wires the modules together
├── entrypoint.rs   # Program entrypoint — forwards to the processor
├── instruction.rs  # Instruction definitions + byte-level (de)serialization
├── processor.rs    # Business logic for each instruction
├── state.rs        # Escrow account state + Pack (de)serialization
└── error.rs        # Custom EscrowError variants
```

### Module responsibilities

- **`entrypoint.rs`** — declares the Solana entrypoint and hands `program_id`, `accounts`, and `instruction_data` to `Processor::process`.
- **`instruction.rs`** — defines `EscrowInstruction` and unpacks raw instruction bytes. The first byte is a tag (`0` = `InitEscrow`, `1` = `Exchange`) followed by a little-endian `u64` amount.
- **`processor.rs`** — implements the two instructions (see flow below), including all CPIs into the SPL Token program.
- **`state.rs`** — the `Escrow` account (105 bytes): `is_initialized`, `initializer_pubkey`, `temp_token_account_pubkey`, `initializer_token_to_receive_account_pubkey`, `expected_amount`. Manually packed/unpacked with `arrayref`.
- **`error.rs`** — `EscrowError` (`InvalidInstruction`, `NotRentExempt`, `ExpectedAmountMismatch`, `AmountOverflow`, …) convertible into `ProgramError::Custom`.

### Instruction flow

**1. `InitEscrow { amount }`** — called by Alice (the initializer):

1. Verifies Alice signed and that the escrow state account is rent-exempt.
2. Writes the escrow state: Alice's pubkey, her temporary X token account, her Y token account (where she wants to receive), and `expected_amount` of Y.
3. Derives the program's PDA from the seed `b"escrow"` and CPIs `spl_token::set_authority` to transfer ownership of the temporary X token account from Alice to the PDA. The X tokens are now locked — only the program can move them.

**2. `Exchange { amount }`** — called by Bob (the taker):

1. Verifies Bob signed and that the amount of X in the PDA-owned temp account matches what Bob expects (protects Bob from front-running changes).
2. Validates the passed accounts against the pubkeys stored in escrow state.
3. CPI: transfers `expected_amount` of Y from Bob's Y account to Alice's Y account (signed by Bob).
4. CPI (`invoke_signed` with the PDA): transfers all X from the temp account to Bob's X account.
5. CPI (`invoke_signed`): closes the temp X account, refunding its rent to Alice.
6. Closes the escrow state account by zeroing its data and moving its lamports back to Alice.

### Key design points

- **PDA authority** — a single PDA (`find_program_address([b"escrow"], program_id)`) owns the locked tokens; it can only "sign" via `invoke_signed`, so tokens can never be moved outside the program's rules.
- **Atomicity** — the entire exchange (Y→Alice, X→Bob, account cleanup) happens in one transaction; either everything succeeds or nothing does.
- **No token custody by the program itself** — all token movement is delegated to the SPL Token program via CPI.

## Building

> **Note:** use `cargo build-sbf`, **not** the deprecated `cargo build-bpf`.

```bash
cargo build-sbf
```

The compiled program lands in `target/deploy/native_rust_escrow.so`.

## Local setup walkthrough

The steps below use the `solana` CLI and `spl-token` CLI against a local validator to set up the two parties. Start a validator first:

```bash
solana-test-validator
solana config set --url localhost
```

Deploy the program:

```bash
solana program deploy target/deploy/native_rust_escrow.so
```

### 1. Create Alice's main account and fund it

```bash
solana-keygen new --outfile alice.json
solana airdrop 5 alice.json
```

### 2. Create mint X and Alice's X token account

Create mint X, mint (supply) some X, create Alice's associated token account for X, and transfer X tokens into it:

```bash
# Create mint X (note the mint address it prints)
spl-token create-token
# => MINT_X

# Create a token account for mint X owned by the fee payer and mint supply into it
spl-token create-account <MINT_X>
spl-token mint <MINT_X> 1000

# Create Alice's token account for mint X and send her tokens
spl-token create-account <MINT_X> --owner alice.json
spl-token transfer <MINT_X> 100 <ALICE_X_TOKEN_ACCOUNT>
```

### 3. Create mint Y and Alice's Y token account

Do the same for mint Y, **but do not send any Y tokens to Alice** — her Y account starts empty and only receives tokens when the escrow executes:

```bash
# Create mint Y and supply it
spl-token create-token
# => MINT_Y
spl-token create-account <MINT_Y>
spl-token mint <MINT_Y> 1000

# Alice's Y token account — created, but left empty
spl-token create-account <MINT_Y> --owner alice.json
```

### 4. Do the same for Bob (mirrored)

Bob is the taker, so his setup mirrors Alice's: he holds **Y** and has an empty **X** account:

```bash
# Bob's main account + airdrop
solana-keygen new --outfile bob.json
solana airdrop 5 bob.json

# Bob's Y token account, funded with Y tokens
spl-token create-account <MINT_Y> --owner bob.json
spl-token transfer <MINT_Y> 100 <BOB_Y_TOKEN_ACCOUNT>

# Bob's X token account — created, but left empty
spl-token create-account <MINT_X> --owner bob.json
```

### End state

| Account | X balance | Y balance |
|---|---|---|
| Alice | 100 | 0 (empty account) |
| Bob | 0 (empty account) | 100 |

From here, Alice can call `InitEscrow` to lock her X and Bob can call `Exchange` to complete the swap — for example through the UI in `escrow-ui-react/` (`npm install && npm run dev`).
