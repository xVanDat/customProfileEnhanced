# CustomProfileEnhanced

CustomProfileEnhanced is a community-maintained backport of Nightcord's `CustomProfile` plugin, adapted to run as an Equicord userplugin. It exists so users can access the profile customization features without installing or running the Nightcord client.

This project is not affiliated with, endorsed by or supported by Nightcord, Equicord, Vencord or Discord Inc.

## Security and responsibility

The backported code has been reviewed and adapted so that it does not read, store or transmit your Discord account token. It does not include Nightcord's account-token synchronization code and does not connect to Nightcord's synchronization services.

Custom profile data, fake account previews and per-user custom statuses are stored locally. The plugin makes network requests only when needed to:

- Load collectible metadata from Discord for Avatar Decorations, Profile Effects, Nameplates and experimental Profile Frames.
- Load badge metadata from the configured Global Badges API. The default is `https://badges.equicord.org/`.
- Display assets hosted by Discord's CDN or links explicitly configured by the user.

No security review can guarantee that third-party software will remain risk-free forever. Discord and Equicord can change, third-party services can change, and future modifications to this repository may introduce new risks. Review changes before updating and install only from a repository you trust.

**YOU USE THIS PLUGIN ENTIRELY AT YOUR OWN RISK. YOU ARE RESPONSIBLE FOR YOUR ACCOUNT, CLIENT, DATA AND COMPLIANCE WITH DISCORD'S TERMS OF SERVICE.**

## Features

- Local profile overrides for username, display name, bio, pronouns, account creation date, email and phone previews.
- Local avatar, banner, profile color and Nitro appearance previews.
- Custom Discord badge previews and Global Badges integration.
- Discord Shop link or SKU ID support for Avatar Decorations, Profile Effects, Nameplates and experimental Profile Frames.
- Local profile connections.
- Local custom statuses for individual users while they are Online or Idle.
- Local fake account entries and profile previews in Discord's account switcher.

All spoofed profile changes are local-only. Other Discord users will not see them.

## Installation

> [!IMPORTANT]
> **YOU MUST BUILD EQUICORD FROM SOURCE BEFORE YOU CAN USE THIS OR ANY SIMILAR USERPLUGIN. PREBUILT EQUICORD DOWNLOADS DO NOT LOAD SOURCE USERPLUGINS.**

### Requirements

- Git
- Node.js LTS
- `pnpm`
- A desktop Discord installation if you plan to inject Equicord into Discord Desktop

Do not perform the Equicord build or injection steps from an Administrator/root terminal.

### 1. Clone and build Equicord from source first

```shell
git clone https://github.com/Equicord/Equicord.git
cd Equicord
pnpm install --frozen-lockfile
pnpm build
```

The first `pnpm build` is mandatory. It confirms that your Equicord source checkout and build environment work before adding an unbundled userplugin.

### 2. Install CustomProfileEnhanced

From the Equicord repository root, clone this repository into `src/userplugins/customProfileEnhanced`:

```shell
git clone <CUSTOM_PROFILE_ENHANCED_REPOSITORY_URL> src/userplugins/customProfileEnhanced
```

Replace `<CUSTOM_PROFILE_ENHANCED_REPOSITORY_URL>` with the HTTPS clone URL of this repository.

If you downloaded a ZIP instead, extract it so that this file exists:

```text
Equicord/src/userplugins/customProfileEnhanced/index.tsx
```

Do not create an extra nested folder such as `customProfileEnhanced/customProfileEnhanced/index.tsx`.

### 3. Rebuild Equicord with the userplugin

```shell
pnpm build
```

You must rebuild Equicord whenever you install or update this plugin.

### 4. Inject the rebuilt Equicord client

```shell
pnpm inject
```

Fully restart Discord, open Equicord Settings, find **CustomProfileEnhanced** in the Plugins tab and enable it. Because the plugin patches Discord's profile UI, restart Discord again after enabling or disabling it.

## Updating

From `Equicord/src/userplugins/customProfileEnhanced`:

```shell
git pull
cd ../../..
pnpm build
pnpm inject
```

Review the incoming changes before rebuilding and injecting them.

## Compatibility

Profile Frames are experimental because Discord is still changing this feature. A valid Shop SKU may temporarily fail if Discord changes the collectible metadata format.

## Origin and licensing

This plugin was backported from Nightcord's plugin named `CustomProfile` and adapted for Equicord. The source retains the existing Vencord/Equicord GPL attribution headers. Modifications and redistribution are provided under the GNU General Public License v3.0 or later.

Nightcord is credited only as the source of the original plugin implementation. This backport does not require Nightcord and does not reuse Nightcord's token synchronization service.
