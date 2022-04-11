# VBT Plugin

Track balance changes of your voters. Useful to identify strange behaviour if any of your voter is 
attempting to game your TBW payout script.

![Sample](https://github.com/deadlock-delegate/vbt/raw/master/sample.png)

#### ❤️ Support maintenance and development of plugins
If you find this or other plugins useful please consider voting for `deadlock` delegate on Solar or Ark networks.

## Installation

### Adding plugin to config

Before restarting your process, you need to add the plugin into the very end  `core.plugins` or `relay.plugins` section of `app.json` file:

```json
{
    "package": "@deadlock-delegate/vbt",
    "options": {
        "enabled": true,
        "explorerTx": "https://explorer.ark.io/transaction/",
        "webhooks": [{
          "endpoint": "https://discordapp.com/api/webhooks/612412465124612462/A1Ag12F&ijafa-3mtASA121mja",
          "payload": {
            "msg": "content"
          },
          "events": ["voting", "balancechange"],
          "delegates": ["deadlock"]
        }, {
          "endpoint": "https://hooks.slack.com/services/T1212ASDA/BAEWAS12/ASxASJL901ajkS",
          "payload": {
            "msg": "text"
          },
          "events": ["voting", "balancechange"],
          "delegates": ["deadlock"]
        },
        {
          "endpoint": "https://api.pushover.net/",
          "payload": {
            "msg": "message",
            "user": "<pushover user key>",
            "token": "<pushover token>"
          },
          "events": ["voting", "balancechange"],
          "delegates": ["deadlock"]
        }]
    }
}
```

### For production (eg. mainnet/testnet/devnet):

1. Install plugin: `<command> plugin:install @deadlock-delegate/vbt`, eg: `ark plugin:install @deadlock-delegate/vbt` or `solar plugin:install @deadlock-delegate/vbt`
2. Add plugin to `app.json`
3. Start your node as you usually start it 

### For active development:

Assuming you don't run testnet locally via docker:

1. Clone this plugin into `plugins/` directory of the `core` project
2. Add plugin to `app.json`, for testnet the file can be found in: `core/packages/core/bin/config/testnet/app.json`
3. Go into the plugin's directory: `cd vbt`
4. Build plugin: `yarn build`
5. Run `yarn full:testnet` inside `core/packages/core` directory to start testnet with vbt plugin

### Configuration explanation

```json
{
  "package": "@deadlock-delegate/vbt",
  "options": {
    "enabled": true,
    "explorerTx": "https://explorer.ark.io/transaction/",
    "webhooks": [{
      "endpoint": "webhook endpoint url",
      "payload": {
        "msg": "name of the message field eg. Discord has 'content', Slack has 'text', Pushover has 'message'"
      },
      "events": ["list of events you want to subscribe to"],
      "delegates": ["list of delegates for which you wish to receive notifications"]
    }]
  }
}
```

#### Events you can subscribe to

- `voting`: sends a message when someone votes for or unvotes a given delegate specified in the delegates field
- `balancechange`: sends a message when someone moves funds in/out from a wallet voting for a given delegate specified in the delegates field

## Credits

- [roks0n](https://github.com/roks0n)
- [console](https://github.com/c0nsol3/)
- [All Contributors](../../contributors)

## License

[MIT](LICENSE) © deadlock delegate
