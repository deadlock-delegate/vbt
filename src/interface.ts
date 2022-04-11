export interface IWebhook {
    endpoint: string;
    events: string[];
    delegates: string[];
    payload: { msg: string };
}

export interface IOptions {
    enabled: boolean;
    explorerTx: string;
    webhooks: IWebhook[];
}

export type NestedArray<T> = Array<T> | Array<NestedArray<T>>;
