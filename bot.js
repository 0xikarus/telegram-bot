const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const proxyChain = require('proxy-chain');
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
puppeteer.use(StealthPlugin());
/**
 * @typedef {Object} Handles
 * @property {Object} browser - Used browser instance (Puppeteer Browser)
 * @property {Object} page - Used page (Puppeteer Page)
 */
/**
 * Check if a DOM element passes the given filter
 * @callback DOMEventFilter
 * @param {Object} DOMElement - DOM Element the filter has to check
 * @param {Object} Mutation - Mutation that was applied to the element
 * @returns {Array}
 */
/**
 * @typedef {Object} MutationEvent
 * @property {string} event name - name of the event
 * @property {string} event query selector - DOM selector to listen to
 * @property {DOMEventFilter} eventFilter - function to filter elements
 */
/**
 * Creates new Telegram-Client
 * @constructor
 * @param {string} botName - Name of your bot
 * @param {string} proxyURL - valid proxy url for the client to connect through
 */
class Telegram extends EventEmitter {
    static loaded_modules = [];
    constructor(botName, proxyURL) {
        super();
        this._proxyURL = proxyURL || undefined;
        this._localStoragePath = './lstorage/' + botName + '.json';
        this._cookieStore = [];
        this._proxyChain = undefined;
        this._browser = undefined;
        this._page = undefined;
        this._userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3592.0 Safari/537.36";
        this._pageURL = "https://web.telegram.org";
        this._modules = [];
        this._mutationEvents = [];
        this.setup();
    }
    /**
     * Loads a module by fileName
     * @param {string} moduleName - Module to load
     * @returns {boolean}
     */
    static loadModule(moduleName) {
        try {
            let t = require(`./modules/${moduleName}.js`)
            Telegram.loaded_modules.push(t);
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }
    /**
     * get used handles
     * @returns {Handles}
     */
    handle() {
        return {
            browser: this._browser,
            page: this._page
        }
    }
    /**
     * call a module function
     * @async
     * @param {string} moduleName - module of the function
     * @param {string} functionName - function Name
     * @param {...*} arguments - function arguments
     * @returns {Any}
     */
    async call(moduleName, functionName, ...args) {
        let mod = Object.keys(this._modules).findIndex((e) => {
            return this._modules[e].constructor.name.toLowerCase() == moduleName.toLowerCase();
        })
        if (mod > -1) {
            let nMod = this._modules[mod];
            if (!nMod[functionName]) return false;
            return await nMod[functionName](...args);
        }
        return false;
    }
    setProxy() {}
    onRequest(request) {
        this.emit("request", request);
        request.continue();
    }
    async loadLocalStorage() {
        await this._page.setRequestInterception(true);
        this._page.once('request', async request => {
            console.log("request")
            request.respond({
                status: 200,
                contentType: 'text/plain',
                body: 'to set settings'
            });
        });
        await this._page.goto(this._pageURL)
        if (fs.existsSync(this._localStoragePath)) {
            let localData = await readFile(this._localStoragePath);
            let local = JSON.parse(localData);
            console.log("local", local);
            await this._page.evaluate((localData) => {
                Object.keys(localData).forEach(e => {
                    console.log(e);
                    console.log(localData[e]);
                    localStorage.setItem(e, localData[e]);
                })
            }, local);
            await this._page.setRequestInterception(false);
            console.log("Loaded LocalStorage");
            this.emit("localStorageLoaded");
            return true;
        }
        return false;
    }
    async saveLocalStorage() {
        let localStorageData = await this._page.evaluate(() => {
            let json = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                json[key] = localStorage.getItem(key);
            }
            return json;
        });
        await writeFile(this._localStoragePath, JSON.stringify(localStorageData, null, 2));
        this.emit("localStorageSaved");
        return true;
    }
    /**
     * Check if the client is logged in
     * @async
     * @returns {bool}
     */
    async isLoggedIn() {
        if (!this._page) return false;
        return await this._page.evaluate(() => $(".tg_head_split > .tg_head_logo_wrap > .tg_head_logo_dropdown").length);
    }
    /**
     * add event to listen to dom changes and filter them
     * @async
     * @param {string} eventName - name of the event
     * @param {string} eventQueryListener - dom query to listen to
     * @param {string} eventQuerySelector - dom query selector
     * @param {DOMEventFilter} eventFormat - event formating
     * @returns {MutationEvent}
     */
    async addMutationEvent(eventName, eventQueryListener, eventQuerySelector, eventFormat) {
        let eventData = {
            eventName: eventName,
            eventQueryListener: eventQueryListener,
            eventQuerySelector: eventQuerySelector,
            eventFormat: eventFormat
        };
        console.log("eventFormat", eventName, eventQueryListener, eventQuerySelector, eventFormat)
        console.log("eventQuerySelector", eventQuerySelector)
        await this._page.waitForSelector(eventQuerySelector)
        let eventFunction = `${eventName}_${this._mutationEvents.length}`;
        await this._page.addScriptTag({
            content: `const ${eventFunction} = ${eventFormat}`
        });
        console.log(eventName, eventQueryListener, eventQuerySelector, eventFunction)
        await this._page.evaluate(async (eventName, eventQueryListener, eventQuerySelector, eventFunction) => {
            let evalEventFunction = eval(`${eventFunction}`)
            console.log("EVENT", eventName, eventQueryListener, eventQuerySelector, evalEventFunction)
            let MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
            let observer = new MutationObserver(function(mutations, observer) {
                let ev = mutations.find((e, i) => {
                    if (e.target == undefined) return false;
                    let c = $(e.target).attr("class");
                    if (c == undefined) return false;
                    if (c.indexOf(eventQuerySelector.replaceAll('.', ' ').trim()) > -1) {
                        return true;
                    }
                    return false;
                });
                if (ev) {
                    let returnValues = evalEventFunction(ev.target, ev);
                    console.log("returnValues", returnValues)
                    if (returnValues != false) {
                        triggerRemoteEvent(eventName, ...returnValues);
                    }
                }
            });
            observer.observe(document.querySelector(eventQueryListener), {
                // observer.observe(document.querySelectorAll(eventQueryListener)[0], {
                childList: true,
                characterData: false,
                attributes: true,
                subtree: true,
            });
        }, eventName, eventQueryListener, eventQuerySelector, eventFunction);
        this._mutationEvents.push(eventData)
        return eventData;
    }
    async setup() {
        let i = 0;
        if (this._proxyURL) {
            this._proxyChain = await proxyChain.anonymizeProxy(this._proxyURL);
        }
        this._browser = await puppeteer.launch({
            headless: false,
            ignoreHTTPSErrors: true,
            devtools: true,
            args: [this._proxyChain ? '--proxy-server=' + this._proxyChain : '']
        })
        this._page = await this._browser.newPage();
        //this._page.on('request', async request => {
        //    this.onRequest(request);
        //});
        await this._page.setViewport({
            width: 1200,
            height: 900
        })
        await this._page.setCacheEnabled(true);
        await this._page.setRequestInterception(true);
        await this._page.setBypassCSP(true);
        await this._page.setUserAgent(this._userAgent);
        await this.loadLocalStorage();
        console.log(`[!] loaded localStorage`);
        await this._page.goto(this._pageURL)
        console.log(`[!] loaded target page ${this._pageURL}`);
        await this._page.exposeFunction('triggerRemoteEvent', (event, ...data) => {
            // console.log("triggerRemoteEvent", event, data.join())
            this.emit(event, ...data)
        });
        console.log("[!] added remoteEvent handler");
        Telegram.loaded_modules.forEach(mod => {
            this._modules.push(new mod(this));
        })
        let userAgent = await this._page.evaluate(() => navigator.userAgent);

        this.emit("setup");
        setTimeout(async () => {
            await this.call("Profile","get_profile")
        },100)
    }
}
//add modules here, we need to load them before initializing. (place them ./modules/ )
Telegram.loadModule("chat")
Telegram.loadModule("profile")

/*
Examples
let bot = new Telegram("testBot");
bot.on("privatChatMessage", async (peerName, message, cutOf) => {
    console.log("new message", "Peername", peerName, "Message", message, cutOf)
    console.log(await bot.call("chat","openChat",peerName));
})
bot.on("groupChatMessage", async (peerName, messageSender, message) => {
    console.log("new group message", "Peername", peerName, "messageSender", messageSender, "message", message)
    console.log(await bot.call("chat","IsGroupChat"));
})
bot.on("chatOpen", async (peerName) => {
    console.log("chatOpen", "Peername", peerName)
})
bot.on("chatMessageOpen", async (peerName, message) => {
    console.log("chatMessageOpen", "peerName", peerName, "message", message)
})*/
