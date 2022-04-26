# Smart Contract

### Runing on local

Open your favorite terminal and run these commands.

1. Pull mandala dev node source code:
    ```sh
    > git clone --recurse-submodules git@github.com:AcalaNetwork/bodhi.js.git
    > cd bodhi.js
    > rush update
    > rush build
    ```
2. Start network node:
    ```sh
    > cd evm-subql
    > docker-compose up
    ```
3. Open new terminal window in the same dir.
4. Start RPC node:
    ```sh
    > cd ../eth-rpc-adapter   // bodhi.js/eth-rpc-adapter
    > rushx build
    > LOCAL_MODE=1 rushx dev
    ```
5. Open new terminal window in the project root.
6. Deploy contracts:
    ```sh
    > npx hardhat run scripts/deploy.js --network mandala_dev
    ```
