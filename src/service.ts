import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@arkecosystem/core-kernel";
import { Interfaces, Utils as CryptoUtils, Enums } from "@arkecosystem/crypto";
import axios from "axios";
import BigNumber from "bignumber.js";

import { IOptions, NestedArray } from "./interface";
import * as messages from "./messages";

const LOG_PREFIX = "[deadlock-delegate/VBT]";
const VALID_EVENTS = ["voting", "balancechange"];
const EVENT_MAPPING = {
    voting: [AppEnums.VoteEvent.Unvote, AppEnums.VoteEvent.Vote],
    balancechange: [AppEnums.TransactionEvent.Applied],
};

@Container.injectable()
export default class Service {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly emitter!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.WalletRepository)
    // why state, blockchain - why not state, clone?
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    private events = {};
    private explorerTxUrl: string = "";

    public async listen(options: IOptions): Promise<void> {
        this.explorerTxUrl = options.explorerTx;

        for (const webhook of options.webhooks) {
            for (const event of webhook.events) {
                if (!VALID_EVENTS.includes(event)) {
                    this.logger.warning(
                        `${LOG_PREFIX} ${event} is not a valid event. Check events in your deadlock-notifier configuration`,
                    );
                    continue;
                }

                const events = EVENT_MAPPING[event];
                for (const e of events) {
                    if (!this.events[e]) {
                        this.events[e] = [];
                    }

                    let eventName = e;
                    if (event === "balancechange") {
                        eventName = "balancechange";
                    }

                    this.events[e].push({
                        endpoint: webhook.endpoint,
                        payload: webhook.payload,
                        delegates: webhook.delegates,
                        eventName,
                    });
                }
            }
        }
        Object.keys(this.events).forEach((event) => this.subscribe(event));
    }

    private subscribe(event: string) {
        // for some yet unknown reason, if handlers are defined at the class level, we can not access
        // walletRepositoiry or triggers (or other) within each handle functions
        const handlers = {
            [AppEnums.VoteEvent.Vote]: this.walletVote.bind({
                walletRepository: this.walletRepository,
                logger: this.logger,
            }),
            [AppEnums.VoteEvent.Unvote]: this.walletUnvote.bind({
                walletRepository: this.walletRepository,
                logger: this.logger,
            }),
            balancechange: this.transactionDetected.bind({
                walletRepository: this.walletRepository,
                logger: this.logger,
                handleTransfer: this.handleTransfer,
            }),
        };

        this.emitter.listen(event, {
            handle: async (payload: any) => {
                const { name, data } = payload;

                const webhooks = this.events[name];

                const requests: Promise<any>[] = [];
                for (const webhook of webhooks) {
                    const messageData: NestedArray<any> = await handlers[webhook.eventName](data, webhook.delegates);
                    if (messageData.length === 0) {
                        continue;
                    }

                    for (const msg of messageData) {
                        msg.push(this.explorerTxUrl);

                        const platform = this.detectPlatform(webhook.endpoint);
                        const message = this.getMessage(platform, webhook.eventName, msg);
                        // todo: `webhook.payload.msg` is the name of the message field eg. discord has "content", slack has "text", make this a bit smarter ;)
                        payload[webhook.payload.msg] = message;

                        // todo: this should be nicer so no checks for platform === pushover would be needed
                        // quick change to handle pushover a little differently
                        if (platform === "pushover") {
                            if (!webhook.payload.token || !webhook.payload.user) {
                                this.logger.error(
                                    `${LOG_PREFIX} Unable to setup pushover notifications. User and token params must be set`,
                                );
                                continue;
                            }
                            payload = { ...payload, token: webhook.payload.token, user: webhook.payload.user };
                        }
                        requests.push(axios.post(webhook.endpoint, payload));
                    }
                }

                // don't care about the response msg except if there's an error
                try {
                    if (name === AppEnums.VoteEvent.Vote) {
                        await AppUtils.sleep(1000);
                    }
                    await Promise.all(requests);
                } catch (err) {
                    this.logger.error(`${LOG_PREFIX} ${err}`);
                }
            },
        });
    }

    private getMessage(platform: string, event: string, data: any) {
        // todo: this should be nicer so no checks for platform === pushover would be needed
        if (platform === "pushover") {
            platform = "fallback";
        }
        return messages[platform][event](...data);
    }

    private detectPlatform(endpoint: string) {
        if (endpoint.includes("hooks.slack.com")) {
            return "slack";
        } else if (endpoint.includes("discordapp.com") || endpoint.includes("discord.com")) {
            return "discord";
        } else if (endpoint.includes("pushover.net")) {
            return "pushover";
        } else {
            return "fallback";
        }
    }

    private async walletVote(
        { delegate, transaction }: { delegate: string; transaction: Interfaces.ITransactionData },
        delegates: string[],
    ): Promise<any[] | null> {
        AppUtils.assert.defined<string>(transaction.senderPublicKey);

        const delIdentifier = delegate.replace("+", "").replace("-", "");
        const pubKeyExists = this.walletRepository.hasByPublicKey(delIdentifier);
        let delWallet: Contracts.State.Wallet;
        if (pubKeyExists) {
            delWallet = this.walletRepository.findByPublicKey(delIdentifier);
        } else {
            delWallet = this.walletRepository.findByUsername(delIdentifier);
        }

        const delegateUsername = delWallet.getAttribute("delegate.username");
        if (!delegates.includes(delegateUsername)) {
            return [];
        }

        const voterWallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
        if (voterWallet.getAddress() == delWallet.getAddress()) {
            return [];
        }

        const balance = CryptoUtils.formatSatoshi(voterWallet.getBalance());
        return [[voterWallet.getAddress(), delWallet.getAttribute("delegate.username"), `+${balance}`, transaction.id]];
    }

    private async walletUnvote(
        { delegate, transaction }: { delegate: string; transaction: Interfaces.ITransactionData },
        delegates: string[],
    ): Promise<any[] | null> {
        AppUtils.assert.defined<string>(transaction.senderPublicKey);

        const delIdentifier = delegate.replace("+", "").replace("-", "");
        const pubKeyExists = this.walletRepository.hasByPublicKey(delIdentifier);
        let delWallet: Contracts.State.Wallet;
        if (pubKeyExists) {
            delWallet = this.walletRepository.findByPublicKey(delIdentifier);
        } else {
            delWallet = this.walletRepository.findByUsername(delIdentifier);
        }

        const delegateUsername = delWallet.getAttribute("delegate.username");
        if (!delegates.includes(delegateUsername)) {
            return [];
        }

        const voterWallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
        if (voterWallet.getAddress() == delWallet.getAddress()) {
            return [];
        }

        const balance = CryptoUtils.formatSatoshi(voterWallet.getBalance());
        return [[voterWallet.getAddress(), delWallet.getAttribute("delegate.username"), `-${balance}`, transaction.id]];
    }

    private handleTransfer(data: any, delegates: string[]) {
        const { senderPublicKey, amount, id, recipientId } = data;

        const sender = this.walletRepository.findByPublicKey(senderPublicKey);
        let sendersDelegate: Contracts.State.Wallet | undefined = undefined;
        let sendersDelegateName = "";
        if (sender.hasVoted()) {
            sendersDelegate = this.walletRepository.findByPublicKey(sender.getAttribute("vote"));
            sendersDelegateName = sendersDelegate.getAttribute("delegate.username");
        }

        const recipient = this.walletRepository.findByAddress(recipientId);
        let recipientsDelegate: Contracts.State.Wallet | undefined = undefined;
        let recipientsDelegateName = "";
        if (recipient.hasVoted()) {
            recipientsDelegate = this.walletRepository.findByPublicKey(recipient.getAttribute("vote"));
            recipientsDelegateName = recipientsDelegate.getAttribute("delegate.username");
        }

        if (!(sendersDelegateName || recipientsDelegateName)) {
            return [];
        }

        if (sender.getAddress() === recipient.getAddress()) {
            return [];
        }

        const senderBalance = sender.getBalance();
        const recipientBalance = recipient.getBalance();
        const amountFmt = CryptoUtils.formatSatoshi(amount);

        const notifications: NestedArray<any> = [];
        if (delegates.includes(sendersDelegateName)) {
            // sender votes for genesis_1 (tracked), recipient votes for unknown (not tracked)
            // sender balance -> before: 100.000, now: 85.000
            // recipient balance -> before: X, now: X + 15.000
            // amount = 15.000

            const bn_transfer_amount = new BigNumber(amount.toString());
            const bn_balance = new BigNumber(senderBalance.toString());
            const balanceChangePct = bn_transfer_amount.times(100).dividedBy(bn_balance.plus(bn_transfer_amount));
            const changePct = balanceChangePct.toFormat(2);

            notifications.push([
                "OUT",
                sender.getAddress(),
                sendersDelegateName,
                recipientsDelegateName,
                recipient.getAddress(),
                `-${amountFmt}`,
                `-${changePct}%`,
                id,
            ]);
        }

        if (delegates.includes(recipientsDelegateName)) {
            // sender votes for uknown (not tracked), recipient votes for genesis_1 (tracked)
            // sender balance -> before: 100.000, now: 85.000
            // recipient balance -> before: X, now: X + 15.000
            // amount = 15.000
            const bn_transfer_amount = new BigNumber(amount.toString());
            const bn_balance = new BigNumber(recipientBalance.toString());
            const balanceChangePct = bn_transfer_amount.times(100).dividedBy(bn_balance.plus(bn_transfer_amount));
            const changePct = balanceChangePct.toFormat(2);

            notifications.push([
                "IN",
                sender.getAddress(),
                sendersDelegateName,
                recipientsDelegateName,
                recipient.getAddress(),
                `+${amountFmt}`,
                `+${changePct}%`,
                id,
            ]);
        }

        return notifications;
    }

    private async transactionDetected(data: any, delegates: string[]): Promise<any[] | null> {
        // TRANSFER
        // data = {
        //     version: 2,
        //     network: 23,
        //     typeGroup: 1,
        //     type: 0,
        //     nonce: BigNumber { value: 3n },
        //     senderPublicKey: '02def27da9336e7fbf63131b8d7e5c9f45b296235db035f1f4242c507398f0f21d',
        //     fee: BigNumber { value: 10000000n },
        //     amount: BigNumber { value: 100000000n },
        //     expiration: 0,
        //     recipientId: 'ANBkoGqWeTSiaEVgVzSKZd3jS7UWzv9PSo',
        //     signature: 'a0b5ccae19e82f1d34518e9adc7c122da8d100fdc0f2bcdbcd1f1bb0a0ae960dd4cc9181f18090b2e9be857c8cbdc8e46b1a6793bb802e648906a63c44035f09',
        //     id: 'd2dc487e0903c23728939a7a5da368a2fdb70d162f24e24e797de5259d62cfb2',
        //     blockId: '7670097519119329960',
        //     blockHeight: 712,
        //     sequence: 0
        //   }

        // MULTIPAYMENT (includes self-payment)
        // data = {
        //     "version": 2,
        //     "network": 23,
        //     "typeGroup": 1,
        //     "type": 6,
        //     "nonce": "4",
        //     "senderPublicKey": "03287bfebba4c7881a0509717e71b34b63f31e40021c321f89ae04f84be6d6ac37",
        //     "fee": "10000000",
        //     "amount": "0",
        //     "asset": {
        //         "payments": [{
        //             "amount": "100000000",
        //             "recipientId": "AbfQq8iRSf9TFQRzQWo33dHYU7HFMS17Zd"
        //         }, {
        //             "amount": "200000000",
        //             "recipientId": "ASGXgo72CoLbmh8BQ4Q97VC3qvhni1C1LN"
        //         }, {
        //             "amount": "300000000",
        //             "recipientId": "ANBkoGqWeTSiaEVgVzSKZd3jS7UWzv9PSo"
        //         }]
        //     },
        //     "signature": "87eda4ee48b7214ed6953f9e5049051de01f5db95a4b4ef1d2096668e8ff24afa426cf4b5f206aacac99027704c5b2bf7a4090dc6beb2f081832223c36696dc6",
        //     "id": "e33045dd0fb3201fd3a67ce268d0e29c4bea15054edf42a5ddee3206e944b4fd",
        //     "blockId": "3010670670693310237",
        //     "blockHeight": 809,
        //     "sequence": 0
        // }

        const { type, asset } = data;
        // TODO: for some reasons Enums always returned undefined when running via plugin:intall on solar
        // hence why I've hardcoded transaction types
        // Enums.TransactionType.Transfer, Enums.TransactionType.MultiPayment
        if (![0, 6].includes(type)) {
            return [];
        }

        let notifications: NestedArray<any> = [];
        if (asset) {
            // multipayment
            for (const payment of asset.payments) {
                const txdata = {
                    senderPublicKey: data.senderPublicKey,
                    amount: payment.amount,
                    id: data.id,
                    recipientId: payment.recipientId,
                };
                const notifs = this.handleTransfer(txdata, delegates);
                notifications = notifications.concat(notifs);
            }
        } else {
            // normal transfer
            const notifs = this.handleTransfer(data, delegates);
            notifications = notifications.concat(notifs);
        }

        return notifications;
    }
}
