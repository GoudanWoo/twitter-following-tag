// ==UserScript==
// @name         Twitter 关注状态 + 列表标签
// @namespace    https://github.com/GoudanWoo/twitter-following-tag
// @version      1.0.3
// @description  根据关注状态显示不同标签, 并且根据所在列表显示自定义标签
// @author       Goudan Woo
// @homepage     https://x.com/GoudanWoo
// @icon         https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png
// @supportURL   https://github.com/GoudanWoo/twitter-following-tag/issues
// @license      GPLv3
// @match        https://x.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-start
// @require      https://update.greasyfork.org/scripts/426194/971661/toastjs.js
// @require      https://cdn.bootcdn.net/ajax/libs/jquery/3.7.1/jquery.min.js
// ==/UserScript==

/*globals cocoMessage*/
/*globals $*/

(async function() {
    class Utils {
        static serialize(obj) {
            return JSON.stringify(obj, (key, value) => {
                if (value instanceof Set) {
                    return {
                        $type: 'Set',
                        $value: Array.from(value).map(item => this.serialize(item))
                    };
                } else if (value instanceof Map) {
                    return {
                        $type: 'Map',
                        $value: Array.from(value).map(([k, v]) => [
                            this.serialize(k),
                            this.serialize(v)
                        ])
                    };
                } else {
                    return value;
                }
            });
        }

        static deserialize(jsonStr) {
            return JSON.parse(jsonStr, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (value.$type === 'Set') {
                        return new Set(value.$value.map(item => this.deserialize(item)));
                    } else if (value.$type === 'Map') {
                        return new Map(
                            value.$value.map(([k, v]) => [
                                this.deserialize(k),
                                this.deserialize(v)
                            ])
                        );
                    }
                }
                return value;
            });
        }

        static sleep(ms){
            return new Promise(resolve => setTimeout(resolve, ms || 1000))
        }

        static scrollToEnd(element) {
            const hasMore = Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) >= 1;
            if (hasMore) {
                element.scrollBy({
                    top: element.clientHeight,
                    left: 0,
                    behavior: "instant",
                });
            }
            return hasMore;
        }
    }

    class Storage {
        static #lastUpdated;
        static #debug;
        static #followings;
        static #blockeds;
        static #muteds;
        static #lists;

        static {
            const defaultSerializedSet = Utils.serialize(new Set());
            const defaultSerializedMap = Utils.serialize(new Map());

            this.#lastUpdated = GM_getValue('lastUpdated', 0);
            this.#debug = GM_getValue('debug', false);
            this.#followings = Utils.deserialize(GM_getValue('followings', defaultSerializedSet));
            this.#blockeds = Utils.deserialize(GM_getValue('blockeds', defaultSerializedSet));
            this.#muteds = Utils.deserialize(GM_getValue('muteds', defaultSerializedSet));
            this.#lists = Utils.deserialize(GM_getValue('lists', defaultSerializedMap));

            GM_addValueChangeListener('lastUpdated', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#lastUpdated = newValue;
                }
            });
            GM_addValueChangeListener('debug', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#debug = newValue;
                }
            });
            GM_addValueChangeListener('followings', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#followings = Utils.deserialize(newValue);
                }
            });

            GM_addValueChangeListener('blockeds', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#blockeds = Utils.deserialize(newValue);
                }
            });

            GM_addValueChangeListener('muteds', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#muteds = Utils.deserialize(newValue);
                }
            });

            GM_addValueChangeListener('lists', (key, oldValue, newValue, remote) => {
                if (remote) {
                    this.#lists = Utils.deserialize(newValue);
                }
            });
        }

        static get lastUpdated() {
            return this.#lastUpdated;
        }
        static #setlastUpdated() {
            const lastUpdated = new Date().getTime();
            if (this.debug) console.debug("最后更新于:", lastUpdated);
            GM_setValue('lastUpdated', lastUpdated);
            this.#lastUpdated = lastUpdated;
        }

        static get debug() {
            return this.#debug;
        }
        static set debug(value) {
            GM_setValue('debug', value);
            this.#debug = value;
            this.#setlastUpdated();
        }

        static get followings() {
            return this.#followings;
        }
        static get followings_copy() {
            return Utils.deserialize(Utils.serialize(this.#followings));
        }
        static set followings(value) {
            let updated = false;

            const added = value.difference(this.#followings);
            const deleted = this.#followings.difference(value);
            if (added.size > 0) {
                if (this.debug) console.debug("新增关注:", added);
                updated ||= true;
                if (added.size > 1) {
                    cocoMessage.success(`新增 ${added.size} 个关注`);
                } else {
                    cocoMessage.success(`新增关注`);
                }
            }
            if (deleted.size > 0) {
                if (this.debug) console.debug("移除关注:", deleted);
                updated ||= true;
                if (deleted.size > 1) {
                    cocoMessage.success(`移除 ${deleted.size} 个关注`);
                } else {
                    cocoMessage.success(`移除关注`);
                }
            }

            if (updated) {
                GM_setValue('followings', Utils.serialize(value));
                this.#followings = value;
                this.#setlastUpdated();
            }
        }
        static followings_add(value) {
            this.followings = this.followings_copy.add(value);
        }
        static followings_delete(value) {
            const tmpObj = this.followings_copy;
            tmpObj.delete(value);
            this.followings = tmpObj;
        }

        static get blockeds() {
            return this.#blockeds;
        }
        static get blockeds_copy() {
            return Utils.deserialize(Utils.serialize(this.#blockeds));
        }
        static set blockeds(value) {
            let updated = false;

            const added = value.difference(this.#blockeds);
            const deleted = this.#blockeds.difference(value);
            if (added.size > 0) {
                if (this.debug) console.debug("新增拉黑:", added);
                updated ||= true;
                if (added.size > 1) {
                    cocoMessage.success(`新增 ${added.size} 个拉黑`);
                } else {
                    cocoMessage.success(`新增拉黑`);
                }
            }
            if (deleted.size > 0) {
                if (this.debug) console.debug("移除拉黑:", deleted);
                updated ||= true;
                if (deleted.size > 1) {
                    cocoMessage.success(`移除 ${deleted.size} 个拉黑`);
                } else {
                    cocoMessage.success(`移除拉黑`);
                }
            }

            if (updated) {
                GM_setValue('blockeds', Utils.serialize(value));
                this.#blockeds = value;
                this.#setlastUpdated();
            }
        }
        static blockeds_add(value) {
            this.blockeds = this.blockeds_copy.add(value);
        }
        static blockeds_delete(value) {
            const tmpObj = this.blockeds_copy;
            tmpObj.delete(value);
            this.blockeds = tmpObj;
        }

        static get muteds() {
            return this.#muteds;
        }
        static get muteds_copy() {
            return Utils.deserialize(Utils.serialize(this.#muteds));
        }
        static set muteds(value) {
            let updated = false;

            const added = value.difference(this.#muteds);
            const deleted = this.#muteds.difference(value);
            if (added.size > 0) {
                if (this.debug) console.debug("新增隐藏:", added);
                updated ||= true;
                if (added.size > 1) {
                    cocoMessage.success(`新增 ${added.size} 个隐藏`);
                } else {
                    cocoMessage.success(`新增隐藏`);
                }
            }
            if (deleted.size > 0) {
                if (this.debug) console.debug("移除隐藏:", deleted);
                updated ||= true;
                if (deleted.size > 1) {
                    cocoMessage.success(`移除 ${deleted.size} 个隐藏`);
                } else {
                    cocoMessage.success(`移除隐藏`);
                }
            }

            if (updated) {
                GM_setValue('muteds', Utils.serialize(value));
                this.#muteds = value;
                this.#setlastUpdated();
            }
        }
        static muteds_add(value) {
            this.muteds = this.muteds_copy.add(value);
        }
        static muteds_delete(value) {
            const tmpObj = this.muteds_copy;
            tmpObj.delete(value);
            this.muteds = tmpObj;
        }

        static get lists() {
            return this.#lists;
        }
        static get lists_copy() {
            return Utils.deserialize(Utils.serialize(this.#lists));
        }
        static set lists(value) {
            GM_setValue('lists', Utils.serialize(value));
            this.#lists = value;
            this.#setlastUpdated();
        }
        static lists_set(key, list) {
            let updated = false;

            const old = this.#lists.get(key);
            if (old === undefined) {
                updated ||= true;
                cocoMessage.success(`新增标签`);
            } else {
                const added = list.difference(old);
                const deleted = old.difference(list);
                if (added.size > 0) {
                    if (this.debug) console.debug("新增标签:", added);
                    updated ||= true;
                    if (added.size > 1) {
                        cocoMessage.success(`新增 ${added.size} 个用户标签`);
                    } else {
                        cocoMessage.success(`新增用户标签`);
                    }
                }
                if (deleted.size > 0) {
                    if (this.debug) console.debug("移除标签:", deleted);
                    updated ||= true;
                    if (deleted.size > 1) {
                        cocoMessage.success(`移除 ${deleted.size} 个用户标签`);
                    } else {
                        cocoMessage.success(`移除用户标签`);
                    }
                }
            }

            if (updated) {
                const tmpObj = this.lists_copy;
                tmpObj.set(key, list);
                this.lists = tmpObj;
            }
        }
        static lists_delete(key) {
            cocoMessage.success(`移除标签`);
            const tmpObj = this.lists_copy;
            tmpObj.delete(key);
            this.lists = tmpObj;
        }
        static lists_syncKeys(keys) {
            let updated = false;

            const old = new Set(this.#lists.keys());
            const added = keys.difference(old);
            const deleted = old.difference(keys);
            if (added.size > 0) {
                if (this.debug) console.debug("新增标签:", added);
                updated ||= true;
                if (added.size > 1) {
                    cocoMessage.success(`新增 ${added.size} 个标签`);
                } else {
                    cocoMessage.success(`新增标签`);
                }
            }
            if (deleted.size > 0) {
                if (this.debug) console.debug("移除标签:", deleted);
                updated ||= true;
                if (deleted.size > 1) {
                    cocoMessage.success(`移除 ${deleted.size} 个标签`);
                } else {
                    cocoMessage.success(`移除标签`);
                }
            }

            if (updated) {
                const tmpObj = this.lists_copy;
                for (const key of added) {
                    tmpObj.set(key, new Set());
                }
                for (const key of deleted) {
                    tmpObj.delete(key);
                }
                this.lists = tmpObj;
            }
        }
        static lists_syncValueKeys(value, keys) {
            let updated = false;

            const old = new Set(this.lists_filter(value));
            const added = keys.difference(old);
            const deleted = old.difference(keys);

            if (added.size > 0) {
                if (this.debug) console.debug("为用户新增标签:", added);
                updated ||= true;
                if (added.size > 1) {
                    cocoMessage.success(`为用户新增 ${added.size} 个标签`);
                } else {
                    cocoMessage.success(`为用户新增标签`);
                }
            }
            if (deleted.size > 0) {
                if (this.debug) console.debug("为用户移除标签:", deleted);
                updated ||= true;
                if (deleted.size > 1) {
                    cocoMessage.success(`为用户移除 ${deleted.size} 个标签`);
                } else {
                    cocoMessage.success(`为用户移除标签`);
                }
            }

            if (updated) {
                const tmpObj = this.lists_copy;
                for (const key of added) {
                    tmpObj.get(key).add(value);
                }
                for (const key of deleted) {
                    tmpObj.get(key).delete(value);
                }
                this.lists = tmpObj;
            }
        }
        static get lists_keys() {
            return Array.from(this.lists.keys());
        }
        static get lists_values() {
            return Array.from(this.lists.values());
        }
        static lists_diffKeys(keys) {
            return keys.difference(new Set(this.#lists.keys())).size > 0;
        }
        static lists_filter(value) {
            let keys = [];
            for (const [key, list] of this.lists) {
                if (list.has(value)) {
                    keys.push(key);
                }
            }
            return keys;
        }
        static lists_has(value) {
            for (const [key, list] of this.lists) {
                if (list.has(value)) {
                    return true;
                }
            }
            return false;
        }
    }

    const listMembersUrlRegexp = /^\/i\/lists\/(\d+)\/members$/;
    const avatarDataIdPrefixRegexp = /^UserAvatar-Container-/;
    const interval = 500;
    const dataidPrefix = 'goudanwoo-twitter-following-tag';
    const internalListPrefix = ' [internal]';
    const blacklistUrls = new Set(['home', 'explore', 'search', 'notifications', 'messages', 'i', 'jobs', 'follower_requests', 'settings']);

    const selfSelector = 'header div[data-testid|="UserAvatar-Container"]';

    // <header> 是左侧边栏
    // <main> 是主体内容
    // primaryColumn 是主体内容布局为"主视图"+"右侧辅助视图"时的"主视图"
    // detail-header 是主体内容布局为"一级视图"+"二级视图"时的"二级视图"
    // accessible-list 是一个自动翻页的列表
    // UserAvatar-Container 是头像容器

    const primaryListUserAvatarContainerSelector = 'main div[data-testid="primaryColumn"] section[aria-labelledby|="accessible-list"] div[data-testid|="UserAvatar-Container"]';
    const mainDetailListUserAvatarContainerSelector = 'main section[aria-labelledby="detail-header"] section[aria-labelledby|="accessible-list"] div[data-testid|="UserAvatar-Container"]';

    const dialogContentSelector = 'div[role="dialog"] div[data-viewportview="true"]';
    const dialogContentRightBtnSelector = 'div[role="dialog"] div[data-viewportview="true"] button[tabindex="-1"]';
    const dialogContentListSelector = 'div[role="dialog"] div[data-viewportview="true"] section[aria-labelledby|="accessible-list"]';
    const dialogContentListUserAvatarContainerSelector = 'div[role="dialog"] div[data-viewportview="true"] section[aria-labelledby|="accessible-list"] div[data-testid|="UserAvatar-Container"]';
    const dialogContentListListNameSelector = 'div[role="dialog"] div[data-viewportview="true"] section[aria-labelledby|="accessible-list"] div[data-testid="listCell"] > div > div > div > div > div > div > div[dir="ltr"] > span';

    const primaryListListNameSelector = 'main div[data-testid="primaryColumn"] section[aria-labelledby|="accessible-list"] div[data-testid="listCell"] > div > div > div > div > div > div > div[dir="ltr"] > span';

    const primaryTitleSelector = 'main div[data-testid="primaryColumn"] h2[role="heading"] span > span';
    const primaryHeaderUsernameSelector = 'main div[data-testid="primaryColumn"] div[data-testid="UserName"] *[role!="button"][role!="tab"][role!="listitem"][role!="article"][tabindex="-1"] div[dir="ltr"] > span';
    const primaryHeaderFollowingBtnTextSelector = 'main div[data-testid="primaryColumn"] div[data-testid="placementTracking"] button span > span';
    const primaryHeaderUnmuteBtnSelector = 'main div[data-testid="primaryColumn"] button[data-testid="unmuteLink"]';

    let refreshing = false;
    let selfUsername = '';

    function isPrimaryTitleReady() {
        return $(primaryTitleSelector).length > 0;
    }

    function isDialogContentListReady() {
        return $(dialogContentListSelector).length > 0;
    }

    function findListByUserAvatarContainer(list, selector) {
        let foundNew = false;
        $(selector).each((_, userAvatarContainer) => {
            const targetUsername = $(userAvatarContainer).data().testid.replace(avatarDataIdPrefixRegexp, '');
            if (!list.has(targetUsername)) {
                list.add(targetUsername);
                foundNew = true;
            }
        });
        return foundNew;
    }

    function findListByListName(list) {
        let foundNew = false;
        $(primaryListListNameSelector).each((_, listName) => {
            const targetListName = $(listName).text();
            if (!list.has(targetListName)) {
                list.add(targetListName);
                foundNew = true;
            }
        });
        return foundNew;
    }

    async function refreshList(url, isDialog, findImplement, listName) {
        if (refreshing) {
            cocoMessage.error("已有正在执行的更新任务");
            return;
        }
        refreshing = true;

        const refreshingListTip = document.createElement('div');
        refreshingListTip.innerText = "开始更新";
        const refreshedListToast = cocoMessage.loading(refreshingListTip);

        const list = new Set();

        const internal = listName.startsWith(internalListPrefix);
        const container = !isDialog ? document.documentElement : $(dialogContentSelector).get(0);

        let foundNew = false;
        let hasMore = false;
        while (location.pathname === url) {
            foundNew = findImplement(list);
            refreshingListTip.innerText = `更新中, 已发现 ${list.size} 个目标`;
            hasMore = Utils.scrollToEnd(container);
            if (hasMore) {
                await Utils.sleep(interval);
            } else if (foundNew) {
                await Utils.sleep(interval*10);
            } else {
                break;
            }
        }

        refreshedListToast();
        if (foundNew) {
            cocoMessage.error("更新被打断");
        } else {
            if (internal) {
                switch (listName) {
                    case ' [internal]followings':{
                        Storage.followings = list;
                    }break;
                    case ' [internal]blockeds':{
                        Storage.blockeds = list;
                    }break;
                    case ' [internal]muteds':{
                        Storage.muteds = list;
                    }break;
                    case ' [internal]lists':{
                        Storage.lists_syncKeys(list);
                    }break;
                }
            } else {
                Storage.lists_set(listName, list);
            }
        }
        refreshing = false;
    }

    function listenTagStatus() {
        const targetUsernameWithAt = $(primaryHeaderUsernameSelector).text();
        if (!targetUsernameWithAt.startsWith('@')) {
            return;
        }
        const targetUsername = targetUsernameWithAt.replace(/^@/, '');

        const listNames = $(dialogContentListListNameSelector);

        const tags = listNames.map((_, listName) => $(listName).text());
        if (Storage.lists_diffKeys(new Set(tags))) {
            cocoMessage.error("由于存储的标签和展示的标签不完全一致，不会更新该用户的标签，可能是标签未同步或可用标签过多");
            return;
        }

        if ($(dialogContentRightBtnSelector).prop('disabled')) {
            const tagedTags = listNames.filter((_, listName) => $(listName).parent().parent().parent().parent().parent().parent().next().children('svg').length > 0).map((_, listName) => $(listName).text());
            Storage.lists_syncValueKeys(targetUsername, new Set(tagedTags));
        }

        $(dialogContentRightBtnSelector).on('click', () => {
            const tagedTags = listNames.filter((_, listName) => $(listName).parent().parent().parent().parent().parent().parent().next().children('svg').length > 0).map((_, listName) => $(listName).text());
            Storage.lists_syncValueKeys(targetUsername, new Set(tagedTags));
        })
    }

    function checkFollowingStatus() {
        const targetUsernameWithAt = $(primaryHeaderUsernameSelector).text();
        if (!targetUsernameWithAt.startsWith('@')) {
            return;
        }
        const targetUsername = targetUsernameWithAt.replace(/^@/, '');

        const followingBtnState = $(primaryHeaderFollowingBtnTextSelector).text();
        switch (followingBtnState) {
            case "关注":{
                if (Storage.followings.has(targetUsername)) { // 已关注
                    Storage.followings_delete(targetUsername);
                }
                if (Storage.blockeds.has(targetUsername)) { // 已屏蔽
                    Storage.blockeds_delete(targetUsername);
                }
            }break;
            case "正在关注":
            case "取消关注":{
                if (!Storage.followings.has(targetUsername)) { // 未关注
                    Storage.followings_add(targetUsername);
                }
                if (Storage.blockeds.has(targetUsername)) { // 已屏蔽
                    Storage.blockeds_delete(targetUsername);
                }
            }break;
            case "已屏蔽":
            case "取消屏蔽":{
                if (Storage.followings.has(targetUsername)) { // 已关注
                    Storage.followings_delete(targetUsername);
                }
                if (!Storage.blockeds.has(targetUsername)) { // 未屏蔽
                    Storage.blockeds_add(targetUsername);
                }
            }break;
        }

        const mutedState = $(primaryHeaderUnmuteBtnSelector).length > 0;
        if (mutedState) {
            if (!Storage.muteds.has(targetUsername)) { // 未隐藏
                Storage.muteds_add(targetUsername);
            }
        } else {
            if (Storage.muteds.has(targetUsername)) { // 已隐藏
                Storage.muteds_delete(targetUsername);
            }
        }
    }

    function createTagElement(tag, color, backgroundColor) {
        return $('<span>').text(tag).css({
            display: 'inline',
            flexShrink: 0,
            borderRadius: '4px',
            padding: '0 4px',
            color: color,
            backgroundColor: backgroundColor,
        });
    }

    function clearTags() {
        $(`*[data-${dataidPrefix}]`).removeAttr(`data-${dataidPrefix}`);
        $(`div[data-${dataidPrefix}-tags]`).remove();
    }

    function updateTags(url) {
        $(`div[data-${dataidPrefix}-tags][data-${dataidPrefix}-tags!="${Storage.lastUpdated}"]`).remove();
        $(`*[role!="button"][role!="tab"][role!="listitem"][role!="article"][tabindex="-1"][data-${dataidPrefix}!="${Storage.lastUpdated}"] *[dir="ltr"] > span`).each((_, usernameText) => {
            const targetUsernameWithAt = $(usernameText).text();
            if (!targetUsernameWithAt.startsWith('@')) {
                console.warn("非预期的选择器结果", usernameText);
                return;
            }
            const targetUsername = targetUsernameWithAt.replace(/^@/, '');

            const usernameBtn = $(usernameText).parents('*[tabindex="-1"]').get(0);

            $(usernameBtn).attr(`data-${dataidPrefix}`, Storage.lastUpdated);

            if (Storage.debug) {
                $(usernameBtn).css({
                    background: 'linear-gradient(135deg,#f02fc2,#6094ea)',
                });
            } else {
                $(usernameBtn).css({
                    background: '',
                });
            }

            if (Storage.debug) console.debug("渲染标签", targetUsername);
            const container = $('<div>').css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                margin: '0 4px',
            });
            container.attr(`data-${dataidPrefix}-tags`, Storage.lastUpdated);

            if (targetUsername === selfUsername) {
                createTagElement("自己", '#fff', '#536471').appendTo(container);
            } else {
                if (Storage.followings.has(targetUsername)) {
                    createTagElement("已关注", '#fff', '#51cf66').appendTo(container);
                } else if (Storage.blockeds.has(targetUsername)) {
                    createTagElement("已拉黑", '#fff', '#f4212e').appendTo(container);
                } else {
                    createTagElement("未关注", '#fff', '#b197fc').appendTo(container);
                }

                if (Storage.muteds.has(targetUsername)) {
                    createTagElement("已隐藏", '#536471', '#e9ecef').appendTo(container);
                }
            }

            const tags = Storage.lists_filter(targetUsername);
            tags.forEach(tag => {
                createTagElement(tag, '#fff', '#5c7cfa').appendTo(container);
            });

            $(usernameBtn).after(container);
            $(usernameBtn).parent().css({
                flexDirection: 'row',
            });
        });
    }

    function createToastBtn(text, event) {
        return $('<button>').text(text).css({
            width: '100%',
            display: 'block',
        }).on('click', event);
    }

    function main(url, simplify) {
        const urlParts = url.split('/').filter(urlPart => urlPart !== '');

        selfUsername = $(selfSelector)?.data()?.testid?.replace(avatarDataIdPrefixRegexp, '');
        if (selfUsername === undefined && !(urlParts.length == 3 && urlParts[1] === 'article')) {
            return simplify;
        }

        if (Storage.debug && !simplify) {
            console.debug("当前用户名:", selfUsername);
            console.debug("当前 url:", url);
            console.debug("最后更新时间:", new Date(Storage.lastUpdated));
            console.debug("当前缓存的关注列表:", Storage.followings);
            console.debug("当前缓存的拉黑列表:", Storage.blockeds);
            console.debug("当前缓存的隐藏列表:", Storage.muteds);
            console.debug("当前缓存的标签列表:", Storage.lists);
            console.debug("当前缓存的标签:", Storage.lists_keys);
            console.debug("未标签的关注:", Array.from(Storage.followings.values()).filter(targetUsername => !Storage.lists_has(targetUsername)));
        }

        updateTags(url);

        if (!simplify) {
            if (url === `/${selfUsername}/following`) {
                const event = async () => {
                    if (location.pathname === url) {
                        await refreshList(url, false, (list) => findListByUserAvatarContainer(list, primaryListUserAvatarContainerSelector), ' [internal]followings');
                    }
                };
                menu.refreshListRender("🔄️ 点此更新关注列表", event);
                cocoMessage.info(createToastBtn("🔄️ 点此更新关注列表", event).get(0));
            } else if (url === '/settings/blocked/all') {
                const event = async () => {
                    if (location.pathname === url) {
                        await refreshList(url, false, (list) => findListByUserAvatarContainer(list, mainDetailListUserAvatarContainerSelector), ' [internal]blockeds');
                    }
                };
                menu.refreshListRender("🔄️ 点此更新拉黑列表", event);
                cocoMessage.info(createToastBtn("🔄️ 点此更新拉黑列表", event).get(0));
            } else if (url === '/settings/muted/all') {
                const event = async () => {
                    if (location.pathname === url) {
                        await refreshList(url, false, (list) => findListByUserAvatarContainer(list, mainDetailListUserAvatarContainerSelector), ' [internal]muteds');
                    }
                };
                menu.refreshListRender("🔄️ 点此更新隐藏列表", event);
                cocoMessage.info(createToastBtn("🔄️ 点此更新隐藏列表", event).get(0));
            } else if (url === `/${selfUsername}/lists` || url === `/${selfUsername}/lists/`) {
                const event = async () => {
                    if (location.pathname === url) {
                        await refreshList(url, false, findListByListName, ' [internal]lists');
                    }
                };
                menu.refreshListRender("🔄️ 点此更新标签列表", event);
                cocoMessage.info(createToastBtn("🔄️ 点此更新标签列表", event).get(0));
            } else if (listMembersUrlRegexp.test(url)) {
                if (!isPrimaryTitleReady()) {
                    return simplify;
                }

                const listName = $(primaryTitleSelector).text();

                const event = async () => {
                    if (location.pathname === url) {
                        await refreshList(url, true, (list) => findListByUserAvatarContainer(list, dialogContentListUserAvatarContainerSelector), listName);
                    }
                };
                menu.refreshListRender(`🔄️ 点此更新 ${listName} 列表`, event);
                cocoMessage.info(createToastBtn(`🔄️ 点此更新 ${listName} 列表`, event).get(0));
            } else if (url === '/i/lists/add_member') {
                if (!isDialogContentListReady()) {
                    return simplify;
                }

                listenTagStatus();
            }
        }

        if ((urlParts.length === 1 || urlParts.length === 2) && urlParts[0] !== selfUsername && !blacklistUrls.has(urlParts[0])) { // 个人页
            if (!isPrimaryTitleReady()) {
                return simplify;
            }

            checkFollowingStatus();
        }

        return true;
    }

    class Menu {
        #debug;
        #refreshList;

        constructor() {
            this.#debugRender();
        }

        #debugRender() {
            this.#debug = GM_registerMenuCommand(`调试模式: ${Storage.debug ? '✅' : '❌'}`, (event) => {
                Storage.debug = !Storage.debug;
                this.#debugRender();
            }, {
                id: this.#debug,
            });
        }

        refreshListRender(name, event) {
            this.#refreshList = GM_registerMenuCommand(name, event, {
                id: this.#refreshList,
            });
        }
        refreshListDestroy() {
            if (this.#refreshList !== undefined) {
                GM_unregisterMenuCommand(this.#refreshList);
                this.#refreshList = undefined;
            }
        }
    }

    async function prepare() {
        let url;
        let simplify = false;
        while (true) {
            if (location.pathname != url) {
                if (Storage.debug) console.debug("url 变动");
                url = location.pathname;
                simplify = false;
                menu.refreshListDestroy();
                clearTags();
            } else {
                await Utils.sleep(interval);
            }
            simplify = main(url, simplify);
        }
    }

    const menu = new Menu();
    await prepare();
})();
