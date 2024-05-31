/**
 * Web App - auth.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["base64"], function(base64) {
    "use strict";

    let JWT = null;
    let refreshTimer = null;

    function getToken() {
        return JWT;
    }

    function setToken(data) {
        JWT = data;
        startRefreshTimer();
    }

    function clearToken() {
        JWT = null;
        refreshTimer && clearTimeout(refreshTimer);
        window.location.hash = "";
        window.location.reload();
    }

    function isToken(data) {
        if (data) {
            try {
                const arr = data.split(".");
                if (arr.length !== 3) {
                    return false;
                }
                const header = JSON.parse(base64.UrlDecode(arr[0]));
                const payload = JSON.parse(base64.UrlDecode(arr[1]));
                return (header["typ"] === "JWT" && payload["iss"] === "Sprinklers");
            } catch(error) {
                return false;
            }
        } else {
            return false;
        }
    }

    function getPayload() {
        if (JWT) {
            try {
                const arr = JWT.split(".");
                return JSON.parse(base64.UrlDecode(arr[1]));
            } catch(error) {
                return {};
            }
        }
        return {};
    }

    function startRefreshTimer() {
        const payload = getPayload();
        if (payload["exp"]) {
            const expires = new Date(payload["exp"] * 1000);
            const current = Date.now();
            const leeway  = 60 * 1000;
            const remainingTime = (expires - current) - leeway;

            if (remainingTime < 0) {
                clearToken();
                return;
            }

            refreshTimer = setTimeout(function() {
                require(["ajax"], function(ajax) {
                    ajax.login(null, null, clearToken);
                });
            }, remainingTime);
        } else {
            clearToken();
            return;
        }
    }

    return {
        getToken   : getToken,
        setToken   : setToken,
        clearToken : clearToken,
        isToken    : isToken,
    };

});
