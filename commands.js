#! /usr/bin/env node
require = require('esm-wallaby')(module);
const conf = new (require('conf'))()
const chalk = require('chalk')
var fetch = require('node-fetch');
const fs = require('fs');
global.fetch = fetch;
const origWarning = process.emitWarning;
process.emitWarning = function(...args) {
    if (args[2] !== 'DEP0005') {
        // pass any other warnings through normally
        return origWarning.apply(process, args);
    } else {
        // do nothing, eat the warning
    }
}
const imageThumbnail = require('image-thumbnail');
const bip39 = require('bip39');
const Ed25519KeyIdentity = require("@dfinity/identity").Ed25519KeyIdentity;
const HttpAgent = require("@dfinity/agent").HttpAgent;
const Actor = require("@dfinity/agent").Actor;
const Principal = require("@dfinity/principal").Principal;
const crypto = require("crypto");
const sjcl = require("sjcl");
const prompt = require("prompt");
const yesno = require("yesno");
const mime = require('mime');
const extjs = require("./extjs/extjs").default;
global.Buffer = global.Buffer || require('buffer').Buffer;
if (typeof btoa === 'undefined') {
  global.btoa = function (str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}
if (typeof atob === 'undefined') {
  global.atob = function (b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
  };
}

const CHUNKSIZE = 1900000;
const NFTFACTORY = "bn2nh-jaaaa-aaaam-qapja-cai";
const NFTFACTORY_IDL = ({ IDL }) => {
  const Factory = IDL.Service({
    'createCanister' : IDL.Func([IDL.Text, IDL.Text], [IDL.Principal], []),
  });
  return Factory;
};
//Helpers
const removeFilenameExtension = (filename) => {
  return filename.split('.').slice(0, -1).join('.');
};
const getId = (seed) => {
  var seed = bip39.mnemonicToSeedSync(seed);
  seed = Array.from(seed);
  seed = seed.splice(0, 32);
  seed = new Uint8Array(seed);
  return Ed25519KeyIdentity.generate(seed);
}
const decrypt = (principal, data, password) => {
	const key = crypto.pbkdf2Sync(password, principal, 30000, 512, 'sha512');
	return atob(sjcl.decrypt(key.toString(), data));
};
const encrypt= (principal, seed, password) => {
	const key = crypto.pbkdf2Sync(password, principal, 30000, 512, 'sha512');
	return sjcl.encrypt(key.toString(), btoa(seed))
};
const getWalletSeed = (w,p) => {
	if (w.encrypted) {
		try {
			return decrypt(w.principal, w.data, p);
		} catch(e) {
			return false;
		};
	} else {
		return w.data;
	};
};
const validateHandle = (h) => {
	var re = /^[^\s^\x00-\x1f\\?*:"";<>|\/.][^\x00-\x1f\\?*:"";<>|\/]*[^\s^\x00-\x1f\\?*:"";<>|\/.]+$/g;
	return re.test(h);
};
const uploadAsset = async (api, ah, filename, filepath) =>{
  outputUpdate("Registering with canister...");
  var data = fs.readFileSync(filepath);
  var type = mime.getType(filepath); 
  await api.ext_assetAdd(ah, type, filename, {direct:[]});
  var pl = [...data];
  var numberOfChunks = Math.ceil(pl.length/CHUNKSIZE);
  var c = 0;
  var first = true;
  var total = Math.ceil(pl.length/CHUNKSIZE);
  while (pl.length > CHUNKSIZE) {
    outputUpdate("Uploading chunk... ("+(c+1)+"/"+total+")");
    c++;
    await api.ext_assetStream(ah, pl.splice(0, CHUNKSIZE), first);
    if (first) first = false;
  };
  outputUpdate("Uploading chunk... ("+(c+1)+"/"+total+")");
  await api.ext_assetStream(ah, pl, first);  
  return true;
}
const outputUpdate = (m) => {
	console.log(chalk.cyan.bold(m));
};
const output = (m) => {
	console.log(chalk.green.bold(m));
};
const outputError = (m) => {
	console.log(chalk.red.bold(m));
};

//Commands
var commands = {};

commands.wallet_create = async (handle, options) => {
	if (!validateHandle(handle)) return outputError("Wallet handle is invalid");
	if (!options.hasOwnProperty('password')) {
		if (!await yesno({question: chalk.yellow.bold('Are you sure you want to create a new wallet without encrypting it with a password? If not, you can set the password using --password? (y/n)')})) return;
	};
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	if (wallets.hasOwnProperty(handle)) return outputError("That wallet handle is already taken");
	var wallet = {};
	var seed = bip39.generateMnemonic();
	var id = getId(seed);
	wallet.principal = id.getPrincipal().toText();
	if (options.hasOwnProperty('password')) {
		wallet.encrypted = true;
		wallet.data = encrypt(wallet.principal, seed, options.password);
	} else {
		wallet.encrypted = false;
		wallet.data = seed;
	};
	wallets[handle] = wallet;
	conf.set('wallets', wallets);
	conf.set('active-wallet', handle);
	return output("Your new wallet was created and has been set to your active wallet!");
};
commands.wallet_import = async (handle, options) => {
	if (!validateHandle(handle)) return outputError("Wallet handle is invalid");
	if (!options.hasOwnProperty('password')) {
		if (!await yesno({question: chalk.yellow.bold('Are you sure you want to import a wallet without encrypting it with a password? If not, you can set the password using --password? (y/n)')})) return;
	};
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	if (wallets.hasOwnProperty(handle)) return outputError("That wallet handle is already taken");
	var wallet = {};
	var seed = options.seed.join(" ");;
	var id = getId(seed);
	wallet.principal = id.getPrincipal().toText();
	if (options.password) {
		wallet.encrypted = true;
		wallet.data = encrypt(wallet.principal, seed, options.password);
	} else {
		wallet.encrypted = false;
		wallet.data = seed;
	};
	wallets[handle] = wallet;
	conf.set('wallets', wallets);
	conf.set('active-wallet', handle);
	return output("Your wallet was imported and has been set to your active wallet!");
};
commands.wallet_list = async () => {
	var wallets = conf.get('wallets');
	if (!wallets) {
		return outputError("You have no stored wallets");
	};
	var w = conf.get('active-wallet');
	var o = 0;
	for (var h of Object.keys(wallets)) {
		output(h+" : "+wallets[h].principal+(h==w ? " *" : ""));
		o++;
	}
	if (o == 0) return outputError("You have no stored wallets");
};
commands.wallet_delete = async (handle) => {
	if (!await yesno({question: chalk.red.bold('If you have not backed this wallet up then you will lose access forever. This can not be reversed! Are you sure you want to delete this wallet? (y/n)')})) return;
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	if (!wallets.hasOwnProperty(handle)) return outputError("No wallet using that handle");
	delete wallets[handle];
	conf.set('wallets', wallets);
	return output("This wallet has been deleted!");
};
commands.wallet_clear = async () => {
	if (!await yesno({question: chalk.red.bold('If you have not backed these wallets up then you will lose access forever. This can not be reversed! Are you sure you want to delete ALL wallets? (y/n)')})) return;
	conf.set('wallets', {});
	return output("All wallets have been cleared");
};
commands.wallet_use = async (handle) => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	if (!wallets.hasOwnProperty(handle)) return outputError("No wallet using that handle");
	conf.set('active-wallet', handle);
	return output("You have set your active wallet!");
};
commands.wallet_export = async (options) => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
	var seed = getWalletSeed(wallets[w], options.password);
	if (!seed) return outputError("Incorrect password");
	
	return output("Your backup seed for this wallet is: " + seed);
};
commands.wallet_whoami = async () => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
  var principal = wallets[w].principal;
	output(w+" : "+principal+" *");
};
commands.wallet_address = async () => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
  var principal = wallets[w].principal;
  var address = extjs.principalToAccountIdentifier(principal, 0);
	output(address);
};
commands.wallet_principal = async () => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
  var principal = wallets[w].principal;
	output(principal);
};
commands.wallet_balance = async () => {
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
  var principal = wallets[w].principal;
  var address = extjs.principalToAccountIdentifier(principal, 0);
  var bal = Number(await extjs.connect("https://boundary.ic0.app/").token().getBalance(address))/100000000;
	output("Wallet balance: " + bal + "ICP");
};
commands.wallet_send = async (amount, address, options) => {
	if (!await yesno({question: chalk.red.bold('This can not be reversed! Are you sure you want to send '+amount+'ICP to '+address+'? (y/n)')})) return;
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
	var seed = getWalletSeed(wallets[w], options.password);
	if (!seed) return outputError("Incorrect password");
	//TODO validate amount and address
	//TODO integrate extjs
	output("This feature is WIP");
};

commands.nft_create = async (handle, options) => {
	if (!validateHandle(handle)) return outputError("Wallet handle is invalid");
	if (fs.existsSync("./"+handle)) return outputError("A directory already exists: "+handle);
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
  //TODO validate input
  
  var principal = wallets[w].principal;
  var address = extjs.principalToAccountIdentifier(principal, 0);
	var seed = getWalletSeed(wallets[w], options.password);
	if (!seed) return outputError("Incorrect password");
  var identity = getId(seed);
  outputUpdate("Creating NFT canister...");
	try {
    var resp = await extjs.connect("https://boundary.ic0.app/", identity).canister(NFTFACTORY, NFTFACTORY_IDL).createCanister("houbaias32sgfwr2fg23ywytg2", principal);
  } catch(e) {
    return outputError("Something went wrong!");
  };
  var config = {
    canister:resp.toText(),
    name:(options.name ?? handle),
    royaltyAddress:(options.address ?? address),
    owner:(options.owner ?? principal),
    admin:(options.admin ?? principal),
    royaltyFee:(options.amount ?? "0.3"),
  };
  try {
    outputUpdate("Update canister config...");
    var nftCanister = extjs.connect("https://boundary.ic0.app/", identity).canister(config.canister, 'ext');
    if (config.owner != principal) await nftCanister.ext_setOwner(Principal.fromText(config.owner));
    if (config.admin != principal) await nftCanister.ext_setAdmin(Principal.fromText(config.admin));
    await nftCanister.ext_setRoyalty(config.royaltyAddress, Math.round(Number(config.royaltyFee)*100000));
    await nftCanister.ext_setCollectionMetadata(config.name, JSON.stringify({}));
    outputUpdate("Creating project folder...");
    fs.mkdirSync("./"+handle);
    fs.mkdirSync("./"+handle+"/assets");
    fs.mkdirSync("./"+handle+"/thumbnails");
    fs.writeFileSync("./"+handle+"/config.json", JSON.stringify(config));
    fs.writeFileSync("./"+handle+"/airdrop.txt", "");
	} catch(e) {
		return outputError("Could not create NFT collection folder!");
	};
  outputUpdate("");
  outputUpdate("View on ICScan: https://icscan.io/canister/"+config.canister);
  outputUpdate("");
  outputUpdate("Goto your project folder using:");
  outputUpdate("cd "+handle);
  outputUpdate("");
  return output("Your new NFT project has been created!");
};

commands.nft_mint = async (options) => {
	if (!fs.existsSync("./config.json")) return outputError("You are not within a valid exponent project directory. You can create a new project using 'exponent nft create'");
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
	var seed = getWalletSeed(wallets[w], options.password);
	if (!seed) return outputError("Incorrect password");
  var principal = wallets[w].principal;
  var address = extjs.principalToAccountIdentifier(principal, 0);
  var identity = getId(seed);
  var assets  = fs.readdirSync("./assets");
  var thumbnails  = fs.readdirSync("./thumbnails");
  var missing = assets.filter(x => !thumbnails.includes(x)).concat(thumbnails.filter(x => !assets.includes(x)));
  if (missing.length){
    let options = { withMetaData: false, width: 300, height: 300, fit : 'cover' }
    outputUpdate("Generating thumbnails: "+missing.length);
    for(var i = 0; i < missing.length; i++){
      try {
        const thumbnail = await imageThumbnail("./assets/"+missing[i], options);
        await fs.writeFileSync("./thumbnails/"+missing[i], thumbnail);
        thumbnails.push(missing[i]);
        outputUpdate("Generated thumbnail: "+missing[i]+" ("+(i+1)+"/"+missing.length+")");
      } catch (err) {
        outputError("Error generating thumbnail: "+missing[i]);
      }
    };
  };
  var config = JSON.parse(fs.readFileSync("./config.json"));
  var nftCanister = extjs.connect("https://boundary.ic0.app/", identity).canister(config.canister, 'ext');
  var toUpload = [];
  var toMint = [];
  outputUpdate("Looking for new assets to mint...");
  for(var i = 0; i < assets.length; i++){
    var ah = removeFilenameExtension(assets[i]);
    var exists = await nftCanister.ext_assetExists(ah);
    if (!exists) {
      outputUpdate("Asset found: " + assets[i]);
      toUpload.push(assets[i]);
    };
  };
  if (toUpload.length){
    var end = (toUpload.length == 1 ? "" : "s");
    outputUpdate("Found " + toUpload.length + " asset"+end+" to mint...");
    outputUpdate(" ");
    for(var i = 0; i < toUpload.length; i++){
      var filename = toUpload[i];
      var ah = removeFilenameExtension(filename);
      var asset = "./assets/"+filename;
      var thumbnail = "./thumbnails/"+filename;
      outputUpdate("Uploading asset: " + filename);
      await uploadAsset(nftCanister, ah, filename, asset);
      var isThumbnail = fs.existsSync(thumbnail);
      if (isThumbnail) {
        outputUpdate("Uploading thumbnail...");
        await uploadAsset(nftCanister, ah+"_thumbnail", filename, thumbnail);
      };
      toMint.push(
        [
          address,
          {
            nonfungible : {
              name : ah,
              asset : ah,
              thumbnail : (isThumbnail? ah+"_thumbnail" : ""),
              metadata : []
            }
          }
        ]
      );
      outputUpdate(" ");
    };
    var end = (toMint.length == 1 ? "" : "s");
    outputUpdate("Minting "+toMint.length+" NFT"+end+"...");
    await nftCanister.ext_mint(toMint);
    outputUpdate(" ");
    output("You have minted all available assets as NFTs!");
  };
};

commands.nft_airdrop = async (options) => {
	if (!fs.existsSync("./config.json")) return outputError("You are not within a valid exponent project directory. You can create a new project using 'exponent nft create'");
	//TODO integrate extjs
	//TODO read airdrop
	//TODO prompt
	var wallets = conf.get('wallets');
	if (!wallets) wallets = {};
	var w = conf.get('active-wallet');
	if (!w || !wallets.hasOwnProperty(w)) return outputError("You do not have an active wallet. Select an active wallet using extjs wallet use");
	var seed = getWalletSeed(wallets[w], options.password);
	if (!seed) return outputError("Incorrect password");
	
};
module.exports = commands;