/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { User } from "@vencord/discord-types";
import { UsernameUtils, UserStore } from "@webpack/common";

interface StaffUserPrototype {
    isStaff?: (this: User) => boolean;
    isStaffPersonal?: (this: User) => boolean;
    hasAnyStaffLevel?: (this: User) => boolean;
    hasFlag?: (this: User, flag: number) => boolean;
}

let isLocalStaff: ((user: User) => boolean) | undefined;
let getCurrentUser: (() => User | undefined) | undefined;
let originalIsStaff: StaffUserPrototype["isStaff"];
let originalIsStaffPersonal: StaffUserPrototype["isStaffPersonal"];
let originalHasAnyStaffLevel: StaffUserPrototype["hasAnyStaffLevel"];
let originalHasFlag: StaffUserPrototype["hasFlag"];
let originalGetUserIsStaff: typeof UsernameUtils.getUserIsStaff | undefined;
let modifiedUser: User | undefined;
let originalFlags: number | undefined;
let originalHadOwnFlags = false;
let patchedPrototype: StaffUserPrototype | undefined;
let installed = false;

function getUserPrototype(): StaffUserPrototype | undefined {
    const user = getCurrentUser?.() ?? Object.values(UserStore.getUsers())[0];
    return user && Object.getPrototypeOf(user);
}

function notifyUserUpdate() {
    UserStore.emitChange();
}

function restoreFlags(user: User) {
    Reflect.set(user, "flags", originalFlags ?? 0);
    if (!originalHadOwnFlags) Reflect.deleteProperty(user, "flags");
}

export function syncStaffSpoof() {
    if (!installed || !isLocalStaff || !getCurrentUser) return;

    const user = getCurrentUser();
    if (modifiedUser && (!user || modifiedUser.id !== user.id)) {
        restoreFlags(modifiedUser);
        modifiedUser = undefined;
        originalFlags = undefined;
        originalHadOwnFlags = false;
    }

    if (modifiedUser && user) {
        modifiedUser = user;
        if (!isLocalStaff(user)) {
            restoreFlags(user);
            notifyUserUpdate();
            modifiedUser = undefined;
            originalFlags = undefined;
            originalHadOwnFlags = false;
        } else {
            user.flags = (user.flags ?? 0) | 1;
        }
        return;
    }

    if (user && isLocalStaff(user)) {
        modifiedUser = user;
        originalHadOwnFlags = Object.prototype.hasOwnProperty.call(user, "flags");
        originalFlags = user.flags;
        user.flags = (user.flags ?? 0) | 1;
        notifyUserUpdate();
    }
}

export function installStaffSpoof(staffCheck: (user: User) => boolean, currentUser: () => User | undefined) {
    if (installed) return;
    installed = true;
    isLocalStaff = staffCheck;
    getCurrentUser = currentUser;

    const proto = getUserPrototype();
    patchedPrototype = proto;
    if (proto?.isStaff) {
        const original = proto.isStaff;
        originalIsStaff = original;
        proto.isStaff = function () {
            return isLocalStaff?.(this) || Reflect.apply(original, this, arguments);
        };
    }
    if (proto?.isStaffPersonal) {
        const original = proto.isStaffPersonal;
        originalIsStaffPersonal = original;
        proto.isStaffPersonal = function () {
            return isLocalStaff?.(this) || Reflect.apply(original, this, arguments);
        };
    }
    if (proto?.hasAnyStaffLevel) {
        const original = proto.hasAnyStaffLevel;
        originalHasAnyStaffLevel = original;
        proto.hasAnyStaffLevel = function () {
            return isLocalStaff?.(this) || Reflect.apply(original, this, arguments);
        };
    }
    if (proto?.hasFlag) {
        const original = proto.hasFlag;
        originalHasFlag = original;
        proto.hasFlag = function (flag: number) {
            if (isLocalStaff?.(this) && (flag & 1)) {
                return flag === 1 || Reflect.apply(original, this, [flag & ~1]);
            }
            return Reflect.apply(original, this, arguments);
        };
    }

    if (UsernameUtils.getUserIsStaff) {
        const original = UsernameUtils.getUserIsStaff;
        originalGetUserIsStaff = original;
        UsernameUtils.getUserIsStaff = user => isLocalStaff?.(user) || original(user);
    }

    syncStaffSpoof();
}

export function uninstallStaffSpoof() {
    if (!installed) return;

    if (modifiedUser) {
        const currentUser = getCurrentUser?.();
        const user = currentUser?.id === modifiedUser.id ? currentUser : modifiedUser;
        restoreFlags(user);
        if (user === currentUser) notifyUserUpdate();
    }

    const proto = patchedPrototype;
    if (proto) {
        if (originalIsStaff) proto.isStaff = originalIsStaff;
        if (originalIsStaffPersonal) proto.isStaffPersonal = originalIsStaffPersonal;
        if (originalHasAnyStaffLevel) proto.hasAnyStaffLevel = originalHasAnyStaffLevel;
        if (originalHasFlag) proto.hasFlag = originalHasFlag;
    }
    if (originalGetUserIsStaff) UsernameUtils.getUserIsStaff = originalGetUserIsStaff;

    isLocalStaff = undefined;
    getCurrentUser = undefined;
    originalIsStaff = undefined;
    originalIsStaffPersonal = undefined;
    originalHasAnyStaffLevel = undefined;
    originalHasFlag = undefined;
    originalGetUserIsStaff = undefined;
    modifiedUser = undefined;
    originalFlags = undefined;
    originalHadOwnFlags = false;
    patchedPrototype = undefined;
    installed = false;
}
