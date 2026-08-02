use borsh::BorshDeserialize;
use solana_sdk::{
    account::{Account, ReadableAccount}, instruction::{Instruction, InstructionError}, message::AccountMeta, program_pack::Pack, pubkey::Pubkey, signature::Keypair, signer::Signer, transaction::{Transaction, TransactionError}
};
use litesvm::{LiteSVM, types::TransactionResult};
use solana_system_interface::instruction::create_account;
use native_rust_escrow::state::Escrow;

const DEPOSIT: u64 = 1_000;
const DEPOSIT_B: u64 = 5_000;
const ESCROW_LEN: usize = 1 + 32 * 3 + 8;
const EXPECTED_AMOUNT: u64 = 5_000;
const EXPECTED_AMOUNT_B: u64 = 1_000;

struct Ctx {
    svm: LiteSVM,
    program_id: Pubkey,
    maker: Keypair,
    temp_token_acc: Pubkey,
    maker_acc_to_receive: Pubkey,
    mint_a: Pubkey,
    mint_b: Pubkey,
    escrow: Pubkey,
    pda: Pubkey,
    taker: Keypair,
    taker_acc_to_send: Pubkey,
    taker_acc_to_receive: Pubkey
}

fn setup() -> Ctx {
    let mut svm = LiteSVM::new();
    let program_id = Keypair::new();
    svm.add_program_from_file(program_id.pubkey(), "target/deploy/native_rust_escrow.so").unwrap();

    let maker = Keypair::new();
    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();

    let mint_authority = Keypair::new();
    let mint_a = create_mint(&mut svm, &maker, mint_authority.pubkey());
    let mint_b = create_mint(&mut svm, &maker, mint_authority.pubkey());

    let temp_token_acc = create_token_acc(&mut svm, &maker, &mint_a);
    let maker_acc_to_receive = create_token_acc(&mut svm, &maker, &mint_b);

    mint_to(&mut svm, &mint_a, &maker, temp_token_acc, &mint_authority, DEPOSIT);
    let escrow = Keypair::new();
    set_escrow_account(&mut svm, escrow.pubkey(), &program_id);

    let (pda, _) = Pubkey::find_program_address(&[b"escrow"], &program_id.pubkey());


    let taker = Keypair::new();
    svm.airdrop(&taker.pubkey(), 1_000_000_000).unwrap();
    let taker_acc_to_send = create_token_acc(&mut svm, &taker, &mint_b);

    mint_to(&mut svm, &mint_b, &taker, taker_acc_to_send, &mint_authority, DEPOSIT_B);
    let taker_acc_to_receive = create_token_acc(&mut svm, &taker, &mint_a);


    Ctx { 
        svm, 
        program_id: program_id.pubkey(),
        maker, 
        temp_token_acc,
        maker_acc_to_receive,
        mint_a,
        mint_b,
        escrow: escrow.pubkey(),
        pda,
        taker,
        taker_acc_to_send,
        taker_acc_to_receive
    }
}

fn create_mint(svm: &mut LiteSVM, payer: &Keypair, authority: Pubkey) -> Pubkey {
    let mint = Keypair::new();
    let len = spl_token::state::Mint::LEN;

    let ix = [
        create_account(
            &payer.pubkey(), 
            &mint.pubkey(), 
            svm.minimum_balance_for_rent_exemption(len), 
            len as u64, 
            &spl_token::id()
        ),
        spl_token::instruction::initialize_mint(
            &spl_token::id(), 
            &mint.pubkey(), 
            &authority, 
            None, 
            9
        ).unwrap()
    ];
    send(svm, &ix, &payer, &[&payer, &mint]).unwrap();
    mint.pubkey()
}

fn create_token_acc(
    svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey
) -> Pubkey {
    let account = Keypair::new();
    let len = spl_token::state::Account::LEN;

    let ix = [
        create_account(
            &payer.pubkey(), 
            &account.pubkey(), 
            svm.minimum_balance_for_rent_exemption(len), 
            len as u64, 
            &spl_token::id()
        ),
        spl_token::instruction::initialize_account(
            &spl_token::id(), 
            &account.pubkey(), 
            &mint, 
            &payer.pubkey()
        ).unwrap()
    ];

    send(svm, &ix, &payer, &[&payer, &account]).unwrap();
    account.pubkey()
}

fn mint_to(svm: &mut LiteSVM, mint: &Pubkey, payer: &Keypair, destination: Pubkey, owner: &Keypair, amount: u64){
    let ix = spl_token::instruction::mint_to(
        &spl_token::id(), 
        mint, 
        &destination, 
        &owner.pubkey(), 
        &[], 
        amount
    ).unwrap();

    send(svm, &[ix], payer, &[&payer, &owner]).unwrap();
}

fn token_acc_state(ctx: &Ctx, address: Pubkey) -> spl_token::state::Account {
    let acc = ctx.svm.get_account(&address).unwrap();
    spl_token::state::Account::unpack(acc.data()).unwrap()
}

fn escrow_state_acc(ctx: &Ctx) -> Escrow {
    let account = ctx.svm.get_account(&ctx.escrow).unwrap();
    Escrow::try_from_slice(&account.data()[..]).unwrap()
}

fn make_ix(ctx: &Ctx, amount: u64, is_signer: bool) -> Instruction {
    let mut data = vec![0u8];
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction{
        program_id: ctx.program_id,
        accounts: vec![
            AccountMeta {
                pubkey: ctx.maker.pubkey(),
                is_signer: is_signer,
                is_writable: true
            },
            AccountMeta::new(ctx.temp_token_acc, false),
            AccountMeta::new(ctx.maker_acc_to_receive, false),
            AccountMeta::new(ctx.escrow, false),
            AccountMeta::new(solana_sdk::sysvar::rent::ID, false),
            AccountMeta::new(spl_token::id(), false),
        ],
        data,
    };
    ix
}

fn take_ix(ctx: &Ctx, amount: u64, is_signer: bool) -> Instruction {
    let mut data = vec![1];
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction{
        program_id: ctx.program_id,
        accounts: vec![
            AccountMeta {pubkey: ctx.taker.pubkey(),is_signer, is_writable: true},
            AccountMeta::new(ctx.taker_acc_to_send, false),
            AccountMeta::new(ctx.taker_acc_to_receive, false),
            AccountMeta::new(ctx.temp_token_acc, false),
            AccountMeta::new(ctx.maker.pubkey(), false),
            AccountMeta::new(ctx.maker_acc_to_receive, false),
            AccountMeta::new(ctx.escrow, false),
            AccountMeta::new(spl_token::id(), false),
            AccountMeta::new(ctx.pda, false),
        ],
        data
    };
    ix
}

fn send(svm: &mut LiteSVM, ix: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> TransactionResult {
  let tx = Transaction::new_signed_with_payer(
        ix, 
        Some(&payer.pubkey()), 
        signers, 
        svm.latest_blockhash()
    );
    svm.send_transaction(tx)
}

fn set_escrow_account(svm: &mut LiteSVM, escrow: Pubkey, program_id: &Keypair){
        svm.set_account(
            escrow,
            Account{
        lamports: svm.minimum_balance_for_rent_exemption(ESCROW_LEN),
        data: vec![0;ESCROW_LEN],
        owner: program_id.pubkey(),
        executable: false,
        rent_epoch: 0
    }).unwrap();
}

fn token_authority(ctx: &Ctx, address: &Pubkey) ->Pubkey {
    let account = ctx.svm.get_account(&address).unwrap();
    let data = spl_token::state::Account::unpack(account.data()).unwrap();
    data.owner
}

fn instruction_error(result: TransactionResult) -> InstructionError {
    match result.unwrap_err().err {
        TransactionError::InstructionError(0, err) => err,
        other => panic!("expected an instruction error, got {other:?}"),
    }
}
#[test]
fn init_escrow(){
    let mut ctx = setup();
    let ix = make_ix(&ctx, EXPECTED_AMOUNT,true);
    send(&mut ctx.svm, &[ix], &ctx.maker, &[&ctx.maker]).unwrap();
    let escrow_state = escrow_state_acc(&ctx);
    assert_eq!(escrow_state.is_initialized,true);
    assert_eq!(escrow_state.initializer_pubkey,ctx.maker.pubkey());
    assert_eq!(escrow_state.expected_amount,EXPECTED_AMOUNT);
    let acc = token_acc_state(&ctx, ctx.temp_token_acc);
    assert_eq!(acc.amount,DEPOSIT);
    assert_eq!(acc.owner, ctx.pda);
    assert_eq!(acc.mint, ctx.mint_a);
}

#[test]
fn make_requires_the_maker_to_sign() {
    let mut ctx = setup();
    let ix = make_ix(&ctx, EXPECTED_AMOUNT, false);

        // Someone else pays the fee so the transaction is valid without the maker.
    let payer = Keypair::new();
    ctx.svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    let result = send(&mut ctx.svm, &[ix], &payer, &[&payer]);
    assert_eq!(
        instruction_error(result),
        InstructionError::MissingRequiredSignature
        );
        assert!(!escrow_state_acc(&ctx).is_initialized);
    }

 #[test]
fn make_rejects_an_already_initialized_escrow() {
     let mut ctx = setup();
     let maker = ctx.maker.insecure_clone();
     let ix = make_ix(&ctx, EXPECTED_AMOUNT, true);
     send(&mut ctx.svm, &[ix], &maker, &[&maker]).unwrap();
     // A different amount, so this is a distinct transaction rather than a replay.
     let ix = make_ix(&ctx, EXPECTED_AMOUNT + 1, true);
     let result = send(&mut ctx.svm, &[ix], &maker, &[&maker]);
     assert_eq!(
         instruction_error(result),
         InstructionError::AccountAlreadyInitialized
     );
     assert_eq!(escrow_state_acc(&ctx).expected_amount, EXPECTED_AMOUNT);
 }


#[test]
fn make_rejects_an_escrow_account_it_does_not_own() {
    let mut ctx = setup();
    let impostor = Keypair::new();
    set_escrow_account(&mut ctx.svm, ctx.escrow, &impostor);
    let ix = make_ix(&ctx, EXPECTED_AMOUNT, true);
    let maker = ctx.maker.insecure_clone();
    let result = send(&mut ctx.svm, &[ix], &maker, &[&maker]);
    assert_eq!(
        instruction_error(result),
        InstructionError::IncorrectProgramId
    );
    assert_eq!(token_authority(&ctx, &ctx.temp_token_acc), ctx.maker.pubkey());
}

#[test]
fn take(){
    let mut ctx = setup();
    let ix = make_ix(&ctx, EXPECTED_AMOUNT,true);
    send(&mut ctx.svm, &[ix], &ctx.maker, &[&ctx.maker]).unwrap();
    let taker_acc_to_send = token_acc_state(&ctx, ctx.taker_acc_to_send);
    let taker_acc_to_receive = token_acc_state(&ctx, ctx.taker_acc_to_receive);
    assert_eq!(taker_acc_to_send.owner,ctx.taker.pubkey());
    assert_eq!(taker_acc_to_send.amount,EXPECTED_AMOUNT);
    assert_eq!(taker_acc_to_send.mint,ctx.mint_b);
    assert_eq!(taker_acc_to_receive.amount,0);
    assert_eq!(taker_acc_to_receive.mint,ctx.mint_a);
    let ix = take_ix(&ctx, EXPECTED_AMOUNT_B, true);
    send(&mut ctx.svm, &[ix], &ctx.taker, &[&ctx.taker]).unwrap();
    let maker_to_receive = token_acc_state(&ctx, ctx.maker_acc_to_receive);
    assert_eq!(maker_to_receive.amount,EXPECTED_AMOUNT);
    assert_eq!(maker_to_receive.mint,ctx.mint_b);
    let taker_acc_to_receive_latest = token_acc_state(&ctx, ctx.taker_acc_to_receive);
    assert_eq!(taker_acc_to_receive_latest.amount,EXPECTED_AMOUNT_B);
    assert_eq!(taker_acc_to_receive_latest.mint,ctx.mint_a);
}