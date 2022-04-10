const Module = require("./base.js");

/**
 * Chat Module
 @constructor
 * @param {Telegram} instance - Instance to atttach to
 */
class Chat extends Module {
    constructor(bot) {
        super(bot);
        console.log("Chat setup");
        this.ready = false;
        this.on("setup", async (...args) => {
            this.ready = true;
            await this.setup();
        });
    }

    /**
     * Get Name of active chat
     * @async
     * @returns {string} chat
     */
    async getActiveChat() {
        if (!this.page) return false;
        return await this.page.evaluate(() => {
            if ($('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_title[my-peer-link="historyPeer.id"]').length == 0) return false;
            return $('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_title[my-peer-link="historyPeer.id"]').text();
        });
    }
    /**
     * Checks if current open chat is a group chat
     * @async
     * @returns {bool} is groupchat
     */
    async IsGroupChat() {
        if (!this.page) return false;
        return await this.page.evaluate(() => {
            if ($('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_status[ng-switch="historyPeer.id > 0"]').length == 0) return false;
            return /.{1,} member/gm.test($('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_status[ng-switch="historyPeer.id > 0"]').text().trim());
        });
    }
    /**
     * Get all Chats
     * @async
     * @returns {string[]} Chat list
     */
    async getChats() {
        if (!await this.isLoggedIn()) return false;
        let chats = await this.page.evaluate(() => {
            let data = [];
            $(".im_dialogs_col >.im_dialogs_wrap > .im_dialogs_scrollable_wrap > .nav > .im_dialog_wrap").each((index, element) => {
                // $(element).
                let chatPeer = $(element).find(".im_dialog>.im_dialog_message_wrap>.im_dialog_peer>span").text();
                let last_message_date = $(element).find(".im_dialog >.im_dialog_meta>.im_dialog_date").text();
                //data
                data.push({
                    peerName: chatPeer,
                    last_date: last_message_date
                })
            })
            return data;
        });
        return chats;
    }
    /**
     * Open a Chat
     * @async
     * @param {string} peerName - peer to open
     * @returns {bool} success
     */
    async openChat(peerName) {
        if (!await this.isLoggedIn()) return false;
        let handles = await this.page.$$(".im_dialogs_col >.im_dialogs_wrap > .im_dialogs_scrollable_wrap > .nav > .im_dialog_wrap>.im_dialog>.im_dialog_message_wrap>.im_dialog_peer>span");
        for (let handle of handles) {
            // get content of that li's
            let text = await this.page.evaluate(element => element.textContent, handle);
            // if they contains some specific string then click on them
            console.log("text", text)
            if (text.includes(peerName)) {
                await handle.click();
                break;
            }
        }
        if (await this.isChatOpen(peerName)) {
        	return true;
        }
        //im_history_messages_peer
        return false;
    }


    /**
     * Check if a Chat is open
     * @async
     * @param {string} peerName - peer to check
     * @returns {bool} success
     */
    async isChatOpen(peerName) {
        if (!this.page) return false;
        return await this.page.evaluate((peer) => {
            if ($('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_title[my-peer-link="historyPeer.id"]').length == 0) return false;
            return $('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_title[my-peer-link="historyPeer.id"]').text() == peer
        }, peerName);
    }

    /**
     * Send a chat message to a peer
     * @async
     * @param {string} peerName - peer to send a message to
     * @param {string} message - message to send
     * @returns {bool} success
     */
    async sendChatMessage(peerName, chatMessage) {
        if (!await this.isLoggedIn()) return false;
        let open = await this.isChatOpen(peerName);

        if (!open) {
        	console.log(`[!] Chat for ${peerName} not open, opening...`)
        	await this.openChat(peerName);
        }

        console.log(`[!] Sending Message to ${peerName}: ${chatMessage}`)

        let inputSelect = '.im_send_field_wrap > textarea[ng-model="draftMessage.text"]';
        await this.page.waitForSelector(inputSelect)
        await this.page.focus(inputSelect);
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(50);
        //await this._page.$eval(inputSelect, (el, value) => el.value = value, chatMessage);
        await this.page.type(inputSelect, chatMessage);
        await this.page.waitForTimeout(50);
        await this.page.click('.im_send_buttons_wrap > button.im_submit_send')
        await this.page.waitForTimeout(50);
        return true;
    }
    async setup() {
        await this.addMutationEvent("chatOpen", ".im_dialogs_wrap > div > ul", ".im_dialog_wrap.active", (element, mutator) => {
            let peerName = $('.tg_head_btn > .tg_head_peer_info > .tg_head_peer_title[my-peer-link="historyPeer.id"]').text();
            console.log("mutator", mutator)
            if (mutator.attributeName != "class") return false;
            
            if (!$(element).hasClass("active")) return false;
            return [peerName]
        });
        await this.addMutationEvent("privatChatMessage", ".im_dialogs_col", ".im_short_message_text", (element) => {
            console.log("selector", $(element).parents(".im_dialog"))
            let peerHandle = $(element).parents(".im_dialog");
            if (peerHandle) {
                let peerName = $(peerHandle).find(".im_dialog_message_wrap >.im_dialog_peer >span").text()
                console.log("peerName", peerName)
                let message_from = $(peerHandle).find(".im_dialog_message_wrap > div >.im_dialog_message> span>span>.im_dialog_chat_from_wrap>.im_dialog_chat_from").text()
                let message_draft = $(peerHandle).find(".im_dialog_message_wrap > div >.im_dialog_message> span.im_dialog_chat_from_wrap>.im_dialog_draft_from").text()
                if (message_from == "You") return false;
                if (message_draft == "Draft:") return false;
                let message_text = $($(peerHandle).find(".im_dialog_message_wrap .im_dialog_message .im_short_message_text")).text()
                let cutOf = false;
                if (message_text.length == 128) cutOf = true;
                if (message_from == "" && peerName != "") {
                    return [peerName, message_text, cutOf]
                }
                return false;
            }
        });
        await this.addMutationEvent("groupChatMessage", ".im_dialogs_col", ".im_short_message_text", (element) => {
            console.log("selector", $(element).parents(".im_dialog"))
            let peerHandle = $(element).parents(".im_dialog");
            if (peerHandle) {
                let peerName = $(peerHandle).find(".im_dialog_message_wrap >.im_dialog_peer >span").text()
                console.log("peerName", peerName)
                let message_from = $(peerHandle).find(".im_dialog_message_wrap > div >.im_dialog_message> span>span>.im_dialog_chat_from_wrap>.im_dialog_chat_from").text()
                let message_draft = $(peerHandle).find(".im_dialog_message_wrap > div >.im_dialog_message> span.im_dialog_chat_from_wrap>.im_dialog_draft_from").text()
                if (message_from == "You") return false;
                if (message_draft == "Draft:") return false;
                let message_text = $($(peerHandle).find(".im_dialog_message_wrap .im_dialog_message .im_short_message_text")).text()
                let cutOf = false;
                if (message_text.length == 128) cutOf = true;
                if (peerName != "" && message_from != "") {
                    return [peerName, message_from, message_text, cutOf]
                }
                return false;
            }
        }); //new_chat_message_full
        await this.addMutationEvent("chatMessageOpen", ".im_history_col_wrap", ".im_history_messages_peer", (element, mutator) => {
            if (mutator.type != "childList") return false;
            let l = $(element).find("div.im_history_message_wrap");
            console.log("length", l);
            let last_message = $(l[l.length - 1]);
            if (!last_message) return false;
            //console.log("last_message",last_message);
            let last_message_text = last_message.find(".im_message_outer_wrap > .im_message_wrap > .im_content_message_wrap > .im_message_body > div > div.im_message_text").text();
            let last_message_author = last_message.find(".im_message_outer_wrap > .im_message_wrap > .im_content_message_wrap > .im_message_body > span.im_message_author_wrap > a.im_message_author").text();
            if (!last_message_text) return false;
            if (!last_message_author) return false;
            return [last_message_author, last_message_text];
        });
        return true;
    }
}
module.exports = Chat;