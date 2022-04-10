const Module = require("./base.js");

/**
 * Profile Module
 @constructor
 * @param {Telegram} instance - Instance to atttach to
 */
class Profile extends Module {
    constructor(bot) {
        super(bot);
        console.log("Profile setup");
        this.ready = false;
        this.on("setup", async (...args) => {
            this.ready = true;
        });
    }
    async test(test1) {
        console.log(test1)
        return "asdf";
    }    
    /**
     * get profile used
     * @async
     * @returns {Object} object containing phonenumber and contactname
     */
    async get_profile() {
        console.log("getOwnProfile")
        if (!this.ready) return false;
        if (!await this.isLoggedIn()) return false;
        await this.page.waitForTimeout(500);
        await this.page.waitForSelector('.tg_head_logo_wrap > .tg_head_logo_dropdown > .tg_head_btn')
        await this.page.waitForTimeout(50);
        await this.page.click('.tg_head_logo_wrap > .tg_head_logo_dropdown > .tg_head_btn')
        await this.page.waitForTimeout(50);
        await this.page.waitForSelector('.tg_head_logo_wrap > .tg_head_logo_dropdown > ul > li > a[ng-click="openSettings()"]')
        await this.page.waitForTimeout(50);
        await this.page.click('.tg_head_logo_wrap > .tg_head_logo_dropdown > ul > li > a[ng-click="openSettings()"]')
        await this.page.waitForSelector('.md_modal_sections > .md_modal_iconed_section_number > .md_modal_section_param_wrap > div[ng-bind="profile.phone | phoneNumber"]')
        let number = await this.page.evaluate(() => {
            return $('.md_modal_sections > .md_modal_iconed_section_number > .md_modal_section_param_wrap > div[ng-bind="profile.phone | phoneNumber"]').text();
        });
        await this.page.waitForSelector('.md_modal_sections > .md_modal_iconed_section_number > .md_modal_section_param_wrap > div[ng-switch="profile.username.length > 0"]')
        let contactName = await this.page.evaluate(() => {
            return $('.md_modal_sections > .md_modal_iconed_section_number > .md_modal_section_param_wrap > div[ng-switch="profile.username.length > 0"]').text().trim().replace("@", "");
        });
        this.contactName = contactName;
        this.phoneNumber = number;
        await this.page.waitForSelector('.md_modal_title_wrap > .md_modal_actions_wrap > a[ng-click="$close()"]')
        await this.page.click('.md_modal_title_wrap > .md_modal_actions_wrap > a[ng-click="$close()"]')
        console.log(`[!] Loaded account data Phone:${this.phoneNumber} Contact:${this.contactName}`)
        return {
            number: this.phoneNumber,
            contactName: this.contactName
        };
    }
}
module.exports = Profile;