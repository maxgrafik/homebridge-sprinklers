/**
 * platform.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const PLATFORM_NAME = "Sprinklers";
const PLUGIN_NAME = "homebridge-sprinklers";

const { IrrigationSystem } = require("./accessories/irrigation");
const { Sensor } = require("./accessories/sensor");

const { Zone } = require("./controller/zone");

const { OpenMeteo } = require("./utils/open-meteo");
const { Server } = require("./utils/server");

class Sprinklers {

    constructor(log, config, api) {

        this.log = log;
        this.config = config;
        this.api = api;

        this.IrrigationSystem = null;

        this.accessories = [];

        if (!this.api || !this.config) {
            return;
        }

        if (!this.config.longitude || !this.config.latitude) {
            this.log.warn("Longitude/Latitude required for weather forecasts.");
            return;
        }

        this.api.on("didFinishLaunching", () => {
            this.runSetup();
        });
    }

    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }

    async runSetup() {

        this.log.debug("Starting setup");

        // Open-Meteo
        this.OpenMeteo = new OpenMeteo(this.log, this.config, this.api);

        // Zones
        const zones = [];
        for (const [index, config] of this.config.zones.entries()) {
            const zone = new Zone((index + 1), config, this);
            await zone.loadSettings();
            zones.push(zone);
        }

        // configure/restore accessories
        await this.setupIrrigationSystem(zones);
        await this.setupSensors(zones);

        // remove remaining unused accessories
        if (this.accessories.length > 0) {
            this.log.debug("Removing unused accessories from cache...");
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
        }

        // clean up
        this.accessories = [];

        // schedule zones
        for (const zone of zones) {
            await zone.updateSchedule();
        }

        // start web server
        if (this.config.server) {
            this.Server = new Server(this, zones);
        }

        // ready and running
        this.log.info("Ready");
    }

    async setupIrrigationSystem(zones) {

        const cachedAccessory = this.accessories.find(item => item.context.type === "IrrigationSystem");

        if (cachedAccessory) {

            this.log.debug("Loading IrrigationSystem from cache");

            this.IrrigationSystem = new IrrigationSystem(this, cachedAccessory, zones);
            this.api.updatePlatformAccessories([cachedAccessory]);
            this.accessories.splice(this.accessories.indexOf(cachedAccessory), 1);

        } else {

            this.log.debug("Configuring IrrigationSystem");

            const name = "IrrigationSystem";
            const uuid = this.api.hap.uuid.generate(name);
            const newAccessory = new this.api.platformAccessory(name, uuid);

            newAccessory.context.type = "IrrigationSystem";

            this.IrrigationSystem = new IrrigationSystem(this, newAccessory, zones);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
        }
    }

    async setupSensors(zones) {

        for (const zone of zones) {

            if (!zone.sensor) { continue; }

            const cachedSensor = this.accessories.find(item => item.context.type === "Sensor" && item.context.id === zone.id);

            if (cachedSensor) {

                this.log.debug("Loading sensor from cache: %s", cachedSensor.displayName);

                this.IrrigationSystem.Sensors.push(new Sensor(this, cachedSensor, zone));
                this.api.updatePlatformAccessories([cachedSensor]);
                this.accessories.splice(this.accessories.indexOf(cachedSensor), 1);

            } else {

                this.log.debug("Configuring sensor: %s", zone.name);

                const name = zone.name + zone.id;
                const uuid = this.api.hap.uuid.generate(name);
                const newSensor = new this.api.platformAccessory(zone.name, uuid);

                newSensor.context.type = "Sensor";
                newSensor.context.id = zone.id;

                this.IrrigationSystem.Sensors.push(new Sensor(this, newSensor, zone));
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newSensor]);
            }
        }
    }
}

exports.Sprinklers = Sprinklers;
