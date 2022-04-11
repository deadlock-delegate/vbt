export const discord = {
    "wallet.vote": (address, username, balance, txid, explorerTx) => {
        return `⬆️ **${address}** voted for **${username}** with **${balance}**. [Open transaction](<${explorerTx}${txid}>)`;
    },
    "wallet.unvote": (address, username, balance, txid, explorerTx) => {
        return `⬇️ **${address}** unvoted **${username}** with **${balance}**. [Open transaction](<${explorerTx}${txid}>)`;
    },
    balancechange: (
        direction,
        senderAddress,
        sendersDelegateName,
        recipientsDelegateName,
        recipientAddress,
        amountChg,
        balanceChgPct,
        id,
        explorerTx,
    ) => {
        let msg: string;
        if (direction === "IN") {
            msg = `**${recipientAddress}** voting **${recipientsDelegateName}** increased balance by **${amountChg}** (${balanceChgPct}) via ${senderAddress} address`;
            if (sendersDelegateName) {
                msg += ` voting **${sendersDelegateName}**`;
            }
        } else {
            msg = `**${senderAddress}** voting **${sendersDelegateName}** decreased balance by **${amountChg}** (${balanceChgPct}) sending it to ${recipientAddress} address`;
            if (recipientsDelegateName) {
                msg += ` voting **${recipientsDelegateName}**`;
            }
        }

        msg += ` [Open transaction](<${explorerTx}${id}>)`;
        return msg;
    },
};

export const slack = {
    "wallet.vote": (address, username, balance, txid, explorerTx) => {
        return `⬆️ *${address}* voted for *${username}* with *${balance}*. <${explorerTx}${txid}|Open transaction>`;
    },
    "wallet.unvote": (address, username, balance, txid, explorerTx) => {
        return `⬇️ *${address}* unvoted *${username}* with *${balance}*. <${explorerTx}${txid}|Open transaction>`;
    },
    balancechange: (
        direction,
        senderAddress,
        sendersDelegateName,
        recipientsDelegateName,
        recipientAddress,
        amountChg,
        balanceChgPct,
        id,
        explorerTx,
    ) => {
        let msg: string;
        if (direction === "IN") {
            msg = `**${recipientAddress}** voting **${recipientsDelegateName}** increased balance by **${amountChg}** (${balanceChgPct}) via ${senderAddress} address`;
            if (sendersDelegateName) {
                msg += ` voting **${sendersDelegateName}**`;
            }
        } else {
            msg = `**${senderAddress}** voting **${sendersDelegateName}** decreased balance by **${amountChg}** (${balanceChgPct}) sending it to ${recipientAddress} address`;
            if (recipientsDelegateName) {
                msg += ` voting **${recipientsDelegateName}**`;
            }
        }

        msg += ` <${explorerTx}${id}|Open transaction>`;
        return msg;
    },
};

export const fallback = {
    "wallet.vote": (address, username, balance, txid, explorerTx) => {
        return `⬆️ ${address} voted for ${username} with ${balance}. ${explorerTx}${txid}`;
    },
    "wallet.unvote": (address, username, balance, txid, explorerTx) => {
        return `⬇️ ${address} unvoted ${username} with ${balance}. ${explorerTx}${txid}`;
    },
    balancechange: (
        direction,
        senderAddress,
        sendersDelegateName,
        recipientsDelegateName,
        recipientAddress,
        amountChg,
        balanceChgPct,
        id,
        explorerTx,
    ) => {
        let msg: string;
        if (direction === "IN") {
            msg = `${recipientAddress} voting ${recipientsDelegateName} increased balance by ${amountChg} (${balanceChgPct}) via ${senderAddress} address`;
            if (sendersDelegateName) {
                msg += ` voting **${sendersDelegateName}**`;
            }
        } else {
            msg = `${senderAddress} voting ${sendersDelegateName} decreased balance by ${amountChg} (${balanceChgPct}) sending it to ${recipientAddress} address`;
            if (recipientsDelegateName) {
                msg += ` voting **${recipientsDelegateName}**`;
            }
        }

        msg += ` ${explorerTx}${id}`;
        return msg;
    },
};
