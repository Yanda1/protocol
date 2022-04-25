# Smart Contract

### Runing on local

Open your favorite terminal and run these commands.

 1. Start moonbeam dev node
     for Mac:
    ```sh
    > docker run --rm --name moonbeam_development -p 9944:9944 -p 9933:9933 \
    purestake/moonbeam:v0.22.1 \
    --dev --ws-external --rpc-external
    ```
    for Linux:
    ```sh
    > docker run --rm --name moonbeam_development --network host \
    purestake/moonbeam:v0.22.1 \
    --dev
    ```
    for Windows:
    ```sh
    > docker run --rm --name moonbeam_development -p 9944:9944 -p 9933:9933 ^
    purestake/moonbeam:v0.22.1 ^
    --dev --ws-external --rpc-external
    ```


2. Open new terminal window

3. Run tests:
    ```sh
    > npx hardhat test --network moonbeam_dev
    ```
