/**
 * valve.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

class Valve {

    constructor(irrigationSystem, zone) {

        this.zone = zone;
        this.zone._onStart = this.start.bind(this);
        this.zone._onStop  = this.stop.bind(this);

        this.irrigationSystem = irrigationSystem;

        this.platform = irrigationSystem.platform;
        this.accessory = irrigationSystem.accessory;

        this.api = this.platform.api;
        this.log = this.platform.log;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.isActive = false;
        this.isOverride = false;

        this.duration = this.zone.schedule.defaultDuration;
        this.timestamp = 0;
        this.timer = null;


        // valve service

        this.valveService = this.accessory.getService(zone.name) || this.accessory.addService(this.Service.Valve, zone.name, zone.id);

        this.valveService
            .setCharacteristic(this.Characteristic.ServiceLabelIndex, zone.id)
            .setCharacteristic(this.Characteristic.Name, zone.name)
            .setCharacteristic(this.Characteristic.ValveType, 1); // irrigation

        this.valveService.getCharacteristic(this.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        this.valveService.getCharacteristic(this.Characteristic.InUse)
            .onGet(this.getInUse.bind(this));

        this.valveService.getCharacteristic(this.Characteristic.RemainingDuration)
            .onGet(this.getRemainingDuration.bind(this));

        this.valveService.getCharacteristic(this.Characteristic.SetDuration)
            .onGet(this.getDuration.bind(this))
            .onSet(this.setDuration.bind(this));
    }

    async getActive() {
        return this.isActive ? 1 : 0;
    }

    async setActive(value) {
        value === 1 ? this.start(null) : this.stop();
    }

    async getInUse() {
        return this.isActive ? 1 : 0;
    }

    async getRemainingDuration() {
        const timeLeft = (this.timestamp + this.duration) - (Date.now() / 1000);
        if (timeLeft > 0) {
            return Math.floor(timeLeft);
        } else {
            return 0;
        }
    }

    async getDuration() {
        return this.zone.schedule.defaultDuration;
    }

    async setDuration(value) {
        this.zone.schedule.defaultDuration = value;
        if (this.zone.schedule.adaptive) {
            this.zone.saveSettings();
        } else {
            this.zone.updateSchedule();
        }
    }

    async start(duration) {

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        this.duration = duration || this.zone.schedule.defaultDuration;

        this.timestamp = Date.now() / 1000;

        this.isActive = true;
        this.valveService.getCharacteristic(this.Characteristic.InUse).updateValue(1);
        this.valveService.getCharacteristic(this.Characteristic.Active).updateValue(1);
        this.valveService.getCharacteristic(this.Characteristic.RemainingDuration).updateValue(this.duration);

        if (duration && duration > 0) {
            this.isOverride = false;
        } else {
            this.isOverride = true;
        }

        // only use timer, if this is a manual run (isOverride == true)
        // scheduled runs are started/stopped in zone.js

        if (this.isOverride) {
            this.timer = setTimeout(() => {
                this.stop();
            }, this.duration * 1000);
        }

        this.irrigationSystem.start(this.zone.id, this.isOverride);

        const timeStr = Math.round(this.duration / 60) + " min";

        if (this.isOverride) {
            this.log.debug("[%s] Starting manual watering (%s)", this.zone.name, timeStr);
        } else {
            this.log.debug("[%s] Starting scheduled run (%s)", this.zone.name, timeStr);
        }
    }

    async stop() {

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const totalRuntime = (Date.now() / 1000) - this.timestamp;

        this.duration = this.zone.schedule.defaultDuration;
        this.timestamp = 0;

        this.isActive = false;
        this.valveService.getCharacteristic(this.Characteristic.InUse).updateValue(0);
        this.valveService.getCharacteristic(this.Characteristic.Active).updateValue(0);
        this.valveService.getCharacteristic(this.Characteristic.RemainingDuration).updateValue(0);

        this.irrigationSystem.stop(this.zone.id);

        if (this.zone.schedule.adaptive) {
            this.zone.updateNetIrrigationDepth(totalRuntime);
            if (this.isOverride) {
                this.zone.updateSchedule();
            } else {
                this.zone.saveSettings();
            }
        }

        this.log.debug("[%s] Done", this.zone.name);
    }
}

exports.Valve = Valve;
