/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { build } = createRequire(path.join(process.cwd(), "package.json"))("esbuild");

const bundle = build({
    entryPoints: [path.join(__dirname, "../patches.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["@webpack", "@webpack/common"],
    plugins: [{
        name: "profile-state",
        setup(builder) {
            builder.onResolve({ filter: /^\.\/modules\/customProfile$/ }, () => ({ path: "profile-state", external: true }));
        }
    }]
});

const staffBundle = build({
    entryPoints: [path.join(__dirname, "../modules/staffSpoof.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["@webpack/common", "@vencord/discord-types"]
});

class User {
    constructor(id, premiumType = null) {
        this.id = id;
        this.premiumType = premiumType;
        this.flags = 128;
        this.publicFlags = 0;
        this.premiumState = null;
        this.perks = { activePerksBitmask: ["0"] };
    }
    hasFlag(flag) { return (this.flags & flag) === flag; }
    isStaff() { return false; }
    isStaffPersonal() { return false; }
    hasAnyStaffLevel() { return false; }
    hasFreePremium() { return this.isStaff() || this.hasFlag(2) || this.isStaffPersonal(); }
    hasPaidTier2Subscription() { return this.premiumType === 2 && this.premiumState?.premiumSubscriptionType === 4; }
    isOnReverseTrial() { return this.premiumType != null && this.premiumState?.premiumSource === 3; }
    isPremiumWithFractionalPremiumOnly() { return this.premiumType === 2 && this.premiumState?.premiumSource === 2; }
}

async function setup(data = {}) {
    const real = new User("self");
    const other = new User("other");
    const state = {
        _dataVersion: 0,
        storedData: data,
        isEnabled: true,
        isMe: id => id === "self",
        getCustomDataForUser: id => id === "self" && state.isEnabled ? { data: state.storedData, enabled: true } : null
    };
    const common = {
        UserStore: {
            getCurrentUser: () => real,
            getUser: id => id === "self" ? real : other,
            getUsers: () => ({ self: real, other }),
            emitChange() {}
        },
        UserProfileStore: { getUserProfile: () => ({ userId: "self", premiumType: null }), getGuildMemberProfile: () => null },
        GuildMemberStore: {}, IconUtils: {}, SnowflakeUtils: {}, RestAPI: {},
        FluxDispatcher: { dispatch() {} },
        UsernameUtils: { getUserIsStaff: () => false }
    };
    const module = { exports: {} };
    const mocks = {
        "profile-state": state,
        "@webpack/common": common,
        "@webpack": { findByPropsLazy: (...props) => props.includes("BOOST_ONLY") ? { TIER_2: 4 } : { SUBSCRIPTION: 1 } }
    };
    vm.runInNewContext((await bundle).outputFiles[0].text, {
        module, exports: module.exports, require: id => mocks[id], Vencord: { Webpack: {} }, Date
    });
    return { api: module.exports, state, common, real, other };
}

async function setupStaffSpoof() {
    const real = new User("self");
    const other = new User("other");
    const common = {
        UserStore: { getUsers: () => ({ self: real, other }), emitChange() {} },
        FluxDispatcher: { dispatch() {} },
        UsernameUtils: { getUserIsStaff: () => false }
    };
    const module = { exports: {} };
    vm.runInNewContext((await staffBundle).outputFiles[0].text, {
        module,
        exports: module.exports,
        require: id => ({ "@webpack/common": common }[id])
    });
    return { api: module.exports, common, real, other };
}

test("Nitro tenure sees a paid tier 2 appearance without changing the server user", async () => {
    const { api, real } = await setup();
    const user = api.fakeCurrentUser(real, { nitro: true });
    assert.equal(user.premiumType, 2);
    assert.equal(user.hasPaidTier2Subscription(), true);
    assert.equal(user.hasFreePremium(), false);
    assert.equal(user.isStaff(), false);
    assert.equal(user.perks, null);
    assert.equal(real.premiumType, null);
    assert.equal(real.premiumState, null);
    assert.equal(real.hasPaidTier2Subscription(), false);
});

test("fractional and trial methods use the same overridden premium state", async () => {
    const { api, real } = await setup();
    real.premiumType = 2;
    real.premiumState = { premiumSource: 2, premiumSubscriptionType: 0 };
    const user = api.fakeCurrentUser(real, { nitro: true });
    assert.equal(user.isPremiumWithFractionalPremiumOnly(), false);
    real.premiumState.premiumSource = 3;
    assert.equal(user.isOnReverseTrial(), false);
    assert.equal(real.isOnReverseTrial(), true);
});

test("profile proxy follows the Staff badge while preserving unrelated flags", async () => {
    const { api, real } = await setup();
    const user = api.fakeCurrentUser(real, { badgeFlags: 1 });
    assert.equal(user.isStaff(), true);
    assert.equal(user.hasAnyStaffLevel(), true);
    assert.equal(user.hasFlag(1), true);
    assert.equal(user.hasFlag(128), true);
    assert.equal(user.flags, 129);
    assert.equal(user.isStaffPersonal(), false);
    assert.equal(real.flags, 128);
    assert.equal(api.fakeCurrentUser(real, { badgeFlags: 0 }).isStaff(), false);
});

test("disabling Nitro preserves a real subscription and its tenure", async () => {
    const { api, real } = await setup();
    real.premiumType = 2;
    real.premiumState = { premiumSource: 1, premiumSubscriptionType: 4 };
    const data = { nitro: false, badgeFlags: 1 };
    assert.equal(api.fakeCurrentUser(real, data).hasPaidTier2Subscription(), true);
    const profile = { userId: "self", premiumType: 2, premiumSince: new Date("2020-01-01"), premiumGuildSince: new Date("2021-01-01") };
    const result = api.hookUserProfile(profile, data);
    assert.equal(result.premiumType, 2);
    assert.equal(result.premiumSince, profile.premiumSince);
    assert.equal(result.premiumGuildSince, profile.premiumGuildSince);
});

test("store hooks isolate accounts and restore original methods on stop", async () => {
    const { api, common, state, real, other } = await setup({ nitro: true, badgeFlags: 1 });
    api.installStoreHooks();
    assert.equal(common.UserStore.getCurrentUser().hasPaidTier2Subscription(), true);
    assert.equal(api.isLocalStaff(real), true);
    assert.equal(api.isLocalStaff(other), false);
    assert.equal(common.UserStore.getUser("other"), other);
    state.isEnabled = false;
    assert.equal(common.UserStore.getCurrentUser(), real);
    assert.equal(api.isLocalStaff(real), false);
    state.isEnabled = true;
    api.uninstallStoreHooks();
    assert.equal(common.UserStore.getCurrentUser(), real);
    assert.equal(api.isLocalStaff(real), false);
});

test("Staff badge updates every client-side staff check and restores them dynamically", async () => {
    const { api, common, real, other } = await setupStaffSpoof();
    let enabled = true;

    api.installStaffSpoof(user => enabled && user.id === "self", () => real);
    assert.equal(real.isStaff(), true);
    assert.equal(real.isStaffPersonal(), true);
    assert.equal(real.hasAnyStaffLevel(), true);
    assert.equal(real.hasFlag(1), true);
    assert.equal(real.flags, 129);
    assert.equal(common.UsernameUtils.getUserIsStaff(real), true);
    assert.equal(other.isStaff(), false);

    enabled = false;
    api.syncStaffSpoof();
    assert.equal(real.isStaff(), false);
    assert.equal(real.isStaffPersonal(), false);
    assert.equal(real.hasAnyStaffLevel(), false);
    assert.equal(real.hasFlag(1), false);
    assert.equal(real.flags, 128);
    assert.equal(common.UsernameUtils.getUserIsStaff(real), false);

    enabled = true;
    api.syncStaffSpoof();
    api.uninstallStaffSpoof();
    assert.equal(real.isStaff(), false);
    assert.equal(real.flags, 128);
});

test("removing the Staff badge restores an originally missing flags property", async () => {
    const { api, real } = await setupStaffSpoof();
    delete real.flags;
    let enabled = true;

    api.installStaffSpoof(user => enabled && user.id === "self", () => real);
    assert.equal(real.flags, 1);

    enabled = false;
    api.syncStaffSpoof();
    assert.equal(Object.prototype.hasOwnProperty.call(real, "flags"), false);
    assert.equal(real.isStaff(), false);
    assert.equal(real.hasFlag(1), false);

    enabled = true;
    api.syncStaffSpoof();
    assert.equal(real.flags, 1);
    assert.equal(real.isStaff(), true);

    enabled = false;
    api.syncStaffSpoof();
    api.uninstallStaffSpoof();
});

test("preview badges use unsaved draft data independently of the saved account", async () => {
    const { api, state } = await setup({ nitro: false });
    state.isEnabled = false;
    assert.equal(api.getCustomProfileBadgesList("self").length, 0);
    const badges = api.getCustomProfileBadgesList("self", { nitro: true, nitroLevel: 8, badgeFlags: 1 });
    assert.equal(badges.some(b => b.id === "premium_tenure_72_month_v2"), true);
    assert.equal(badges.some(b => b.id === "staff"), true);
    assert.equal(state.storedData.nitro, false);
});
