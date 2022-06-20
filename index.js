#! /usr/bin/env node
require = require('esm-wallaby')(module);
const commander  = require('commander');
const program = new commander.Command();
const commands = require('./commands');
const wallet = program.command('wallet').description('Manage wallet identities on this machine');
const nft = program.command('nft').description('Manage NFT collections');

wallet
	.command('create')
	.description('Create a new named wallet')
	.argument('<handle>', 'A handle to identify your wallet')
	.option('-p, --password <password>', 'Set an optional password to use with this wallet')
	.action(commands.wallet_create);
wallet
	.command('import')
	.description('Import a new named wallet using a seed phrase')
	.argument('<handle>', 'A handle to identify your wallet')
	.requiredOption('-s, --seed <words...>', 'Your mnemonic seed phrase')
	.option('-p, --password <password>', 'If the current wallet has a password you need to specify it here')
	.action(commands.wallet_import);
wallet
	.command('list')
	.description('List all wallets')
	.action(commands.wallet_list);
wallet
	.command('clear')
	.description('Clear all wallets')
	.action(commands.wallet_clear);
wallet
	.command('delete')
	.description('Delete a named wallet from this machine')
	.argument('<handle>', 'A handle to identify your wallet')
	.action(commands.wallet_delete);
wallet
	.command('use')
	.description('Change your active wallet')
	.argument('<handle>', 'A handle to identify your wallet')
	.action(commands.wallet_use);
wallet
	.command('export')
	.description('Print out the seed phrase for your active wallet')
	.option('-p, --password <password>', 'Set an optional password to use with this wallet')
	.action(commands.wallet_export);
wallet
	.command('whoami')
	.description('Get the name of your active wallet')
	.action(commands.wallet_whoami);
wallet
	.command('address')
	.description('Get the address of your active wallet')
	.action(commands.wallet_address);
wallet
	.command('principal')
	.description('Get the principal of your active wallet')
	.action(commands.wallet_principal);
wallet
	.command('balance')
	.description('Get the balance of your active wallet')
	.action(commands.wallet_balance);
wallet
	.command('send')
	.description('Send an <amount> of ICP from your active wallet to <address>')
	.argument('<amount>', 'The amount of ICP to send')
	.argument('<address>', 'An ICP address to send to')
	.option('-p, --password <password>', 'If the current wallet has a password you need to specify it here')
	.action(commands.wallet_send);

nft
	.command('create')
	.description('Create a named NFT collection using EXT')
	.argument('<handle>', 'A handle to identify your collection')
	.option('-n, --name <name>', 'Full name of the collection')
	.option('-r, --royalty-address <address>', 'Set the royalty address for this collection. Defaults to the address of the owner')
	.option('-o, --owner <owner>', 'Set the principal of the owner of the collection. Defaults to the principal of the active wallet')
	.option('-a, --admin <admin>', 'Set the principal of the admin of the collection. Defaults to the principal of the active wallet')
	.option('-f, --royalty-fee <amount>', 'Set the % royalty fee for the collection as a number between 0 and 100 (decimals are allowed). Defaults to 3 (3%)')
	.option('-p, --password <password>', 'If the current wallet has a password you need to specify it here')
	.action(commands.nft_create);
nft
	.description('Mint all the assets in the "assets" folder')
	.command('mint')
	.option('-p, --password <password>', 'If the current wallet has a password you need to specify it here')
	.action(commands.nft_mint);
nft
	.description('Airdrop random assets to the airdresses in the airdrop.txt file')
	.command('airdrop')
	.option('-p, --password <password>', 'If the current wallet has a password you need to specify it here')
	.action(commands.nft_airdrop);
	
program.parse();