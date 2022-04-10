/**
 * Base Module
 @constructor
 * @param {Telegram} instance - Instance to atttach to
 */
class Module {
    constructor(bot) {
        this._bot = bot;
        console.log("Init module");
        const self = this;
    }
    /**
     * Returns used page-instance
     * @returns {Object}
    */
    get page() {
        return this._bot.handle().page;
    }
    /**
     * Returns used browser-instance
     * @returns {Object}
    */
    get browser() {
        return this._bot.handle().browser;
    }
    /**
     * Check if instance is logged in
     * @async
     * @returns {bool}
    */
    async isLoggedIn() {
        return await this._bot.isLoggedIn();
    }
    /**
     * Emit a Instance Event
     * @async     
     * @param {string} eventName - event Name
     * @param {...*} arguments - event arguments
     * @returns {bool}
    */
    emit(eventName, ...args) {
        return this._bot.emit(eventName, ...args);
    }
    /**
     * add event to listen to dom changes and filter them
     * @async
     * @param {string} eventName - name of the event
     * @param {string} eventQueryListener - dom query to listen to
     * @param {string} eventQuerySelector - dom query selector
     * @param {DOMEventFilter} eventFilter - filter function
     * @returns {MutationEvent}
     */
    async addMutationEvent(eventName, eventQueryListener, eventQuerySelector, eventFormat) {
        return await this._bot.addMutationEvent(eventName, eventQueryListener, eventQuerySelector, eventFormat);
    }

    /**
     * Register a listener for a Instance event
     * @async     
     * @param {string} eventName - event Name
     * @param {Function} callback - Event callback
    */

    async on(eventName, callback) {
        this._bot.on(eventName, async (...args) => {
            await callback(...args);
        })
    }
}
module.exports = Module;