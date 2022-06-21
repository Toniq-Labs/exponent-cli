# Exponent CLI

Exponent CLI is a command line tool for our Exponent platform, providing developers with a friendly tool to use for the creation and management of tokenized assets (fungible and non fungible) on the Internet Computer.

Firstly, lets install Exponent
```
npm i -g @toniq-labs/exponent
```

Now lets create an identity/wallet to use, and the use it to create an NFT canister
```
exponent wallet create me
exponent nft create myCollection
cd myCollection
```

This creates a project directory, where we can store our NFT assets. You can move your assets into the assets folder, and then mint using exponent.
```
exponent nft mint
```
