'use strict';

const { spawn }    = require('child_process');
const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');
const WebSocket    = require('ws');

require('./polyfill.js');

const MachinaModels = require('./models/_MachinaModels.js');

// Public class
const MachinaFFXIV = (() => {
    const monitor = Symbol();
    const server = Symbol();
    const filter = Symbol();
    const port = Symbol();

    const ip = Symbol();
    const noData = Symbol();
    const noExe = Symbol();
    const logger = Symbol();
    const region = Symbol();

    const hasWine = Symbol();
    const winePrefix = Symbol();

    const args = Symbol();
    const exePath = Symbol();
    const ws = Symbol();

    class MachinaFFXIV extends EventEmitter {
        constructor(options) {
            super();

            this[logger] = () => {};

            // Basic type checks.
            if (options) {
                if (options.ip && typeof options.ip !== 'string') {
                    throw new TypeError("IP must be a string.");
                } else if (options.ip) {
                    this[ip] = options.ip.replace(/[^0-9.]/g, "");
                }

                if (options.dataPath && typeof options.dataPath !== 'string') {
                    throw new TypeError("dataPath must be a string.");
                } else if (options.dataPath) {
                    this[dataPath] = options.dataPath;
                }

                if (options.noData && typeof options.noData !== 'boolean') {
                    throw new TypeError("noData must be a Boolean.");
                } else if (options.noData) {
                    this[noData] = options.noData;
                }

                if (options.noExe && typeof options.noExe !== 'boolean') {
                    throw new TypeError("noExe must be a Boolean.");
                } else if (options.noExe) {
                    this[noExe] = options.noExe;
                }

                if (options.logger && typeof options.logger !== 'function') {
                    throw new TypeError("logger must be a Function.");
                } else if (options.logger) {
                    this[logger] = options.logger;
                }

                if (options.region && typeof options.region !== 'string') {
                    throw new TypeError("region must be a string.");
                } else if (options.region) {
                    this[region] = options.region;
                }

                if (options.port && typeof options.port !== 'number') {
                    throw new TypeError("port must be a number.");
                } else if (options.port) {
                    this[port] = options.port;
                }

                if (options.hasWine && typeof options.hasWine !== 'boolean') {
                    throw new TypeError("hasWine must be a boolean.");
                } else if (options.hasWine) {
                    this[hasWine] = options.hasWine;
                }

                if (options.winePrefix && typeof options.winePrefix !== 'string') {
                    throw new TypeError("winePrefix must be a string.");
                } else if (options.winePrefix) {
                    this[winePrefix] = options.winePrefix;
                }
            }

            if (!this[port]) {
                this[port] = 13346;
            }
            if (!this[winePrefix]) {
                this[winePrefix] = "$HOME/.Wine";
            }

            // Folders
            const remoteDatapath = (options && options.remoteDataPath) || path.join(__dirname, './remote-data');
            if (!fs.existsSync(remoteDatapath)) {
                fs.mkdirSync(remoteDatapath);
            }

            if (!this[noExe]) {
                this[args] = [];
                if (this[ip]) this[args].push(...["-LocalIP", this[ip]]);
                if (this[region]) this[args].push(...["-Region", this[region]]);
                if (this[port]) this[args].push(...["-Port", this[port]]);
                if (this[dataPath]) this[args].push(...["-DataPath", this[dataPath]]);
                if (this[noData]) this[args].push(...["-Dev", this[noData]]);
                this[exePath] = (options && options.machinaExePath) || path.join(__dirname, '/ZanarkandWrapper/ZanarkandWrapperJSON.exe');
                if (!fs.existsSync(this[exePath])) {
                    throw new Error(`ZanarkandWrapperJSON not found in ${this[exePath]}`);
                }

                this.log({
                    level: "info",
                    message: `Starting ZanarkandWrapper from executable ${this[exePath]}.`,
                });
                this.launchChild();
            }

            MachinaModels.loadDefinitions(options && options.definitionsDir);

            this[filter] = [];

            this.connect();
        }

        launchChild() {
            if (this[hasWine]) {
                this[monitor] = spawn(`WINEPREFIX="${this[winePrefix]}" wine ${this[exePath]}`, this[args]);
            } else {
                this[monitor] = spawn(this[exePath], this[args]);
            }
            this[logger]({
                level: "info",
                message: `ZanarkandWrapper spawned with arguments "${this[args].toString()}"`,
            });

            this[monitor].once('close', (code, signal) => {
                this[server].close();
                this[logger]({
                    level: "info",
                    message: `ZanarkandWrapper closed with code: ${code || signal}`,
                });
            });

            this[monitor].stdout
                .on("data", (chunk) => this[log]({
                    level: "info",
                    message: chunk
                }))
                .on("error", (err) => this[log]({
                    level: "error",
                    message: err.message,
                }));
        }

        connect() {
            this[ws] = new WebSocket(
                `ws://${this.options.networkDevice}:${this.options.port}`,
                {
                    perMessageDeflate: false,
                },
            );
    
            this[ws]
                .on("message", (data) => {
                    let content;
                    try {
                        content = JSON.parse(data);
                    } catch (err) {
                        this[logger]({
                            level: "error",
                            message: `Message threw an error: ${err}\n${err.stack}\nMessage content:\n${data.toString()}`,
                        });
                        return;
                    }
                    if (this[filter].length === 0 ||
                            this[filter].includes(content.type) ||
                            this[filter].includes(content.subType) |
                            this[filter].includes(content.superType)) {
                        Object.defineProperties(content, {
                            opcode: {value: content.opcode},
                            region: {value: content.region},
                            connection: {value: content.connection},
                            operation: {value: content.operation},
                            epoch: {value: content.epoch},
                            packetSize: {value: content.packetSize},
                            segmentType: {value: content.segmentType},
                            data: {value: new Uint8Array(content.data)}, // Should be less size in memory than a 64-bit number array
                        });

                        MachinaModels.parseAndEmit(this[logger], content, this[noData], this); // Parse packet data
                        this.emit('raw', content); // Emit a catch-all event
                    }
                })
                .on("open", () =>
                    this.log(
                        `Connected to ZanarkandWrapper on ${this.options.networkDevice}:${this.options.port}!`,
                    ),
                )
                .on("upgrade", () =>
                    this.log("ZanarkandWrapper connection protocol upgraded."),
                )
                .on("close", () => this.log("Connection with ZanarkandWrapper closed."))
                .on("error", (err) => {
                    this.log(
                        `Connection errored with message ${err.message}, reconnecting in 1 second...`,
                    );
                    setTimeout(() => this.connect(), 1000); // This cannot be reduced since we need to maintain "this" context.
                });
        }

        async parse(struct) {
            return await MachinaModels.parse(this[logger], struct, this[noData], this);
        }

        oncePacket(packetName) {
            return new Promise((resolve) => this.once(packetName, resolve));
        }

        filter(userFilter) {
            if (!userFilter) return;
            this[filter] = userFilter.slice(0);
        }

        reset(callback) {
            return new Promise((_, reject) => {
                if (this[exePath] == null || this[args] == null)
                    reject(new Error("No instance to reset."));
                this.kill();
                if (!this[noExe]) {
                    this.launchChild();
                }
    
                this.start(callback);
                this.log({
                    level: "info",
                    message: `ZanarkandWrapper reset!`
                });
            });
        }

        async start(callback) {
            await this.sendMessage("start", callback);
            this.log({
                level: "info",
                message: `ZanarkandWrapper started!`
            });
        }
    
        async stop(callback) {
            await this.sendMessage("stop", callback);
            this.ws.close(0);
            this.log({
                level: "info",
                message: `ZanarkandWrapper stopped!`
            });
        }
    
        async kill(callback) {
            await this.sendMessage("kill", callback);
            this.ws.close(0);
            this.log({
                level: "info",
                message: `ZanarkandWrapper killed!`
            });
        }
    
        async sendMessage(message, callback) {
            try {
                if (this.options.noExe) return; // nop
                if (!this.childProcess) {
                    throw new Error("ZanarkandWrapper is uninitialized.");
                }
                await this.waitForWebSocketReady();
                this.ws.send(message, callback);
            } catch (err) {
                if (callback) callback(err);
                else throw err;
            }
        }
    
        async waitForWebSocketReady() {
            while (this.ws.readyState !== 1)
                await new Promise((resolve) => setTimeout(resolve, 1));
            return;
        }
    };

    return MachinaFFXIV;
})();

module.exports = MachinaFFXIV;