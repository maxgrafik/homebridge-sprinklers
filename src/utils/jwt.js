/**
 * jwt.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const crypto = require("node:crypto");
// const path = require("node:path");
// const fsPromises = require("node:fs/promises");

let JWTKey = null;

async function create(claims = {}) {
    try {

        const timestamp = Math.round(Date.now() / 1000);
        const expTime   = 5 * 60;

        claims.iss = "Sprinklers";
        claims.iat = timestamp;
        claims.exp = timestamp + expTime;

        let header = JSON.stringify({
            alg: "HS256",
            typ: "JWT"
        });

        let payload = JSON.stringify(claims);

        header  = Buffer.from(header).toString("base64url");
        payload = Buffer.from(payload).toString("base64url");

        const key = await getKey();
        const hmac = crypto.createHmac("sha256", key);
        hmac.update(header + "." + payload);
        const signature = hmac.digest("base64url");

        return header + "." + payload + "." + signature;

    } catch(error) {
        return null;
    }
}

async function verify(token, isRefreshToken = false) {
    try {

        const segments = token.split(".");
        if (segments.length !== 3) {
            return false;
        }

        let header  = segments[0];
        let payload = segments[1];

        const key = await getKey();
        const hmac = crypto.createHmac("sha256", key);
        hmac.update(header + "." + payload);
        const signature = hmac.digest("base64url");

        if (signature !== segments[2]) {
            return false;
        }

        header  = Buffer.from(header, "base64url").toString("ascii");
        payload = Buffer.from(payload, "base64url").toString("ascii");

        header = JSON.parse(header);

        if (header.alg !== "HS256" || header.typ !== "JWT") {
            return false;
        }

        payload = JSON.parse(payload);

        if (payload.iss !== "Sprinklers") {
            return false;
        }

        const timestamp = Math.round(Date.now() / 1000);

        if (!payload.iat || payload.iat > timestamp) {
            return false;
        }

        if (!payload.exp || payload.exp < timestamp) {
            return false;
        }

        if (isRefreshToken && (!payload.aud || payload.aud !== "refresh")) {
            return false;
        }

        return true;

    } catch(error) {
        return false;
    }
}

async function getKey() {

    if (JWTKey !== null) {
        return JWTKey;
    }

    try {
        JWTKey = await createKey();
        return JWTKey;
    } catch(error) {
        return null;
    }

    // Any good reason, why we should write the key to disk?

    // const filePath = path.join(__dirname, ".jwtkey");
    //
    // try {
    //     const key = await fsPromises.readFile(filePath, { encoding: "ascii" });
    //     JWTKey = crypto.createSecretKey(key, "base64");
    //     return JWTKey;
    // } catch(error) {
    //     // console.log(error.message || error);
    // }
    //
    // try {
    //     JWTKey = await createKey();
    //     await fsPromises.writeFile(filePath, JWTKey.export().toString("base64"), { encoding: "ascii" });
    //     return JWTKey;
    // } catch(error) {
    //     // console.log(error.message || error);
    // }
    //
    // return null;
}

function createKey() {
    return new Promise((resolve, reject) => {
        crypto.generateKey("hmac", { length: 256 }, (error, key) => {
            if (error) { reject(error); }
            resolve(key);
        });
    });
}

module.exports = {
    create,
    verify,
};
