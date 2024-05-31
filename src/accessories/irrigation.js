/**
 * irrigation.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const packageJson = require("../../package.json");
const { Valve } = require("./valve");

class IrrigationSystem {

    constructor(platform, accessory, zones) {

        this.platform = platform;
        this.accessory = accessory;

        this.log = this.platform.log;
        this.config = this.platform.config;
        this.api = this.platform.api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.isActive = true;
        this.inUse = false;
        this.programMode = 1;


        // array of valve services added to this IrrigationSystem accessory

        this.Valves = [];


        // array of associated separate sensor services. NOT(!) part of the IrrigationSystem
        // stored here just for convenience, so start()/stop() can set their state directly

        this.Sensors = [];


        // accessory information

        this.accessory.getService(this.Service.AccessoryInformation)
            .setCharacteristic(this.Characteristic.Manufacturer, packageJson.author)
            .setCharacteristic(this.Characteristic.Model, packageJson.displayName)
            .setCharacteristic(this.Characteristic.SerialNumber, this.accessory.UUID.slice(24, 36))
            .setCharacteristic(this.Characteristic.FirmwareRevision, packageJson.version);


        // irrigation system

        this.irrigationService = this.accessory.getService(this.Service.IrrigationSystem) || this.accessory.addService(this.Service.IrrigationSystem);

        this.irrigationService.setCharacteristic(this.Characteristic.Name, packageJson.displayName);

        this.irrigationService.getCharacteristic(this.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        this.irrigationService.getCharacteristic(this.Characteristic.InUse)
            .onGet(this.getInUse.bind(this));

        this.irrigationService.getCharacteristic(this.Characteristic.ProgramMode)
            .onGet(this.getProgramMode.bind(this));

        this.irrigationService.getCharacteristic(this.Characteristic.RemainingDuration)
            .onGet(this.getRemainingDuration.bind(this));


        // valves

        for (const zone of zones) {
            this.Valves.push(
                new Valve(this, zone)
            );
        }
    }

    async getActive() {
        return this.isActive ? 1 : 0;
    }

    async setActive(value) {

        this.log.debug("IrrigationSystem setActive: %s", value);

        // this gets called whenever you tell Siri to start irrigation
        // i.e. start a manual override for all valves/zones with their
        // respective default duration

        // Note: there is no control in the home app for this operation!

        this.programMode = 2; // scheduled with manual override

        for (const valve of this.Valves) {
            value === 1 ? valve.start() : valve.stop();
        }
    }

    async getInUse() {
        return this.inUse ? 1 : 0;
    }

    async getProgramMode() {
        return this.programMode;
    }

    async getRemainingDuration() {

        let remainingDuration = 0;

        for (const valve of this.Valves) {
            const duration = await valve.getRemainingDuration();
            remainingDuration = Math.max(duration, remainingDuration);
        }

        return remainingDuration;
    }

    start(zoneId, isOverride) {

        this.setSensorState(zoneId, 1);

        this.inUse = true;
        // this.isActive = true;
        this.irrigationService.getCharacteristic(this.Characteristic.InUse).updateValue(1);
        // this.irrigationService.getCharacteristic(this.Characteristic.Active).updateValue(1);

        this.programMode = isOverride ? 2 : 1;
        this.irrigationService.getCharacteristic(this.Characteristic.ProgramMode).updateValue(this.programMode);
    }

    stop(zoneId) {

        this.setSensorState(zoneId, 0);

        // if there are valves still running -> just return
        for (const valve of this.Valves) {
            if (valve.isActive) {
                return;
            }
        }

        this.inUse = false;
        // this.isActive = false;
        this.irrigationService.getCharacteristic(this.Characteristic.InUse).updateValue(0);
        // this.irrigationService.getCharacteristic(this.Characteristic.Active).updateValue(0);

        this.programMode = 1;
        this.irrigationService.getCharacteristic(this.Characteristic.ProgramMode).updateValue(this.programMode);
    }

    setSensorState(zoneId, state) {
        for (const sensor of this.Sensors) {
            if (sensor.accessory.context.id === zoneId) {
                sensor.setState(state);
                return;
            }
        }
    }
}

exports.IrrigationSystem = IrrigationSystem;
