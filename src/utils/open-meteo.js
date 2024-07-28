/**
 * open-meteo.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const https = require("node:https");
const path = require("node:path");
const fsPromises = require("node:fs/promises");

class OpenMeteo {

    constructor(log, config, api) {

        this.log = log;
        this.config = config;
        this.api = api;

        this.weatherModel = this.config.weatherModel || "best_match";
        this.longitude = this.config.longitude;
        this.latitude = this.config.latitude;

        this.Forecast = null;
    }

    async getForecast() {

        if (!this.Forecast) {
            await this.loadForecast();
        }

        if (this.Forecast && (Date.now() - this.Forecast.timestamp) < (60 * 60 * 1000)) {
            return this.Forecast;
        }

        try {
            this.Forecast = await this.fetch();
            this.Forecast.timestamp = Date.now();
            this.saveForecast();
            return this.Forecast;
        } catch(error) {
            this.Forecast = null;
            this.log.error(error.message || error);
            return null;
        }
    }

    async loadForecast() {

        const storagePath = this.api.user.storagePath();
        const filePath = path.join(storagePath, "sprinklers", "open-meteo.json");

        try {
            const contents = await fsPromises.readFile(filePath, { encoding: "utf8" });
            this.Forecast = JSON.parse(contents);
        } catch(error) {
            this.Forecast = null;
        }
    }

    async saveForecast() {

        const storagePath = this.api.user.storagePath();
        const filePath = path.join(storagePath, "sprinklers", "open-meteo.json");

        try {
            await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
            await fsPromises.writeFile(filePath, JSON.stringify(this.Forecast, null, 4), { encoding: "utf8" });
        } catch(error) {
            this.log.debug(error.message || error);
        }
    }

    fetch() {
        return new Promise((resolve, reject) => {

            this.log.debug("Fetching data from open-meteo.com...");

            const dailyData = [
                "weather_code",
                "temperature_2m_max",
                // "temperature_2m_min",
                "sunrise",
                // "sunset",
                "precipitation_sum",
                // "precipitation_probability_max",
                "et0_fao_evapotranspiration"
            ];

            const url = "https://api.open-meteo.com/v1/forecast"
                + "?latitude=" + this.latitude
                + "&longitude=" + this.longitude
                + "&daily=" + dailyData.join(",")
                + "&timezone=auto"
                + "&past_days=1"
                + "&models=" + this.weatherModel;

            const request = https.request(url, (response) => {

                let data = "";

                response.on("data", (chunk) => {
                    data = data + chunk.toString();
                });

                response.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch(error) {
                        reject(error);
                    }
                });
            });

            request.on("error", (error) => {
                reject(error);
            });

            request.end();
        });
    }
}

exports.OpenMeteo = OpenMeteo;
