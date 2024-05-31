/**
 * sensor.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const packageJson = require("../../package.json");

class Sensor {

    constructor(platform, accessory, zone) {

        this.platform = platform;
        this.accessory = accessory;

        this.log = this.platform.log;
        this.config = this.platform.config;
        this.api = this.platform.api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.state = false;


        // accessory information

        this.accessory.getService(this.Service.AccessoryInformation)
            .setCharacteristic(this.Characteristic.Manufacturer, packageJson.author)
            .setCharacteristic(this.Characteristic.Model, packageJson.displayName)
            .setCharacteristic(this.Characteristic.SerialNumber, this.accessory.UUID.slice(24, 36))
            .setCharacteristic(this.Characteristic.FirmwareRevision, packageJson.version);


        // sensor service

        this.sensorService = this.accessory.getService(zone.name) || this.accessory.addService(this.Service.ContactSensor, zone.name, zone.id);

        this.sensorService.getCharacteristic(this.Characteristic.ContactSensorState)
            .onGet(this.getState.bind(this));


        // set initial state

        this.setState(0);
    }

    async getState() {
        return this.state ? 1 : 0;
    }

    async setState(value) {
        this.state = (value === 1);
        this.sensorService.getCharacteristic(this.Characteristic.ContactSensorState).updateValue(value);
    }
}

exports.Sensor = Sensor;
