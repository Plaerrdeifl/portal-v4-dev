"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WPPEngineMediaProcessor = exports.WhatsappSessionWPPCore = void 0;
exports.WPPMedia = WPPMedia;
exports.MimetypeForDataUrl = MimetypeForDataUrl;
const common_1 = require("@nestjs/common");
const session_abc_1 = require("../../abc/session.abc");
const channels_dto_1 = require("../../../structures/channels.dto");
const helpers_1 = require("../../../helpers");
const chats_dto_1 = require("../../../structures/chats.dto");
const chatting_dto_1 = require("../../../structures/chatting.dto");
const enums_dto_1 = require("../../../structures/enums.dto");
const SingleDelayedJobRunner_1 = require("../../../utils/SingleDelayedJobRunner");
const env_1 = require("../../env");
const pagination_dto_1 = require("../../../structures/pagination.dto");
const labels_dto_1 = require("../../../structures/labels.dto");
const responses_dto_1 = require("../../../structures/responses.dto");
const status_dto_1 = require("../../../structures/status.dto");
const Paginator_1 = require("../../../utils/Paginator");
const PinoWinstonAdapter_1 = require("../../../utils/logging/PinoWinstonAdapter");
const promiseTimeout_1 = require("../../../utils/promiseTimeout");
const wppconnect_1 = require("@wppconnect-team/wppconnect");
const events_wpp_1 = require("./events.wpp");
const wppStreams_1 = require("./reactive/wppStreams");
const exceptions_1 = require("../../exceptions");
const LottieMediaProcessorWrapper_1 = require("../../media/LottieMediaProcessorWrapper");
const QR_1 = require("../../QR");
const chrome_1 = require("../../utils/chrome");
const config_1 = require("../../../config");
const processes_1 = require("../../utils/processes");
const reactive_1 = require("../../utils/reactive");
const jids_1 = require("../../utils/jids");
const serialized_1 = require("../../utils/serialized");
const lodash = require("lodash");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const ids_1 = require("../../utils/ids");
const vcard_1 = require("../../vcard");
const groups_dto_1 = require("../../../structures/groups.dto");
const contacts_dto_1 = require("../../../structures/contacts.dto");
const helpers_2 = require("@wppconnect-team/wppconnect/dist/api/helpers");
const version_1 = require("../../../version");
const WPPAuthFactory_1 = require("./WPPAuthFactory");
const WAMimeType_1 = require("../../media/WAMimeType");
const files_1 = require("../../../utils/files");
const session_hooks_activity_1 = require("../../abc/session.hooks.activity");
class WhatsappSessionWPPCore extends session_abc_1.WhatsappSession {
    constructor(config) {
        super(config);
        this.START_ATTEMPT_DELAY_SECONDS = 2;
        this.engine = enums_dto_1.WAHAEngine.WPP;
        this.authManager = null;
        this.authFactory = new WPPAuthFactory_1.WPPAuthFactory();
        this.meInfo = null;
        this.presencesByChatId = new Map();
        this.startAttemptId = 0;
        this.qr = new QR_1.QR();
        this.shouldRestart = true;
        this.startDelayedJob = new SingleDelayedJobRunner_1.SingleDelayedJobRunner('start-engine', this.START_ATTEMPT_DELAY_SECONDS * enums_dto_1.SECOND, this.logger);
    }
    getUserDataDir() {
        const base = process.env.WAHA_LOCAL_STORE_BASE_DIR || './.sessions';
        return `${base}/${(0, config_1.getSessionNamespace)()}/${this.name}`;
    }
    async start() {
        var _a, _b, _c, _d, _e, _f;
        this.authManager = await this.authFactory.build(this.sessionStore, this.name, this.getUserDataDir(), this.loggerBuilder, () => this.status);
        this.shouldRestart = true;
        this.status = enums_dto_1.WAHASessionStatus.STARTING;
        this.pairingCode = null;
        const startAttemptId = ++this.startAttemptId;
        const args = this.getBrowserArgsForPuppeteer();
        args.push(...(((_a = this.engineConfig) === null || _a === void 0 ? void 0 : _a.puppeteerArgs) || []));
        args.unshift(`--a-waha-timestamp=${new Date()}`);
        args.unshift(`--a-waha-session=${this.name}`);
        const deviceName = (_d = (_c = (_b = this.sessionConfig) === null || _b === void 0 ? void 0 : _b.client) === null || _c === void 0 ? void 0 : _c.deviceName) !== null && _d !== void 0 ? _d : env_1.WAHA_CLIENT_DEVICE_NAME;
        const userDataDir = this.getUserDataDir();
        const logger = this.logger.child({
            name: 'WPP',
            session: this.name,
        });
        const wppLogger = new PinoWinstonAdapter_1.PinoWinstonAdapter(logger);
        const options = {
            session: this.name,
            disableWelcome: true,
            updatesLog: false,
            logQR: false,
            waitForLogin: false,
            autoClose: 0,
            deviceSyncTimeout: 0,
            deviceName: deviceName || false,
            headless: true,
            debug: this.isDebugEnabled(),
            logger: wppLogger,
            whatsappVersion: (_e = this.engineConfig) === null || _e === void 0 ? void 0 : _e.webVersion,
            browserArgs: args,
            puppeteerOptions: {
                protocolTimeout: 300000,
                headless: true,
                executablePath: this.getBrowserExecutablePath(),
                args: args,
                dumpio: this.isDebugEnabled(),
                userDataDir: userDataDir,
            },
            catchQR: (base64Image, asciiQR, attempt, urlCode) => {
                if (!this.isCurrentStartAttempt(startAttemptId)) {
                    return;
                }
                void base64Image;
                void asciiQR;
                void attempt;
                this.qr.save(urlCode);
                this.printQR(this.qr);
                this.status = enums_dto_1.WAHASessionStatus.SCAN_QR_CODE;
            },
            catchLinkCode: (code) => {
                if (!this.isCurrentStartAttempt(startAttemptId)) {
                    return;
                }
                this.pairingCode = code;
            },
            statusFind: (status) => {
                if (!this.isCurrentStartAttempt(startAttemptId)) {
                    return;
                }
                this.applyStatusFind(status);
            },
        };
        if ((_f = this.proxyConfig) === null || _f === void 0 ? void 0 : _f.server) {
            options.proxy = {
                url: this.proxyConfig.server,
                username: this.proxyConfig.username,
                password: this.proxyConfig.password,
            };
        }
        void this.createClientAsync(options, startAttemptId).catch((error) => {
            this.logger.error({ error: error }, 'Failed to create WPP client async');
        });
        return this;
    }
    async stop() {
        var _a;
        this.shouldRestart = false;
        this.startDelayedJob.cancel();
        this.status = enums_dto_1.WAHASessionStatus.STOPPED;
        this.stopEvents();
        this.mediaManager.close();
        await ((_a = this.authManager) === null || _a === void 0 ? void 0 : _a.stop());
        await this.end();
    }
    restartClient() {
        if (!this.shouldRestart) {
            this.logger.debug('Should not restart the client, ignoring restart request');
            this.end().catch((error) => {
                this.logger.error(error, 'Failed to end() the client');
            });
            return;
        }
        this.startDelayedJob.schedule(async () => {
            if (!this.shouldRestart) {
                this.logger.warn('Should not restart the client, ignoring restart request');
                return;
            }
            await this.end();
            await this.start();
        });
    }
    failed() {
        this.status = enums_dto_1.WAHASessionStatus.FAILED;
        this.restartClient();
    }
    async end() {
        var _a, _b, _c;
        ++this.startAttemptId;
        this.presence = null;
        this.meInfo = null;
        this.presencesByChatId.clear();
        this.qr.save('');
        const wpp = this.wpp;
        this.wpp = null;
        this.whatsapp = null;
        (_a = wpp === null || wpp === void 0 ? void 0 : wpp.page) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
        (_c = (_b = wpp === null || wpp === void 0 ? void 0 : wpp.page) === null || _b === void 0 ? void 0 : _b.browser()) === null || _c === void 0 ? void 0 : _c.removeAllListeners();
        await (wpp === null || wpp === void 0 ? void 0 : wpp.close().catch((error) => {
            this.logger.warn({ error: error }, 'Failed to close WPP client');
        }));
    }
    isCurrentStartAttempt(startAttemptId) {
        return this.startAttemptId === startAttemptId;
    }
    async createClientAsync(options, startAttemptId) {
        var _a;
        if (!this.isCurrentStartAttempt(startAttemptId)) {
            return;
        }
        await (0, processes_1.killProcessesByPatterns)([version_1.IsChrome ? 'chrome' : 'chromium', `--a-waha-session=${this.name}`], 'SIGKILL', this.logger);
        await (0, chrome_1.removeSingletonFiles)(this.getUserDataDir());
        await ((_a = this.authManager) === null || _a === void 0 ? void 0 : _a.beforeStart());
        let wpp;
        try {
            wpp = await (0, wppconnect_1.create)(options);
        }
        catch (error) {
            if (!this.isCurrentStartAttempt(startAttemptId)) {
                return;
            }
            this.logger.error('Failed to start WPP client');
            this.logger.error(error, error === null || error === void 0 ? void 0 : error.stack);
            this.status = enums_dto_1.WAHASessionStatus.FAILED;
            return;
        }
        if (!this.isCurrentStartAttempt(startAttemptId)) {
            await wpp.close().catch((error) => {
                this.logger.warn({ error: error }, 'Failed to close stale WPP client');
            });
            return;
        }
        this.wpp = wpp;
        this.whatsapp = this.wpp;
        this.subscribeEngineEvents2();
        if (this.isDebugEnabled()) {
            this.listenEngineEventsInDebugMode();
        }
        wpp.page.browser().on('disconnected', () => {
            if (this.wpp !== wpp) {
                return;
            }
            if (this.shouldRestart) {
                this.logger.error('The browser has been disconnected');
            }
            else {
                this.logger.info('The browser has been disconnected');
            }
            this.failed();
        });
        wpp.page.on('close', () => {
            if (this.wpp !== wpp) {
                return;
            }
            this.logger.error('The WhatsApp Web page has been closed');
            this.failed();
        });
        wpp.onStateChange((state) => {
            if (this.wpp !== wpp) {
                return;
            }
            this.applySocketState(state);
        });
        const state = await wpp.getConnectionState().catch(() => null);
        if (!this.isCurrentStartAttempt(startAttemptId) || this.wpp !== wpp) {
            return;
        }
        this.applySocketState(state);
    }
    async unpair() {
        var _a;
        this.unpairing = true;
        this.shouldRestart = false;
        await ((_a = this.wpp) === null || _a === void 0 ? void 0 : _a.logout());
    }
    getSessionMeInfo() {
        return this.meInfo;
    }
    getQR() {
        return this.qr;
    }
    async getScreenshot() {
        var _a;
        if (!((_a = this.wpp) === null || _a === void 0 ? void 0 : _a.page)) {
            throw new Error('WPP page is not ready');
        }
        const screenshot = await this.wpp.page.screenshot({
            encoding: 'binary',
        });
        return screenshot;
    }
    async checkNumberStatus(request) {
        let phone = request.phone.split('@')[0];
        phone = phone.replace(/\+/g, '');
        const number = await this.hooks.wid.chat.promise(phone, 'checkNumberStatus');
        const profile = await this.wpp.checkNumberStatus(number);
        const chatId = (0, ids_1.Deserialized)(profile === null || profile === void 0 ? void 0 : profile.id);
        if (!chatId) {
            return {
                numberExists: false,
            };
        }
        return {
            numberExists: true,
            chatId: chatId,
        };
    }
    async setProfileName(name) {
        await this.wpp.setProfileName(name);
        return true;
    }
    async setProfileStatus(status) {
        await this.wpp.setProfileStatus(status);
        return true;
    }
    async setProfilePicture(file) {
        const content = await this.fileToBuffer(file);
        const mimetype = MimetypeForDataUrl(file.mimetype || 'image/jpeg');
        const base64 = content.toString('base64');
        const media = `data:${mimetype};base64,${base64}`;
        await this.wpp.setProfilePic(media);
        return true;
    }
    async deleteProfilePicture() {
        await this.wpp.removeMyProfilePicture();
        return true;
    }
    async rejectCall(from, id) {
        void from;
        await this.wpp.rejectCall(id);
    }
    async sendLocation(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        const options = {
            lat: request.latitude,
            lng: request.longitude,
            name: request.title || '',
        };
        if (quotedMessageId) {
            options.quotedMsg = quotedMessageId;
        }
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendLocation');
        const sent = await this.wpp.sendLocation(chatId, options);
        return await this.toWAMessage(sent);
    }
    async forwardMessage(request) {
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'forwardMessage');
        const sentMessages = await this.wpp.forwardMessagesV2(chatId, request.messageId);
        const sent = Array.isArray(sentMessages) && sentMessages.length > 0;
        return {
            sent: Boolean(sent),
        };
    }
    async sendPoll(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        const options = {
            selectableCount: request.poll.multipleAnswers
                ? request.poll.options.length
                : 1,
        };
        if (quotedMessageId) {
            options.quotedMsg = quotedMessageId;
        }
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendPoll');
        const sent = await this.wpp.sendPollMessage(chatId, request.poll.name, request.poll.options, options);
        const messageIdPart = this.getMessageIdPart((0, ids_1.Deserialized)(sent === null || sent === void 0 ? void 0 : sent.id));
        this.hooks.message.sent.call(messageIdPart);
        const message = await this.toWAMessage(sent);
        return message;
    }
    async sendContactVCard(request) {
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendContactVCard');
        const contacts = [];
        const vcards = request.contacts.filter((c) => c.vcard);
        for (const vcard of vcards) {
            const contact = (0, vcard_1.parseVCardV3)(vcard.vcard);
            const id = contact.whatsappId || (0, vcard_1.normalizePN)(contact.phoneNumbers[0] || '');
            if (!id) {
                continue;
            }
            const contactId = await this.hooks.wid.chat.promise(id, 'sendContactVCard');
            contacts.push({
                id: contactId,
                name: contact.fullName || null,
            });
        }
        const contactsData = request.contacts.filter((c) => !c.vcard);
        for (const contact of contactsData) {
            const id = contact.whatsappId || (0, vcard_1.normalizePN)(contact.phoneNumber);
            const contactId = await this.hooks.wid.chat.promise(id, 'sendContactVCard');
            contacts.push({
                id: contactId,
                name: contact.fullName || null,
            });
        }
        if (contacts.length <= 1) {
            const single = contacts[0];
            const sent = await this.wpp.sendContactVcard(chatId, single.id, single.name || undefined);
            return await this.toWAMessage(sent);
        }
        const sent = await this.wpp.sendContactVcardList(chatId, contacts);
        return await this.toWAMessage(sent);
    }
    async sendImage(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        const content = await this.fileToBuffer(request.file);
        const mimetype = request.file.mimetype || WAMimeType_1.WAMimeType.IMAGE;
        const media = WPPMedia(content, mimetype);
        let mentions;
        if (request.mentions) {
            mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'sendImage')));
        }
        const options = {
            type: 'image',
            caption: request.caption,
            filename: request.file.filename,
            mimetype: mimetype,
            quotedMsg: quotedMessageId,
            mentionedList: mentions,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendImage');
        return await this.sendMedia(chatId, media, options);
    }
    async sendFile(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        const content = await this.fileToBuffer(request.file);
        const mimetype = request.file.mimetype || (await (0, files_1.detectMimetype)(content));
        const media = WPPMedia(content, mimetype);
        let mentions;
        if (request.mentions) {
            mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'sendFile')));
        }
        const options = {
            type: 'document',
            caption: request.caption,
            filename: request.file.filename,
            mimetype: mimetype,
            quotedMsg: quotedMessageId,
            mentionedList: mentions,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendFile');
        return await this.sendMedia(chatId, media, options);
    }
    async sendVoice(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        let content = await this.fileToBuffer(request.file);
        let mimetype = request.file.mimetype || WAMimeType_1.WAMimeType.VOICE;
        if (request.convert) {
            content = await this.convertVoice(content);
            mimetype = WAMimeType_1.WAMimeType.VOICE;
        }
        const media = WPPMedia(content, mimetype);
        const options = {
            type: 'audio',
            isPtt: true,
            mimetype: mimetype,
            quotedMsg: quotedMessageId,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendVoice');
        return await this.sendMedia(chatId, media, options);
    }
    async sendVideo(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        let content = await this.fileToBuffer(request.file);
        let mimetype = request.file.mimetype || WAMimeType_1.WAMimeType.VIDEO;
        if (request.convert) {
            content = await this.convertVideo(content);
            mimetype = WAMimeType_1.WAMimeType.VIDEO;
        }
        const media = WPPMedia(content, mimetype);
        let mentions;
        if (request.mentions) {
            mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'sendVideo')));
        }
        const options = {
            type: 'video',
            isPtv: request.asNote,
            caption: request.caption,
            filename: request.file.filename,
            mimetype: mimetype,
            quotedMsg: quotedMessageId,
            mentionedList: mentions,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendVideo');
        return await this.sendMedia(chatId, media, options);
    }
    async sendSticker(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        const content = await this.fileToBuffer(request.file);
        const mimetype = request.file.mimetype || WAMimeType_1.WAMimeType.STICKER;
        const media = WPPMedia(content, mimetype);
        const options = {
            type: 'sticker',
            filename: request.file.filename,
            mimetype: mimetype,
            quotedMsg: quotedMessageId,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendSticker');
        return await this.sendMedia(chatId, media, options);
    }
    async sendImageStatus(status) {
        this.checkStatusRequest(status);
        const content = await this.fileToBuffer(status.file);
        const mimetype = status.file.mimetype || WAMimeType_1.WAMimeType.IMAGE;
        const media = WPPMedia(content, mimetype);
        const options = {
            caption: status.caption,
            waitForAck: false,
        };
        if (status.id) {
            options.messageId = status.id;
        }
        const sent = (await this.wpp.sendImageStatus(media, options));
        return await this.toStatusResponse(sent, status.id);
    }
    async sendVoiceStatus(status) {
        this.checkStatusRequest(status);
        let content = await this.fileToBuffer(status.file);
        let mimetype = status.file.mimetype || WAMimeType_1.WAMimeType.VOICE;
        if (status.convert) {
            content = await this.convertVoice(content);
            mimetype = WAMimeType_1.WAMimeType.VOICE;
        }
        const media = WPPMedia(content, mimetype);
        const options = {
            type: 'audio',
            isPtt: true,
            mimetype: mimetype,
            waitForAck: true,
        };
        return await this.sendMedia(status_dto_1.BROADCAST_ID, media, options);
    }
    async sendVideoStatus(status) {
        this.checkStatusRequest(status);
        let content = await this.fileToBuffer(status.file);
        let mimetype = status.file.mimetype || WAMimeType_1.WAMimeType.VIDEO;
        if (status.convert) {
            content = await this.convertVideo(content);
            mimetype = WAMimeType_1.WAMimeType.VIDEO;
        }
        const media = WPPMedia(content, mimetype);
        const options = {
            caption: status.caption,
            waitForAck: false,
        };
        if (status.id) {
            options.messageId = status.id;
        }
        const sent = (await this.wpp.sendVideoStatus(media, options));
        return await this.toStatusResponse(sent, status.id);
    }
    async sendMedia(chatId, media, options) {
        const serializedChatId = typeof chatId === 'string'
            ? chatId
            : ((chatId === null || chatId === void 0 ? void 0 : chatId._serialized) ||
                (chatId === null || chatId === void 0 ? void 0 : chatId.toString()));
        if (serializedChatId && serializedChatId.endsWith('@newsletter')) {
            const bridged = await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (channelId) => {
                const chatStore = WPP.whatsapp.ChatStore;
                const newsletterStore = WPP.whatsapp.NewsletterStore;
                if (chatStore.get(channelId)) {
                    return true;
                }
                const newsletter = newsletterStore.get(channelId);
                if (!newsletter) {
                    return false;
                }
                chatStore.add(newsletter);
                return !!chatStore.get(channelId);
            }, serializedChatId);
            if (!bridged) {
                throw new Error(`WAHA WPP newsletter bridge failed for ${serializedChatId}`);
            }
        }
        const sent = await this.wpp.sendFile(chatId, media, options);
        const sentId = (sent === null || sent === void 0 ? void 0 : sent.id) || null;
        if (!sentId) {
            return {
                id: null,
                _data: sent,
            };
        }
        this.hooks.message.sent.call(this.extractMessageIdPart(sentId));
        const sentMessage = await this.wpp.getMessageById(sentId).catch(() => null);
        if (!sentMessage) {
            return {
                id: sentId,
                _data: sent,
            };
        }
        return await this.toWAMessage(sentMessage);
    }
    async convertVideo(content) {
        return await this.mediaConverter.video(content);
    }
    async convertVoice(content) {
        return await this.mediaConverter.voice(content);
    }
    extractMessageIdPart(messageId) {
        if (!messageId) {
            return null;
        }
        const parts = messageId.split('_');
        if (parts.length >= 3) {
            return parts[2];
        }
        return messageId;
    }
    async toStatusResponse(sent, fallbackId) {
        const sentId = (sent === null || sent === void 0 ? void 0 : sent.id) || fallbackId || null;
        if (!sentId) {
            return {
                id: null,
                _data: sent,
            };
        }
        this.hooks.message.sent.call(this.extractMessageIdPart(sentId));
        const sentMessage = await this.wpp.getMessageById(sentId).catch(() => null);
        if (!sentMessage) {
            return {
                id: sentId,
                _data: sent,
            };
        }
        return await this.toWAMessage(sentMessage);
    }
    async reply(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        let mentions;
        if (request.mentions) {
            mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'reply')));
        }
        const options = {
            mentionedList: mentions,
            quotedMsg: quotedMessageId,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'reply');
        const sent = await this.wpp.sendText(chatId, request.text, options);
        return await this.toWAMessage(sent);
    }
    async startTyping(request) {
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'startTyping');
        await this.wpp.startTyping(chatId);
    }
    async stopTyping(request) {
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'stopTyping');
        await Promise.all([
            this.wpp.stopTyping(chatId),
            this.wpp.stopRecording(chatId),
        ]);
    }
    async setReaction(request) {
        const reaction = request.reaction || false;
        return this.wpp.sendReactionToMessage(request.messageId, reaction);
    }
    async setStar(request) {
        await this.wpp.starMessage(request.messageId, request.star);
    }
    async sendText(request) {
        const quotedMessageId = this.getReplyToMessageId(request);
        let mentions;
        if (request.mentions) {
            mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'sendText')));
        }
        const options = {
            mentionedList: mentions,
            quotedMsg: quotedMessageId,
            waitForAck: false,
        };
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendText');
        const serializedChatId = typeof chatId === 'string'
            ? chatId
            : ((chatId === null || chatId === void 0 ? void 0 : chatId._serialized) ||
                (chatId === null || chatId === void 0 ? void 0 : chatId.toString()));
        if (serializedChatId && serializedChatId.endsWith('@newsletter')) {
            const bridged = await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (channelId) => {
                const chatStore = WPP.whatsapp.ChatStore;
                const newsletterStore = WPP.whatsapp.NewsletterStore;
                if (chatStore.get(channelId)) {
                    return true;
                }
                const newsletter = newsletterStore.get(channelId);
                if (!newsletter) {
                    return false;
                }
                chatStore.add(newsletter);
                return !!chatStore.get(channelId);
            }, serializedChatId);
            if (!bridged) {
                throw new Error(`WAHA WPP newsletter text bridge failed for ${serializedChatId}`);
            }
        }
        const sent = await this.wpp.sendText(chatId, request.text, options);
        const messageIdPart = this.getMessageIdPart((0, ids_1.Deserialized)(sent === null || sent === void 0 ? void 0 : sent.id));
        this.hooks.message.sent.call(messageIdPart);
        const message = await this.toWAMessage(sent);
        return message;
    }
    async sendSeen(request) {
        const chatId = await this.hooks.wid.chat.promise(request.chatId, 'sendSeen');
        await this.wpp.sendSeen(chatId);
    }
    async setPresence(presence, chatId) {
        switch (presence) {
            case enums_dto_1.WAHAPresenceStatus.ONLINE:
                await this.wpp.setOnlinePresence(true);
                break;
            case enums_dto_1.WAHAPresenceStatus.OFFLINE:
                await this.wpp.setOnlinePresence(false);
                break;
            case enums_dto_1.WAHAPresenceStatus.TYPING: {
                await this.hooks.activity.promise('setPresence');
                const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'setPresence');
                await this.wpp.startTyping(normalizedChatId);
                break;
            }
            case enums_dto_1.WAHAPresenceStatus.RECORDING: {
                await this.hooks.activity.promise('setPresence');
                const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'setPresence');
                await this.wpp.startRecording(normalizedChatId);
                break;
            }
            case enums_dto_1.WAHAPresenceStatus.PAUSED: {
                await this.hooks.activity.promise('setPresence');
                const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'setPresence');
                await Promise.all([
                    this.wpp.stopTyping(normalizedChatId),
                    this.wpp.stopRecording(normalizedChatId),
                ]);
                break;
            }
            default:
                throw new exceptions_1.NotImplementedByEngineError(`WPP engine doesn't support '${presence}' presence.`);
        }
        this.presence = presence;
    }
    async getPresences() {
        return Array.from(this.presencesByChatId.values());
    }
    async getPresence(id) {
        const chatId = await this.hooks.wid.chat.promise(id, 'getPresence');
        await this.subscribePresence(chatId);
        const presence = this.presencesByChatId.get(chatId);
        if (presence) {
            return presence;
        }
        return {
            id: chatId,
            presences: [],
        };
    }
    async subscribePresence(id) {
        const chatId = await this.hooks.wid.chat.promise(id, 'subscribePresence');
        await this.wpp.subscribePresence(chatId);
        return null;
    }
    async sendTextStatus(status) {
        this.checkStatusRequest(status);
        const options = {
            waitForAck: false,
        };
        if (status.font != null) {
            options.font = status.font;
        }
        if (status.backgroundColor != null) {
            options.backgroundColor = status.backgroundColor;
        }
        if (status.id) {
            options.messageId = status.id;
        }
        const sent = await this.wpp.sendTextStatus(status.text, options);
        const sentId = extractWppMessageId(sent) || status.id || null;
        if (!sentId) {
            return {
                id: null,
                _data: sent,
            };
        }
        this.hooks.message.sent.call(this.getMessageIdPart(sentId));
        const sentMessage = await this.wpp.getMessageById(sentId).catch(() => null);
        if (!sentMessage) {
            return {
                id: sentId,
                _data: sent,
            };
        }
        return await this.toWAMessage(sentMessage);
    }
    async getChats(pagination, filter = null) {
        var _a;
        const chats = await this.wpp.listChats();
        let rows = chats.map((chat) => {
            return Object.assign(Object.assign({}, chat), { id: this.toChatId(chat) });
        });
        if ((_a = filter === null || filter === void 0 ? void 0 : filter.ids) === null || _a === void 0 ? void 0 : _a.length) {
            const normalizedIds = await Promise.all(filter.ids.map((id) => this.hooks.wid.chat.promise(id, 'getChats')));
            const ids = new Set(normalizedIds);
            rows = rows.filter((chat) => ids.has(chat.id));
        }
        const sortBy = this.toChatSortBy(pagination === null || pagination === void 0 ? void 0 : pagination.sortBy);
        const normalizedPagination = Object.assign(Object.assign({}, pagination), { sortBy: sortBy });
        return new Paginator_1.PaginatorInMemory(normalizedPagination).apply(rows);
    }
    async getChatsOverview(pagination, filter) {
        pagination = Object.assign(Object.assign({}, pagination), { sortBy: chats_dto_1.ChatSortField.CONVERSATION_TIMESTAMP, sortOrder: pagination_dto_1.SortOrder.DESC });
        const chats = await this.getChats(pagination, filter);
        const promises = [];
        for (const chat of chats) {
            promises.push(this.fetchChatSummary(chat));
        }
        const result = await Promise.all(promises);
        return result;
    }
    async fetchChatSummary(chat) {
        const chatId = this.toChatId(chat);
        const [picture, lastMessage] = await Promise.all([
            this.getContactProfilePicture(chatId, false),
            this.getLastMessage(chatId),
        ]);
        return {
            id: chatId,
            name: chat.name || null,
            picture: picture,
            lastMessage: lastMessage,
            _chat: chat,
        };
    }
    async getChatMessages(chatId, query, filter) {
        if (chatId === 'all') {
            throw new exceptions_1.NotImplementedByEngineError("Can not get messages from 'all' in WPP");
        }
        const id = await this.hooks.wid.chat.promise(chatId, 'getChatMessages');
        const offset = (query === null || query === void 0 ? void 0 : query.offset) || 0;
        const limit = (query === null || query === void 0 ? void 0 : query.limit) || 10;
        const fetchCount = offset + limit;
        const rawMessages = await this.wpp.getMessages(id, {
            count: fetchCount,
            direction: 'before',
        });
        const messagesById = new Map();
        for (const rawMessage of rawMessages) {
            const rawMessageId = (0, ids_1.Deserialized)(rawMessage === null || rawMessage === void 0 ? void 0 : rawMessage.id);
            if (!rawMessageId) {
                continue;
            }
            messagesById.set(rawMessageId, rawMessage);
        }
        let messages = await Promise.all(rawMessages.map((message) => this.toWAMessage(message)));
        messages = this.filterMessages(messages, filter);
        messages = new Paginator_1.PaginatorInMemory({
            limit: limit,
            offset: offset,
            sortBy: (query === null || query === void 0 ? void 0 : query.sortBy) || 'timestamp',
            sortOrder: (query === null || query === void 0 ? void 0 : query.sortOrder) || pagination_dto_1.SortOrder.DESC,
        }).apply(messages);
        const params = {
            download: query.downloadMedia,
            mimetypes: query.downloadMediaMimetypes,
        };
        const options = lodash.defaults({}, params, this.media.api);
        const promises = [];
        for (const message of messages) {
            const rawMessage = messagesById.get(message.id);
            if (!rawMessage) {
                promises.push(Promise.resolve(message));
                continue;
            }
            promises.push(this.processIncomingMessage(rawMessage, options));
        }
        let result = await Promise.all(promises);
        result = result.filter(Boolean);
        return result;
    }
    async getChatMessage(chatId, messageId, query) {
        void chatId;
        const message = await this.wpp.getMessageById(messageId).catch(() => null);
        if (!message) {
            return null;
        }
        const params = {
            download: query.downloadMedia,
            mimetypes: query.downloadMediaMimetypes,
        };
        const options = lodash.defaults({}, params, this.media.api);
        return this.processIncomingMessage(message, options);
    }
    async deleteMessage(chatId, messageId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'deleteMessage');
        await this.wpp.deleteMessage(normalizedChatId, messageId);
        return true;
    }
    async editMessage(chatId, messageId, request) {
        var _a;
        void chatId;
        const options = {};
        if ((_a = request.mentions) === null || _a === void 0 ? void 0 : _a.length) {
            options.mentions = await Promise.all(request.mentions.map((mention) => this.hooks.wid.mention.promise(mention, 'editMessage')));
        }
        if (request.linkPreview != null) {
            options.linkPreview = request.linkPreview;
        }
        const sent = await this.wpp.editMessage(messageId, request.text, options);
        return await this.toWAMessage(sent);
    }
    async deleteChat(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'deleteChat');
        return this.wpp.deleteChat(normalizedChatId);
    }
    async clearMessages(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'clearMessages');
        return this.wpp.clearChat(normalizedChatId, true);
    }
    async chatsArchiveChat(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'chatsArchiveChat');
        return this.wpp.archiveChat(normalizedChatId, true);
    }
    async chatsUnarchiveChat(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'chatsUnarchiveChat');
        return this.wpp.archiveChat(normalizedChatId, false);
    }
    async chatsUnreadChat(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'chatsUnreadChat');
        return this.wpp.markUnseenMessage(normalizedChatId);
    }
    async readChatMessages(chatId, request) {
        void request;
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'readChatMessages');
        await this.wpp.sendSeen(normalizedChatId);
        return { ids: null };
    }
    async fetchContactProfilePicture(id) {
        const contactId = await this.hooks.wid.chat.promise(id, 'fetchContactProfilePicture');
        const profilePicture = await this.wpp.getProfilePicFromServer(contactId);
        return ((profilePicture === null || profilePicture === void 0 ? void 0 : profilePicture.eurl) ||
            (profilePicture === null || profilePicture === void 0 ? void 0 : profilePicture.imgFull) ||
            (profilePicture === null || profilePicture === void 0 ? void 0 : profilePicture.img) ||
            null);
    }
    async getContact(query) {
        const contactId = await this.hooks.wid.chat.promise(query.contactId, 'getContact');
        const contact = await this.wpp.getContact(contactId);
        return this.toWAContact(contact);
    }
    async getContacts(pagination) {
        const contacts = await this.wpp.getAllContacts();
        const rows = contacts.map((contact) => this.toWAContact(contact));
        return new Paginator_1.PaginatorInMemory(pagination).apply(rows);
    }
    async getContactAbout(query) {
        const contactId = await this.hooks.wid.chat.promise(query.contactId, 'getContactAbout');
        const result = await this.wpp.getStatus(contactId).catch(() => null);
        if (!result) {
            return {
                about: null,
            };
        }
        if (typeof result === 'string') {
            return {
                about: result,
            };
        }
        return {
            about: (result === null || result === void 0 ? void 0 : result.status) || null,
        };
    }
    async blockContact(request) {
        const contactId = await this.hooks.wid.chat.promise(request.contactId, 'blockContact');
        await this.wpp.blockContact(contactId);
    }
    async unblockContact(request) {
        const contactId = await this.hooks.wid.chat.promise(request.contactId, 'unblockContact');
        await this.wpp.unblockContact(contactId);
    }
    async getAllLids(pagination) {
        const lids = await this.listAllKnownLids();
        const paginator = new Paginator_1.PaginatorInMemory(pagination);
        return paginator.apply(lids);
    }
    async getLidsCount() {
        const lids = await this.listAllKnownLids();
        return lids.length;
    }
    async findPNByLid(lid) {
        const normalizedLid = lid.includes('@') ? lid : `${lid}@lid`;
        const entry = await this.wpp.getPnLidEntry(normalizedLid).catch(() => null);
        return this.toLidMapping(entry, normalizedLid, null);
    }
    async findLIDByPhoneNumber(phoneNumber) {
        const normalizedPhoneNumber = await this.hooks.wid.chat.promise(phoneNumber, 'findLIDByPhoneNumber');
        const entry = await this.wpp.getPnLidEntry(normalizedPhoneNumber).catch(() => null);
        return this.toLidMapping(entry, null, normalizedPhoneNumber);
    }
    async createGroup(request) {
        const participants = await Promise.all(request.participants.map((participant) => this.hooks.wid.chat.promise(participant.id, 'createGroup')));
        return this.wpp.createGroup(request.name, participants);
    }
    async joinGroup(code) {
        const response = await this.wpp.joinGroup(code);
        const id = (0, ids_1.Deserialized)(response === null || response === void 0 ? void 0 : response.id) || (response === null || response === void 0 ? void 0 : response.id);
        return (0, jids_1.toCusFormat)(id);
    }
    joinInfoGroup(code) {
        return this.wpp.getGroupInfoFromInviteLink(code);
    }
    async getGroups(pagination) {
        const groups = await this.wpp.listChats({
            onlyGroups: true,
        });
        const rows = groups.map((group) => (Object.assign(Object.assign({}, group), { id: this.toChatId(group) })));
        const normalizedPagination = Object.assign(Object.assign({}, pagination), { sortBy: this.toGroupSortBy(pagination === null || pagination === void 0 ? void 0 : pagination.sortBy) });
        return new Paginator_1.PaginatorInMemory(normalizedPagination).apply(rows);
    }
    removeGroupsFieldParticipant(group) {
        var _a, _b, _c, _d;
        delete group.participants;
        delete group.pendingParticipants;
        delete group.pastParticipants;
        delete group.membershipApprovalRequests;
        (_a = group.groupMetadata) === null || _a === void 0 ? true : delete _a.participants;
        (_b = group.groupMetadata) === null || _b === void 0 ? true : delete _b.pendingParticipants;
        (_c = group.groupMetadata) === null || _c === void 0 ? true : delete _c.pastParticipants;
        (_d = group.groupMetadata) === null || _d === void 0 ? true : delete _d.membershipApprovalRequests;
    }
    async refreshGroups() {
        await this.wpp.listChats({
            onlyGroups: true,
        });
        return true;
    }
    async getGroup(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'getGroup');
        return this.wpp.getChatById(groupId);
    }
    async getGroupParticipants(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getGroupParticipants');
        const group = await this.wpp.getChatById(groupId);
        const participants = ((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.participants) || [];
        return this.toGroupParticipants(participants);
    }
    async getInfoAdminsOnly(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getInfoAdminsOnly');
        const group = await this.wpp.getChatById(groupId);
        const adminsOnly = Boolean((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.restrict);
        return {
            adminsOnly: adminsOnly,
        };
    }
    async setInfoAdminsOnly(id, value) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setInfoAdminsOnly');
        return this.wpp.setGroupProperty(groupId, wppconnect_1.GroupProperty.RESTRICT, value);
    }
    async getMessagesAdminsOnly(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getMessagesAdminsOnly');
        const group = await this.wpp.getChatById(groupId);
        const adminsOnly = Boolean((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.announce);
        return {
            adminsOnly: adminsOnly,
        };
    }
    async setMessagesAdminsOnly(id, value) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setMessagesAdminsOnly');
        return this.wpp.setGroupProperty(groupId, wppconnect_1.GroupProperty.ANNOUNCEMENT, value);
    }
    async getMemberAddMode(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getMemberAddMode');
        const group = await this.wpp.getChatById(groupId);
        const memberAddMode = (_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.memberAddMode;
        return {
            membersCanAddNewMember: memberAddMode === 'all_member_add',
        };
    }
    async setMemberAddMode(id, value) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setMemberAddMode');
        return this.wpp.setGroupProperty(groupId, 'member_add_mode', value);
    }
    async getMembershipApprovalMode(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getMembershipApprovalMode');
        const group = await this.wpp.getChatById(groupId);
        return {
            newMembersApprovalRequired: !!((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.membershipApprovalMode),
        };
    }
    async setMembershipApprovalMode(id, value) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setMembershipApprovalMode');
        return this.wpp.setGroupProperty(groupId, 'membership_approval_mode', value);
    }
    async getGroupJoinRequests(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'getGroupJoinRequests');
        const requests = await this.wpp.getGroupMembershipRequests(groupId);
        return requests.map((request) => ({
            requesterId: (0, serialized_1.GetSerialized)(request.id),
            addedById: (0, serialized_1.GetSerialized)(request.addedBy),
            parentGroupId: (0, serialized_1.GetSerialized)(request.parentGroupId),
            requestMethod: (0, groups_dto_1.NormalizeJoinRequestMethod)(request.requestMethod),
            timestamp: request.t,
        }));
    }
    async approveGroupJoinRequests(id, request) {
        const groupId = await this.hooks.wid.chat.promise(id, 'approveGroupJoinRequests');
        const results = await this.wpp.approveGroupMembershipRequest(groupId, request.participants.map((participant) => participant.id));
        return results.map(WppToGroupJoinRequestResult);
    }
    async rejectGroupJoinRequests(id, request) {
        const groupId = await this.hooks.wid.chat.promise(id, 'rejectGroupJoinRequests');
        const results = await this.wpp.rejectGroupMembershipRequest(groupId, request.participants.map((participant) => participant.id));
        return results.map(WppToGroupJoinRequestResult);
    }
    async deleteGroup(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'deleteGroup');
        return this.wpp.deleteChat(groupId);
    }
    async leaveGroup(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'leaveGroup');
        return this.wpp.leaveGroup(groupId);
    }
    async setDescription(id, description) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setDescription');
        return this.wpp.setGroupDescription(groupId, description);
    }
    async setGroupPicture(id, file) {
        const content = await this.fileToBuffer(file);
        const mimetype = MimetypeForDataUrl(file.mimetype || 'image/jpeg');
        const base64 = content.toString('base64');
        const media = `data:${mimetype};base64,${base64}`;
        const groupId = await this.hooks.wid.chat.promise(id, 'setGroupPicture');
        await this.wpp.setGroupIcon(groupId, media);
        return true;
    }
    async deleteGroupPicture(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'deleteGroupPicture');
        return this.wpp.removeGroupIcon(groupId);
    }
    async setSubject(id, subject) {
        const groupId = await this.hooks.wid.chat.promise(id, 'setSubject');
        return this.wpp.setGroupSubject(groupId, subject);
    }
    async getInviteCode(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'getInviteCode');
        const inviteLink = await this.wpp.getGroupInviteLink(groupId);
        return this.unwrapGroupInviteCode(inviteLink);
    }
    async revokeInviteCode(id) {
        const groupId = await this.hooks.wid.chat.promise(id, 'revokeInviteCode');
        const inviteLink = await this.wpp.revokeGroupInviteLink(groupId);
        return this.unwrapGroupInviteCode(inviteLink);
    }
    async getParticipants(id) {
        var _a;
        const groupId = await this.hooks.wid.chat.promise(id, 'getParticipants');
        const group = await this.wpp.getChatById(groupId);
        return ((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.participants) || [];
    }
    async addParticipants(id, request) {
        const participants = await Promise.all(request.participants.map((participant) => this.hooks.wid.chat.promise(participant.id, 'addParticipants')));
        const groupId = await this.hooks.wid.chat.promise(id, 'addParticipants');
        return this.wpp.addParticipant(groupId, participants);
    }
    async removeParticipants(id, request) {
        const participants = await Promise.all(request.participants.map((participant) => this.hooks.wid.chat.promise(participant.id, 'removeParticipants')));
        const groupId = await this.hooks.wid.chat.promise(id, 'removeParticipants');
        return this.wpp.removeParticipant(groupId, participants);
    }
    async promoteParticipantsToAdmin(id, request) {
        const participants = await Promise.all(request.participants.map((participant) => this.hooks.wid.chat.promise(participant.id, 'promoteParticipantsToAdmin')));
        const groupId = await this.hooks.wid.chat.promise(id, 'promoteParticipantsToAdmin');
        await this.wpp.promoteParticipant(groupId, participants);
        return true;
    }
    async demoteParticipantsToUser(id, request) {
        const participants = await Promise.all(request.participants.map((participant) => this.hooks.wid.chat.promise(participant.id, 'demoteParticipantsToUser')));
        const groupId = await this.hooks.wid.chat.promise(id, 'demoteParticipantsToUser');
        return this.wpp.demoteParticipant(groupId, participants);
    }
    async getLabels() {
        const labels = await this.wpp.getAllLabels();
        return labels.map((label) => this.toLabel(label));
    }
    async createLabel(label) {
        const created = await this.wpp.addNewLabel(label.name, {
            labelColor: label.color,
        });
        return this.toLabel(created, label);
    }
    async updateLabel(label) {
        var _a;
        if (!((_a = this.wpp) === null || _a === void 0 ? void 0 : _a.page)) {
            throw new exceptions_1.NotImplementedByEngineError('WPP page is not ready');
        }
        const updated = await this.wpp.page.evaluate(async (id, name, color) => {
            var _a, _b;
            if (!((_b = (_a = window === null || window === void 0 ? void 0 : window.WPP) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.editLabel)) {
                return null;
            }
            return await window.WPP.labels.editLabel(id, {
                name: name,
                labelColor: color,
            });
        }, label.id, label.name, label.color);
        if (!updated) {
            throw new exceptions_1.NotImplementedByEngineError('WPP labels.editLabel is not available in current WPP state');
        }
        return this.toLabel(updated, label);
    }
    async deleteLabel(label) {
        await this.wpp.deleteLabel(label.id);
    }
    getChatsByLabelId(labelId) {
        return this.wpp.listChats({
            withLabels: [labelId],
        });
    }
    async getChatLabels(chatId) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'getChatLabels');
        const labels = await this.getLabels();
        const checks = labels.map(async (label) => {
            const chats = await this.wpp.listChats({
                withLabels: [label.id],
            }).catch(() => []);
            const hasChat = chats.some((chat) => this.toChatId(chat) === normalizedChatId);
            if (!hasChat) {
                return null;
            }
            return label;
        });
        const rows = await Promise.all(checks);
        return rows.filter(Boolean);
    }
    async putLabelsToChat(chatId, labels) {
        const normalizedChatId = await this.hooks.wid.chat.promise(chatId, 'putLabelsToChat');
        const targetLabelIds = labels.map((label) => label.id);
        const currentLabels = await this.getChatLabels(normalizedChatId);
        const currentLabelIds = currentLabels.map((label) => label.id);
        const addLabelIds = lodash.difference(targetLabelIds, currentLabelIds);
        const removeLabelIds = lodash.difference(currentLabelIds, targetLabelIds);
        const operations = [
            ...addLabelIds.map((id) => ({
                labelId: id,
                type: 'add',
            })),
            ...removeLabelIds.map((id) => ({
                labelId: id,
                type: 'remove',
            })),
        ];
        if (operations.length === 0) {
            return;
        }
        await this.wpp.addOrRemoveLabels(normalizedChatId, operations);
    }
    async requestCode(phoneNumber, method, params) {
        var _a;
        void method;
        void params;
        if (!((_a = this.wpp) === null || _a === void 0 ? void 0 : _a.page)) {
            throw new Error('WPP page is not ready');
        }
        let code = this.pairingCode;
        if (!code) {
            code = await this.wpp.page.evaluate(async (phone) => {
                var _a, _b;
                if (!((_b = (_a = window === null || window === void 0 ? void 0 : window.WPP) === null || _a === void 0 ? void 0 : _a.conn) === null || _b === void 0 ? void 0 : _b.genLinkDeviceCodeForPhoneNumber)) {
                    return null;
                }
                return await window.WPP.conn.genLinkDeviceCodeForPhoneNumber(phone);
            }, phoneNumber);
        }
        if (!code) {
            throw new exceptions_1.NotImplementedByEngineError('Pairing code is not available in current WPP state');
        }
        const formatted = (0, helpers_1.splitAt)(code, 4).join('-');
        return { code: formatted };
    }
    async getEngineInfo() {
        if (!this.wpp) {
            return null;
        }
        return {
            WWebVersion: await this.wpp.getWAVersion().catch(() => null),
            state: await this.wpp.getConnectionState().catch(() => null),
        };
    }
    subscribeEngineEvents2() {
        const streams = (0, wppStreams_1.buildWppStreams)(this.wpp);
        const all$ = (0, rxjs_1.merge)(...Object.values(streams)).pipe((0, rxjs_1.retry)({ delay: 2000 }), (0, rxjs_1.share)());
        this.events2.get(enums_dto_1.WAHAEvents.ENGINE_EVENT).switch(all$);
        const messages$ = streams.onMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) !== wppconnect_1.MessageType.GP2), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) !== wppconnect_1.MessageType.E2E_NOTIFICATION), (0, operators_1.filter)((msg) => this.jids.include((msg === null || msg === void 0 ? void 0 : msg.chatId) || (msg === null || msg === void 0 ? void 0 : msg.from))), (0, rxjs_1.mergeMap)((msg) => this.processIncomingWPPMessage(msg)));
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE).switch(messages$);
        const messagesAny$ = streams.onAnyMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) !== wppconnect_1.MessageType.GP2), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) !== wppconnect_1.MessageType.E2E_NOTIFICATION), (0, operators_1.filter)((msg) => this.jids.include((msg === null || msg === void 0 ? void 0 : msg.chatId) || (msg === null || msg === void 0 ? void 0 : msg.from))), (0, rxjs_1.mergeMap)((msg) => this.processIncomingWPPMessage(msg)));
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_ANY).switch(messagesAny$);
        const messagesAck$ = streams.onAck.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.map)((data) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (typeof data === 'number') {
                return null;
            }
            let model;
            let ackLevel;
            if (Array.isArray(data)) {
                [model, ackLevel] = data;
            }
            else {
                model = data;
                ackLevel = data === null || data === void 0 ? void 0 : data.ack;
            }
            if (!(model === null || model === void 0 ? void 0 : model.id)) {
                return null;
            }
            const msgId = (0, ids_1.Deserialized)(model.id);
            const from = (_e = (0, jids_1.toCusFormat)((_d = (_c = (_b = (_a = model.id) === null || _a === void 0 ? void 0 : _a.remote) !== null && _b !== void 0 ? _b : model.from) !== null && _c !== void 0 ? _c : model.chatId) !== null && _d !== void 0 ? _d : '')) !== null && _e !== void 0 ? _e : null;
            const to = (_g = (0, jids_1.toCusFormat)((_f = model.to) !== null && _f !== void 0 ? _f : '')) !== null && _g !== void 0 ? _g : null;
            const fromMe = Boolean((_j = (_h = model.id) === null || _h === void 0 ? void 0 : _h.fromMe) !== null && _j !== void 0 ? _j : model.fromMe);
            const ack = typeof ackLevel === 'number'
                ? ackLevel
                : (_k = model.ack) !== null && _k !== void 0 ? _k : enums_dto_1.WAMessageAck.PENDING;
            return {
                id: msgId,
                from: from,
                to: to,
                participant: model.author ? (0, jids_1.toCusFormat)(model.author) : null,
                fromMe: fromMe,
                ack: ack,
                ackName: enums_dto_1.WAMessageAck[ack] || enums_dto_1.ACK_UNKNOWN,
                _data: data,
            };
        }), (0, operators_1.filter)(Boolean), (0, operators_1.filter)((ack) => !!ack.id &&
            this.jids.include((0, jids_1.isJidGroup)(ack.from) ? ack.from : ack.to)));
        const messagesAckContacts$ = messagesAck$.pipe((0, operators_1.filter)((ack) => !(0, jids_1.isJidGroup)(ack.to) && !(0, jids_1.isJidGroup)(ack.from)), (0, reactive_1.DistinctAck)());
        const messagesAckGroups$ = messagesAck$.pipe((0, operators_1.filter)((ack) => (0, jids_1.isJidGroup)(ack.to) || (0, jids_1.isJidGroup)(ack.from)), (0, reactive_1.DistinctAck)());
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_ACK).switch(messagesAckContacts$);
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_ACK_GROUP).switch(messagesAckGroups$);
        const messagesRevoked$ = streams.onRevokedMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((data) => this.jids.include((data === null || data === void 0 ? void 0 : data.from) || (data === null || data === void 0 ? void 0 : data.to))), (0, operators_1.map)((data) => {
            const key = (0, ids_1.parseMessageIdSerialized)(data.id);
            const editedKey = (0, ids_1.parseMessageIdSerialized)(data.refId);
            return {
                revokedMessageId: editedKey.id,
                before: editedKey,
                after: key,
                _data: data,
            };
        }));
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_REVOKED).switch(messagesRevoked$);
        const messagesReaction$ = streams.onReactionMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.map)((data) => (0, events_wpp_1.WppReactionToMessageReaction)(data)), (0, operators_1.filter)((r) => this.jids.include(r.participant)));
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_REACTION).switch(messagesReaction$);
        const messagesEdit$ = streams.onMessageEdit.pipe((0, operators_1.map)((p) => this.normalizeWppMessageEditData(p.data)), (0, operators_1.filter)(Boolean), (0, operators_1.filter)((payload) => {
            return this.jids.include(payload.chatId);
        }), (0, rxjs_1.concatMap)(async (payload) => {
            const message = await this.toWAMessage(payload.message);
            const serializedOriginalId = payload.editedMessageId || message.id;
            const editedMessageId = (0, ids_1.parseMessageIdSerialized)(serializedOriginalId, true).id ||
                serializedOriginalId;
            const id = payload.editKey || message.id;
            return Object.assign(Object.assign({}, message), { id: id, editedMessageId: editedMessageId, _data: payload.raw });
        }));
        this.events2.get(enums_dto_1.WAHAEvents.MESSAGE_EDITED).switch(messagesEdit$);
        const presences$ = streams.onPresenceChanged.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((data) => this.jids.include(data === null || data === void 0 ? void 0 : data.id)), (0, operators_1.map)((data) => (0, events_wpp_1.WppPresenceToPresence)(data)), (0, operators_1.tap)((presence) => {
            this.presencesByChatId.set(presence.id, {
                id: presence.id,
                presences: presence.presences.map((p) => (Object.assign({}, p))),
            });
        }));
        this.events2.get(enums_dto_1.WAHAEvents.PRESENCE_UPDATE).switch(presences$);
        const participantsChanged$ = streams.onParticipantsChanged.pipe((0, operators_1.map)((p) => p.data), (0, rxjs_1.share)());
        const groupParticipants$ = participantsChanged$.pipe((0, operators_1.filter)((data) => !(0, events_wpp_1.WppParticipantsIsMyJoin)(data, this.getSessionMeInfo()) &&
            !(0, events_wpp_1.WppParticipantsIsMyLeave)(data, this.getSessionMeInfo())), (0, operators_1.map)((data) => (0, events_wpp_1.WppParticipantsToGroupV2Participants)(data)), (0, operators_1.filter)(Boolean));
        this.events2
            .get(enums_dto_1.WAHAEvents.GROUP_V2_PARTICIPANTS)
            .switch(groupParticipants$);
        const groupV2Join$ = participantsChanged$.pipe((0, operators_1.filter)((data) => (0, events_wpp_1.WppParticipantsIsMyJoin)(data, this.getSessionMeInfo())), (0, rxjs_1.mergeMap)(async (data) => {
            var _a, _b, _c, _d, _e;
            const groupId = (0, jids_1.toCusFormat)(data.groupId);
            const group = await this.wpp.getChatById(data.groupId);
            const participants = this.toGroupParticipants(((_a = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _a === void 0 ? void 0 : _a.participants) || []);
            const groupInfo = {
                id: groupId,
                subject: (group === null || group === void 0 ? void 0 : group.name) || '',
                description: ((_b = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _b === void 0 ? void 0 : _b.desc) || '',
                invite: null,
                membersCanAddNewMember: ((_c = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _c === void 0 ? void 0 : _c.memberAddMode) === 'all_member_add',
                membersCanSendMessages: !((_d = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _d === void 0 ? void 0 : _d.announce),
                newMembersApprovalRequired: !!((_e = group === null || group === void 0 ? void 0 : group.groupMetadata) === null || _e === void 0 ? void 0 : _e.membershipApprovalMode),
                participants: participants,
            };
            return {
                timestamp: Math.floor(Date.now() / 1000),
                group: groupInfo,
                _data: data,
            };
        }));
        this.events2.get(enums_dto_1.WAHAEvents.GROUP_V2_JOIN).switch(groupV2Join$);
        const groupV2Leave$ = participantsChanged$.pipe((0, operators_1.filter)((data) => (0, events_wpp_1.WppParticipantsIsMyLeave)(data, this.getSessionMeInfo())), (0, operators_1.map)((data) => (0, events_wpp_1.WppParticipantsToGroupV2Leave)(data)));
        this.events2.get(enums_dto_1.WAHAEvents.GROUP_V2_LEAVE).switch(groupV2Leave$);
        const groupV2Update$ = streams.onAnyMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) === wppconnect_1.MessageType.GP2), (0, rxjs_1.distinct)((msg) => msg === null || msg === void 0 ? void 0 : msg.id, (0, rxjs_1.interval)(60000)), (0, operators_1.map)((msg) => (0, events_wpp_1.WppGp2ToGroupV2Update)(msg)), (0, operators_1.filter)(Boolean));
        this.events2.get(enums_dto_1.WAHAEvents.GROUP_V2_UPDATE).switch(groupV2Update$);
        const groupV2ParticipantsJoinRequest$ = streams.onAnyMessage.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((msg) => (msg === null || msg === void 0 ? void 0 : msg.type) === wppconnect_1.MessageType.GP2), (0, rxjs_1.distinct)((msg) => msg === null || msg === void 0 ? void 0 : msg.id, (0, rxjs_1.interval)(60000)), (0, operators_1.map)((msg) => (0, events_wpp_1.WppGp2ToGroupV2ParticipantsJoinRequest)(msg)), (0, operators_1.filter)(Boolean));
        this.events2
            .get(enums_dto_1.WAHAEvents.GROUP_V2_PARTICIPANTS_JOIN_REQUEST)
            .switch(groupV2ParticipantsJoinRequest$);
        const calls$ = streams.onIncomingCall.pipe((0, operators_1.map)((p) => this.normalizeWppIncomingCallData(p.data)), (0, operators_1.filter)(Boolean));
        this.events2.get(enums_dto_1.WAHAEvents.CALL_RECEIVED).switch(calls$);
        const pollVotes$ = streams.onPollResponse.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.map)((data) => {
            var _a;
            const raw = data;
            const chatId = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(raw.chatId));
            if (!chatId || !this.jids.include(chatId)) {
                return null;
            }
            const meId = (_a = this.getSessionMeInfo()) === null || _a === void 0 ? void 0 : _a.id;
            const sender = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(raw.sender));
            const fromMe = !!meId && (0, jids_1.toCusFormat)(meId) === sender;
            const msgId = (0, ids_1.Deserialized)(raw.msgId);
            return {
                poll: {
                    id: msgId,
                    from: fromMe ? sender : chatId,
                    fromMe: fromMe,
                    to: fromMe ? chatId : sender,
                    participant: (0, jids_1.isJidGroup)(chatId) ? sender : null,
                },
                vote: {
                    id: msgId,
                    from: sender,
                    fromMe: fromMe,
                    to: chatId,
                    participant: (0, jids_1.isJidGroup)(chatId) ? sender : null,
                    selectedOptions: Array.isArray(data.selectedOptions)
                        ? data.selectedOptions
                            .map((option) => option === null || option === void 0 ? void 0 : option.name)
                            .filter(Boolean)
                        : [],
                    timestamp: data.timestamp,
                },
                _data: data,
            };
        }), (0, operators_1.filter)(Boolean));
        this.events2.get(enums_dto_1.WAHAEvents.POLL_VOTE).switch(pollVotes$);
        const labelsUpdated$ = streams.onUpdateLabel.pipe((0, operators_1.map)((p) => p.data), (0, rxjs_1.mergeMap)((data) => (0, rxjs_1.from)((0, events_wpp_1.WppUpdateLabelToAssociations)(data))), (0, rxjs_1.share)());
        this.events2.get(enums_dto_1.WAHAEvents.LABEL_CHAT_ADDED).switch(streams.onUpdateLabel.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((data) => data.type === 'add'), (0, rxjs_1.mergeMap)((data) => (0, rxjs_1.from)((0, events_wpp_1.WppUpdateLabelToAssociations)(data)))));
        this.events2.get(enums_dto_1.WAHAEvents.LABEL_CHAT_DELETED).switch(streams.onUpdateLabel.pipe((0, operators_1.map)((p) => p.data), (0, operators_1.filter)((data) => data.type === 'remove'), (0, rxjs_1.mergeMap)((data) => (0, rxjs_1.from)((0, events_wpp_1.WppUpdateLabelToAssociations)(data)))));
        void labelsUpdated$;
        const stateChanged$ = streams.onStateChange.pipe((0, operators_1.map)((p) => p.data));
        this.events2.get(enums_dto_1.WAHAEvents.STATE_CHANGE).switch(stateChanged$);
    }
    listenEngineEventsInDebugMode() {
        this.events2.get(enums_dto_1.WAHAEvents.ENGINE_EVENT).subscribe((data) => {
            this.logger.debug({ events: data }, `WPP event`);
        });
    }
    toChatSortBy(sortBy) {
        switch (sortBy) {
            case chats_dto_1.ChatSortField.CONVERSATION_TIMESTAMP:
                return 't';
            case chats_dto_1.ChatSortField.ID:
                return 'id';
            default:
                return sortBy;
        }
    }
    toGroupSortBy(sortBy) {
        switch (sortBy) {
            case groups_dto_1.GroupSortField.ID:
                return 'id';
            case groups_dto_1.GroupSortField.SUBJECT:
                return 'groupMetadata.subject';
            default:
                return sortBy;
        }
    }
    toChatId(chat) {
        const id = chat === null || chat === void 0 ? void 0 : chat.id;
        if (typeof id === 'string') {
            return (0, session_abc_1.ensureSuffix)(id);
        }
        return (0, ids_1.Deserialized)(id);
    }
    async listAllKnownLids() {
        const contacts = await this.wpp.getAllContacts().catch(() => []);
        const ids = contacts
            .map((contact) => (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(contact === null || contact === void 0 ? void 0 : contact.id)))
            .filter(Boolean);
        const lookups = ids.map(async (id) => this.wpp.getPnLidEntry(id).catch(() => null));
        const entries = await Promise.all(lookups);
        const byLid = new Map();
        for (const entry of entries) {
            const row = this.toLidMapping(entry, null, null);
            if (!(row === null || row === void 0 ? void 0 : row.lid)) {
                continue;
            }
            const existing = byLid.get(row.lid);
            if (!existing) {
                byLid.set(row.lid, row);
                continue;
            }
            if (!existing.pn && row.pn) {
                byLid.set(row.lid, row);
            }
        }
        return Array.from(byLid.values());
    }
    toLidMapping(entry, fallbackLid, fallbackPhoneNumber) {
        const lid = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(entry === null || entry === void 0 ? void 0 : entry.lid) || (entry === null || entry === void 0 ? void 0 : entry.lid) || fallbackLid || null);
        const phoneNumber = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(entry === null || entry === void 0 ? void 0 : entry.phoneNumber) ||
            (entry === null || entry === void 0 ? void 0 : entry.phoneNumber) ||
            fallbackPhoneNumber ||
            null);
        return {
            lid: lid,
            pn: phoneNumber,
        };
    }
    toWAContact(contact) {
        if (!contact) {
            return null;
        }
        const id = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(contact.id));
        return Object.assign(Object.assign({}, contact), { id: id });
    }
    async fileToBuffer(file) {
        if ('url' in file) {
            return this.fetch(file.url);
        }
        return Buffer.from(file.data, 'base64');
    }
    toGroupParticipants(participants) {
        const result = [];
        for (const participant of participants) {
            result.push(this.toGroupParticipant(participant));
        }
        return result;
    }
    toGroupParticipant(participant) {
        const id = (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(participant === null || participant === void 0 ? void 0 : participant.id) || (participant === null || participant === void 0 ? void 0 : participant.id));
        let role = groups_dto_1.GroupParticipantRole.PARTICIPANT;
        if (participant === null || participant === void 0 ? void 0 : participant.isSuperAdmin) {
            role = groups_dto_1.GroupParticipantRole.SUPERADMIN;
        }
        else if (participant === null || participant === void 0 ? void 0 : participant.isAdmin) {
            role = groups_dto_1.GroupParticipantRole.ADMIN;
        }
        return {
            id: id,
            pn: null,
            role: role,
        };
    }
    toLabel(label, fallback) {
        var _a, _b, _c;
        const color = (_c = (_b = (_a = label === null || label === void 0 ? void 0 : label.colorIndex) !== null && _a !== void 0 ? _a : label === null || label === void 0 ? void 0 : label.color) !== null && _b !== void 0 ? _b : fallback === null || fallback === void 0 ? void 0 : fallback.color) !== null && _c !== void 0 ? _c : 0;
        return {
            id: String((label === null || label === void 0 ? void 0 : label.id) || ''),
            name: (label === null || label === void 0 ? void 0 : label.name) || (fallback === null || fallback === void 0 ? void 0 : fallback.name) || '',
            color: color,
            colorHex: (label === null || label === void 0 ? void 0 : label.hexColor) || labels_dto_1.Label.toHex(color),
        };
    }
    unwrapGroupInviteCode(inviteLink) {
        if (!inviteLink) {
            return inviteLink;
        }
        if (inviteLink.includes('/')) {
            return (0, session_abc_1.parseGroupInviteLink)(inviteLink);
        }
        return inviteLink;
    }
    getMessageIdPart(messageId) {
        if (!messageId) {
            return null;
        }
        const parts = messageId.split('_');
        if (parts.length >= 3) {
            return parts[2];
        }
        return messageId;
    }
    getReplyToMessageId(request) {
        return request.reply_to || request.replyTo || undefined;
    }
    extractQuotedMessageId(message, quotedMessage) {
        var _a, _b, _c;
        const quotedMessageId = (0, ids_1.Deserialized)(quotedMessage === null || quotedMessage === void 0 ? void 0 : quotedMessage.id) ||
            this.serializeQuotedMessageId(message === null || message === void 0 ? void 0 : message.quotedMsgId) ||
            this.serializeQuotedMessageId((_a = message === null || message === void 0 ? void 0 : message._data) === null || _a === void 0 ? void 0 : _a.quotedMsgId) ||
            (message === null || message === void 0 ? void 0 : message.quotedStanzaID) ||
            ((_b = message === null || message === void 0 ? void 0 : message._data) === null || _b === void 0 ? void 0 : _b.quotedStanzaID) ||
            (message === null || message === void 0 ? void 0 : message.quotedStanzaId) ||
            ((_c = message === null || message === void 0 ? void 0 : message._data) === null || _c === void 0 ? void 0 : _c.quotedStanzaId) ||
            null;
        return quotedMessageId;
    }
    serializeQuotedMessageId(value) {
        if (!value) {
            return null;
        }
        const serialized = (0, ids_1.Deserialized)(value);
        if (serialized) {
            return serialized;
        }
        try {
            return (0, ids_1.SerializeMsgKey)(value);
        }
        catch (error) {
            void error;
            return null;
        }
    }
    async toWAMessage(message) {
        var _a;
        const serializedId = (0, ids_1.Deserialized)(message === null || message === void 0 ? void 0 : message.id);
        const messageIdPart = this.getMessageIdPart(serializedId);
        const timestamp = (message === null || message === void 0 ? void 0 : message.timestamp) || (message === null || message === void 0 ? void 0 : message.t) || null;
        const ack = (_a = message === null || message === void 0 ? void 0 : message.ack) !== null && _a !== void 0 ? _a : enums_dto_1.WAMessageAck.PENDING;
        const hasMedia = getHasMedia(message);
        const replyTo = this.extractReplyTo(message);
        let source = await this.hooks.message.source.promise(messageIdPart);
        source = source !== null && source !== void 0 ? source : responses_dto_1.MessageSource.APP;
        return {
            id: serializedId,
            timestamp: timestamp,
            from: (message === null || message === void 0 ? void 0 : message.from) || null,
            fromMe: Boolean(message === null || message === void 0 ? void 0 : message.fromMe),
            source: source,
            to: (message === null || message === void 0 ? void 0 : message.to) || null,
            participant: (message === null || message === void 0 ? void 0 : message.author) || null,
            body: getMessageBody(message),
            hasMedia: hasMedia,
            media: null,
            mediaUrl: (message === null || message === void 0 ? void 0 : message.clientUrl) || null,
            ack: ack,
            ackName: enums_dto_1.WAMessageAck[ack] || enums_dto_1.ACK_UNKNOWN,
            location: null,
            vCards: null,
            replyTo: replyTo,
            _data: message,
        };
    }
    normalizeWppMessageEditData(data) {
        var _a, _b;
        let chat;
        let id;
        let msg;
        if (Array.isArray(data)) {
            chat = data[0];
            id = data[1];
            msg = data[2];
        }
        else {
            chat = data === null || data === void 0 ? void 0 : data.chat;
            id = data === null || data === void 0 ? void 0 : data.id;
            msg = (_b = (_a = data === null || data === void 0 ? void 0 : data.msg) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.message) !== null && _b !== void 0 ? _b : data;
        }
        const rawChatId = (0, ids_1.Deserialized)(msg === null || msg === void 0 ? void 0 : msg.chatId) ||
            (0, ids_1.Deserialized)(msg === null || msg === void 0 ? void 0 : msg.from) ||
            (0, ids_1.Deserialized)(chat) ||
            (msg === null || msg === void 0 ? void 0 : msg.chatId) ||
            (msg === null || msg === void 0 ? void 0 : msg.from) ||
            chat ||
            null;
        if (!rawChatId) {
            return null;
        }
        const editedMessageId = (0, ids_1.Deserialized)(id) || (0, ids_1.Deserialized)(msg === null || msg === void 0 ? void 0 : msg.id) || id || (msg === null || msg === void 0 ? void 0 : msg.id) || null;
        const editKey = (0, ids_1.Deserialized)(msg === null || msg === void 0 ? void 0 : msg.latestEditMsgKey) || null;
        return {
            chatId: (0, jids_1.toCusFormat)(rawChatId),
            editedMessageId: editedMessageId,
            editKey: editKey,
            message: msg,
            raw: data,
        };
    }
    normalizeWppIncomingCallData(data) {
        var _a, _b, _c;
        let call = data;
        if (Array.isArray(data)) {
            call = data[0];
        }
        if (Array.isArray(call)) {
            call = call[0];
        }
        if (!call || typeof call !== 'object') {
            return null;
        }
        const id = (0, ids_1.Deserialized)(call.id) || call.id || null;
        const fromRaw = (0, ids_1.Deserialized)(call.peerJid) ||
            (0, ids_1.Deserialized)(call.from) ||
            call.peerJid ||
            call.from ||
            null;
        const from = fromRaw ? (0, jids_1.toCusFormat)(fromRaw) : null;
        const timestampRaw = (_c = (_b = (_a = call.offerTime) !== null && _a !== void 0 ? _a : call.timestamp) !== null && _b !== void 0 ? _b : call.t) !== null && _c !== void 0 ? _c : null;
        const timestamp = typeof timestampRaw === 'number'
            ? timestampRaw
            : Number(timestampRaw) || Math.floor(Date.now() / 1000);
        const isVideo = Boolean(call.isVideo);
        const isGroup = Boolean(call.isGroup);
        return {
            id: id,
            from: from,
            timestamp: timestamp,
            isVideo: isVideo,
            isGroup: isGroup,
            _data: data,
        };
    }
    extractReplyTo(message) {
        var _a, _b;
        const quotedMessage = (message === null || message === void 0 ? void 0 : message.quotedMsg) || ((_a = message === null || message === void 0 ? void 0 : message._data) === null || _a === void 0 ? void 0 : _a.quotedMsg);
        const quotedMessageId = this.extractQuotedMessageId(message, quotedMessage);
        if (!quotedMessageId) {
            return null;
        }
        const quotedParticipant = (message === null || message === void 0 ? void 0 : message.quotedParticipant) ||
            ((_b = message === null || message === void 0 ? void 0 : message._data) === null || _b === void 0 ? void 0 : _b.quotedParticipant) ||
            (quotedMessage === null || quotedMessage === void 0 ? void 0 : quotedMessage.author) ||
            (quotedMessage === null || quotedMessage === void 0 ? void 0 : quotedMessage.from) ||
            null;
        const hasMedia = getHasMedia(quotedMessage);
        return {
            id: quotedMessageId,
            participant: (0, jids_1.toCusFormat)((0, ids_1.Deserialized)(quotedParticipant) || quotedParticipant),
            body: getMessageBody(quotedMessage),
            hasMedia: hasMedia,
            media: null,
            _data: quotedMessage,
        };
    }
    async processIncomingMessage(message, options) {
        var _a, _b;
        const wamessage = await this.toWAMessage(message);
        const media = await this.downloadMediaSafe(message, options);
        wamessage.media = media;
        if ((_a = wamessage.replyTo) === null || _a === void 0 ? void 0 : _a.hasMedia) {
            const quotedMessage = (message === null || message === void 0 ? void 0 : message.quotedMsg) || ((_b = message === null || message === void 0 ? void 0 : message._data) === null || _b === void 0 ? void 0 : _b.quotedMsg);
            if (quotedMessage) {
                wamessage.replyTo.media = await this.downloadMediaSafe(quotedMessage, options);
            }
        }
        return wamessage;
    }
    checkStatusRequest(request) {
        var _a;
        if (request.contacts && ((_a = request.contacts) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            const msg = "WPP doesn't accept 'contacts'. Remove the field to send status to all contacts.";
            throw new common_1.UnprocessableEntityException(msg);
        }
    }
    async downloadMediaSafe(message, options) {
        try {
            let processor = new WPPEngineMediaProcessor(this.wpp);
            processor = new LottieMediaProcessorWrapper_1.LottieMediaProcessorWrapper(processor, this.logger);
            return await this.mediaManager.processMedia(processor, message, options);
        }
        catch (error) {
            this.logger.error('Failed when tried to download media for a message');
            this.logger.error(error, error.stack);
        }
        return null;
    }
    filterMessages(messages, filter) {
        if (!filter) {
            return messages;
        }
        return messages.filter((message) => {
            if (filter['filter.timestamp.lte'] != null &&
                message.timestamp > filter['filter.timestamp.lte']) {
                return false;
            }
            if (filter['filter.timestamp.gte'] != null &&
                message.timestamp < filter['filter.timestamp.gte']) {
                return false;
            }
            if (filter['filter.fromMe'] != null &&
                message.fromMe !== filter['filter.fromMe']) {
                return false;
            }
            if (filter['filter.ack'] != null &&
                message.ack !== filter['filter.ack']) {
                return false;
            }
            return true;
        });
    }
    async getLastMessage(chatId) {
        if (!chatId) {
            return null;
        }
        const messages = await this.wpp.getMessages(chatId, {
            count: 1,
            direction: 'before',
        }).catch(() => []);
        const last = lodash.last(messages);
        if (!last) {
            return null;
        }
        return await this.toWAMessage(last);
    }
    async processIncomingWPPMessage(msg) {
        if (msg === null || msg === void 0 ? void 0 : msg.fromMe) {
            await (0, promiseTimeout_1.sleep)(3000);
        }
        return this.processIncomingMessage(msg, this.media.events);
    }
    async refreshMeInfo() {
        var _a, _b, _c;
        const host = await ((_a = this.wpp) === null || _a === void 0 ? void 0 : _a.getHostDevice().catch(() => null));
        let id = (0, ids_1.Deserialized)(host === null || host === void 0 ? void 0 : host.wid);
        if (!id) {
            id = (_c = (await ((_b = this.wpp) === null || _b === void 0 ? void 0 : _b.getWid().catch(() => null)))) !== null && _c !== void 0 ? _c : null;
        }
        if (!id) {
            this.meInfo = null;
            return;
        }
        const lid = await this.wpp.getPnLidEntry(id).catch((error) => {
            this.logger.warn({ error }, `Failed get my lid by id ${id}`);
            return null;
        });
        this.meInfo = {
            id: (0, ids_1.Deserialized)(id),
            lid: (0, ids_1.Deserialized)(lid === null || lid === void 0 ? void 0 : lid.lid),
            pushName: (host === null || host === void 0 ? void 0 : host.pushname) || null,
        };
    }
    applyStatusFind(status) {
        var _a;
        switch (status) {
            case wppconnect_1.StatusFind.notLogged:
                this.status = enums_dto_1.WAHASessionStatus.SCAN_QR_CODE;
                break;
            case wppconnect_1.StatusFind.isLogged:
            case wppconnect_1.StatusFind.inChat:
            case wppconnect_1.StatusFind.qrReadSuccess:
                this.status = enums_dto_1.WAHASessionStatus.WORKING;
                this.refreshMeInfo().catch((error) => {
                    this.logger.warn({ error }, 'Failed to refresh WPP host info');
                });
                void ((_a = this.authManager) === null || _a === void 0 ? void 0 : _a.afterConnected());
                break;
            case wppconnect_1.StatusFind.browserClose:
            case wppconnect_1.StatusFind.serverClose:
                this.failed();
                break;
            case wppconnect_1.StatusFind.qrReadError:
            case wppconnect_1.StatusFind.qrReadFail:
            case wppconnect_1.StatusFind.disconnectedMobile:
            case wppconnect_1.StatusFind.phoneNotConnected:
            case wppconnect_1.StatusFind.autocloseCalled:
                this.status = enums_dto_1.WAHASessionStatus.FAILED;
                break;
            default:
                break;
        }
    }
    applySocketState(state) {
        var _a;
        switch (state) {
            case wppconnect_1.SocketState.CONNECTED:
                this.status = enums_dto_1.WAHASessionStatus.WORKING;
                this.refreshMeInfo().catch((error) => {
                    this.logger.warn({ error }, 'Failed to refresh WPP host info');
                });
                void ((_a = this.authManager) === null || _a === void 0 ? void 0 : _a.afterConnected());
                break;
            case wppconnect_1.SocketState.UNPAIRED:
            case wppconnect_1.SocketState.UNPAIRED_IDLE:
                this.status = enums_dto_1.WAHASessionStatus.SCAN_QR_CODE;
                break;
            case wppconnect_1.SocketState.OPENING:
            case wppconnect_1.SocketState.PAIRING:
                this.status = enums_dto_1.WAHASessionStatus.STARTING;
                break;
            case wppconnect_1.SocketState.CONFLICT:
            case wppconnect_1.SocketState.DEPRECATED_VERSION:
            case wppconnect_1.SocketState.PROXYBLOCK:
            case wppconnect_1.SocketState.SMB_TOS_BLOCK:
            case wppconnect_1.SocketState.TIMEOUT:
            case wppconnect_1.SocketState.TOS_BLOCK:
            case wppconnect_1.SocketState.UNLAUNCHED:
                this.status = enums_dto_1.WAHASessionStatus.FAILED;
                break;
            default:
                break;
        }
    }
    wppChatToChannel(chat) {
        var _a, _b, _c, _d, _e;
        const m = (chat === null || chat === void 0 ? void 0 : chat.newsletterMetadata) || {};
        const inviteCode = (m === null || m === void 0 ? void 0 : m.invite) || '';
        const picPath = ((_a = m === null || m === void 0 ? void 0 : m.picture) === null || _a === void 0 ? void 0 : _a.directPath) || null;
        const picture = picPath ? (0, session_abc_1.getPublicUrlFromDirectPath)(picPath) : null;
        const previewPath = ((_b = m === null || m === void 0 ? void 0 : m.preview) === null || _b === void 0 ? void 0 : _b.directPath) || null;
        const preview = previewPath
            ? (0, session_abc_1.getPublicUrlFromDirectPath)(previewPath)
            : picture;
        const role = (((_c = m === null || m === void 0 ? void 0 : m.viewerMetadata) === null || _c === void 0 ? void 0 : _c.role) ||
            ((_d = m === null || m === void 0 ? void 0 : m.viewerMetadata) === null || _d === void 0 ? void 0 : _d.viewRole) ||
            channels_dto_1.ChannelRole.SUBSCRIBER);
        return {
            id: (chat === null || chat === void 0 ? void 0 : chat.id) || '',
            name: (chat === null || chat === void 0 ? void 0 : chat.name) || '',
            description: ((_e = m === null || m === void 0 ? void 0 : m.description) === null || _e === void 0 ? void 0 : _e.text) || null,
            invite: (0, session_abc_1.getChannelInviteLink)(inviteCode),
            preview: preview,
            picture: picture,
            verified: (m === null || m === void 0 ? void 0 : m.verification) === 'VERIFIED',
            role: role,
            subscribersCount: Number(m === null || m === void 0 ? void 0 : m.subscribersCount) || 0,
        };
    }
    wppCreateResultToChannel(result) {
        return {
            id: (result === null || result === void 0 ? void 0 : result.idJid) || '',
            name: (result === null || result === void 0 ? void 0 : result.name) || '',
            description: (result === null || result === void 0 ? void 0 : result.description) || null,
            invite: (result === null || result === void 0 ? void 0 : result.inviteLink) || (0, session_abc_1.getChannelInviteLink)((result === null || result === void 0 ? void 0 : result.inviteCode) || ''),
            preview: null,
            picture: null,
            verified: false,
            role: channels_dto_1.ChannelRole.OWNER,
            subscribersCount: (result === null || result === void 0 ? void 0 : result.subscribersCount) || 0,
        };
    }
    listChatToChannel(chat) {
        var _a, _b;
        const pic = (_a = chat === null || chat === void 0 ? void 0 : chat.contact) === null || _a === void 0 ? void 0 : _a.profilePicThumbObj;
        const picture = (pic === null || pic === void 0 ? void 0 : pic.imgFull) || (pic === null || pic === void 0 ? void 0 : pic.img) || (pic === null || pic === void 0 ? void 0 : pic.eurl) || null;
        const role = (chat === null || chat === void 0 ? void 0 : chat.isReadOnly) ? channels_dto_1.ChannelRole.SUBSCRIBER : channels_dto_1.ChannelRole.OWNER;
        return {
            id: ((_b = chat === null || chat === void 0 ? void 0 : chat.id) === null || _b === void 0 ? void 0 : _b._serialized) || '',
            name: (chat === null || chat === void 0 ? void 0 : chat.name) || '',
            description: null,
            invite: '',
            preview: picture,
            picture: picture,
            verified: false,
            role: role,
            subscribersCount: 0,
        };
    }
    async channelsList(query) {
        const chats = await this.wpp.listChats({ onlyNewsletter: true });
        let channels = (chats || []).map((chat) => this.listChatToChannel(chat));
        if (query.role) {
            channels = channels.filter((c) => c.role === query.role);
        }
        return channels;
    }
    async channelsCreateChannel(request) {
        let result = await this.wpp.createNewsletter(request.name, {
            description: request.description,
        });
        if (request.picture) {
            const buffer = await this.fileToBuffer(request.picture);
            const picture = WPPMedia(buffer, request.picture.mimetype || 'image/jpeg');
            result = await this.wpp.editNewsletter(result.idJid, {
                picture: picture,
            });
        }
        return this.wppCreateResultToChannel(result);
    }
    async channelsGetChannel(id) {
        const chats = await this.wpp.listChats({ onlyNewsletter: true });
        const chat = (chats || []).find((c) => { var _a; return ((_a = c === null || c === void 0 ? void 0 : c.id) === null || _a === void 0 ? void 0 : _a._serialized) === id; });
        if (!chat) {
            throw new common_1.NotFoundException(`Channel ${id} not found`);
        }
        return this.listChatToChannel(chat);
    }
    channelsGetChannelByInviteCode(inviteCode) {
        void inviteCode;
        throw new exceptions_1.NotImplementedByEngineError();
    }
    async channelsDeleteChannel(id) {
        await this.wpp.destroyNewsletter(id);
    }
    async channelsFollowChannel(id) {
        await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (channelId) => WPP.newsletter.follow(channelId), id);
    }
    async channelsUnfollowChannel(id) {
        await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (channelId) => WPP.newsletter.unfollow(channelId), id);
    }
    async channelsMuteChannel(id) {
        await this.wpp.muteNesletter(id);
    }
    async channelsUnmuteChannel(id) {
        await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (channelId) => WPP.newsletter.mute(channelId, false), id);
    }
    async previewChannelMessages(inviteCode, query) {
        const messages = await this.getChatMessages(inviteCode, query, {});
        return messages.map((message) => {
            return {
                message: message,
                reactions: {},
                viewCount: 0,
            };
        });
    }
    searchChannelsByView(query) {
        void query;
        throw new exceptions_1.NotImplementedByEngineError();
    }
    async searchChannelsByText(query) {
        const result = await (0, helpers_2.evaluateAndReturn)(this.wpp.page, async (text, categories, limit, startCursor) => WPP.newsletter.search(text, {
            categories: categories,
            limit: limit,
            cursorToken: startCursor || undefined,
        }), query.text, query.categories || [], query.limit || 50, query.startCursor || '');
        const channels = ((result === null || result === void 0 ? void 0 : result.newsletters) || []).map((n) => ({
            id: n.idJid || '',
            name: n.name || '',
            description: n.description || null,
            invite: (0, session_abc_1.getChannelInviteLink)(n.inviteCode || ''),
            preview: null,
            picture: n.picture || null,
            verified: n.verification === 'VERIFIED',
            subscribersCount: n.subscribersCount || 0,
        }));
        const pageInfo = result === null || result === void 0 ? void 0 : result.pageInfo;
        return {
            channels: channels,
            page: {
                startCursor: query.startCursor || null,
                endCursor: (pageInfo === null || pageInfo === void 0 ? void 0 : pageInfo.endCursor) || null,
                hasNextPage: (pageInfo === null || pageInfo === void 0 ? void 0 : pageInfo.hasNextPage) || false,
                hasPreviousPage: Boolean(query.startCursor),
            },
        };
    }
}
exports.WhatsappSessionWPPCore = WhatsappSessionWPPCore;
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.CheckNumberStatusQuery]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "checkNumberStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setProfileName", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setProfileStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setProfilePicture", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteProfilePicture", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "rejectCall", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageLocationRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendLocation", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageForwardRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "forwardMessage", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessagePollRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendPoll", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageContactVcardRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendContactVCard", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageImageRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendImage", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageFileRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendFile", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageVoiceRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendVoice", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageVideoRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendVideo", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageStickerRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendSticker", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [status_dto_1.ImageStatus]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendImageStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [status_dto_1.VoiceStatus]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendVoiceStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [status_dto_1.VideoStatus]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendVideoStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageReplyRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "reply", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.ChatRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "startTyping", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.ChatRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "stopTyping", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageReactionRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setReaction", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageStarRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setStar", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.MessageTextRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendText", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatting_dto_1.SendSeenRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendSeen", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "getPresence", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "subscribePresence", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [status_dto_1.TextStatus]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "sendTextStatus", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteMessage", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, chatting_dto_1.EditMessageRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "editMessage", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteChat", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "clearMessages", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "chatsArchiveChat", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "chatsUnarchiveChat", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "chatsUnreadChat", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, chats_dto_1.ReadChatMessagesQuery]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "readChatMessages", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "fetchContactProfilePicture", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [contacts_dto_1.ContactRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "blockContact", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [contacts_dto_1.ContactRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "unblockContact", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [groups_dto_1.CreateGroupRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "createGroup", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "joinGroup", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "joinInfoGroup", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "refreshGroups", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setInfoAdminsOnly", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setMessagesAdminsOnly", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setMemberAddMode", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setMembershipApprovalMode", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "getGroupJoinRequests", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "approveGroupJoinRequests", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "rejectGroupJoinRequests", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteGroup", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "leaveGroup", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setDescription", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setGroupPicture", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteGroupPicture", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "setSubject", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "getInviteCode", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "revokeInviteCode", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "addParticipants", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "removeParticipants", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "promoteParticipantsToAdmin", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, groups_dto_1.ParticipantsRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "demoteParticipantsToUser", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [labels_dto_1.LabelDTO]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "createLabel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [labels_dto_1.Label]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "updateLabel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [labels_dto_1.Label]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "deleteLabel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "putLabelsToChat", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channels_dto_1.CreateChannelRequest]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsCreateChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsGetChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsDeleteChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsFollowChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsUnfollowChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsMuteChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "channelsUnmuteChannel", null);
__decorate([
    (0, session_hooks_activity_1.Activity)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channels_dto_1.ChannelSearchByText]),
    __metadata("design:returntype", Promise)
], WhatsappSessionWPPCore.prototype, "searchChannelsByText", null);
function WppToGroupJoinRequestResult(result) {
    return {
        requesterId: (0, serialized_1.GetSerialized)(result.wid),
        success: !result.error,
        error: Number(result.error) || undefined,
    };
}
function extractWppMessageId(response) {
    if (!response || typeof response !== 'object') {
        return null;
    }
    const payload = response;
    if (typeof payload.id !== 'string') {
        return null;
    }
    return payload.id;
}
function extractBase64(value) {
    if (!value) {
        return null;
    }
    if (!value.startsWith('data:')) {
        return value;
    }
    const commaIndex = value.indexOf(',');
    if (commaIndex < 0) {
        return null;
    }
    return value.slice(commaIndex + 1);
}
function getHasMedia(message) {
    if ((message === null || message === void 0 ? void 0 : message.type) === 'revoked') {
        return false;
    }
    return Boolean((message === null || message === void 0 ? void 0 : message.isMedia) || (message === null || message === void 0 ? void 0 : message.isMMS) || (message === null || message === void 0 ? void 0 : message.mimetype));
}
function getMessageBody(message) {
    if (getHasMedia(message)) {
        return message.caption;
    }
    return message.body;
}
class WPPEngineMediaProcessor {
    constructor(wpp) {
        this.wpp = wpp;
    }
    hasMedia(message) {
        return getHasMedia(message);
    }
    getFilename(message) {
        return (message === null || message === void 0 ? void 0 : message.filename) || null;
    }
    getMimetype(message) {
        return (message === null || message === void 0 ? void 0 : message.mimetype) || 'application/octet-stream';
    }
    getMessageId(message) {
        return (0, ids_1.Deserialized)(message.id);
    }
    getChatId(message) {
        var _a, _b, _c;
        const chatId = (0, ids_1.Deserialized)(message.chatId);
        return (_c = (_a = (0, jids_1.toCusFormat)(chatId)) !== null && _a !== void 0 ? _a : (0, jids_1.toCusFormat)((_b = message === null || message === void 0 ? void 0 : message.from) !== null && _b !== void 0 ? _b : '')) !== null && _c !== void 0 ? _c : null;
    }
    async getMediaContent(message) {
        const buffer = await this.getMediaBuffer(message);
        if (!buffer) {
            return null;
        }
        return { buffer: buffer };
    }
    async getMediaBuffer(message) {
        const base64OrDataUri = await this.wpp.downloadMedia(message);
        if (!base64OrDataUri || typeof base64OrDataUri !== 'string') {
            return null;
        }
        const base64 = extractBase64(base64OrDataUri);
        if (!base64) {
            return null;
        }
        return Buffer.from(base64, 'base64');
    }
}
exports.WPPEngineMediaProcessor = WPPEngineMediaProcessor;
function WPPMedia(content, mimetype) {
    mimetype = MimetypeForDataUrl(mimetype);
    const data = content.toString('base64');
    return `data:${mimetype};base64,${data}`;
}
function MimetypeForDataUrl(mimetype) {
    return mimetype
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(';')
        .replace(/\s*=\s*/g, '=');
}
//# sourceMappingURL=session.wpp.core.js.map