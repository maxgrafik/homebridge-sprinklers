/**
 * zone.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const path = require("node:path");
const fsPromises = require("node:fs/promises");

const { Scheduler } = require("../utils/scheduler");

class Zone {

    constructor(id, config, platform) {

        this.id = id;
        this.name = config.zoneName;
        this.sensor = config.exposeSensor;
        this.enabled = true;
        this.configured = false;
        this.isRunning = false;

        this.characteristics = {
            Kc: 1,       // Crop coefficient
            Zr: 1.0,     // Crop rooting depth (m)
            TAW: 110,    // Total available water (mm/m)
            MAD: 0.5,    // Management allowable depletion (%)
            Dr: 0,       // Current root zone depletion (mm)
            Dr_date: "", // Last 'Dr' update (ISO Date)
            I: 0,        // Current net irrigation depth (mm)
        };

        this.irrigation = {
            area: 1,          // m^2
            emitterCount: 1,  //
            flowRate: 1,      // L/h
            efficiency: 0.75, // %
            cycles: 2,        //
            soakTime: 300,    // seconds
        };

        this.schedule = {
            adaptive: true,
            start: null,            // timestamp
            duration: null,         // seconds
            sunriseOffset: 0,       // seconds before/after sunrise an irrigation run should finish
            minimumDuration: 60,    // seconds
            defaultDuration: 1800,  // seconds
            weekdays: [0,1,2,3,4,5,6],
        };


        // Props excluded when serializing

        this._platform = platform;

        this._jobs = new Scheduler();

        this._onStart = null;
        this._onStop  = null;
    }

    async updateSchedule() {

        const today = new Date().toISOString().slice(0, 10);

        // Cancel current jobs
        this._jobs.cancel();

        if (this.isRunning) {
            if (this._onStop && typeof this._onStop === "function") {
                await this._onStop();
            }
            this.isRunning = false;
        }

        // Get weather
        const forecast = await this._platform.OpenMeteo.getForecast();

        // Network down? Try again in 5 minutes
        if (forecast === null || !forecast.daily) {
            setTimeout(() => {
                this.updateSchedule();
            }, (5 * 60 * 1000));
            return;
        }

        // Set a date on very first run
        if (!this.characteristics.Dr_date) {
            this.characteristics.Dr_date = today;
        }

        // Update root zone depletion, if start of day
        if (this.characteristics.Dr_date < today) {
            this.updateRootZoneDepletion(forecast);
            this.characteristics.Dr_date = today;
        }

        // Schedule zone
        await this.scheduleNext(forecast);

        // Create jobs
        if (this.schedule.start !== null) {
            await this.scheduleJobs();
        }

        // Schedule next update

        if (this.schedule.start === null) {

            // If no run was scheduled, 'updateSchedule' at sunrise tomorrow

            const sunrise = Date.parse(forecast.daily.sunrise[2]);
            this._jobs.add(sunrise, this.updateSchedule.bind(this));

        } else {

            const nextRun = new Date(this.schedule.start).toISOString().slice(0, 10);
            if (nextRun > today) {

                // If next run is ahead of today, 'updateSchedule' at sunrise tomorrow
                // or 30 minutes before next start (whichever comes first)

                const sunrise = Date.parse(forecast.daily.sunrise[2]);
                const nextUpdate = Math.min(sunrise, this.schedule.start - (30 * 60 * 1000));
                this._jobs.add(nextUpdate, this.updateSchedule.bind(this));

            } else {
                // If scheduled date is today (or before; unlikely),
                // 'updateSchedule' after this run has finished
            }
        }

        this._jobs.run();
    }

    async scheduleNext(forecast) {

        if (!this.configured) { return; }

        if (!this.enabled) {
            if (this.schedule.start !== null || this.schedule.duration !== null) {
                this.schedule.start = null;
                this.schedule.duration = null;
                this.saveSettings();
            }
            return;
        }

        if (this.schedule.adaptive) {
            await this.scheduleAdaptive(forecast);
        } else {
            await this.scheduleNonAdaptive(forecast);
        }

        if (this.schedule.start !== null) {
            const dateStr = new Date(this.schedule.start).toLocaleString();
            const timeStr = Math.round(this.schedule.duration / 60) + " min";
            this._platform.log.debug("[%s] Next scheduled run: %s (%s)", this.name, dateStr, timeStr);
        } else {
            this._platform.log.debug("[%s] No scheduled runs. Checking again tomorrow", this.name);
        }

        this.saveSettings();
    }

    async scheduleAdaptive(forecast) {

        this.schedule.start = null;
        this.schedule.duration = null;

        const TAW = this.characteristics.TAW * this.characteristics.Zr;
        const RAW = Math.min(TAW, TAW * this.characteristics.MAD);

        let Dr = Math.max(0, this.characteristics.Dr - this.characteristics.I);

        const today = new Date().toISOString().slice(0, 10);
        const firstDay = forecast.daily.time.indexOf(today);
        const lastDay  = forecast.daily.time.length - 1;

        for (let day = firstDay; day <= lastDay; day++) {

            // FAO-56 - Reference evapotranspiration (ETo)

            const ETo = forecast.daily.et0_fao_evapotranspiration[day];

            // FAO-56 Chapter 6 - ETc - Single crop coefficient (Kc)

            const ETc = ETo * this.characteristics.Kc;

            // FAO-56 Chapter 8 - Water stress coefficient (Ks)

            const Ks = (Dr > RAW) ? Math.max(0, (TAW - Dr) / (TAW - RAW)) : 1;

            // FAO-56 Chapter 8 - ETc under soil water stress conditions

            const ETc_adj = ETc * Ks;

            // FAO-56 Chapter 8 - Soil water balance
            // Daily precipitation in amounts less than about 0.2 ETo is
            // normally entirely evaporated and can usually be ignored

            let P = forecast.daily.precipitation_sum[day];
            if (P < 0.2 * ETo) { P = 0; }

            // Root zone depletion for this day

            const Dr_day = ETc_adj - P;

            // FAO-56 Chapter 8 - Forecasting or allocating irrigations
            // To avoid crop water stress, irrigations should be applied before or
            // at the moment when the readily available soil water is depleted

            if (Dr + Dr_day > RAW) {

                // Net irrigation depth should be smaller than
                // or equal to the root zone depletion

                const totalWaterRequired = Dr * this.irrigation.area;

                if (totalWaterRequired > 0) {

                    // Irrigation system capacity in L/h

                    const systemCapacity = this.irrigation.emitterCount * this.irrigation.flowRate * this.irrigation.efficiency;

                    // Duration in seconds

                    const duration = Math.round((totalWaterRequired / systemCapacity) * 3600);

                    // Check if duration exceeds 24 hours

                    if (duration >= (24 * 60 * 60)) {
                        this._platform.log.debug("[%s] Error: Runtime exceeds 24 hours", this.name);
                        break;
                    }

                    const timestamp = Date.now();
                    const sunrise = Date.parse(forecast.daily.sunrise[day]);
                    const endTime = sunrise + (this.schedule.sunriseOffset * 1000);
                    const runtime = duration + ((this.irrigation.cycles - 1) * this.irrigation.soakTime);

                    let start = endTime - (runtime * 1000);

                    // In the rare case where the pre-irrigation check results in an earlier start,
                    // but still lies within the 30 minute timeframe, schedule for now + 15sec

                    if (start < timestamp && start > timestamp - (30 * 60 * 1000)) {
                        start = timestamp + (15 * 1000);
                    }

                    if (start > timestamp && (duration / this.irrigation.cycles) > this.schedule.minimumDuration) {
                        this.schedule.start = start;
                        this.schedule.duration = duration;
                        return;
                    }
                }
            }

            // FAO-56 Chapter 8 - Limits on Dr (0 <= Dr <= TAW)

            Dr = Math.min(TAW, Math.max(0, Dr + Dr_day));
        }
    }

    async scheduleNonAdaptive(forecast) {

        this.schedule.start = null;
        this.schedule.duration = null;

        for (let day = 0; day < 7; day++) {

            const sunrise = Date.parse(forecast.daily.sunrise[day]);
            const weekday = new Date(sunrise).getDay();

            if (this.schedule.weekdays.includes(weekday)) {

                const duration = this.schedule.defaultDuration;

                const timestamp = Date.now();
                const endTime = sunrise + (this.schedule.sunriseOffset * 1000);
                const runtime = duration + ((this.irrigation.cycles - 1) * this.irrigation.soakTime);

                const start = endTime - (runtime * 1000);

                if (start > timestamp) {
                    this.schedule.start = start;
                    this.schedule.duration = duration;
                    return;
                }
            }
        }
    }

    async scheduleJobs(overrideStart = null) {

        let cycles      = this.irrigation.cycles;
        let jobStart    = overrideStart || this.schedule.start;
        let jobDuration = Math.round(this.schedule.duration / cycles);

        // Check if cycle duration exceeds HomeKit limit
        if (jobDuration > 3600) {
            cycles = Math.ceil(this.schedule.duration / 3600);
            jobDuration = Math.round(this.schedule.duration / cycles);

            this._platform.log.debug("[%s] Calculated cycle duration exceeds HomeKit limit", this.name);
            this._platform.log.debug("[%s] Temporarily setting cycle count to %s", this.name, cycles);
        }

        for (let cycle = 1; cycle <= cycles; cycle++) {
            this._jobs.add(jobStart, this.start.bind(this, jobDuration, cycle, cycles));
            jobStart += (jobDuration * 1000);
            this._jobs.add(jobStart, this.stop.bind(this, cycles - cycle));
            jobStart += (this.irrigation.soakTime * 1000);
        }
    }

    async start(duration, currentCycle, totalCycles) {

        if (this._onStart && typeof this._onStart === "function") {
            await this._onStart(duration);
        }

        this.isRunning = true;

        if (currentCycle === 1) {
            this._platform.log.info("[%s] Starting scheduled run", this.name);
        }

        const timeStr = Math.round(duration / 60) + " min";
        this._platform.log.info("[%s] Cycle %s of %s (%s)", this.name, currentCycle, totalCycles, timeStr);
    }

    async stop(remainingCycles) {

        if (this._onStop && typeof this._onStop === "function") {
            await this._onStop();
        }

        if (remainingCycles === 0) {
            this.isRunning = false;

            this._platform.log.info("[%s] Scheduled run completed", this.name);

            this.updateSchedule();
        }
    }

    async cancel() {
        if (this.isRunning) {

            this._jobs.cancel();

            if (this._onStop && typeof this._onStop === "function") {
                await this._onStop();
            }

            // scheduled start + 24h - 30min (pre-irrigation check)
            const nextUpdate = this.schedule.start + (24 * 60 * 60 * 1000) - (30 * 60 * 1000);

            this.isRunning = false;
            this.schedule.start = null;
            this.schedule.duration = null;

            this.saveSettings();

            this._jobs.add(nextUpdate, this.updateSchedule.bind(this));
            this._jobs.run();

            this._platform.log.info("[%s] Current run was cancelled", this.name);

            const dateStr = new Date(nextUpdate).toLocaleString();
            this._platform.log.debug("[%s] Next update: %s", this.name, dateStr);
        }
    }

    async skip() {
        if (this.isRunning || this.schedule.start === null) {
            return;
        }

        this._jobs.cancel();

        // scheduled start + 24h - 30min (pre-irrigation check)
        const nextUpdate = this.schedule.start + (24 * 60 * 60 * 1000) - (30 * 60 * 1000);

        this.isRunning = false;
        this.schedule.start = null;
        this.schedule.duration = null;

        this.saveSettings();

        this._jobs.add(nextUpdate, this.updateSchedule.bind(this));
        this._jobs.run();

        this._platform.log.info("[%s] Skipping scheduled run", this.name);

        const dateStr = new Date(nextUpdate).toLocaleString();
        this._platform.log.debug("[%s] Next update: %s", this.name, dateStr);
    }

    async run() {
        if (this.isRunning || this.schedule.start === null) {
            return;
        }

        this._jobs.cancel();
        await this.scheduleJobs(Date.now());
        this._jobs.run();

        this._platform.log.info("[%s] Overriding schedule", this.name);
    }

    async loadSettings() {

        const storagePath = this._platform.api.user.storagePath();
        const filePath = path.join(storagePath, "sprinklers", "zone" + this.id + ".json");

        try {
            const contents = await fsPromises.readFile(filePath, { encoding: "utf8" });
            const settings = JSON.parse(contents);
            this.updateSettings(this, settings, ["id", "name", "sensor", "isRunning"]);
        } catch(error) {
            // this._platform.log.debug(error.message || error);
        }
    }

    async saveSettings() {

        const storagePath = this._platform.api.user.storagePath();
        const filePath = path.join(storagePath, "sprinklers", "zone" + this.id + ".json");

        try {
            await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
            await fsPromises.writeFile(filePath, this.serialize(), { encoding: "utf8" });
        } catch(error) {
            this._platform.log.debug(error.message || error);
        }
    }

    updateSettings(obj, src, ignore = []) {
        for (const key of Object.keys(obj)) {
            if (ignore.includes(key)) { continue; }
            if (typeof obj[key] === "object" && !Array.isArray(obj[key]) && obj[key] !== null) {
                if (Object.hasOwn(src, key)) {
                    this.updateSettings(obj[key], src[key]);
                }
            } else if (Object.hasOwn(src, key)) {
                if (Array.isArray(obj[key])) {
                    obj[key] = src[key].slice();
                } else {
                    obj[key] = src[key];
                }
            }
        }
    }

    updateRootZoneDepletion(forecast) {
        if (!this.schedule.adaptive) {
            this.characteristics.Dr = 0;
            return;
        }

        const Dr = this.characteristics.Dr;
        const I  = this.characteristics.I;

        const TAW = this.characteristics.TAW * this.characteristics.Zr;
        const RAW = Math.min(TAW, TAW * this.characteristics.MAD);

        const ETo = forecast.daily.et0_fao_evapotranspiration[0];
        const ETc = ETo * this.characteristics.Kc;

        const Ks = (Dr > RAW) ? Math.max(0, (TAW - Dr) / (TAW - RAW)) : 1;
        const ETc_adj = ETc * Ks;

        let P = forecast.daily.precipitation_sum[0];
        if (P < 0.2 * ETo) { P = 0; }

        // FAO-56 Chapter 8 - Soil water balance
        // Simplified equation 85 without factors for
        // runoff, capillary rise and deep percolation
        //
        // Dr(i) = Dr(i-1) - P(i) - I(i) + ETc(i)

        this.characteristics.Dr = Math.round((Dr - P - I + ETc_adj) * 100) / 100;

        // FAO-56 Chapter 8 - Limits on Dr (0 <= Dr <= TAW)

        this.characteristics.Dr = Math.min(TAW, Math.max(0, this.characteristics.Dr));

        // Reset net irrigation depth

        this.characteristics.I = 0;
    }

    updateNetIrrigationDepth(irrigationDuration) {

        if (!this.schedule.adaptive) {
            return;
        }

        const appliedWaterPerHour = this.irrigation.emitterCount * this.irrigation.flowRate * this.irrigation.efficiency;
        const appliedWaterTotal = (appliedWaterPerHour / 3600) * irrigationDuration;
        const appliedWaterPerSquareMeter = appliedWaterTotal / this.irrigation.area;

        this.characteristics.I += (Math.round(appliedWaterPerSquareMeter * 100) / 100);
    }

    serialize() {
        const replacer = (key, value) => {
            if (key.startsWith("_")) { return undefined; }
            return value;
        };
        return JSON.stringify(this, replacer, 4);
    }
}

exports.Zone = Zone;
