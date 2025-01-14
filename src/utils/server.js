/**
 * server.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const express = require("express");
const cookie = require("cookie");
const path = require("node:path");
const jwt = require("./jwt");

class Server {

    constructor(platform, zones) {

        this.platform = platform;
        this.zones = zones;

        this.log = this.platform.log;
        this.config = this.platform.config;
        // this.api = this.platform.api;

        this.app = express();

        const root = path.join(__dirname, "..", "www");

        this.app.use(express.static(root));
        this.app.use(express.json());
        this.app.use("/api", this.verifyAccess.bind(this));

        this.app.get("/api", (req, res) => {
            switch(req.query["q"]) {
            case "forecast":
                this.getForecast(res);
                break;
            case "zones":
                this.getZones(res);
                break;
            default:
                res.sendStatus(400);
            }
        });

        this.app.post("/api", async (req, res) => {
            switch(req.query["q"]) {
            case "zones":
                this.setZones(req, res);
                break;
            case "override":
                this.overrideZoneSchedule(req, res);
                break;
            default:
                res.sendStatus(400);
            }
        });

        const port = this.config.serverPort || 8080;
        this.app.listen(port, () => {
            this.log.debug("[Web UI] Server running on port " + port);
        });
    }

    async getForecast(res) {
        const forecast = await this.platform.OpenMeteo.getForecast();
        res.send({ forecast: forecast });
    }

    async getZones(res) {
        const zones = [];
        for (const zone of this.zones) {
            const data = zone.serialize();
            zones.push(JSON.parse(data));
        }
        res.send({ zones: zones });
    }

    async setZones(req, res) {
        if (!Array.isArray(req.body)) {
            return res.sendStatus(400);
        }
        for (const obj of req.body) {
            if (typeof obj !== "object" || Array.isArray(obj) || obj === null) {
                return res.sendStatus(400);
            }
            const zone = this.zones.find(({ id }) => id === obj.id);
            if (zone) {
                const ignore = ["id", "name", "sensor", "start", "duration", "isRunning"];
                zone.updateSettings(zone, obj, ignore);
                await zone.saveSettings();
                await zone.updateSchedule();
            }
        }
        res.sendStatus(200);
    }

    async overrideZoneSchedule(req, res) {
        const obj = req.body;
        if (typeof obj !== "object" || Array.isArray(obj) || obj === null) {
            return res.sendStatus(400);
        }
        const zone = this.zones.find(({ id }) => id === obj.zoneId);
        if (zone) {
            switch(obj.schedule) {
            case "CANCEL":
                await zone.cancel();
                break;
            case "SKIP":
                await zone.skip();
                break;
            case "RUN":
                await zone.run();
                break;
            default:
                return res.sendStatus(400);
            }
        }
        res.sendStatus(200);
    }

    async verifyAccess(req, res, next) {

        try {
            const target  = req.get("Host");
            const referer = new URL(req.get("Referer")).host;
            if (!target || !referer || target !== referer) {
                return res.sendStatus(400);
            }
        } catch(error) {
            return res.status(500).send(error.message || error);
        }

        if (!req.xhr) {
            return res.sendStatus(400);
        }

        if (req.method === "POST" && req.is("application/json") !== "application/json") {
            return res.sendStatus(400);
        }

        const query = req.query["q"];

        if (!query) {
            return res.sendStatus(400);
        }

        if (query === "login" && req.method === "POST") {
            return await this.handleLogin(req, res);
        }

        const authHeader = req.get("Authorization");
        const authToken = authHeader && authHeader.split(" ")[1];

        if (!authToken) {
            res.clearCookie("RefreshToken", { httpOnly: true });
            return res.sendStatus(401);
        }

        const isAuthorized = await jwt.verify(authToken);
        if (!isAuthorized) {
            res.clearCookie("RefreshToken", { httpOnly: true });
            return res.sendStatus(401);
        }

        next();
    }

    async handleLogin(req, res) {

        const password = this.config.serverPassword;

        if (password && !req.body.pass) {
            return await this.handleRefresh(req, res);
        }

        if (password && req.body.pass !== password) {
            this.log.warn("[Web UI] Failed login attempt");
            return res.sendStatus(401);
        }

        const authToken    = await jwt.create();
        const refreshToken = await jwt.create({ aud: "refresh" });

        res.cookie("RefreshToken", refreshToken, { maxAge: 300000, httpOnly: true });
        res.send(authToken);
    }

    async handleRefresh(req, res) {

        let token = null;

        try {
            const cookieHeader = req.get("Cookie");
            const cookies = cookieHeader && cookie.parse(cookieHeader);
            token = cookies && cookies.RefreshToken;
        } catch(error) {
            return res.status(500).send(error.message || error);
        }

        if (!token) {
            return res.sendStatus(401);
        }

        const isAuthorized = await jwt.verify(token, true);
        if (!isAuthorized) {
            res.clearCookie("RefreshToken", { httpOnly: true });
            return res.sendStatus(401);
        }

        const authToken    = await jwt.create();
        const refreshToken = await jwt.create({ aud: "refresh" });

        res.cookie("RefreshToken", refreshToken, { maxAge: 300000, httpOnly: true });
        res.send(authToken);
    }
}

exports.Server = Server;
